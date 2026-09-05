import { randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import type {
  CertificateGenerator,
  CertificateMailer,
  CertificateRecord,
  ShopifyAdmin,
  ShopifyFulfilledOrder,
} from './types.js';

type CertificateRow = {
  token: string;
  certificate_number: string;
  order_name: string;
  product_title: string;
  brand: string;
  sku: string;
  image_urls: string[];
  authentication_partner: string | null;
  authentication_report_number: string | null;
  issued_at: Date;
  pdf_path: string | null;
  status: 'active' | 'revoked';
  emailed_at: Date | null;
};

function record(row: CertificateRow): CertificateRecord {
  return {
    token: row.token,
    certificateNumber: row.certificate_number,
    orderName: row.order_name,
    productTitle: row.product_title,
    brand: row.brand,
    sku: row.sku,
    imageUrls: row.image_urls,
    authenticationPartner: row.authentication_partner,
    authenticationReportNumber: row.authentication_report_number,
    issuedAt: row.issued_at,
    pdfPath: row.pdf_path,
    status: row.status,
  };
}

function certificateNumber(now: Date): string {
  return `CF-${now.getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export class CertificateService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly shopify: ShopifyAdmin,
    private readonly generator: CertificateGenerator,
    private readonly mailer: CertificateMailer,
    private readonly publicBaseUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async processFulfilledOrder(order: ShopifyFulfilledOrder): Promise<CertificateRecord[]> {
    const orderId = String(order.id);
    const orderGid = order.admin_graphql_api_id ?? `gid://shopify/Order/${orderId}`;
    const orderName = order.name ?? `#${orderId}`;
    const email = order.contact_email ?? order.email ?? null;

    for (const line of order.line_items) {
      const lineItemId = String(line.id);
      const productId = line.product_id == null ? null : String(line.product_id);
      let row = (await this.pool.query<CertificateRow>(
        `SELECT * FROM authenticity_certificates WHERE shopify_order_id=$1 AND line_item_id=$2`,
        [orderId, lineItemId],
      )).rows[0];
      if (!row) {
        const product = productId ? await this.shopify.getProduct(productId) : null;
        const issuedAt = this.now();
        const token = randomUUID();
        const inserted = await this.pool.query<CertificateRow>(`
          INSERT INTO authenticity_certificates (
            token, certificate_number, shopify_order_id, order_name, line_item_id,
            product_id, customer_email, product_title, brand, sku, image_urls,
            authentication_partner, authentication_report_number, issued_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (shopify_order_id, line_item_id) DO NOTHING
          RETURNING *`, [
          token, certificateNumber(issuedAt), orderId, orderName, lineItemId,
          productId, email, product?.title ?? line.title ?? line.name ?? 'Purchased item',
          product?.brand ?? line.vendor ?? '', line.sku ?? '', JSON.stringify(product?.imageUrls ?? []),
          product?.authenticationPartner ?? null, product?.authenticationReportNumber ?? null, issuedAt,
        ]);
        row = inserted.rows[0] ?? (await this.pool.query<CertificateRow>(
          `SELECT * FROM authenticity_certificates WHERE shopify_order_id=$1 AND line_item_id=$2`,
          [orderId, lineItemId],
        )).rows[0];
      }
      if (!row) throw new Error(`Unable to create certificate for line item ${lineItemId}`);
      if (!row.pdf_path) {
        const item = record(row);
        const pdfPath = await this.generator.render({
          ...item,
          verificationUrl: `${this.publicBaseUrl}/certificates/${item.token}`,
        });
        await this.pool.query(`UPDATE authenticity_certificates SET pdf_path=$2 WHERE token=$1`, [row.token, pdfPath]);
      }
    }

    const result = await this.pool.query<CertificateRow>(
      `SELECT * FROM authenticity_certificates WHERE shopify_order_id=$1 ORDER BY created_at`,
      [orderId],
    );
    const certificates = result.rows.map(record);
    await this.shopify.setOrderCertificates(orderGid, certificates, this.publicBaseUrl);

    if (email && result.rows.some(row => !row.emailed_at)) {
      await this.mailer.sendCertificateEmail({
        email,
        orderName,
        certificates,
        publicBaseUrl: this.publicBaseUrl,
        idempotencyKey: `certificate-order-${orderId}`,
      });
      await this.pool.query(
        `UPDATE authenticity_certificates SET emailed_at=$2 WHERE shopify_order_id=$1`,
        [orderId, this.now()],
      );
    }
    return certificates;
  }
}

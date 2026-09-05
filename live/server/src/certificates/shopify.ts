import type { CertificateRecord, ProductSnapshot, ShopifyAdmin } from './types.js';

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export class ShopifyAdminClient implements ShopifyAdmin {
  private readonly endpoint: string;

  constructor(storeDomain: string, private readonly accessToken: string, apiVersion = '2026-07') {
    const domain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.endpoint = `https://${domain}/admin/api/${apiVersion}/graphql.json`;
  }

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Shopify Admin API returned ${response.status}`);
    const body = await response.json() as GraphQlResponse<T>;
    if (body.errors?.length) throw new Error(`Shopify Admin API: ${body.errors.map(e => e.message).join('; ')}`);
    if (!body.data) throw new Error('Shopify Admin API returned no data');
    return body.data;
  }

  async getProduct(productId: string): Promise<ProductSnapshot | null> {
    const id = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
    const data = await this.query<{
      product: null | {
        title: string;
        vendor: string;
        images: { nodes: Array<{ url: string }> };
        partner: null | { value: string };
        reportNumber: null | { value: string };
      };
    }>(`query CertificateProduct($id: ID!) {
      product(id: $id) {
        title
        vendor
        images(first: 3) { nodes { url } }
        partner: metafield(namespace: "custom", key: "authentication_partner") { value }
        reportNumber: metafield(namespace: "custom", key: "authentication_report_number") { value }
      }
    }`, { id });
    if (!data.product) return null;
    return {
      title: data.product.title,
      brand: data.product.vendor,
      imageUrls: data.product.images.nodes.map(image => image.url),
      authenticationPartner: data.product.partner?.value ?? null,
      authenticationReportNumber: data.product.reportNumber?.value ?? null,
    };
  }

  async setOrderCertificates(
    orderGid: string,
    certificates: CertificateRecord[],
    publicBaseUrl: string,
  ): Promise<void> {
    const value = JSON.stringify(certificates.map(certificate => ({
      number: certificate.certificateNumber,
      status: certificate.status,
      productTitle: certificate.productTitle,
      url: `${publicBaseUrl}/certificates/${certificate.token}`,
      pdfUrl: `${publicBaseUrl}/certificates/${certificate.token}.pdf`,
    })));
    const data = await this.query<{
      metafieldsSet: { userErrors: Array<{ field: string[] | null; message: string }> };
    }>(`mutation SetOrderCertificates($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`, {
      metafields: [{
        ownerId: orderGid,
        namespace: 'custom',
        key: 'authenticity_certificates',
        type: 'json',
        value,
      }],
    });
    const errors = data.metafieldsSet.userErrors;
    if (errors.length) throw new Error(`Unable to save order certificate metafield: ${errors.map(e => e.message).join('; ')}`);
  }
}

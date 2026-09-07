import type { CertificateRecord, ProductSnapshot, ShopifyAdmin } from './types.js';

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export class ShopifyAdminClient implements ShopifyAdmin {
  private readonly endpoint: string;
  private readonly tokenEndpoint: string;
  private cachedToken: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(storeDomain: string, private readonly accessToken: string | { clientId: string; clientSecret: string }, apiVersion = '2026-07') {
    const domain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.endpoint = `https://${domain}/admin/api/${apiVersion}/graphql.json`;
    this.tokenEndpoint = `https://${domain}/admin/oauth/access_token`;
  }

  private async getAccessToken(): Promise<string> {
    if (typeof this.accessToken === 'string') return this.accessToken;
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) return this.cachedToken.value;
    if (this.pendingToken) return this.pendingToken;
    const credentials = this.accessToken;
    this.pendingToken = (async () => {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.clientId, client_secret: credentials.clientSecret }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Shopify token exchange returned ${response.status}`);
      const body = await response.json() as { access_token?: string; expires_in?: number };
      if (!body.access_token || !body.expires_in || body.expires_in <= 0) throw new Error('Invalid Shopify token response');
      this.cachedToken = { value: body.access_token, expiresAt: Date.now() + Math.max(0, body.expires_in - 60) * 1000 };
      return body.access_token;
    })();
    try { return await this.pendingToken; }
    finally { this.pendingToken = null; }
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': await this.getAccessToken(),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Shopify Admin API returned ${response.status}`);
    const body = await response.json() as GraphQlResponse<T>;
    if (body.errors?.length) throw new Error(`Shopify Admin API: ${body.errors.map(e => e.message).join('; ')}`);
    if (!body.data) throw new Error('Shopify Admin API returned no data');
    return body.data;
  }

  async getProduct(productId: string): Promise<ProductSnapshot | null> {
    const id = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
    const images: string[] = [];
    let cursor: string | null = null;
    let snapshot: ProductSnapshot | null = null;
    do {
      const data: {
        product: null | {
          title: string;
          vendor: string;
          images: { nodes: Array<{ url: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
          partner: null | { value: string };
          reportNumber: null | { value: string };
        };
      } = await this.query(`query CertificateProduct($id: ID!, $cursor: String) {
        product(id: $id) {
          title
          vendor
          images(first: 250, after: $cursor) { nodes { url } pageInfo { hasNextPage endCursor } }
          partner: metafield(namespace: "custom", key: "authentication_partner") { value }
          reportNumber: metafield(namespace: "custom", key: "authentication_report_number") { value }
        }
      }`, { id, cursor });
      if (!data.product) return null;
      images.push(...data.product.images.nodes.map(image => image.url));
      snapshot = {
        title: data.product.title,
        brand: data.product.vendor,
        // Keep the main product photo plus the final listing photos (tags/labels).
        // Short galleries overlap, so avoid repeating the same image.
        imageUrls: [...new Set([...images.slice(0, 1), ...images.slice(-2)])],
        authenticationPartner: data.product.partner?.value ?? null,
        authenticationReportNumber: data.product.reportNumber?.value ?? null,
      };
      const page = data.product.images.pageInfo;
      if (page.hasNextPage && (!page.endCursor || page.endCursor === cursor)) {
        throw new Error('Shopify image pagination did not advance');
      }
      cursor = page.hasNextPage ? page.endCursor : null;
    } while (cursor);
    return snapshot;
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

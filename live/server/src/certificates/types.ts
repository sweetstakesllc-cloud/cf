export type ShopifyOrderLine = {
  id: string | number;
  product_id?: string | number | null;
  title?: string;
  name?: string;
  vendor?: string | null;
  sku?: string | null;
  quantity?: number;
};

export type ShopifyFulfilledOrder = {
  id: string | number;
  admin_graphql_api_id?: string;
  name?: string;
  email?: string | null;
  contact_email?: string | null;
  line_items: ShopifyOrderLine[];
};

export type ProductSnapshot = {
  title: string;
  brand: string;
  imageUrls: string[];
  authenticationPartner: string | null;
  authenticationReportNumber: string | null;
};

export type CertificateRecord = {
  token: string;
  certificateNumber: string;
  orderName: string;
  productTitle: string;
  brand: string;
  sku: string;
  imageUrls: string[];
  authenticationPartner: string | null;
  authenticationReportNumber: string | null;
  issuedAt: Date;
  pdfPath: string | null;
  status: 'active' | 'revoked';
};

export type CertificateRenderInput = Omit<CertificateRecord, 'pdfPath' | 'status'> & {
  verificationUrl: string;
};

export interface CertificateGenerator {
  render(input: CertificateRenderInput): Promise<string>;
}

export interface CertificateMailer {
  sendCertificateEmail(input: {
    email: string;
    orderName: string;
    certificates: CertificateRecord[];
    publicBaseUrl: string;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface ShopifyAdmin {
  getProduct(productId: string): Promise<ProductSnapshot | null>;
  setOrderCertificates(orderGid: string, certificates: CertificateRecord[], publicBaseUrl: string): Promise<void>;
}

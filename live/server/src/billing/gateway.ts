export type WebhookEvent =
  | { type: 'setup_succeeded'; gatewayCustomerId: string; paymentMethodId: string }
  | { type: 'ignored' };

export interface PaymentGateway {
  ensureCustomer(email: string): Promise<string>;
  createSetupIntent(gatewayCustomerId: string): Promise<{ clientSecret: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent;
}

export class FakePaymentGateway implements PaymentGateway {
  customers = new Map<string, string>(); // email → id
  setupIntents: string[] = [];
  webhookEvents: WebhookEvent[] = [];
  private n = 0;

  async ensureCustomer(email: string): Promise<string> {
    const existing = this.customers.get(email);
    if (existing) return existing;
    const id = `cus_fake_${++this.n}`;
    this.customers.set(email, id);
    return id;
  }

  async createSetupIntent(gatewayCustomerId: string): Promise<{ clientSecret: string }> {
    this.setupIntents.push(gatewayCustomerId);
    return { clientSecret: `seti_fake_${++this.n}_${gatewayCustomerId}` };
  }

  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent {
    if (signature !== 'fake-valid-signature') throw new Error('bad signature');
    return JSON.parse(rawBody.toString()) as WebhookEvent;
  }
}

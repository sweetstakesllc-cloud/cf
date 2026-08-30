export type WebhookEvent =
  | { type: 'setup_succeeded'; gatewayCustomerId: string; paymentMethodId: string }
  | { type: 'ignored' };

export type ChargeResult =
  | { status: 'succeeded'; paymentIntentId: string }
  | { status: 'failed'; failureReason: string };

export interface PaymentGateway {
  ensureCustomer(email: string): Promise<string>;
  createSetupIntent(gatewayCustomerId: string): Promise<{ clientSecret: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent;
  chargeSavedCard(input: {
    gatewayCustomerId: string;
    paymentMethodId: string;
    amountOre: number;
    description: string;
    idempotencyKey: string;
  }): Promise<ChargeResult>;
}

export class FakePaymentGateway implements PaymentGateway {
  customers = new Map<string, string>(); // email → id
  setupIntents: string[] = [];
  webhookEvents: WebhookEvent[] = [];
  charges: Array<{ gatewayCustomerId: string; paymentMethodId: string; amountOre: number; description: string; idempotencyKey: string }> = [];
  failNextCharge = false;
  private n = 0;
  private chargeResults = new Map<string, ChargeResult>();

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

  async chargeSavedCard(input: {
    gatewayCustomerId: string;
    paymentMethodId: string;
    amountOre: number;
    description: string;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    const seen = this.chargeResults.get(input.idempotencyKey);
    if (seen) return seen;
    let result: ChargeResult;
    if (this.failNextCharge) {
      this.failNextCharge = false;
      result = { status: 'failed', failureReason: 'card_declined' };
    } else {
      this.charges.push({ ...input });
      result = { status: 'succeeded', paymentIntentId: `pi_fake_${this.charges.length}` };
    }
    this.chargeResults.set(input.idempotencyKey, result);
    return result;
  }
}

import Stripe from 'stripe';
import type { PaymentGateway, WebhookEvent, ChargeResult } from './gateway.js';

export class StripeGateway implements PaymentGateway {
  private stripe: Stripe;
  constructor(secretKey: string, private webhookSecret: string) {
    this.stripe = new Stripe(secretKey);
  }

  async ensureCustomer(email: string): Promise<string> {
    const existing = await this.stripe.customers.list({ email, limit: 1 });
    if (existing.data[0]) return existing.data[0].id;
    const created = await this.stripe.customers.create({ email });
    return created.id;
  }

  async createSetupIntent(gatewayCustomerId: string): Promise<{ clientSecret: string }> {
    const si = await this.stripe.setupIntents.create({
      customer: gatewayCustomerId,
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
    });
    return { clientSecret: si.client_secret! };
  }

  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    if (event.type === 'setup_intent.succeeded') {
      const si = event.data.object as Stripe.SetupIntent;
      return {
        type: 'setup_succeeded',
        gatewayCustomerId: typeof si.customer === 'string' ? si.customer : si.customer!.id,
        paymentMethodId: typeof si.payment_method === 'string' ? si.payment_method : si.payment_method!.id,
      };
    }
    return { type: 'ignored' };
  }

  async chargeSavedCard(input: {
    gatewayCustomerId: string;
    paymentMethodId: string;
    amountOre: number;
    description: string;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    try {
      const pi = await this.stripe.paymentIntents.create(
        {
          amount: input.amountOre,
          currency: 'sek',
          customer: input.gatewayCustomerId,
          payment_method: input.paymentMethodId,
          off_session: true,
          confirm: true,
          description: input.description,
        },
        { idempotencyKey: input.idempotencyKey }
      );
      return { status: 'succeeded', paymentIntentId: pi.id };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        return { status: 'failed', failureReason: err.code ?? 'card_declined' };
      }
      throw err;
    }
  }
}

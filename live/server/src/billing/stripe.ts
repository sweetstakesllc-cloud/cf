import Stripe from 'stripe';
import type { PaymentGateway, WebhookEvent } from './gateway.js';

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
}

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { PaymentGateway } from './gateway.js';

export function registerBilling(app: FastifyInstance, pool: pg.Pool, gateway: PaymentGateway): void {
  app.post('/billing/setup-intent', { preHandler: app.requireAuth }, async (request) => {
    const { customerId, email } = request.customer!;
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM customers WHERE id=$1`, [customerId]);
    let gatewayCustomerId: string | null = rows[0]?.stripe_customer_id ?? null;
    if (!gatewayCustomerId) {
      gatewayCustomerId = await gateway.ensureCustomer(email);
      await pool.query(`UPDATE customers SET stripe_customer_id=$2 WHERE id=$1`, [customerId, gatewayCustomerId]);
    }
    return gateway.createSetupIntent(gatewayCustomerId);
  });

  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });

    scope.post('/webhooks/stripe', async (request, reply) => {
      const signature = request.headers['stripe-signature'];
      if (typeof signature !== 'string') return reply.code(400).send({ error: 'missing_signature' });
      let event;
      try {
        event = gateway.verifyWebhook(request.body as Buffer, signature);
      } catch {
        return reply.code(400).send({ error: 'bad_signature' });
      }
      if (event.type === 'setup_succeeded') {
        await pool.query(
          `UPDATE customers SET default_payment_method_id=$2, bid_ready=true WHERE stripe_customer_id=$1`,
          [event.gatewayCustomerId, event.paymentMethodId],
        );
      }
      return { received: true };
    });
  });
}

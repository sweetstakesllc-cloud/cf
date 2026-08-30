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
}

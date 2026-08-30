import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { buildApp } from './app.js';
import { ConsoleMailer } from './mailer.js';
import { FakePaymentGateway, type PaymentGateway } from './billing/gateway.js';
import { StripeGateway } from './billing/stripe.js';
import { runMigrations } from '../scripts/migrate.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
await runMigrations(pool);

const gateway: PaymentGateway =
  config.stripeSecretKey && config.stripeWebhookSecret
    ? new StripeGateway(config.stripeSecretKey, config.stripeWebhookSecret)
    : new FakePaymentGateway();
if (gateway instanceof FakePaymentGateway && config.env === 'production') {
  throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required in production');
}

const mailer = new ConsoleMailer();
if (config.env === 'production') {
  throw new Error('A real Mailer is required in production (ConsoleMailer prints OTP codes to stdout)');
}

const app = buildApp({ config, pool, mailer, gateway });
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`cf-live-server on :${config.port} (stripe: ${gateway instanceof StripeGateway ? 'live' : 'fake'})`);

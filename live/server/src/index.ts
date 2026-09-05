import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { buildApp } from './app.js';
import { ConsoleMailer, ResendOtpMailer } from './mailer.js';
import { FakePaymentGateway, type PaymentGateway } from './billing/gateway.js';
import { StripeGateway } from './billing/stripe.js';
import { runMigrations } from '../scripts/migrate.js';
import { settleDueAuctions, getPublicState } from './live/engine.js';
import { ShopifyAdminClient } from './certificates/shopify.js';
import { PythonCertificateGenerator } from './certificates/pdf.js';
import { ConsoleCertificateMailer, ResendCertificateMailer } from './certificates/mailer.js';
import { CertificateService } from './certificates/service.js';
import { processNextCertificateJob } from './certificates/worker.js';

const config = loadConfig();
const isProduction = config.env === 'production';
const certificateConfig = [
  config.shopifyWebhookSecret,
  config.shopifyStoreDomain,
  config.shopifyAdminAccessToken,
  config.publicBaseUrl,
];
const certificateConfigured = certificateConfig.every(Boolean);
if (certificateConfig.some(Boolean) && !certificateConfigured) {
  throw new Error('Certificate automation requires SHOPIFY_WEBHOOK_SECRET, SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN and PUBLIC_BASE_URL');
}
if (isProduction && certificateConfigured && (!config.resendApiKey || !config.certificateFromEmail)) {
  throw new Error('RESEND_API_KEY and CERTIFICATE_FROM_EMAIL are required for certificate emails in production');
}
const pool = createPool(config.databaseUrl);
await runMigrations(pool);

const gateway: PaymentGateway =
  config.stripeSecretKey && config.stripeWebhookSecret
    ? new StripeGateway(config.stripeSecretKey, config.stripeWebhookSecret)
    : new FakePaymentGateway();
if (gateway instanceof FakePaymentGateway && isProduction) {
  throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required in production');
}

const mailer = config.resendApiKey && config.certificateFromEmail
  ? new ResendOtpMailer(config.resendApiKey, config.certificateFromEmail)
  : new ConsoleMailer();
if (isProduction && mailer instanceof ConsoleMailer) {
  throw new Error('A real Mailer is required in production (ConsoleMailer prints OTP codes to stdout)');
}

const app = buildApp({ config, pool, mailer, gateway });
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`cf-live-server on :${config.port} (stripe: ${gateway instanceof StripeGateway ? 'live' : 'fake'})`);

const TICK_MS = 500;
setInterval(async () => {
  try {
    const events = await settleDueAuctions(pool, gateway, () => new Date());
    if (events.length > 0) app.hub.broadcast({ type: 'state', state: await getPublicState(pool) });
  } catch (err) {
    app.log.error(err, 'settle tick failed');
  }
}, TICK_MS);

if (certificateConfigured) {
  const shopify = new ShopifyAdminClient(
    config.shopifyStoreDomain!,
    config.shopifyAdminAccessToken!,
    config.shopifyApiVersion,
  );
  const certificateGenerator = new PythonCertificateGenerator(
    config.certificateStorageDirectory,
    config.certificatePythonBin,
  );
  const certificateMailer = config.resendApiKey && config.certificateFromEmail
    ? new ResendCertificateMailer(config.resendApiKey, config.certificateFromEmail)
    : new ConsoleCertificateMailer();
  const certificateService = new CertificateService(
    pool,
    shopify,
    certificateGenerator,
    certificateMailer,
    config.publicBaseUrl!,
  );
  let certificateWorkerRunning = false;
  setInterval(async () => {
    if (certificateWorkerRunning) return;
    certificateWorkerRunning = true;
    try {
      while (await processNextCertificateJob(pool, certificateService)) { /* drain queued orders */ }
    } catch (error) {
      app.log.error(error, 'certificate worker failed');
    } finally {
      certificateWorkerRunning = false;
    }
  }, 3000);
}

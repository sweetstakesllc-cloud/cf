import Fastify from 'fastify';
import { z } from 'zod';
import { createPool } from '../db.js';
import { runMigrations } from '../../scripts/migrate.js';
import { registerCertificateRoutes } from './routes.js';
import { ShopifyAdminClient } from './shopify.js';
import { PythonCertificateGenerator } from './pdf.js';
import { ResendCertificateMailer } from './mailer.js';
import { CertificateService } from './service.js';
import { processNextCertificateJob } from './worker.js';

// Certificate-only production entry point; no auction, payment, or OTP routes.
const env = z.object({
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1),
  SHOPIFY_STORE_DOMAIN: z.string().regex(/^[a-z0-9-]+\.myshopify\.com$/),
  SHOPIFY_CLIENT_ID: z.string().min(1),
  SHOPIFY_CLIENT_SECRET: z.string().min(1),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().default('2026-07'),
  PUBLIC_BASE_URL: z.string().url().startsWith('https://'),
  CERTIFICATE_STORAGE_DIR: z.string().min(1),
  CERTIFICATE_PYTHON_BIN: z.string().default('python3'),
  RESEND_API_KEY: z.string().min(1),
  CERTIFICATE_FROM_EMAIL: z.string().min(3),
}).parse(process.env);

const pool = createPool(env.DATABASE_URL);
await runMigrations(pool);
const app = Fastify({ logger: true });
registerCertificateRoutes(app, pool, env.SHOPIFY_WEBHOOK_SECRET, env.CERTIFICATE_STORAGE_DIR);
app.get('/health', async () => {
  await pool.query('SELECT 1');
  return { ok: true };
});
const service = new CertificateService(pool,
  new ShopifyAdminClient(env.SHOPIFY_STORE_DOMAIN, {
    clientId: env.SHOPIFY_CLIENT_ID, clientSecret: env.SHOPIFY_CLIENT_SECRET,
  }, env.SHOPIFY_API_VERSION),
  new PythonCertificateGenerator(env.CERTIFICATE_STORAGE_DIR, env.CERTIFICATE_PYTHON_BIN),
  new ResendCertificateMailer(env.RESEND_API_KEY, env.CERTIFICATE_FROM_EMAIL),
  env.PUBLIC_BASE_URL.replace(/\/$/, ''),
);
let stopping = false;
let activeJob: Promise<void> | undefined;
const timer = setInterval(() => {
  if (stopping || activeJob) return;
  activeJob = (async () => {
    try {
      while (!stopping && await processNextCertificateJob(pool, service)) { /* drain */ }
    } catch (error) { app.log.error(error, 'certificate worker failed'); }
  })().finally(() => { activeJob = undefined; });
}, 3000);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    stopping = true;
    clearInterval(timer);
    await app.close();
    await activeJob;
    await pool.end();
  });
}
await app.listen({ host: '0.0.0.0', port: env.PORT });

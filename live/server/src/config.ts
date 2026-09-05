import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  HOST_PASSWORD: z.string().min(12).optional(),
  WIDGET_ORIGINS: z.string().default(''),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1).optional(),
  SHOPIFY_STORE_DOMAIN: z.string().min(1).optional(),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1).optional(),
  SHOPIFY_API_VERSION: z.string().regex(/^\d{4}-\d{2}$/).default('2026-07'),
  PUBLIC_BASE_URL: z.string().url().optional(),
  CERTIFICATE_STORAGE_DIR: z.string().default('./data/certificates'),
  CERTIFICATE_PYTHON_BIN: z.string().default('python'),
  RESEND_API_KEY: z.string().min(1).optional(),
  CERTIFICATE_FROM_EMAIL: z.string().min(3).optional(),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  cookieSecret: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  stripePublishableKey: string | null;
  hostPassword: string | null;
  widgetOrigins: string[];
  shopifyWebhookSecret: string | null;
  shopifyStoreDomain: string | null;
  shopifyAdminAccessToken: string | null;
  shopifyApiVersion: string;
  publicBaseUrl: string | null;
  certificateStorageDirectory: string;
  certificatePythonBin: string;
  resendApiKey: string | null;
  certificateFromEmail: string | null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = schema.parse(env);
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    cookieSecret: e.COOKIE_SECRET,
    stripeSecretKey: e.STRIPE_SECRET_KEY ?? null,
    stripeWebhookSecret: e.STRIPE_WEBHOOK_SECRET ?? null,
    stripePublishableKey: e.STRIPE_PUBLISHABLE_KEY ?? null,
    hostPassword: e.HOST_PASSWORD ?? null,
    widgetOrigins: e.WIDGET_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
    shopifyWebhookSecret: e.SHOPIFY_WEBHOOK_SECRET ?? null,
    shopifyStoreDomain: e.SHOPIFY_STORE_DOMAIN ?? null,
    shopifyAdminAccessToken: e.SHOPIFY_ADMIN_ACCESS_TOKEN ?? null,
    shopifyApiVersion: e.SHOPIFY_API_VERSION,
    publicBaseUrl: e.PUBLIC_BASE_URL?.replace(/\/$/, '') ?? null,
    certificateStorageDirectory: e.CERTIFICATE_STORAGE_DIR,
    certificatePythonBin: e.CERTIFICATE_PYTHON_BIN,
    resendApiKey: e.RESEND_API_KEY ?? null,
    certificateFromEmail: e.CERTIFICATE_FROM_EMAIL ?? null,
  };
}

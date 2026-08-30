import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  HOST_PASSWORD: z.string().min(12).optional(),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  cookieSecret: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  hostPassword: string | null;
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
    hostPassword: e.HOST_PASSWORD ?? null,
  };
}

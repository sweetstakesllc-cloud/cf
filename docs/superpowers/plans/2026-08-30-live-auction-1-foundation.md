# Live Auction Build — Plan 1 of 4: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the live-auction backend skeleton: a Fastify + Postgres service with email-OTP auth, sessions, and Stripe card-on-file ("bid-ready") — everything Plan 2's auction engine plugs into.

**Architecture:** One Node.js/TypeScript app (`live/server`) with all external services behind injected interfaces (`Mailer`, `PaymentGateway`) so every route is testable without network calls. Postgres holds customers, OTP codes, and sessions; migrations are plain SQL files run by a tiny runner. Real Stripe is a thin adapter wired in only at the entrypoint.

**Tech Stack:** Node 22, TypeScript (strict, ESM), Fastify 5, `@fastify/cookie`, `pg`, Vitest, Stripe SDK, Zod, Postgres 16 via Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-30-live-auction-custom-build-design.md`

## Global Constraints

- All work on branch `live-auction`, created from `main` (the `web-mockups` branch is theme work — do not build on it).
- All commands below run from **`live/server/`** unless a path is shown. This package is independent of the repo-root Expo `package.json`.
- Node **>= 22**. TypeScript `"strict": true`, ESM (`"type": "module"`, `"module": "NodeNext"`).
- **Money is always integer öre** (SEK minor units). Never floats, never `kr` decimals, in any table or type.
- Secrets only via environment variables. Nothing secret in git; `.env` is gitignored, `.env.example` is committed.
- OTP codes and session tokens are stored **hashed** (SHA-256). Raw values never touch the database or logs.
- Every task follows TDD: failing test → minimal implementation → pass → commit.
- Postgres for dev/tests runs from `live/server/docker-compose.yml` on port **5433** (avoids clashing with any local 5432). Test database URL default: `postgres://cf:cf@localhost:5433/cf_live`.

## File Structure (end state of this plan)

```
live/server/
  package.json  tsconfig.json  vitest.config.ts  .env.example  .gitignore  README.md
  docker-compose.yml
  migrations/001-foundation.sql
  scripts/migrate.ts          SQL migration runner (also used by tests)
  src/
    config.ts                 zod-validated env → Config
    db.ts                     pg Pool factory
    app.ts                    buildApp(deps) → Fastify instance (no listen)
    index.ts                  entrypoint: real deps, migrate, listen
    mailer.ts                 Mailer interface + ConsoleMailer
    auth/otp.ts               request/verify OTP against DB
    auth/session.ts           create/get/destroy sessions
    auth/routes.ts            /auth/* endpoints + requireAuth decorator
    billing/gateway.ts        PaymentGateway interface + FakePaymentGateway
    billing/stripe.ts         StripeGateway (real adapter, not unit-tested)
    billing/routes.ts         /billing/setup-intent + /webhooks/stripe
  test/
    helpers.ts                test DB setup/truncate + app factory
    app.test.ts  otp.test.ts  auth-routes.test.ts  billing.test.ts
```

---

### Task 1: Package scaffold, config module, health endpoint

**Files:**
- Create: `live/server/package.json`, `live/server/tsconfig.json`, `live/server/vitest.config.ts`, `live/server/.gitignore`, `live/server/src/config.ts`, `live/server/src/app.ts`, `live/server/test/app.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `loadConfig(env: NodeJS.ProcessEnv): Config` where `Config = { env: 'development'|'test'|'production'; port: number; databaseUrl: string; cookieSecret: string; stripeSecretKey: string|null; stripeWebhookSecret: string|null }`
  - `buildApp(deps: Deps): FastifyInstance` — `Deps` starts as `{ config: Config }` and later tasks widen it. **Later tasks add fields to `Deps`; never rename existing ones.**

- [ ] **Step 1: Scaffold the package**

```bash
mkdir -p live/server/src live/server/test
cd live/server
npm init -y
npm install fastify @fastify/cookie zod pg stripe
npm install -D typescript vitest @types/node @types/pg tsx
```

Then replace `package.json` scripts and set module type (edit the generated file):

```json
{
  "name": "cf-live-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "tsc": "tsc --noEmit",
    "migrate": "tsx scripts/migrate.ts"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "test", "scripts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', fileParallelism: false } });
```

(`fileParallelism: false` because test files share one Postgres database.)

`.gitignore`:

```
node_modules/
dist/
.env
```

- [ ] **Step 2: Write the failing test**

`test/app.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
  COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
};

describe('config', () => {
  it('loads and applies defaults', () => {
    const c = loadConfig(baseEnv);
    expect(c.port).toBe(3001);
    expect(c.env).toBe('test');
    expect(c.stripeSecretKey).toBeNull();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: undefined })).toThrow();
  });
});

describe('healthz', () => {
  it('responds ok', async () => {
    const app = buildApp({ config: loadConfig(baseEnv) });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../src/config.js` / `../src/app.js`.

- [ ] **Step 4: Implement config and app**

`src/config.ts`:

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  cookieSecret: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
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
  };
}
```

`src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Config } from './config.js';

export type Deps = {
  config: Config;
};

export function buildApp(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: deps.config.env !== 'test' });
  app.register(cookie, { secret: deps.config.cookieSecret });
  app.get('/healthz', async () => ({ ok: true }));
  return app;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` — Expected: PASS. Also run `npm run tsc` — Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add live/server
git commit -m "feat(live): scaffold auction server with config and healthz"
```

---

### Task 2: Postgres via Docker, migration runner, foundation schema

**Files:**
- Create: `live/server/docker-compose.yml`, `live/server/migrations/001-foundation.sql`, `live/server/scripts/migrate.ts`, `live/server/src/db.ts`, `live/server/test/helpers.ts`
- Test: `live/server/test/db.test.ts`

**Interfaces:**
- Consumes: `Config` from Task 1.
- Produces:
  - `createPool(databaseUrl: string): pg.Pool`
  - `runMigrations(pool: pg.Pool): Promise<string[]>` (returns applied filenames; idempotent)
  - `test/helpers.ts`: `getTestPool(): Promise<pg.Pool>` (migrated, shared per file) and `truncateAll(pool): Promise<void>`
  - Tables: `customers(id uuid pk default gen_random_uuid(), email text unique not null, stripe_customer_id text, default_payment_method_id text, bid_ready boolean not null default false, created_at timestamptz not null default now())`, `otp_codes(id uuid pk default gen_random_uuid(), email text not null, code_hash text not null, expires_at timestamptz not null, attempts int not null default 0, consumed_at timestamptz, created_at timestamptz not null default now())`, `sessions(token_hash text pk, customer_id uuid not null references customers(id), expires_at timestamptz not null, created_at timestamptz not null default now())`

- [ ] **Step 1: Docker Compose for Postgres**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: cf
      POSTGRES_PASSWORD: cf
      POSTGRES_DB: cf_live
    ports:
      - "5433:5432"
```

Run: `docker compose up -d` and wait until `docker compose exec db pg_isready -U cf` prints "accepting connections".

- [ ] **Step 2: Write the failing test**

`test/db.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });

describe('migrations + schema', () => {
  it('creates the foundation tables and enforces email uniqueness', async () => {
    await truncateAll(pool);
    await pool.query(`INSERT INTO customers (email) VALUES ('a@b.se')`);
    await expect(pool.query(`INSERT INTO customers (email) VALUES ('a@b.se')`)).rejects.toThrow();
    const { rows } = await pool.query(`SELECT bid_ready FROM customers WHERE email='a@b.se'`);
    expect(rows[0].bid_ready).toBe(false);
  });

  it('is idempotent — running migrations again applies nothing', async () => {
    const { runMigrations } = await import('../scripts/migrate.js');
    expect(await runMigrations(pool)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- db` — Expected: FAIL (helpers/migrate modules missing).

- [ ] **Step 4: Implement db, migrations, helpers**

`migrations/001-foundation.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  stripe_customer_id text,
  default_payment_method_id text,
  bid_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_email_idx ON otp_codes (email, created_at);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

`scripts/migrate.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  const { rows } = await pool.query(`SELECT filename FROM schema_migrations`);
  const done = new Set(rows.map(r => r.filename));
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { loadConfig } = await import('../src/config.js');
  const { createPool } = await import('../src/db.js');
  const pool = createPool(loadConfig().databaseUrl);
  const applied = await runMigrations(pool);
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'up to date');
  await pool.end();
}
```

`src/db.ts`:

```ts
import pg from 'pg';

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}
```

`test/helpers.ts`:

```ts
import pg from 'pg';
import { createPool } from '../src/db.js';
import { runMigrations } from '../scripts/migrate.js';

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgres://cf:cf@localhost:5433/cf_live';

export async function getTestPool(): Promise<pg.Pool> {
  const pool = createPool(TEST_DB_URL);
  await runMigrations(pool);
  return pool;
}

export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query(`TRUNCATE sessions, otp_codes, customers CASCADE`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` (Docker DB must be up) — Expected: PASS. Run `npm run tsc` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add live/server
git commit -m "feat(live): postgres schema, migration runner, docker compose"
```

---

### Task 3: OTP request/verify core

**Files:**
- Create: `live/server/src/mailer.ts`, `live/server/src/auth/otp.ts`
- Test: `live/server/test/otp.test.ts`

**Interfaces:**
- Consumes: `pg.Pool`, tables from Task 2.
- Produces:
  - `interface Mailer { sendOtp(email: string, code: string): Promise<void> }`; `class ConsoleMailer implements Mailer`
  - `requestOtp(pool, email, mailer, now: () => Date): Promise<{ ok: true } | { ok: false; reason: 'rate_limited' }>` — 6-digit code, 10-min expiry, max 3 active requests per email per 10 minutes.
  - `verifyOtp(pool, email, code, now: () => Date): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }>` — max 5 attempts per code, single-use (`consumed_at`).
  - `hashToken(value: string): string` — SHA-256 hex; exported from `otp.ts` and reused for session tokens in Task 4.

- [ ] **Step 1: Write the failing test**

`test/otp.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { requestOtp, verifyOtp } from '../src/auth/otp.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

function capturingMailer() {
  const sent: { email: string; code: string }[] = [];
  const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };
  return { mailer, sent };
}
const now = () => new Date('2026-08-30T19:00:00Z');

describe('requestOtp', () => {
  it('emails a 6-digit code and stores only its hash', async () => {
    const { mailer, sent } = capturingMailer();
    const res = await requestOtp(pool, 'a@b.se', mailer, now);
    expect(res.ok).toBe(true);
    expect(sent[0]!.code).toMatch(/^\d{6}$/);
    const { rows } = await pool.query(`SELECT code_hash FROM otp_codes WHERE email='a@b.se'`);
    expect(rows[0].code_hash).not.toContain(sent[0]!.code);
  });

  it('rate-limits the 4th request in 10 minutes', async () => {
    const { mailer } = capturingMailer();
    for (let i = 0; i < 3; i++) expect((await requestOtp(pool, 'a@b.se', mailer, now)).ok).toBe(true);
    expect(await requestOtp(pool, 'a@b.se', mailer, now)).toEqual({ ok: false, reason: 'rate_limited' });
  });
});

describe('verifyOtp', () => {
  it('accepts the right code once, then never again', async () => {
    const { mailer, sent } = capturingMailer();
    await requestOtp(pool, 'a@b.se', mailer, now);
    expect(await verifyOtp(pool, 'a@b.se', sent[0]!.code, now)).toEqual({ ok: true });
    expect((await verifyOtp(pool, 'a@b.se', sent[0]!.code, now)).ok).toBe(false);
  });

  it('rejects a wrong code and an expired code', async () => {
    const { mailer, sent } = capturingMailer();
    await requestOtp(pool, 'a@b.se', mailer, now);
    expect(await verifyOtp(pool, 'a@b.se', '000000', now)).toEqual({ ok: false, reason: 'invalid' });
    const later = () => new Date('2026-08-30T19:11:00Z');
    expect(await verifyOtp(pool, 'a@b.se', sent[0]!.code, later)).toEqual({ ok: false, reason: 'expired' });
  });

  it('locks a code after 5 wrong attempts', async () => {
    const { mailer, sent } = capturingMailer();
    await requestOtp(pool, 'a@b.se', mailer, now);
    for (let i = 0; i < 5; i++) await verifyOtp(pool, 'a@b.se', '000000', now);
    expect(await verifyOtp(pool, 'a@b.se', sent[0]!.code, now)).toEqual({ ok: false, reason: 'too_many_attempts' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- otp` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement mailer and OTP**

`src/mailer.ts`:

```ts
export interface Mailer {
  sendOtp(email: string, code: string): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async sendOtp(email: string, code: string): Promise<void> {
    console.log(`[mailer] OTP for ${email}: ${code}`);
  }
}
```

`src/auth/otp.ts`:

```ts
import { createHash, randomInt } from 'node:crypto';
import type pg from 'pg';
import type { Mailer } from '../mailer.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function requestOtp(
  pool: pg.Pool, email: string, mailer: Mailer, now: () => Date,
): Promise<{ ok: true } | { ok: false; reason: 'rate_limited' }> {
  const windowStart = new Date(now().getTime() - OTP_TTL_MS);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM otp_codes WHERE email=$1 AND created_at > $2`,
    [email, windowStart],
  );
  if (rows[0].n >= MAX_REQUESTS_PER_WINDOW) return { ok: false, reason: 'rate_limited' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query(
    `INSERT INTO otp_codes (email, code_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)`,
    [email, hashToken(code), new Date(now().getTime() + OTP_TTL_MS), now()],
  );
  await mailer.sendOtp(email, code);
  return { ok: true };
}

export async function verifyOtp(
  pool: pg.Pool, email: string, code: string, now: () => Date,
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }> {
  const { rows } = await pool.query(
    `SELECT id, code_hash, expires_at, attempts, consumed_at FROM otp_codes
     WHERE email=$1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  const row = rows[0];
  if (!row || row.consumed_at) return { ok: false, reason: 'invalid' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (row.expires_at < now()) return { ok: false, reason: 'expired' };
  if (row.code_hash !== hashToken(code)) {
    await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1`, [row.id]);
    return { ok: false, reason: 'invalid' };
  }
  await pool.query(`UPDATE otp_codes SET consumed_at=$2 WHERE id=$1`, [row.id, now()]);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all PASS. `npm run tsc` — clean.

- [ ] **Step 5: Commit**

```bash
git add live/server
git commit -m "feat(live): email OTP request/verify with rate limiting"
```

---

### Task 4: Sessions

**Files:**
- Create: `live/server/src/auth/session.ts`
- Test: `live/server/test/session.test.ts`

**Interfaces:**
- Consumes: `hashToken` from Task 3, `sessions`/`customers` tables from Task 2.
- Produces:
  - `SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000` (30 days, exported)
  - `createSession(pool, customerId: string, now: () => Date): Promise<string>` — returns the **raw** token (48 hex chars); only its hash is stored.
  - `getSession(pool, rawToken: string, now: () => Date): Promise<{ customerId: string; email: string; bidReady: boolean } | null>` — null when missing or expired.
  - `destroySession(pool, rawToken: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`test/session.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { createSession, getSession, destroySession } from '../src/auth/session.js';
import type pg from 'pg';

let pool: pg.Pool;
beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await truncateAll(pool); });

const now = () => new Date('2026-08-30T19:00:00Z');

async function makeCustomer(): Promise<string> {
  const { rows } = await pool.query(`INSERT INTO customers (email) VALUES ('a@b.se') RETURNING id`);
  return rows[0].id;
}

describe('sessions', () => {
  it('round-trips a session and exposes customer fields', async () => {
    const id = await makeCustomer();
    const token = await createSession(pool, id, now);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    const s = await getSession(pool, token, now);
    expect(s).toEqual({ customerId: id, email: 'a@b.se', bidReady: false });
  });

  it('stores only a hash of the token', async () => {
    const id = await makeCustomer();
    const token = await createSession(pool, id, now);
    const { rows } = await pool.query(`SELECT token_hash FROM sessions`);
    expect(rows[0].token_hash).not.toBe(token);
  });

  it('returns null for expired sessions and after destroy', async () => {
    const id = await makeCustomer();
    const token = await createSession(pool, id, now);
    const in31Days = () => new Date('2026-09-30T19:00:01Z');
    expect(await getSession(pool, token, in31Days)).toBeNull();
    await destroySession(pool, token);
    expect(await getSession(pool, token, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- session` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement sessions**

`src/auth/session.ts`:

```ts
import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { hashToken } from './otp.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(pool: pg.Pool, customerId: string, now: () => Date): Promise<string> {
  const token = randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO sessions (token_hash, customer_id, expires_at, created_at) VALUES ($1, $2, $3, $4)`,
    [hashToken(token), customerId, new Date(now().getTime() + SESSION_TTL_MS), now()],
  );
  return token;
}

export async function getSession(
  pool: pg.Pool, rawToken: string, now: () => Date,
): Promise<{ customerId: string; email: string; bidReady: boolean } | null> {
  const { rows } = await pool.query(
    `SELECT s.customer_id, s.expires_at, c.email, c.bid_ready
     FROM sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = $1`,
    [hashToken(rawToken)],
  );
  const row = rows[0];
  if (!row || row.expires_at < now()) return null;
  return { customerId: row.customer_id, email: row.email, bidReady: row.bid_ready };
}

export async function destroySession(pool: pg.Pool, rawToken: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(rawToken)]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS. `npm run tsc` — clean.

- [ ] **Step 5: Commit**

```bash
git add live/server
git commit -m "feat(live): hashed session tokens with 30-day expiry"
```

---

### Task 5: Auth routes + requireAuth decorator

**Files:**
- Create: `live/server/src/auth/routes.ts`
- Modify: `live/server/src/app.ts` (widen `Deps`, register routes)
- Test: `live/server/test/auth-routes.test.ts`

**Interfaces:**
- Consumes: `requestOtp`/`verifyOtp` (Task 3), `createSession`/`getSession`/`destroySession`/`SESSION_TTL_MS` (Task 4), `Mailer` (Task 3).
- Produces:
  - `Deps` becomes `{ config: Config; pool: pg.Pool; mailer: Mailer; now?: () => Date }` (`now` defaults to `() => new Date()`).
  - Routes: `POST /auth/request-code {email}` → `200 {ok:true}` or `429 {error:'rate_limited'}`; `POST /auth/verify {email, code}` → `200 {ok:true}` + `cf_session` httpOnly cookie (creates the customer row on first login) or `401 {error:<reason>}`; `GET /auth/me` → `200 {email, bidReady}` or `401`; `POST /auth/logout` → `200 {ok:true}` + cleared cookie.
  - Fastify decorator produced for later plans: `app.requireAuth` — a `preHandler` that sets `request.customer = { customerId, email, bidReady }` or replies 401. Declared via module augmentation:

```ts
declare module 'fastify' {
  interface FastifyRequest { customer?: { customerId: string; email: string; bidReady: boolean } }
  interface FastifyInstance { requireAuth: preHandlerHookHandler }
}
```

- [ ] **Step 1: Write the failing test**

`test/auth-routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };

beforeAll(async () => {
  pool = await getTestPool();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer,
  });
});
afterAll(async () => { await app.close(); await pool.end(); });
beforeEach(async () => { await truncateAll(pool); sent.length = 0; });

async function login(email = 'a@b.se'): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const code = sent.at(-1)!.code;
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code } });
  expect(res.statusCode).toBe(200);
  return res.cookies.find(c => c.name === 'cf_session')!.value;
}

describe('auth flow', () => {
  it('request-code → verify sets a session cookie and creates the customer', async () => {
    const token = await login();
    expect(token.length).toBeGreaterThan(20);
    const { rows } = await pool.query(`SELECT email FROM customers`);
    expect(rows[0].email).toBe('a@b.se');
  });

  it('verify with a wrong code is 401 and sets no cookie', async () => {
    await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email: 'a@b.se' } });
    const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email: 'a@b.se', code: '000000' } });
    expect(res.statusCode).toBe(401);
    expect(res.cookies.find(c => c.name === 'cf_session')).toBeUndefined();
  });

  it('/auth/me reflects the session; logout kills it', async () => {
    const token = await login();
    const me = await app.inject({ method: 'GET', url: '/auth/me', cookies: { cf_session: token } });
    expect(me.json()).toEqual({ email: 'a@b.se', bidReady: false });
    await app.inject({ method: 'POST', url: '/auth/logout', cookies: { cf_session: token } });
    const after = await app.inject({ method: 'GET', url: '/auth/me', cookies: { cf_session: token } });
    expect(after.statusCode).toBe(401);
  });

  it('/auth/me without a cookie is 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('rate-limited request-code returns 429', async () => {
    for (let i = 0; i < 3; i++) await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email: 'a@b.se' } });
    const res = await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email: 'a@b.se' } });
    expect(res.statusCode).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-routes` — Expected: FAIL (routes don't exist; `buildApp` rejects new deps).

- [ ] **Step 3: Implement routes and widen Deps**

`src/auth/routes.ts`:

```ts
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { Mailer } from '../mailer.js';
import { requestOtp, verifyOtp } from './otp.js';
import { createSession, getSession, destroySession, SESSION_TTL_MS } from './session.js';

declare module 'fastify' {
  interface FastifyRequest { customer?: { customerId: string; email: string; bidReady: boolean } }
  interface FastifyInstance { requireAuth: preHandlerHookHandler }
}

const COOKIE = 'cf_session';
const emailSchema = z.object({ email: z.string().email().transform(e => e.toLowerCase()) });
const verifySchema = emailSchema.extend({ code: z.string().regex(/^\d{6}$/) });

export function registerAuth(app: FastifyInstance, pool: pg.Pool, mailer: Mailer, now: () => Date): void {
  const cookieOpts = {
    httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
  };

  app.decorate('requireAuth', (async (request, reply) => {
    const raw = request.cookies[COOKIE];
    const session = raw ? await getSession(pool, raw, now) : null;
    if (!session) return reply.code(401).send({ error: 'unauthorized' });
    request.customer = session;
  }) as preHandlerHookHandler);

  app.post('/auth/request-code', async (request, reply) => {
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const res = await requestOtp(pool, parsed.data.email, mailer, now);
    if (!res.ok) return reply.code(429).send({ error: res.reason });
    return { ok: true };
  });

  app.post('/auth/verify', async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const { email, code } = parsed.data;
    const res = await verifyOtp(pool, email, code, now);
    if (!res.ok) return reply.code(401).send({ error: res.reason });
    const { rows } = await pool.query(
      `INSERT INTO customers (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
      [email],
    );
    const token = await createSession(pool, rows[0].id, now);
    reply.setCookie(COOKIE, token, cookieOpts);
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: app.requireAuth }, async (request) => {
    return { email: request.customer!.email, bidReady: request.customer!.bidReady };
  });

  app.post('/auth/logout', async (request, reply) => {
    const raw = request.cookies[COOKIE];
    if (raw) await destroySession(pool, raw);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });
}
```

`src/app.ts` becomes:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type pg from 'pg';
import type { Config } from './config.js';
import type { Mailer } from './mailer.js';
import { registerAuth } from './auth/routes.js';

export type Deps = {
  config: Config;
  pool: pg.Pool;
  mailer: Mailer;
  now?: () => Date;
};

export function buildApp(deps: Deps): FastifyInstance {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.config.env !== 'test' });
  app.register(cookie, { secret: deps.config.cookieSecret });
  app.get('/healthz', async () => ({ ok: true }));
  registerAuth(app, deps.pool, deps.mailer, now);
  return app;
}
```

Also update `test/app.test.ts`'s healthz test to pass the new deps (any `pg.Pool` from `getTestPool()` and a no-op mailer) — the config tests are unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all PASS (including the updated app.test.ts). `npm run tsc` — clean.

- [ ] **Step 5: Commit**

```bash
git add live/server
git commit -m "feat(live): auth routes with session cookie and requireAuth"
```

---

### Task 6: PaymentGateway interface, fake, and setup-intent route

**Files:**
- Create: `live/server/src/billing/gateway.ts`, `live/server/src/billing/routes.ts`
- Modify: `live/server/src/app.ts` (add `gateway` to `Deps`, register billing routes)
- Test: `live/server/test/billing.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (Task 5), `customers` table (Task 2).
- Produces:

```ts
export type WebhookEvent =
  | { type: 'setup_succeeded'; gatewayCustomerId: string; paymentMethodId: string }
  | { type: 'ignored' };

export interface PaymentGateway {
  ensureCustomer(email: string): Promise<string>;                       // gateway customer id
  createSetupIntent(gatewayCustomerId: string): Promise<{ clientSecret: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent;      // throws on bad signature
}

export class FakePaymentGateway implements PaymentGateway { /* in-memory, records calls */ }
```

  - `Deps` gains `gateway: PaymentGateway`.
  - Route: `POST /billing/setup-intent` (auth required) → `200 { clientSecret }`; persists `stripe_customer_id` on the customer row.
  - **Plan 2 will consume** `PaymentGateway` by adding a `chargeSavedCard` method — the interface lives in `gateway.ts` and is the single seam to Stripe.

- [ ] **Step 1: Write the failing test**

`test/billing.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestPool, truncateAll } from './helpers.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FakePaymentGateway } from '../src/billing/gateway.js';
import type { Mailer } from '../src/mailer.js';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';

let pool: pg.Pool;
let app: FastifyInstance;
let gateway: FakePaymentGateway;
const sent: { email: string; code: string }[] = [];
const mailer: Mailer = { async sendOtp(email, code) { sent.push({ email, code }); } };

beforeAll(async () => { pool = await getTestPool(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await truncateAll(pool); sent.length = 0;
  gateway = new FakePaymentGateway();
  if (app) await app.close();
  app = buildApp({
    config: loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://cf:cf@localhost:5433/cf_live',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
    }),
    pool, mailer, gateway,
  });
});

async function login(email = 'a@b.se'): Promise<string> {
  await app.inject({ method: 'POST', url: '/auth/request-code', payload: { email } });
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code: sent.at(-1)!.code } });
  return res.cookies.find(c => c.name === 'cf_session')!.value;
}

describe('POST /billing/setup-intent', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/billing/setup-intent' });
    expect(res.statusCode).toBe(401);
  });

  it('creates a gateway customer once and returns a client secret', async () => {
    const token = await login();
    const res1 = await app.inject({ method: 'POST', url: '/billing/setup-intent', cookies: { cf_session: token } });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().clientSecret).toMatch(/^seti_fake_/);
    const res2 = await app.inject({ method: 'POST', url: '/billing/setup-intent', cookies: { cf_session: token } });
    expect(res2.statusCode).toBe(200);
    expect(gateway.customers.size).toBe(1); // second call reuses the stored customer id
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM customers WHERE email='a@b.se'`);
    expect(rows[0].stripe_customer_id).toMatch(/^cus_fake_/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- billing` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement gateway and route**

`src/billing/gateway.ts`:

```ts
export type WebhookEvent =
  | { type: 'setup_succeeded'; gatewayCustomerId: string; paymentMethodId: string }
  | { type: 'ignored' };

export interface PaymentGateway {
  ensureCustomer(email: string): Promise<string>;
  createSetupIntent(gatewayCustomerId: string): Promise<{ clientSecret: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent;
}

export class FakePaymentGateway implements PaymentGateway {
  customers = new Map<string, string>(); // email → id
  setupIntents: string[] = [];
  webhookEvents: WebhookEvent[] = [];
  private n = 0;

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
}
```

`src/billing/routes.ts` (setup-intent only in this task; the webhook route is Task 7):

```ts
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
```

In `src/app.ts`: add `gateway: PaymentGateway` to `Deps`, import and call `registerBilling(app, deps.pool, deps.gateway)` after `registerAuth`. Update the `buildApp` calls in `test/app.test.ts` and `test/auth-routes.test.ts` to pass `gateway: new FakePaymentGateway()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all PASS. `npm run tsc` — clean.

- [ ] **Step 5: Commit**

```bash
git add live/server
git commit -m "feat(live): payment gateway seam and setup-intent endpoint"
```

---

### Task 7: Stripe webhook → bid-ready

**Files:**
- Modify: `live/server/src/billing/routes.ts` (add webhook route)
- Test: extend `live/server/test/billing.test.ts`

**Interfaces:**
- Consumes: `PaymentGateway.verifyWebhook` (Task 6), `customers` table.
- Produces: `POST /webhooks/stripe` — raw-body route; verifies signature via the gateway; on `setup_succeeded` sets `default_payment_method_id` and `bid_ready=true` on the customer matching `stripe_customer_id`; returns `200 {received:true}`; bad signature → `400`. After this lands, `/auth/me` returns `bidReady: true` for that customer — **this is the flag Plan 2's bid endpoint checks.**

- [ ] **Step 1: Write the failing test**

Append to `test/billing.test.ts`:

```ts
describe('POST /webhooks/stripe', () => {
  it('rejects a bad signature', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'nope', 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'ignored' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('marks the customer bid-ready on setup_succeeded', async () => {
    const token = await login();
    await app.inject({ method: 'POST', url: '/billing/setup-intent', cookies: { cf_session: token } });
    const { rows } = await pool.query(`SELECT stripe_customer_id FROM customers WHERE email='a@b.se'`);

    const res = await app.inject({
      method: 'POST', url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'fake-valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'setup_succeeded',
        gatewayCustomerId: rows[0].stripe_customer_id,
        paymentMethodId: 'pm_fake_1',
      }),
    });
    expect(res.statusCode).toBe(200);

    const me = await app.inject({ method: 'GET', url: '/auth/me', cookies: { cf_session: token } });
    expect(me.json()).toEqual({ email: 'a@b.se', bidReady: true });
  });

  it('ignores unknown events without error', async () => {
    const res = await app.inject({
      method: 'POST', url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'fake-valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'ignored' }),
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- billing` — Expected: FAIL (404 on /webhooks/stripe).

- [ ] **Step 3: Implement the webhook route**

Add to `src/billing/routes.ts` inside `registerBilling` (the encapsulated `register` scope gives the webhook a raw-body parser without affecting other routes):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all PASS. `npm run tsc` — clean.

- [ ] **Step 5: Commit**

```bash
git add live/server
git commit -m "feat(live): stripe webhook marks customers bid-ready"
```

---

### Task 8: Real Stripe adapter, entrypoint, env example, README

**Files:**
- Create: `live/server/src/billing/stripe.ts`, `live/server/src/index.ts`, `live/server/.env.example`, `live/server/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `class StripeGateway implements PaymentGateway` (constructor `(secretKey: string, webhookSecret: string)`); a runnable `npm run dev`. No unit tests for `StripeGateway` — it is a thin adapter; it gets exercised against Stripe test mode manually (checklist below) and end-to-end in Plan 4's hardening.

- [ ] **Step 1: Implement the Stripe adapter**

`src/billing/stripe.ts`:

```ts
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
```

- [ ] **Step 2: Implement the entrypoint**

`src/index.ts`:

```ts
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

const app = buildApp({ config, pool, mailer: new ConsoleMailer(), gateway });
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`cf-live-server on :${config.port} (stripe: ${gateway instanceof StripeGateway ? 'live' : 'fake'})`);
```

`.env.example`:

```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://cf:cf@localhost:5433/cf_live
COOKIE_SECRET=change-me-to-32-plus-random-characters
# Optional in dev (FakePaymentGateway is used when absent); required in production:
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 3: Write the README**

`live/server/README.md`:

```markdown
# cf-live-server

Backend for Circular Fash Live (spec: docs/superpowers/specs/2026-08-30-live-auction-custom-build-design.md).

## Dev setup
1. `docker compose up -d`   (Postgres 16 on :5433)
2. `cp .env.example .env`   (set a real COOKIE_SECRET)
3. `npm install && npm run migrate && npm run dev`
4. `npm test` runs against the same Docker database.

Without Stripe keys the server runs with a fake in-memory gateway —
OTP codes print to the console, cards never leave your machine.

## Stripe test-mode smoke check (manual, once keys exist)
1. Put `sk_test_...` in `.env`; run `stripe listen --forward-to localhost:3001/webhooks/stripe`
   and copy the printed `whsec_...` into `.env`. Restart `npm run dev`.
2. POST /auth/request-code → code from server console → POST /auth/verify.
3. POST /billing/setup-intent → confirm the SetupIntent with test card
   4242 4242 4242 4242 (e.g. via Stripe Shell or the Plan 3 widget).
4. GET /auth/me → expect `bidReady: true`.
```

- [ ] **Step 4: Verify everything**

Run: `npm test` (all pass), `npm run tsc` (clean), then `cp .env.example .env`, set `COOKIE_SECRET`, and `npm run dev` — Expected: server starts, `curl http://localhost:3001/healthz` returns `{"ok":true}`, log line ends `(stripe: fake)`.

- [ ] **Step 5: Commit**

```bash
git add live/server
git commit -m "feat(live): stripe adapter, entrypoint, dev docs"
```

---

## Prerequisites the user must provide (not blocking this plan)

Plan 1 runs entirely locally with fakes. Before Plan 2's charge flow and Plan 4's deploy, the user needs to create: a **Stripe account** (Sweden) with test keys, a **Mux account**, a **Shopify custom app** token (Admin API), and a hosting account (Railway/Fly/Render). None are needed to execute this plan.

## What the next plans consume from this one

- Plan 2 (auction engine): `buildApp`/`Deps` to extend, `requireAuth` + `request.customer.bidReady`, `PaymentGateway` seam (adds `chargeSavedCard(gatewayCustomerId, paymentMethodId, amountOre, description)`), the migration runner for new tables, the event-log pattern.
- Plan 3 (viewer widget): `/auth/*` endpoints and the `cf_session` cookie contract, `/billing/setup-intent` client secret for Stripe Payment Element.
- Plan 4 (Shopify + hardening): the entrypoint's dependency wiring for a `ShopifyClient` interface, `.env.example` as the deploy variable manifest.

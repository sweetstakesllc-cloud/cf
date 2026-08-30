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

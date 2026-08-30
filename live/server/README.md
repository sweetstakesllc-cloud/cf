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

## Running a live sale (dev)
1. `npm run dev` starts the API and a background settle ticker (every 500ms) that
   closes any auction whose timer has elapsed — even with zero bids, a pinned
   auction item flips from `open` to `passed` on its own once the clock runs out.
2. Open `http://localhost:3001/host` in a browser. The host page prompts for the
   `HOST_PASSWORD` from `.env` and uses it as a Bearer token on every `/host/*`
   call.
3. Stream flow from the host page (or via curl with
   `Authorization: Bearer $HOST_PASSWORD`):
   - `POST /host/streams` `{ "title": "..." }` — creates and goes live.
   - `POST /host/items` `{ "streamId", "title", "mode": "auction" | "buy_now", ... }`
     — queues an item.
   - `POST /host/items/:id/pin` — brings an item to the front for viewers.
   - `POST /host/items/:id/open-auction` `{ "durationSec": 15 }` — starts the
     countdown; the settle ticker (or `/host/items/:id/extend`,
     `/host/items/:id/pass`) resolves it.
   - `POST /host/items/:id/second-chance` — offers the item to the next-highest
     bidder after a winner fails to be charged.
   - `POST /host/streams/end` — ends the stream.
   - `GET /host/state` — full host view (pinned item, winner, charge status,
     queued items).
4. Viewers never touch `/host/*`. They read `GET /live/state` for a snapshot,
   connect to `/live/ws` for realtime `state` / `chat` / `viewers` / `error`
   messages, and post bids/purchases with `POST /live/bid` and `POST /live/buy`.
   Plan 3 builds the actual viewer page against these endpoints; today they can
   be exercised directly with curl or a WebSocket client.

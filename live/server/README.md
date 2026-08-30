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
   The viewer page at `/live` (below) is the UI over these endpoints.
5. Chat moderation: every chat message carries a `fromId` (8-hex digest of the
   customer id). The host console shows the feed with a Mute button per line;
   `POST /host/mute { "fromId" }` drops that customer's future messages. Mutes
   are in-memory — a server restart clears them.

## Viewer page

`GET /live` serves the customer-facing page: HLS player, pinned-item card with
the BID/BUY button, countdown with going-once styling, chat, email+OTP sign-in
and the get-bid-ready card flow. It is a plain-JS widget — no build step:

- `public/live.js` + `public/live.css`, served under `/static/` (10-minute cache).
- The page is just `<div id="cf-live">` plus those two files. **This is the
  Shopify embed contract**: the theme's live page includes the same stylesheet,
  div, and script tag (pointing at the API host) and gets the identical widget.
  The widget derives the API origin from its own `<script src>`.
- Cross-origin embedding needs `WIDGET_ORIGINS` in `.env` (comma-separated,
  e.g. `https://circularfash.com,https://www.circularfash.com`). CORS runs with
  credentials; session cookies stay SameSite=Lax, which works because
  circularfash.com → api.circularfash.com is same-site.
- `GET /live/config` hands the widget `STRIPE_PUBLISHABLE_KEY`. Without it the
  bid-ready modal explains card setup is unavailable (dev default); with it the
  widget mounts a Stripe Payment Element and polls `/auth/me` until the webhook
  flips `bidReady`.
- Video: create the stream with a `playbackUrl` (Mux LL-HLS `.m3u8`) and the
  player picks it up — native HLS on Safari, hls.js (lazy CDN load) elsewhere.
  No URL → a "stream starting" panel; no live stream at all → the off-air panel.

Scripted dry run: with the dev server up and a seeded stream, the Plan-3
verification script drives sign-in, bid-ready (fake webhook), a bidding duel,
soft close, settle → SOLD, a buy-now claim, and host-side mute headlessly via
puppeteer. See `docs/superpowers/plans/2026-08-30-live-auction-3-viewer.md`.

## Left for Plan 4 (hardening)

Shopify order sync on charge success, replays / seen-live grid, Mux wiring +
real playback IDs, load test (p95 bid round-trip < 300 ms @ 200 viewers), and
persisted mutes if they should survive restarts.

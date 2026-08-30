# Live Auction Build — Plan 3 of 4: Viewer Experience

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The customer-facing live page: video player, pinned-item card with the one hi-vis BID/BUY button, client countdown with soft-close feedback, chat with sign-in, the "get bid-ready" card-save flow, and the host-side chat moderation deferred here from Plan 2. After this plan a viewer on a phone can watch, sign in, save a card, bid, win, and see themselves charged — against the Plan-2 engine unchanged.

**Architecture:** The widget is **plain JS + CSS served as static files** from the API app (`public/live.js`, `public/live.css`) and mounted into `<div id="cf-live">`. `GET /live` on the API serves a minimal HTML shell using exactly that mount contract — the Shopify theme page later includes the same two files plus the div, so the standalone page doubles as the integration test for the embed. *Deviation from spec §2.5:* the spec suggested Preact (~30 KB); we stay dependency-free and build-step-free like the host console — the widget is one state-render function over WebSocket messages, and adding a bundler to this repo for that buys nothing. Server stays authoritative: the widget renders `PublicState` and never computes auction outcomes; the countdown is cosmetic (the settle ticker decides).

**Tech Stack:** Everything from Plans 1–2, plus `@fastify/cors` and `@fastify/static`. In the browser: hls.js from CDN (lazy, only when a playback URL exists and native HLS is absent) and Stripe.js v3 (lazy, only when a publishable key is configured).

**Spec:** `docs/superpowers/specs/2026-08-30-live-auction-custom-build-design.md` (§2.5 viewer page, §2.3 payments)

## Global Constraints

- Branch `live-auction-3` from `web-mockups`. All commands from `live/server/`. Postgres on :5433 must be up.
- Everything from Plan 2's constraints stands: integer öre everywhere, engine functions are the only writers of auction state, TDD per task on the server side (failing test → implement → pass → commit), strict TS, ESM/NodeNext, no `process.env` outside `src/config.ts`.
- **Brand check (spec §7):** dark stream UI over video; Assistant font; zero rounded corners; uppercase letterspaced labels; **mono numerals** for every price and timer (`font-variant-numeric: tabular-nums` + the mono stack); exactly **one hi-vis element** on screen — the BID/BUY button in `#E8FF52` (the hue the host console's primary already established for the live sub-brand).
- Widget files are plain browser JS (no TS, no modules) — they are not compiled. Server-side integration tests cover every new endpoint; the widget itself is verified by a scripted browser dry run (Task 9).
- CORS: `@fastify/cors` with `credentials: true`, origins from `WIDGET_ORIGINS` (comma-separated env, empty = same-origin only). Session cookies stay `SameSite=Lax` — circularfash.com → api.circularfash.com is same-*site*, so Lax cookies flow; CORS is needed because it is cross-*origin*.

## File Structure (end state)

```
live/server/
  migrations/005-playback-url.sql       streams.playback_url
  src/config.ts                         + widgetOrigins, stripePublishableKey
  src/app.ts                            + cors, static, viewer shell wiring
  src/live/engine.ts                    + playbackUrl in stream, currentBidderMasked in pinned
  src/live/host-routes.ts               + playbackUrl on stream create, POST /host/mute
  src/live/host-page.ts                 + playback URL field, chat feed with mute
  src/live/hub.ts                       + fromId on chat, mute set
  src/live/viewer-page.ts               VIEWER_HTML shell served at GET /live
  src/live/routes.ts                    + GET /live/config
  public/live.js                        the widget (vanilla IIFE)
  public/live.css                       widget styles
  test/viewer-shell.test.ts  cors.test.ts  (+ extended engine/hub/host/live route tests)
```

---

### Task 1: CORS + widget config endpoint

- [x] **Test:** `cors.test.ts` — app built with `widgetOrigins: ['https://circularfash.com']`: preflight `OPTIONS /live/state` from that origin gets `access-control-allow-origin` echoed and `access-control-allow-credentials: true`; a request from an unlisted origin gets no CORS headers; with `widgetOrigins: []` no CORS headers at all. `live-routes.test.ts` — `GET /live/config` returns `{ stripePublishableKey: null }` when unconfigured, the key when set.
- [x] **Implement:** `WIDGET_ORIGINS` (comma-separated, default empty) and `STRIPE_PUBLISHABLE_KEY` (optional) in `config.ts`; register `@fastify/cors` in `buildApp` with `origin: widgetOrigins, credentials: true` only when the list is non-empty; `GET /live/config` in `live/routes.ts`.
- [x] **Commit** `feat(live): CORS for the shop origin and viewer config endpoint`

### Task 2: Playback URL through the stack

- [x] **Test:** engine — `createStream` accepts an optional playback URL and `getPublicState().stream.playbackUrl` returns it (null when absent). host routes — `POST /host/streams` passes `playbackUrl` through.
- [x] **Implement:** migration `005-playback-url.sql` (`ALTER TABLE streams ADD COLUMN playback_url text`); `createStream(pool, title, playbackUrl?)`; include in `PublicState.stream`; zod-validate `playbackUrl: z.string().url().optional()` on the host route; playback URL input on the host console's New-stream flow.
- [x] **Commit** `feat(live): stream playback URL for the viewer player`

### Task 3: Current bidder in public state

- [x] **Test:** engine — after a bid, `getPublicState().pinned.currentBidderMasked` is the bidder's masked email; null before any bid.
- [x] **Implement:** join `customers` on `current_bidder_id` in `getPublicState`, mask with the existing `maskEmail`. (The viewer uses this for "x*** is highest — you've been outbid" states; masking level matches what the chat already leaks.)
- [x] **Commit** `feat(live): expose masked current bidder in public state`

### Task 4: Chat identity + host mute (deferred from Plan 2)

- [x] **Test:** hub — chat broadcasts now carry a stable `fromId` (8-hex digest of customerId, not the raw uuid); after `hub.mute(fromId)`, that customer's next chat is not broadcast and the sender gets `{type:'error',error:'muted'}`; other customers unaffected. host routes — `POST /host/mute {fromId}` (bearer) mutes; bad body 400.
- [x] **Implement:** `fromId = sha256(customerId).slice(0,8)` computed once per `add()`; `Hub.mute(fromId)` + muted set consulted in `handleMessage`; route wires to `app.hub`. Host console: a chat feed panel (the console opens the same `/live/ws` read-only) with a MUTE button per line calling the endpoint.
- [x] **Commit** `feat(live): chat sender ids and host mute`

### Task 5: Static plumbing + viewer shell

- [x] **Test:** `viewer-shell.test.ts` — `GET /live` returns `text/html` containing `id="cf-live"`, `/static/live.js`, `/static/live.css`; `GET /static/live.js` serves JS with a long-lived cache header; 404 for `/static/nope.js`.
- [x] **Implement:** `@fastify/static` rooted at `public/` under prefix `/static/`; `src/live/viewer-page.ts` exports `VIEWER_HTML` (shell: viewport meta, Assistant font link, the div, the two static includes); serve at `GET /live`.
- [x] **Commit** `feat(live): static widget serving and viewer shell`

### Task 6: Widget core — state render, countdown, bid/buy

- [x] **Implement** `public/live.css` + `public/live.js` core:
  - Mobile-first layout: video full-bleed behind, bottom sheet with pinned-item card (title, image thumb, condition-free v1 fields: current/starting price in mono, bid count, viewer count), chat above it, ≥900px: video left ~2/3, rail right.
  - WS client with reconnect (1s→8s backoff), `state`/`viewers`/`chat`/`error` handling; `GET /live/state` fallback poll every 10s while socket is down.
  - Countdown from `endsAt` every 250ms; ≤10s renders in the soft-close style (pulsing, "GOING ONCE…"); state transitions won/charged render the SOLD stamp with `winner.emailMasked` + amount; `passed` renders PASSED; no stream renders the off-air panel (schedule pointer back to /pages/live content).
  - BID button: quick-bid at `max(currentBidOre + minIncrementOre, startingBidOre)`; disabled (with reason) when not open; BUY for buy_now items. 409 responses re-render from the broadcast state ("outbid" toast for `too_low`).
  - Bid ticker derived client-side: on state change where `currentBidOre` moved, prepend "`x*** bid 3 400 kr`" into the chat feed.
  - Player: `<video muted playsinline autoplay>`; native HLS if `canPlayType('application/vnd.apple.mpegurl')`, else lazy hls.js from jsdelivr with onerror → poster panel; no playbackUrl → "stream starting" panel.
  - Money renders `3 400 kr` style (space thousands, öre dropped when zero) in the mono stack.
- [x] **Commit** `feat(live): viewer widget core — player, state, countdown, bid`

### Task 7: Widget — sign-in and get-bid-ready flows

- [x] **Implement:** tapping BID unauthenticated opens the email→code modal (`/auth/request-code`, `/auth/verify`, then `/auth/me`); authenticated-but-not-bid-ready opens the bid-ready modal: `POST /billing/setup-intent` → if `stripePublishableKey` configured, lazy-load Stripe.js, mount Payment Element, `confirmSetup({redirect:'if_required'})`, then poll `/auth/me` (2s, max 30s) until `bidReady` flips (the webhook writes it); no key → explanatory dev panel. All fetches `credentials:'include'`. Modal chrome matches the brand rules (sharp corners, uppercase labels, single accent reserved for the primary action).
- [x] **Commit** `feat(live): viewer sign-in and bid-ready flows`

### Task 8: Widget — chat

- [x] **Implement:** chat feed (last 200 lines, auto-scroll pinned to bottom unless the user scrolled up), send box (signed-in only; else it opens the sign-in modal), 280-char counter, `slow_down`/`muted`/`too_long` error toasts, viewer count chip, bid-ticker lines styled distinctly from chat lines.
- [x] **Commit** `feat(live): viewer chat`

### Task 9: README + scripted dry run

- [x] **Verify:** full `npm test` + `npm run tsc` green. Scripted browser dry run against the dev server: create stream + items via host API, open viewer in Chrome, sign in with an OTP (dev mailer logs the code), fake-webhook the customer bid-ready, bid from the page, watch soft-close, settle, SOLD stamp. Screenshot the money states.
- [x] **Document:** README "Viewer page" section — the embed contract for the Shopify page (div + two static files + `WIDGET_ORIGINS`), the playback-URL flow from Mux, and what stays for Plan 4 (Shopify order sync, replays, load test).
- [x] **Commit** `feat(live): viewer docs and dry-run notes`

## What Plan 4 (hardening) consumes from this plan

The embed contract (`#cf-live` + `/static/live.js` + `/static/live.css` + `WIDGET_ORIGINS`), `GET /live/config`, `playback_url` on streams (Mux wiring lands in Plan 4 alongside order sync), and the dry-run script as the seed of the load-test scenario.

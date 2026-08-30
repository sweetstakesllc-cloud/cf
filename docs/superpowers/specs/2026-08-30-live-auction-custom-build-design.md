# Circular Fash Live — Custom Whatnot-Style Auction Build

**Status: design for comparison, not a build commitment.** Written 2026-08-30 to
put concrete numbers and scope next to the buy option (CommentSold core platform)
so the build-vs-buy decision can be made on facts. Decisions locked so far, from
brainstorming: **live auctions** (not buy-now-only), **website first** (iOS app
later on the same backend), custom build scoped here as the alternative to
CommentSold.

---

## 1. What we're building

Whatnot-style live shopping on **circularfash.com**: the host streams from the
studio, one piece is pinned at a time, viewers bid in a timed auction with a
soft-close, and the winner's **saved card is charged automatically** when the
hammer falls. Chat runs beside the video. Everything wears the locked
street-high-contrast brand; buyers never leave the site; orders land in Shopify
like any other sale.

What this is *not*: a marketplace (one seller — Circular Fash), a mobile app
(v2, same backend), or a replacement for the store (it's one page plus a backend).

### Why custom beats the apps on the two things that matter

- **True claim mechanics.** No credible Shopify app offers card-on-file
  auto-charge or holds. Custom gives auctions *and* instant buy-now with a real
  server-side hold — first tap wins, not first to finish checkout.
- **The brand.** CommentSold puts the live sale on their webstore with their
  layout system. Custom keeps the mono prices, hard edges, and hi-vis discipline
  on our own page.

---

## 2. Architecture

Five pieces. Video is rented; everything else is one small app we own.

```
studio phone/OBS ──RTMP──> Mux Live ──LL-HLS──> viewer's browser
                                                      │ video only
circularfash.com/pages/live  (theme page, loads our JS widget)
                                                      │ WebSocket
                    api.circularfash.com  ── one Node.js app ──
                    │  auction engine · chat · holds · auth    │
                    │  Postgres (state + event log)            │
                    └── Stripe (saved cards, off-session charge)
                    └── Shopify Admin API (product queue in, paid orders out)
```

### 2.1 Video (rented: Mux Live)

- Host streams RTMP from a phone (Larix/Prism) or OBS to a Mux live stream.
  Viewers get low-latency HLS, ~4–8 s behind live.
- **The latency doesn't break auctions** because the countdown, current bid, and
  "going once" state are rendered client-side from WebSocket server state — the
  video is context, the auction UI is authoritative and identical for everyone.
  Whatnot itself runs a few seconds behind live.
- Mux records automatically → replay VODs and the "As Seen on the Live" grid on
  the existing live page for free.
- Alternative: Amazon IVS (cheaper input at $0.20–2.00/channel-hr, more AWS
  plumbing). Upgrade path if sub-second ever matters: IVS Real-Time / LiveKit
  (WebRTC). Start with Mux for developer speed and built-in VOD.

### 2.2 Auction engine (the heart — server-authoritative)

One state machine per pinned item, all transitions server-side, every event
appended to a Postgres log (audit trail for disputes):

`queued → pinned → auction_open → soft_close → won → charged → ordered`
(or `→ payment_failed → second_chance → …`, or `→ passed`)

- Host sets starting bid, minimum increment, timer (30–90 s typical).
- **Soft close / anti-snipe:** any bid in the final 10 s resets the clock to
  10 s. Host can also extend manually (+1 min).
- One auction at a time (matches the one-piece-at-a-time format; also what
  CommentSold enforces).
- Bids validated server-side: must beat current + increment, bidder must be
  **bid-ready** (card saved), item must still be open. Ties broken by server
  arrival order — no client clocks trusted.
- **Buy-now mode** for non-auction pieces: host pins with a fixed price; first
  bid-ready viewer to tap gets a **server-side hold**; their card is charged
  immediately. Non-bid-ready tappers get a 5-minute hold + express card entry.
  This is the claim-and-hold no Shopify app has.

### 2.3 Payments (Stripe)

- **"Get bid-ready":** before the first bid, viewer saves a card via Stripe
  SetupIntent (Payment Element, Apple Pay/Google Pay supported). One-time,
  ~30 s, prompted the first time they tap **Bid**.
- **On win:** off-session PaymentIntent against the saved card. EU **SCA/PSD2**
  reality: an off-session charge can be declined pending 3DS. Mitigation:
  authenticate at save time (Stripe marks future off-session usage), and on a
  decline the winner gets a 10-minute push-to-pay link; if unpaid, the item is
  offered to the underbidder at their last bid ("second chance"), Whatnot-style.
- Fees (Stripe Sweden, current list): **1.5% + 1.80 kr** EEA cards, **+3.25%**
  non-EEA cards, +2% if currency conversion. On a 4 200 kr bag: ~65 kr domestic.
- Refunds/chargebacks run through Stripe dashboard; the event log is the
  evidence trail.

### 2.4 Shopify integration (Admin API)

Shopify stays the source of truth for catalog, fulfillment, and accounting.

- **In:** host console pulls the item queue from Shopify products (title, photos,
  price as auction reserve/starting point, condition).
- **Out, on charge success:** create a Shopify order marked paid (gateway
  "manual"/custom, tagged `live-auction`), zero the inventory, tag the product
  `sold` and `seen-live` per existing conventions. Customer matched/created by
  email so order history is unified.
- **To verify in a 1-day spike before committing:** whether Shopify levies
  third-party-gateway transaction fees on API-created paid orders on the store's
  current plan. If it does (typically 0.5–2%), that stacks on Stripe's fee and
  belongs in the comparison table below.

### 2.5 Viewer page + host console

- **Viewer:** `/pages/live` in the existing theme loads our JS widget (Preact,
  ~30 KB) from api.circularfash.com. Layout: video full-height, pinned-item
  card (mono price, condition, est. retail) with the big **BID** button — the
  screen's one hi-vis element — chat and bid ticker beside/below. Mobile-web
  first: most viewers arrive from a TikTok bio link. Falls back to the current
  promo page content when no stream is live.
- **Auth:** email + one-time code (magic code), session cookie. No passwords,
  no dependency on Shopify customer accounts mid-stream.
- **Host console:** password-protected page on the API app, phone/iPad friendly:
  stream health, item queue (from Shopify), pin / start auction / extend /
  pass, buy-now toggle, current bids, chat with block/remove, mark-sold overlay
  trigger.
- **Chat:** same WebSocket, rate-limited, host-moderated. Nothing fancier in v1.

---

## 3. Costs

### Running costs (monthly, at ~1 stream/day × 1 hr, ~100 concurrent viewers)

| Item | Estimate | Notes |
|---|---|---|
| Mux Live (encode + deliver + store) | **$50–150** | first 100k delivery min free; scales with viewers |
| App hosting + Postgres (Railway/Fly/Render) | **$15–30** | one Node app, small DB |
| Stripe | **1.5% + 1.80 kr**/sale (EEA) | +3.25% non-EEA cards |
| Email OTP (Resend/Postmark) | **$0–15** | |
| **Fixed total** | **~$65–195/mo** | ≈ 700–2 100 kr |

### Build cost (the real price)

| Phase | Scope | Estimate |
|---|---|---|
| 0 — Spike | Mux test stream end-to-end; verify Shopify API-order fee question | 1–2 days |
| A — Foundation | API app, Postgres, OTP auth, Stripe save-card, deploy | 1.5–2 wks |
| B — Auction engine | State machine, WebSocket, bidding, charge + decline + second-chance, host console | 2–3 wks |
| C — Viewer experience | Player, overlay UI on brand, chat, bid flow, mobile web | ~2 wks |
| D — Hardening | Shopify order sync, replays/seen-live, load test, ≥3 private dry-run streams | ~2 wks |
| **Total** | | **~8–10 focused weeks; 2–3 months calendar** |

First revenue-capable stream is realistically **~2 months out**; CommentSold is
**~1–2 weeks out**.

---

## 4. Comparison: custom vs CommentSold core (vs Videeo, for reference)

| | **Custom build** | **CommentSold core** | Videeo (no auctions) |
|---|---|---|---|
| Auctions + auto-charge | ✅ ours, exact mechanics we want | ✅ proven, theirs | ❌ |
| Where it lives | circularfash.com, our theme | their webstore + their app | our theme |
| Buyer account/card | one site, Stripe | separate CS account + card | Shopify checkout |
| Buy-now hold | ✅ real server hold | ✅ holds/waitlists | ❌ race to checkout |
| Fixed cost /mo | ~$65–195 infra | $149–999 (demo-gated pricing) | $0 |
| Per-sale cost | Stripe ~1.5% (+ possible Shopify gateway fee — verify) | payment processing (Stripe/CS) on top of subscription | **5% of live GMV** |
| Time to first stream | ~2 months | ~1–2 weeks | ~1 week |
| Build cost | 8–10 weeks of work | ~0 | ~0 |
| Who owns failures during a live sale | **us** | them (support, SLAs) | them |
| Brand fidelity | total | logo/colors on their template | high |
| iOS app path | same backend powers the RN app later | their app builder ($) | their $79.99/mo app |
| Exit cost | none — we own it | migration + retrain buyers | low |

**At 100 000 kr/mo live GMV:** custom ≈ 1 500–2 000 kr Stripe + ~1 000–2 000 kr
infra ≈ **3–4%** all-in falling as GMV grows · CommentSold ≈ subscription
1 600–11 000 kr + processing ≈ **3–13%** · Videeo ≈ 5 000 kr = **5%** flat, and
no auctions.

---

## 5. Risks (custom path — own them or don't build)

1. **We are the ops team during a live sale.** Stream drops, WebSocket blips,
   double-bid edge cases — at 19:00 with an audience, there's no vendor to call.
   Mitigated by phases D's dry runs, but never zero.
2. **SCA declines at the hammer.** Some EU winners will fail off-session 3DS.
   The push-to-pay + second-chance flow contains it; it can't eliminate it.
   (CommentSold has the same physics; they've just already built the flow.)
3. **Unvalidated format.** Two months of build before learning whether this
   audience bids. The counter-argument: a CommentSold trial month could validate
   the *format* first, then this build proceeds de-risked — the options are
   composable, not exclusive.
4. **Scope creep.** Gifting, follower notifications, clips, multi-host — all
   real Whatnot features, all **out of scope for v1**. v1 is: watch, chat, bid,
   win, charged, shipped.

## 6. Out of scope for v1

Push notifications (needs the app), simulcast to TikTok (view-only mirror is a
later nice-to-have), seller tooling beyond one host console, loyalty/points,
multi-language, Android/iOS native (v2 reuses this entire backend and its
WebSocket protocol).

## 7. Success criteria

- A dry-run auction completes end-to-end: pin → bids from 3+ devices → soft
  close → auto-charge → Shopify order created → replay available.
- p95 bid round-trip < 300 ms at 200 concurrent viewers (load test).
- A payment-declined winner path resolves without manual DB surgery.
- The live page passes the brand check: one hi-vis element, mono numerals,
  zero rounded corners.

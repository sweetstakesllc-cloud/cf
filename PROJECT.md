# Circular Fash — iOS App

Project context for Claude Code. Read this first each session. It captures the
decisions already made so you don't re-litigate or drift from them.

## What we're building

A native iOS app for **circularfash.com**, a Sweden-based Shopify store selling
**pre-owned authentic luxury fashion** (Moncler, Gucci, Stone Island, Off-White,
C.P. Company, Prada, and similar). Prices in SEK with multi-currency support.

**The defining constraint:** inventory is **one-of-one**. Almost every item is a
single unique piece that sells fast and never restocks. This shapes everything —
the app is less a catalog and more an *alert system with a store attached*.

## Tech stack & architecture

- **Expo + React Native, TypeScript.** Managed workflow.
- **Navigation:** React Navigation — bottom tabs (Home, Saved, Alerts, Sell) +
  a stack for Product detail.
- **Data:** Shopify **Storefront API** (GraphQL). The standalone Checkout API was
  deprecated April 2025 — carts are assembled via the Storefront Cart API and
  checkout is handed off to Shopify's hosted checkout via the **Checkout Sheet Kit**
  (`@shopify/checkout-sheet-kit`). We do NOT build a custom checkout.
- **Checkout Sheet Kit is a native module** → it won't run in Expo Go. Browse/grid
  works in Expo Go; switch to an **Expo dev build (EAS)** when implementing checkout.

### The mock-data seam (important)

We are building **frontend-first**. To keep that from becoming throwaway work:

- Define one normalized `Product` type. All screens consume only this type.
- All sample data lives behind a single mock module (`src/data/mockProducts.ts`)
  exposing functions: `getNewArrivals()`, `getProduct(id)`, `getSaved()`, etc.
- Screens import only from this module — never inline data.
- Later, swap the module's internals for real Storefront calls. The UI never
  changes. This module is the seam between frontend and backend.

```ts
type Product = {
  id: string;
  brand: string;            // Shopify "vendor"
  title: string;
  images: string[];
  price: number;            // SEK
  compareAtPrice?: number | null;
  size?: string | null;
  availableForSale: boolean;
  isNew?: boolean;          // from createdAt or a tag
  condition?: string;       // e.g. "Excellent"
  measurements?: { label: string; value: string }[];
};
```

## Design direction — "Street high-contrast"

The visual direction is locked. Source of truth is `theme.ts` and `ProductCard.tsx`
(already in the project). Do not invent a new look; derive everything from the tokens.

Grounding idea: the catalog is technical, garment-dyed outerwear (Stone Island,
C.P. Company, Moncler) — military/workwear/hi-vis codes. So this is *technical*
street, not generic dark-mode-with-acid-accent.

**Palette** (near-black, single accent):
- `ink #0E0E0E` page · `surface #161616` card · `surfaceAlt #1E1E1E` wells
- `line #2A2A2A` · `lineStrong #3A3A3A` borders
- `paper #FFFFFF` · `paperDim #A7A7A7` · `paperMute #6E6E6E` text
- `hiVis #E8FF52` — the ONE accent · `onHiVis #0E0E0E`

**Type roles:** Archivo (display, uppercase, used with restraint) · Inter (body) ·
Space Mono (all numeric/technical data: price, size, SKU). Load via expo-font;
fall back to system faces until added.

**Rules — these are what stop it looking like a template:**
1. **One accent per screen.** Hi-vis does exactly one job at a time (active tab,
   freshest drop, Add to Bag). One more hi-vis element = it becomes wallpaper.
2. **Numeric data is mono.** Prices, sizes, measurements read like garment spec tags.
3. **Hard edges.** Radius lives at 0–4. Rounded corners are the exception.
4. **SOLD is a flex, not an apology.** Hard inverted stamp (paper bg, ink text)
   over a dimmed photo — never a greyed-out dead cell. In resale, sold = desirable.

## Feature scope

Everything below is in scope **except a recommendation engine** (we use
"follow your sizes + brands" instead). Tagged by ship wave.

**v1 — core (the floor)**
- Browse + filters (brand, category, size, price)
- Resale-grade product page (photos, condition, measurements, authenticity)
- Cart · Checkout (Sheet Kit handoff) · Accounts (Shopify customer auth) · Order history
- "Just sold while you were looking" handling — quantity-one items aren't reserved
  until checkout completes, so two people can race for one piece. Design the loss
  gracefully; it's common here, not an edge case.

**v1 — differentiators (ship with launch)**
- Personalized drop alerts: follow sizes + brands, push only matching new arrivals.
  This is the reason the app exists. Do not defer it.
- Authenticity + condition as designed, visible UI on the product page.

**v1.x — makes it yours**
- Saved items reframed as urgency: still available / viewing now / just sold
- In-app "Sell to us": photos → brand/category/condition → submit
- Recently viewed · Trustpilot social proof

**v2 / v3 — later waves (need infra or 3rd-party tools)**
- Loyalty & referral (surface a Shopify loyalty app) · In-app chat (needs a support tool)
- Live selling (real-time video — its own mini-product; build last)

## Build order

1. Foundation: project scaffold, navigation shell
2. Mock data module + `Product` type + mappers
3. Home (collection grid) — proves the core loop
4. Product detail — the conversion screen
5. Saved · 6. Alerts · 7. Sell
8. (Backend phase) Storefront API client → swap mock module internals
9. Cart → Checkout Sheet Kit (requires EAS dev build) → Accounts → Order history
10. Push notifications + drop-alert delivery
11. Later waves per scope above

## Screen notes

- **Home:** 2-col ProductCard grid from `getNewArrivals()`, NEW badge, header +
  filter chips. Tap → Product detail.
- **Product detail:** image w/ condition tag, brand/title/price + discount call-out,
  prominent authenticity panel, measurements spec list, size, sticky hi-vis Add to Bag.
- **Saved:** urgency states (still available / viewing now / inverted SOLD stamp).
- **Alerts:** follow-sizes + follow-brands toggles, "matching you" drop feed with
  freshest item flagged hi-vis.
- **Sell:** 4-step explainer, photo dropzone, brand/category/condition rows, submit.

## App Store compliance (design around these now)

- **Payments:** physical goods consumed outside the app must NOT use IAP — use
  Shopify checkout (Sheet Kit). Apple takes 0%. Don't add anything that looks like
  a digital good (paid membership, credits) or you fall into IAP rules.
- **5.2.1 — who submits:** the app shows third-party luxury brand names/logos, so it
  MUST be submitted under Circular Fash's own **company** Apple Developer account
  (company enrollment, likely needs a D-U-N-S number), with seller/app metadata
  matching the business. Not a personal or contractor account → near-automatic reject.
  Be ready to show you're a legitimate retailer of authentic goods.
- **5.2 — authenticity:** keep the authentication/grading process real and defensible;
  a resale app gets scrutinized for counterfeits. (Doubles as the conversion feature.)
- **UGC (sell flow):** photo uploads trigger UGC rules — need a content policy, a
  report path, and basic moderation. Lighter for us since photos go privately to the
  team, not published to other shoppers.
- **Accounts:** if users can create an account, must offer in-app **account deletion**
  (5.1.1(v)). If offering social login, must also offer **Sign in with Apple** (4.8).
- **Not a wrapper (4.2):** native app with push/alerts/saved/sell is well clear of the
  "repackaged website" rejection.
- **Privacy (5.1):** accurate privacy nutrition labels, a privacy policy, justify each
  permission (push, camera for sell flow). Enforced strictly in 2026.
- **At submission:** provide a working demo account; keep backend live for the reviewer.

Not legal advice; Apple revises guidelines regularly. Official text:
https://developer.apple.com/app-store/review/guidelines

## Files already in the project

- `theme.ts` — design tokens (palette, type, spacing, radius, formatSEK). Source of truth.
- `ProductCard.tsx` — the product card in the street direction (NEW + SOLD states).

# Circular Fash — iOS App

Native iOS app for [circularfash.com](https://circularfash.com), a Sweden-based
Shopify store for one-of-one pre-owned luxury fashion. See **PROJECT.md** for the
locked product, design, and compliance decisions — read it first.

This repo is the **frontend-first** build: every screen runs on mock data today,
behind a single seam that swaps to the Shopify Storefront API later without the UI
changing.

## Run it

Requires **Node 18+** (this environment had Node 16, which Expo SDK 51 does not
support — upgrade before running).

```bash
npm install
npm start          # then press i for iOS simulator, or scan the QR in Expo Go
```

Browse / grid / detail / saved / alerts / sell all work in **Expo Go**. Checkout
needs the native Checkout Sheet Kit → switch to an **EAS dev build** for that phase
(see PROJECT.md).

```bash
npm run tsc        # type-check only
```

## Structure

```
App.tsx                      NavigationContainer + brand theme
index.ts                     Expo entry
src/
  theme.ts                   design tokens — the locked source of truth
  types/product.ts           the ONE normalized Product type (+ filters)
  data/mockProducts.ts       THE SEAM — getNewArrivals / getProduct / getSaved /
                             getMatchingDrops / getFacets. Swap internals for
                             Storefront calls later; signatures stay put.
  navigation/
    types.ts                 param lists (Tabs + Product stack)
    RootNavigator.tsx        bottom tabs over a stack; Product detail sits above
  components/
    ProductCard.tsx          grid card — NEW flash + inverted SOLD stamp
    Chip.tsx                 selectable filter/toggle chip
    Tag.tsx                  hard-edged spec tag
  screens/
    HomeScreen.tsx           2-col new-arrivals grid + brand filter chips
    ProductDetailScreen.tsx  carousel, authenticity panel, measurements,
                             sticky hi-vis Add to Bag, graceful SOLD
    SavedScreen.tsx          urgency states: available / viewing now / just sold
    AlertsScreen.tsx         follow brands + sizes → matching drop feed
    SellScreen.tsx           4-step explainer, photo dropzone, submit
    AccountScreen.tsx        hub tab → the v2/v3 engagement screens
    RewardsScreen.tsx        loyalty points, tier progress, redeem
    ReferScreen.tsx          referral code, share, give/get
    LiveScreen.tsx           live-selling shows (live / upcoming / replay)
    ChatScreen.tsx           support chat thread + composer
  data/
    catalogSnapshot.ts       REAL products from circularfash.com/products.json
    mockAccount.ts           seam for loyalty / referral / live / chat (stubs)
```

## Build status (per PROJECT.md build order)

- [x] 1. Foundation — scaffold + navigation shell
- [x] 2. Mock data module + `Product` type + mappers (the seam)
- [x] 3. Home (collection grid)
- [x] 4. Product detail
- [x] 5. Saved
- [x] 6. Alerts (follow sizes + brands feed)
- [x] 7. Sell
- [ ] 8. Storefront API client → swap the seam's internals
- [ ] 9. Cart → Checkout Sheet Kit (EAS dev build) → Accounts → Order history
- [ ] 10. Push notifications + drop-alert delivery
- [~] 11. Later waves — **frontend stubs built** (loyalty, referral, live, chat);
      wired to the mock seam, awaiting real vendors (see below)

## v2/v3 engagement stubs

Built ahead of schedule as **frontend-only stubs** behind `data/mockAccount.ts`.
The shapes are deliberately vendor-agnostic so adopting a real tool changes only
the data layer, never the screens:

- **Rewards / Referral** → a Shopify loyalty app (Smile.io / LoyaltyLion / Yotpo)
- **Support chat** → a support SDK (Intercom / Gorgias / Crisp)
- **Live selling** → a live-video provider

These are reachable from the **Account** tab. Treat them as UX placeholders, not
finished features — none are bound to a real backend yet.

## Notes / shortcuts taken in this pass

- **Fonts** — Archivo / Inter / Space Mono load via `expo-font` + `@expo-google-fonts`
  in `App.tsx`; swap weights there once.
- **Images** are the store's real Shopify CDN photos (capped `&width=900`). The
  catalog is a one-time snapshot — the live Storefront API replaces it in step 8.
- **Loyalty/chat/live/referral** data is in-memory mock; redeem/share/join CTAs
  are non-binding until the real vendors are wired.
- **Sell photo dropzone** is a stub — wire `expo-image-picker` (camera + library)
  in the real build; uploads go privately to the team (keeps UGC scope light).
- **Add to Bag** shows the one-of-one "not reserved until checkout" message; the
  actual Cart + Checkout Sheet Kit handoff is the backend phase.
- Follow-brands/sizes prefs are in-memory; persist + register for push later.

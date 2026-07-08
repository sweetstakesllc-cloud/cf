# Dev build & native checkout runbook

The app runs in **Expo Go / web** for everything except native modules. Two
features need a **custom dev build** (Expo Go can't load native code):

- **In-app checkout** — `@shopify/checkout-sheet-kit` (upgrades BUY NOW from
  "opens Safari" to an in-app modal). Checkout already *works* without this.
- **Push notifications** — the drop-alerts feature (real push needs a build).

You only have to do the build **once**; after that you run JS from Metro like
normal, and only rebuild when native dependencies change.

---

## 0. One-time prerequisites

- A free **Expo account** → https://expo.dev/signup
- For a **simulator** build: a Mac with Xcode (no Apple Developer account needed).
- For a **real iPhone** build: a paid **Apple Developer account** (and for the
  store, the *company* account — see PROJECT.md §App Store compliance).

```bash
npm i -g eas-cli          # or: npx eas-cli@latest ...
eas login                 # sign in to your Expo account
```

## 1. Add the dev client

```bash
npx expo install expo-dev-client
```

## 2. Build & run (pick one)

**iOS Simulator (fastest, no Apple account):**
```bash
eas build --profile development --platform ios
# when it finishes, install the .app on a booted simulator, then:
npx expo start --dev-client
```

**Real iPhone (needs Apple Developer account):**
```bash
eas build --profile development-device --platform ios
# scan the QR / install via the link, then:
npx expo start --dev-client
```

`eas.json` already defines the `development`, `development-device`, `preview`,
and `production` profiles.

---

## 3. Wire the native Checkout Sheet Kit

Checkout works today by opening the hosted URL in the browser
(`src/data/checkout.ts` → `presentCheckout`). To make it an in-app modal:

```bash
npx expo install @shopify/checkout-sheet-kit
```

Then swap the body of `presentCheckout(url)` in `src/data/checkout.ts`:

```ts
import { ShopifyCheckout } from '@shopify/checkout-sheet-kit';

export async function presentCheckout(url: string): Promise<void> {
  ShopifyCheckout.present(url);
  // optional: ShopifyCheckout.addEventListener('completed', ...) to route to
  // an order-confirmation screen and clear local state.
}
```

Nothing else changes — `buyNow()` and the BUY NOW button already call
`presentCheckout`. Keep the `Linking.openURL` version as a `Platform.OS === 'web'`
fallback so the web preview and Expo Go keep working.

> Rebuild the dev client after installing any native package (step 2), since
> the native binary changed.

---

## 4. Push notifications (later phase)

```bash
npx expo install expo-notifications expo-device
```
Then register for a push token, store it against the user's followed
sizes/brands, and deliver matching new-arrival alerts from the backend. Needs
the dev build (this step) plus APNs setup in the Apple Developer account.

---

## Notes

- The `.env` Storefront credentials are inlined at build time — make sure `.env`
  exists before `eas build` (or set them as EAS secrets for cloud builds:
  `eas secret:create`).
- Web/Expo Go remain fully usable for browse, product, saved, alerts UI, and the
  browser-based checkout. The dev build is only required for the native modal +
  push.

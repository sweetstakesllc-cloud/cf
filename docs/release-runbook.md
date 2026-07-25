# Circular Fash — v1.0 release runbook

Getting the app onto a phone for a demo and into App Review. Written 2026-07-25
against app version **1.0.0**, Expo SDK 51, EAS CLI 21.2.0.

TestFlight covers both jobs: it is the same binary you submit, so the build your
client taps through is the build Apple reviews. There is no faster path — Expo Go
cannot run this app (it is SDK 51; current Expo Go only supports the latest few
SDKs), and ad-hoc installs would need every demo device's UDID registered first.

---

## What v1.0 contains

**Shipping:** Home (live Shopify catalog, ~263 available), Saved, Product detail,
BUY NOW → Shopify hosted checkout, Account (storefront + policy links).

**Gated off** in `src/features.ts`: Alerts, Sell, Rewards, Refer, Live, Chat.
These are built and styled but backed by stubs in `src/data/mockAccount.ts`.
Apple reads simulated functionality as an incomplete app (guidelines 2.1 / 4.2),
so each stays off until its real backend lands. Flip a flag to `true` and the tab
or route returns to the navigator on its own — nothing was deleted.

---

## Prerequisites (only you can do these)

1. **Apple credentials.** The Apple Account is `info@circularfash.com`
   (Circular Fash AB, Team ID `D733G94FZQ`, Account Holder Oliver Friberg
   Qvarfordt). Whoever runs the build needs that login, or an Admin / App Manager
   seat on the team. If you don't hold it, get a seat added before starting —
   this is the single most common place this stalls.

2. **Commit your work.** EAS builds from your git tree; uncommitted changes are
   not included in the build. From the project root:

   ```sh
   git add -A && git commit -m "v1.0: gate mock features, add app icon, release metadata"
   ```

3. **Log in to EAS** (interactive — it opens a browser):

   ```sh
   npx eas login
   npx eas whoami     # should print your Expo account, not "Not logged in"
   ```

---

## Step 1 — push the Shopify credentials to EAS

**Do not skip this.** `.env` is gitignored, so a cloud build has no Shopify
token and the app silently falls back to the bundled 30-item offline snapshot.
Your client would be looking at stale demo stock.

```sh
npx eas env:push production --path .env --force
npx eas env:push preview    --path .env --force
```

Verify before building:

```sh
npx eas env:list production      # expect EXPO_PUBLIC_SHOPIFY_DOMAIN + _TOKEN
```

These are `EXPO_PUBLIC_*` variables, so they are inlined into the JS bundle and
are readable by anyone who unpacks the app. That is fine and by design — a
Shopify **Storefront** public access token is meant to be public. Never push a
Shopify Admin API token this way.

## Step 2 — build

```sh
npx eas build --platform ios --profile production
```

First run prompts for Apple credentials, then offers to create the bundle ID
(`com.circularfash.app`), distribution certificate and provisioning profile —
say yes to all. Takes roughly 15–25 minutes in the queue.

`appVersionSource` is `remote` and the production profile has `autoIncrement`,
so EAS owns the build number. You never edit it by hand; bump the marketing
version in `app.json` only when you want a new public version string.

## Step 3 — upload to App Store Connect

```sh
npx eas submit --platform ios --latest
```

If no app record exists yet, this offers to create one. Processing on Apple's
side takes another 10–30 minutes before the build appears in TestFlight.

## Step 4 — get it on your client's phone

In App Store Connect → **TestFlight**:

- **Internal testing** — instant, no review. Up to 100 testers, but each needs a
  seat on your App Store Connect team (Users and Access → invite their Apple ID).
  Best if your client will tolerate an invite.
- **External testing / public link** — a shareable link, no team seat needed, but
  the first build goes through **Beta App Review** (usually under a day).

Either way the client installs Apple's **TestFlight** app, then your build.

Do the demo from this build. Take your App Store screenshots from it too — see
below.

---

## Step 5 — the metadata Apple requires before you can submit

Everything here is entered in App Store Connect, not in code.

| Field | Value |
| --- | --- |
| Privacy policy URL | `https://circularfash.com/policies/privacy-policy` |
| Support URL | `https://circularfash.com/pages/contact` |
| Marketing URL (optional) | `https://circularfash.com/` |
| Category | Shopping |
| Age rating | 4+ (no objectionable content; commerce only) |
| Demo account | Not needed — no login exists in v1.0 |
| Export compliance | Already declared in code (`ITSAppUsesNonExemptEncryption: false`, HTTPS-only is exempt), so uploads stop asking |

**Screenshots.** Required for the 6.9" iPhone class (1320 × 2868 portrait);
App Store Connect scales these for smaller devices. Confirm the current required
sizes in ASC as you upload — Apple revises them. Take them on the TestFlight
build: Home grid, a product detail with BUY NOW, and Saved make a solid three.
Screenshots must show the real app; mockup frames with marketing copy are fine,
fabricated UI is not.

**App Privacy questionnaire.** The app itself collects nothing: no accounts, no
analytics or tracking SDKs, and checkout leaves the app entirely — `BUY NOW`
opens Shopify's hosted checkout in the system browser via `Linking.openURL`
(`src/data/checkout.ts:69`), so email and shipping details are collected by
Shopify in Safari, not by this binary. **"Data Not Collected"** is the accurate
answer. Re-answer this the moment you add analytics, push, or accounts.

**Review notes** — paste something like:

> Circular Fash is a curated second-hand fashion marketplace for Circular Fash AB
> (Lund, Sweden). Browse live inventory and tap BUY NOW to complete the purchase
> in Shopify's hosted checkout, which opens in Safari. No account or login is
> required, so no demo credentials are needed. Prices are in SEK.

---

## Known follow-ups after v1.0 ships

- **Accounts stay deferred.** The moment users can create an account you must
  also offer in-app account deletion (5.1.1(v)), and Sign in with Apple if you
  add any social login.
- **The icon is a generated CF wordmark** (`assets/icon.png`), not a brand asset.
  Swapping it later requires shipping an app update, so replace it now if a real
  mark exists.
- **Re-enabling a gated feature** means building its backend first, then flipping
  the flag in `src/features.ts`. Shipping one still stubbed risks a 2.1/4.2
  rejection on the *update*, which is slower than the first review.

## If a build fails

```sh
npx eas build:list --platform ios --limit 5    # find the build
npx eas build:view <build-id>                  # full logs
npm run typecheck && npx expo-doctor@latest    # reproduce locally first
```

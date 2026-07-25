/**
 * Circular Fash — release feature flags
 *
 * v1.0 ships BROWSE + BUY only. The screens below are built and styled, but
 * they are backed by frontend stubs (src/data/mockAccount.ts) rather than real
 * services. App Review treats simulated functionality as an incomplete app
 * (guidelines 2.1 App Completeness / 4.2 Minimum Functionality), so each one
 * stays off until its backend lands.
 *
 * Nothing is deleted. Flip a flag to `true` and the tab or route returns to the
 * navigator on its own — see src/navigation/RootNavigator.tsx.
 */
export const features = {
  /** Drop alerts. Needs expo-notifications + a dev build; matching is stubbed. */
  alerts: false,
  /** Seller intake. SellScreen currently discards submissions (alert only). */
  sell: false,
  /** Loyalty points + tiers. Needs Smile.io / LoyaltyLion. */
  rewards: false,
  /** Referral codes. Rides on whichever loyalty vendor is chosen. */
  refer: false,
  /** Live selling. Needs a video provider. */
  live: false,
  /** In-app support chat. Needs Intercom / Gorgias; replies are canned today. */
  chat: false,
} as const;

export type FeatureName = keyof typeof features;

/** Storefront URLs used by the Account screen and App Store metadata. */
export const links = {
  shop: 'https://circularfash.com/',
  contact: 'https://circularfash.com/pages/contact',
  shipping: 'https://circularfash.com/policies/shipping-policy',
  returns: 'https://circularfash.com/policies/refund-policy',
  privacy: 'https://circularfash.com/policies/privacy-policy',
  terms: 'https://circularfash.com/policies/terms-of-service',
} as const;

export default features;

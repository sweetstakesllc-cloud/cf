/**
 * Express single-item checkout for one-of-one inventory.
 *
 * Flow: BUY NOW -> Storefront `cartCreate` with the one variant -> hand the
 * returned `checkoutUrl` to Shopify's hosted checkout. We do NOT build a custom
 * checkout (see PROJECT.md) and we never take payment in-app (App Store 3.1.1 —
 * physical goods must not use IAP).
 *
 * Presentation is a seam (`presentCheckout`): Shopify's Checkout Sheet renders
 * the hosted checkout as an in-app modal, and anywhere that native module is
 * missing — web, Expo Go, or a binary built before it was added — it falls back
 * to opening the same URL in the system browser. NOTE the sheet only exists
 * after a rebuild; an over-the-air update alone will keep using the browser.
 */

import { Linking, Platform } from 'react-native';
import { storefront, shopifyConfigured } from './shopifyClient';
import { getMarket } from './market';
import { invalidateCatalog } from './mockProducts';
import type { Product } from '../types/product';

/** Thrown when a piece can't be taken to checkout (offline demo data, or the
 *  one-of-one just sold out from under the shopper). Callers show the graceful
 *  loss path — expected here, not an edge case. */
export class CheckoutUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutUnavailableError';
  }
}

// @inContext(country:) has to match the market the price was shown in, or the
// shopper is quoted CA$671 in the grid and then billed in kronor on Shopify's
// checkout. The catalogue queries carry this directive too — see
// src/data/shopify.ts. Both read the same market from src/data/market.ts.
const CART_CREATE = `
  mutation CartCreate($lines: [CartLineInput!]!, $country: CountryCode)
  @inContext(country: $country) {
    cartCreate(input: { lines: $lines }) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

type CartCreateResult = {
  cartCreate: {
    cart: { id: string; checkoutUrl: string } | null;
    userErrors: { field: string[] | null; message: string }[];
  };
};

/** Create a single-line cart and return its hosted checkout URL. */
export async function createCheckoutUrl(variantId: string): Promise<string> {
  const data = await storefront<CartCreateResult>(CART_CREATE, {
    lines: [{ merchandiseId: variantId, quantity: 1 }],
    country: getMarket().country,
  });

  const { cart, userErrors } = data.cartCreate;
  if (userErrors.length) {
    throw new CheckoutUnavailableError(userErrors[0].message);
  }
  if (!cart?.checkoutUrl) {
    throw new CheckoutUnavailableError('Checkout could not be started.');
  }
  return cart.checkoutUrl;
}

/**
 * Shopify's Checkout Sheet, created once and reused.
 *
 * Required lazily and behind a try/catch because it is a native module: it does
 * not exist on web, and it does not exist in a binary built before it was
 * added. Both cases fall through to the system browser rather than failing —
 * the shopper still gets to Shopify's checkout either way, which is what
 * matters when they are one tap from paying.
 */
let sheet: { present(url: string): void } | null | undefined;

function getSheet() {
  if (sheet !== undefined) return sheet;
  if (Platform.OS === 'web') {
    sheet = null;
    return sheet;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kit = require('@shopify/checkout-sheet-kit');
    const instance = new kit.ShopifyCheckoutSheet({
      colorScheme: kit.ColorScheme.light, // app.json pins userInterfaceStyle to light
    });
    // A one-of-one just sold. Drop the cached catalogue so it stops showing as
    // available in the grid the shopper returns to.
    instance.addEventListener('completed', () => invalidateCatalog());
    sheet = instance;
  } catch (err) {
    console.warn('[checkout] sheet unavailable, using system browser:', err);
    sheet = null;
  }
  return sheet;
}

/**
 * Hand a checkout URL to Shopify's hosted checkout.
 *
 * In-app modal where the native module is present, system browser otherwise.
 * Either way this is Shopify's own checkout — we never take payment ourselves
 * (App Store 3.1.1: physical goods must not use IAP).
 */
export async function presentCheckout(url: string): Promise<void> {
  const s = getSheet();
  if (s) {
    try {
      s.present(url);
      return;
    } catch (err) {
      console.warn('[checkout] sheet present failed, falling back:', err);
    }
  }

  const can = await Linking.canOpenURL(url);
  if (!can) throw new CheckoutUnavailableError('Unable to open checkout.');
  await Linking.openURL(url);
}

/** One call for the BUY NOW button: mint the checkout and present it. */
export async function buyNow(product: Product): Promise<void> {
  if (!shopifyConfigured || !product.variantId) {
    // Offline snapshot / demo data has no live variant to transact.
    throw new CheckoutUnavailableError(
      'Live checkout isn’t configured for this item.'
    );
  }
  if (!product.availableForSale) {
    throw new CheckoutUnavailableError('This piece has just sold.');
  }
  const url = await createCheckoutUrl(product.variantId);
  await presentCheckout(url);
}

/**
 * Express single-item checkout for one-of-one inventory.
 *
 * Flow: BUY NOW -> Storefront `cartCreate` with the one variant -> hand the
 * returned `checkoutUrl` to Shopify's hosted checkout. We do NOT build a custom
 * checkout (see PROJECT.md) and we never take payment in-app (App Store 3.1.1 —
 * physical goods must not use IAP).
 *
 * Presentation is a seam (`presentCheckout`):
 *   - Today it opens the hosted checkout URL in the system browser via Linking,
 *     which works everywhere — web, Expo Go, and a device build. Fully
 *     functional and store-compliant.
 *   - Once an EAS dev build exists, swap the body of `presentCheckout` for
 *     @shopify/checkout-sheet-kit's `.present(url)` so checkout renders as an
 *     in-app modal. Nothing else changes — callers stay the same.
 */

import { Linking } from 'react-native';
import { storefront, shopifyConfigured } from './shopifyClient';
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

const CART_CREATE = `
  mutation CartCreate($lines: [CartLineInput!]!) {
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

/** Hand a checkout URL to Shopify's hosted checkout. Native module swap-in
 *  point (see file header). */
export async function presentCheckout(url: string): Promise<void> {
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

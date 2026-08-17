/**
 * The market a shopper is browsing in — country in, currency out.
 *
 * circularfash.com sells into 46 countries across 27 currencies, and the app
 * used to hardcode "kr" on every price. Shopify does the conversion: the
 * Storefront API takes an `@inContext(country:)` directive and returns prices
 * already in that country's currency, so nothing is converted here.
 *
 * State is module-level rather than React context because the data seam
 * (mockProducts.ts) needs to read it too, and it has no component tree to sit
 * in. Screens subscribe with `onMarketChange`.
 *
 * NOTE: the choice does not survive an app restart. Persisting it needs
 * AsyncStorage, which is a native module; adding one is a rebuild, so it was
 * left out of this pass. Every launch starts in the shop's home market.
 */

import { storefront, shopifyConfigured } from './shopifyClient';

export type Market = {
  /** ISO 3166-1 alpha-2, e.g. "SE". What @inContext takes. */
  country: string;
  /** ISO 4217, e.g. "SEK". What prices come back in. */
  currency: string;
  name: string;
};

/** The shop's own market. Also the fallback whenever the list can't be loaded. */
export const HOME_MARKET: Market = { country: 'SE', currency: 'SEK', name: 'Sweden' };

let current: Market = HOME_MARKET;
const listeners = new Set<() => void>();

export function getMarket(): Market {
  return current;
}

export function setMarket(next: Market): void {
  if (next.country === current.country) return;
  current = next;
  listeners.forEach((fn) => fn());
}

/** Subscribe to market changes. Returns an unsubscribe. */
export function onMarketChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// @inContext(language: EN) because country names come back in the shop's
// default language otherwise — the picker read "Albanien / Danmark / Frankrike"
// inside an app whose every other word is English.
const COUNTRIES_QUERY = `
  query Markets @inContext(language: EN) {
    localization {
      availableCountries { isoCode name currency { isoCode } }
    }
  }
`;

type CountriesResponse = {
  localization: {
    availableCountries: { isoCode: string; name: string; currency: { isoCode: string } }[];
  };
};

let _markets: Market[] | null = null;

/**
 * Every country the store sells into, alphabetical. Cached for the session —
 * markets change when someone edits Shopify settings, not while the app runs.
 */
export async function fetchMarkets(): Promise<Market[]> {
  if (_markets) return _markets;
  if (!shopifyConfigured) return [HOME_MARKET];
  try {
    const data = await storefront<CountriesResponse>(COUNTRIES_QUERY);
    const list = data.localization.availableCountries
      .map((c) => ({ country: c.isoCode, currency: c.currency.isoCode, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    _markets = list.length ? list : [HOME_MARKET];
    return _markets;
  } catch (err) {
    console.warn('[market] falling back to home market:', err);
    return [HOME_MARKET];
  }
}

/**
 * THE SEAM. (See PROJECT.md — "The mock-data seam".)
 *
 * Every screen imports data ONLY from this module — never inline literals.
 * Today it returns hand-authored sample products. Later, the bodies of these
 * functions are replaced with Shopify Storefront API calls + a mapper into the
 * normalized `Product` type. The function signatures, and therefore the UI,
 * never change.
 *
 * Keep this file honest to that contract:
 *  - export functions, not raw arrays
 *  - return Promises so swapping in async network calls is a no-op for callers
 *  - do all "shaping" (filtering, sorting, urgency) here, not in screens
 */

import type {
  Product,
  ProductFilter,
  Condition,
} from '../types/product';

// Real catalog snapshot (circularfash.com) — the offline stand-in.
import { CATALOG } from './catalogSnapshot';
// Live Storefront read path — used automatically when credentials are present.
import { shopifyConfigured, fetchProducts, fetchProduct } from './shopify';
import { onMarketChange } from './market';

/**
 * The single source of truth for "all products". Live Storefront data when the
 * app is configured (EXPO_PUBLIC_SHOPIFY_*), otherwise the bundled snapshot.
 * Result is cached for the session; the live product list is fetched once.
 */
let _catalog: Product[] | null = null;
async function getCatalog(): Promise<Product[]> {
  if (!shopifyConfigured) return CATALOG;
  if (_catalog) return _catalog;
  try {
    _catalog = await fetchProducts();
    return _catalog;
  } catch (err) {
    // Network/credential failure → degrade to the snapshot rather than an empty app.
    console.warn('[shopify] falling back to snapshot:', err);
    return CATALOG;
  }
}

/**
 * Drop the cached catalogue so the next read re-asks Shopify.
 *
 * Called on two events. A market switch, because prices are baked in by the
 * market they were fetched in — the grid would keep showing kronor after the
 * shopper picked dollars. And a completed checkout, because the piece they just
 * bought is the only one: leaving it in the cache means watching it sit in the
 * grid, still apparently for sale, immediately after buying it.
 */
export function invalidateCatalog(): void {
  _catalog = null;
}

onMarketChange(invalidateCatalog);

/**
 * Sold stock is not browsable, matching circularfash.com. It stays in the
 * catalogue and keeps its product page — Saved still shows it, stamped SOLD,
 * so a piece you lost is accounted for rather than silently gone.
 */
const inStock = (p: Product) => p.availableForSale;

const clone = (p: Product): Product => ({ ...p });

function byNewest(a: Product, b: Product): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

/* ----------------------------------------------------------------------------
 * Public seam API. Screens use ONLY these.
 * ------------------------------------------------------------------------- */

/**
 * Home grid: freshest first, in stock only. Optionally narrowed by facets.
 * Pass `inStockOnly: false` explicitly to include sold pieces.
 */
export async function getNewArrivals(filter?: ProductFilter): Promise<Product[]> {
  const f: ProductFilter = { inStockOnly: true, ...filter };
  const list = (await getCatalog())
    .slice()
    .sort(byNewest)
    .filter((p) => matchesFilter(p, f));
  return list.map(clone);
}

/** Single product for the detail screen. */
export async function getProduct(id: string): Promise<Product | null> {
  // Live: query the product directly for the fullest images/variants. Snapshot:
  // resolve from the bundled catalog.
  if (shopifyConfigured) {
    try {
      return await fetchProduct(id);
    } catch (err) {
      console.warn('[shopify] getProduct fallback:', err);
    }
  }
  const found = (await getCatalog()).find((p) => p.id === id);
  return found ? clone(found) : null;
}

/**
 * Saved items, reframed as urgency (PROJECT.md v1.x). Pairs each saved product
 * with a live status so the Saved screen can show "still available / viewing
 * now / just sold" instead of a dead wishlist.
 */
export type SavedStatus = 'available' | 'viewing' | 'sold';
export type SavedItem = { product: Product; status: SavedStatus; viewers?: number };

const SAVED_IDS: Record<string, { status: SavedStatus; viewers?: number }> = {
  'cf-10112148078920': { status: 'viewing', viewers: 3 },  // Moncler Kenya Field Jacket
  'cf-10112144376136': { status: 'available' },            // Stone Island Shadow Sweatshirt
  'cf-10112146866504': { status: 'sold' },                 // Moncler Gui Vest — raced and lost
  'cf-10112311329096': { status: 'available' },            // Gucci GG Supreme Shoulder Bag
  'cf-10112154763592': { status: 'sold' },                 // Gucci GG Belt
};

export async function getSaved(): Promise<SavedItem[]> {
  const catalog = await getCatalog();
  let items: SavedItem[] = Object.entries(SAVED_IDS)
    .map(([id, meta]): SavedItem | null => {
      const product = catalog.find((p) => p.id === id);
      if (!product) return null;
      // Status reflects live availability; a sold product can't be "available".
      const status: SavedStatus = product.availableForSale ? meta.status : 'sold';
      return { product: clone(product), status, viewers: meta.viewers };
    })
    .filter((x): x is SavedItem => x !== null);

  // Live store ids won't match the snapshot's SAVED_IDS — until saved lists are
  // user-backed, seed a small demo set from the live catalog so the screen isn't
  // empty. (Removed once a real wishlist/customer backend lands.)
  if (items.length === 0 && catalog.length) {
    const rotate: SavedStatus[] = ['viewing', 'available', 'sold', 'available', 'sold'];
    items = catalog.slice(0, 5).map((product, i) => {
      const status: SavedStatus = product.availableForSale ? rotate[i % rotate.length] : 'sold';
      return { product: clone(product), status, viewers: status === 'viewing' ? 3 : undefined };
    });
  }
  return items;
}

/**
 * Alert feed: new arrivals matching the user's followed sizes + brands.
 * The reason the app exists (PROJECT.md). Newest first; caller flags the top
 * one hi-vis.
 */
export async function getMatchingDrops(prefs: {
  brands: string[];
  sizes: string[];
}): Promise<Product[]> {
  const brands = new Set(prefs.brands);
  const sizes = new Set(prefs.sizes);
  const list = (await getCatalog())
    .filter((p) => {
      if (!p.availableForSale) return false;
      const brandHit = brands.size === 0 || brands.has(p.brand);
      const sizeHit = sizes.size === 0 || (p.size != null && sizes.has(p.size));
      return brandHit && sizeHit;
    })
    .sort(byNewest);
  return list.map(clone);
}

/** Facet values for filter UIs — derived from the catalog, never hardcoded in screens. */
export async function getFacets(): Promise<{
  brands: string[];
  categories: string[];
  sizes: string[];
  conditions: Condition[];
  /** How many buyable pieces sit behind each brand / category. */
  brandCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  total: number;
}> {
  // Derived from what is actually buyable. Facets taken over the whole
  // catalogue would offer brands and categories that are 100% sold — every one
  // a chip that leads to an empty grid. The website hides empty collections for
  // the same reason.
  const PRODUCTS = (await getCatalog()).filter(inStock);
  const uniq = (xs: (string | null | undefined)[]) =>
    Array.from(new Set(xs.filter((x): x is string => !!x))).sort();
  const tally = (xs: (string | null | undefined)[]) =>
    xs.reduce<Record<string, number>>((acc, x) => {
      if (x) acc[x] = (acc[x] ?? 0) + 1;
      return acc;
    }, {});

  const brandCounts = tally(PRODUCTS.map((p) => p.brand));
  return {
    // Brands lead by depth, not alphabet: "what do they actually have" is
    // answered by Moncler 56 before it is answered by Ami 1.
    brands: uniq(PRODUCTS.map((p) => p.brand)).sort(
      (a, b) => (brandCounts[b] ?? 0) - (brandCounts[a] ?? 0) || a.localeCompare(b)
    ),
    categories: uniq(PRODUCTS.map((p) => p.category)),
    sizes: uniq(PRODUCTS.map((p) => p.size ?? undefined)),
    conditions: ['Excellent', 'Very Good', 'Good', 'Fair'],
    brandCounts,
    categoryCounts: tally(PRODUCTS.map((p) => p.category)),
    total: PRODUCTS.length,
  };
}

/* -------------------------------- internals ------------------------------ */

function matchesFilter(p: Product, f: ProductFilter): boolean {
  if (f.brands?.length && !f.brands.includes(p.brand)) return false;
  if (f.categories?.length && (!p.category || !f.categories.includes(p.category))) return false;
  if (f.sizes?.length && (!p.size || !f.sizes.includes(p.size))) return false;
  if (f.minPrice != null && p.price < f.minPrice) return false;
  if (f.maxPrice != null && p.price > f.maxPrice) return false;
  if (f.inStockOnly && !p.availableForSale) return false;
  return true;
}

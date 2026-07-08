/**
 * The one normalized Product shape. Every screen consumes ONLY this type.
 *
 * This is the frontend side of the mock-data seam (see PROJECT.md). When the
 * backend lands, the Storefront GraphQL response is mapped INTO this shape
 * (vendor -> brand, priceRange.minVariantPrice.amount -> price, etc.) inside
 * the data module — the UI layer never touches a raw API shape, and never
 * changes when the seam is swapped.
 */

export type Measurement = {
  label: string; // e.g. "Chest", "Length", "Sleeve"
  value: string; // e.g. "56 cm" — kept as a string; these are spec-tag values
};

/**
 * Garment condition grade. Resale lives or dies on this being honest and
 * legible (App Store 5.2 scrutinizes resale authenticity too). Ordered best
 * to worst so UI can rank/compare if needed.
 */
export type Condition = 'Excellent' | 'Very Good' | 'Good' | 'Fair';

export type Authenticity = {
  verified: boolean;
  /** Who/what stands behind it, e.g. "Verified in-house by Circular Fash". */
  verifiedBy?: string;
  /** Short human note shown on the product page authenticity panel. */
  note?: string;
};

export type Product = {
  id: string;
  /**
   * Shopify variant GID of the piece to purchase (the cart's `merchandiseId`).
   * One-of-one items have a single variant. Optional because the offline
   * catalog snapshot can't transact; live products always carry it.
   */
  variantId?: string;
  brand: string; // Shopify "vendor"
  title: string;
  images: string[]; // first image is the hero; cards use images[0]
  price: number; // in SEK
  compareAtPrice?: number | null; // original price when discounted
  size?: string | null;
  availableForSale: boolean;
  isNew?: boolean; // derive from createdAt or a tag
  condition?: Condition;
  category?: string; // e.g. "Jackets", "Knitwear" — drives filters
  sku?: string; // shown mono on the product page
  description?: string;
  measurements?: Measurement[];
  authenticity?: Authenticity;
  /** ISO timestamp of when it landed — powers "freshest drop" + alert ordering. */
  createdAt?: string;
};

/** Filter facets a browse screen can narrow by. All optional = no filter. */
export type ProductFilter = {
  brands?: string[];
  categories?: string[];
  sizes?: string[];
  /** Inclusive SEK bounds. */
  minPrice?: number;
  maxPrice?: number;
  /** When true, hide sold pieces. Default surfaces them (SOLD is a flex). */
  inStockOnly?: boolean;
};

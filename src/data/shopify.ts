/**
 * Live Storefront read path. Maps Shopify GraphQL into the normalized `Product`
 * type — the same shape the catalog snapshot proves — so screens never change.
 *
 * Exposes: fetchProducts() and fetchProduct(id). The seam (mockProducts.ts)
 * delegates to these when `shopifyConfigured` is true, otherwise uses CATALOG.
 */

import { storefront, shopifyConfigured } from './shopifyClient';
import { getMarket } from './market';
import type { Product, Condition } from '../types/product';

export { shopifyConfigured };

/* ------------------------------ brand/category --------------------------- */
// The store sets `vendor` to "Circular Fash", so the actual label lives in the
// title — same parsing the snapshot generator uses.
// Mirrors the BRANDS menu on circularfash.com, plus the labels that still turn
// up in titles. Longest first, so "Christian Louboutin" is not shadowed by
// "Dior" and "Amiri" is not swallowed by "Ami".
const KNOWN_BRANDS = [
  'Christian Louboutin', 'Vivienne Westwood', 'Alviero Martini', 'Bottega Veneta',
  'Philippe Model', 'Giuseppe Zanotti', 'Moose Knuckles', 'Dolce & Gabbana',
  'Saint Laurent', 'Louis Vuitton', 'Stone Island', 'C.P. Company', 'Canada Goose',
  'Palm Angels', 'Parajumpers', 'Loro Piana', 'Philipp Plein', 'Jacquemus',
  'Balenciaga', 'Dsquared2', 'Off-White', 'Louboutin', 'Valentino', 'Burberry',
  'Givenchy', 'Woolrich', 'Moncler', 'Balmain', 'Versace', 'Lanvin', 'Celine',
  'Chanel', 'Amiri', 'Gucci', 'Prada', 'Fendi', 'Dior', 'Ami',
].sort((a, b) => b.length - a.length);

function brandOf(title: string, vendor?: string): string {
  if (vendor && vendor.toLowerCase() !== 'circular fash' && vendor.trim()) return vendor;
  const hay = title.toLowerCase();
  // Word-boundary match, or "Ami" hits "Miami" and "Dior" hits nothing useful
  // inside a longer word. Escaped because of "C.P. Company" and "Dolce & …".
  const hit = KNOWN_BRANDS.find((b) => {
    const needle = b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${needle}([^a-z]|$)`).test(hay);
  });
  return hit || title.split(' ')[0];
}

function stripBrand(title: string, brand: string): string {
  const re = new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const out = title.replace(re, '').trim();
  return out || title;
}

// Luxury bags/leather goods are usually titled by model name, not the word "bag"
// (LV Keepall, Neverfull, Alma, Pochette; Gucci clutch/wallet…). Match those too.
const BAG_MODELS =
  /bag|messenger|pouch|pochette|neverfull|keepall|bandouli|backpack|clutch|wallet|handbag|tote|crossbody|satchel|purse|speedy|jolly|jolicoeur|berkeley|\balma\b/;

function categoryOf(title: string, _productType?: string): string | undefined {
  // `product_type` is NOT a category on this store. Only 7 of 250 products
  // carry one at all, and every value is a model name — Abbey, Diana, GGBelt,
  // Jolicoeur. Trusting it put those straight into the category chips as if
  // they were departments. The title is the honest signal here.
  const s = title.toLowerCase();
  if (/\bbelt\b/.test(s)) return 'Belts';
  if (/sunglass|eyewear|\bglasses\b/.test(s)) return 'Eyewear';
  if (BAG_MODELS.test(s)) return 'Bags';
  if (/\bvest\b|gilet/.test(s)) return 'Vests';
  if (/jacket|parka|coat/.test(s)) return 'Jackets';
  if (/hoodie|sweatshirt|zip|track ?top|tracksuit/.test(s)) return 'Hoodies';
  if (/polo|shirt/.test(s) && !/t-?shirt/.test(s)) return 'Shirts';
  if (/t-?shirt|tee/.test(s)) return 'T-Shirts';
  if (/jean|trouser|pant/.test(s)) return 'Trousers';
  if (/\bskirt\b/.test(s)) return 'Skirts';
  if (/beanie|cap|hat/.test(s)) return 'Headwear';
  if (/bracelet|necklace|ring/.test(s)) return 'Jewellery';
  return undefined;
}

const CONDITION_TAGS: Condition[] = ['Excellent', 'Very Good', 'Good', 'Fair'];
function conditionFromTags(tags: string[]): Condition | undefined {
  const lower = tags.map((t) => t.toLowerCase());
  return CONDITION_TAGS.find((c) => lower.includes(c.toLowerCase()));
}

/* --------------------------------- mapping ------------------------------- */

type Money = { amount: string } | null;
type GqlProduct = {
  id: string;
  handle: string;
  title: string;
  vendor?: string;
  productType?: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  availableForSale: boolean;
  priceRange: { minVariantPrice: { amount: string; currencyCode?: string } };
  compareAtPriceRange?: { minVariantPrice: Money };
  images: { edges: { node: { url: string } }[] };
  variants: {
    edges: {
      node: {
        id: string;
        sku?: string | null;
        availableForSale: boolean;
        price: { amount: string };
        selectedOptions: { name: string; value: string }[];
      };
    }[];
  };
};

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function mapProduct(n: GqlProduct): Product {
  const brand = brandOf(n.title, n.vendor);
  const title = stripBrand(n.title, brand);

  const price = parseFloat(n.priceRange.minVariantPrice.amount);
  const cmpAmount = n.compareAtPriceRange?.minVariantPrice?.amount;
  const compareAtPrice = cmpAmount && parseFloat(cmpAmount) > price ? parseFloat(cmpAmount) : null;

  // size: read the "Size" option from an available variant if possible
  const variants = n.variants.edges.map((e) => e.node);
  const withSize = variants.find((v) => v.selectedOptions.some((o) => /size/i.test(o.name)));
  const chosen = variants.find((v) => v.availableForSale) || withSize || variants[0];
  const sizeOpt = chosen?.selectedOptions.find((o) => /size/i.test(o.name));
  let size = sizeOpt?.value ?? null;
  if (size && /one size/i.test(size)) size = 'OS';

  const isNew = n.createdAt ? Date.now() - new Date(n.createdAt).getTime() < RECENT_MS : false;

  return {
    id: n.id,
    variantId: chosen?.id,
    brand,
    title,
    images: n.images.edges.map((e) => e.node.url),
    price,
    compareAtPrice,
    size,
    // Whatever @inContext resolved to. Prices are already converted, so the
    // code is only needed to print the right symbol next to them.
    currencyCode: n.priceRange.minVariantPrice.currencyCode ?? getMarket().currency,
    availableForSale: n.availableForSale,
    isNew,
    condition: conditionFromTags(n.tags ?? []),
    category: categoryOf(n.title, n.productType),
    sku: chosen?.sku || n.handle,
    description: n.description,
    createdAt: n.createdAt,
    authenticity: {
      verified: true,
      verifiedBy: 'Verified in-house by Circular Fash',
      note: 'Authenticated against brand references; condition graded by our team.',
    },
  };
}

/* --------------------------------- queries ------------------------------- */

const PRODUCT_FIELDS = `
  id
  handle
  title
  vendor
  productType
  description
  tags
  createdAt
  availableForSale
  priceRange { minVariantPrice { amount currencyCode } }
  compareAtPriceRange { minVariantPrice { amount } }
  images(first: 6) { edges { node { url } } }
  variants(first: 50) {
    edges { node { id sku availableForSale price { amount } selectedOptions { name value } } }
  }
`;

// @inContext(country:) is what makes prices arrive in the shopper's currency.
// Shopify does the conversion and rounding against the market's rules, so the
// app never converts anything itself — it just prints what it is given.
const PRODUCTS_QUERY = `
  query Products($first: Int!, $after: String, $country: CountryCode)
  @inContext(country: $country) {
    products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges { node { ${PRODUCT_FIELDS} } }
    }
  }
`;

const PRODUCT_QUERY = `
  query Product($id: ID!, $country: CountryCode) @inContext(country: $country) {
    node(id: $id) { ... on Product { ${PRODUCT_FIELDS} } }
  }
`;

type ProductsPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: GqlProduct }[];
  };
};

// Pull the whole channel, not just the first page. The Storefront API caps
// `first` at 250, so we page with the cursor until it's exhausted. The catalog
// runs a few hundred one-of-one pieces (293 at last count), so this is 1–2
// round trips; the `page` guard is just a runaway-loop backstop.
export async function fetchProducts(): Promise<Product[]> {
  const out: Product[] = [];
  const country = getMarket().country;
  let after: string | null = null;
  for (let page = 0; page < 40; page++) {
    const data: ProductsPage = await storefront<ProductsPage>(PRODUCTS_QUERY, {
      first: 250,
      after,
      country,
    });
    out.push(...data.products.edges.map((e) => mapProduct(e.node)));
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }
  return out;
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const data = await storefront<{ node: GqlProduct | null }>(PRODUCT_QUERY, {
    id,
    country: getMarket().country,
  });
  return data.node ? mapProduct(data.node) : null;
}

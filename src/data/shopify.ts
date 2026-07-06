/**
 * Live Storefront read path. Maps Shopify GraphQL into the normalized `Product`
 * type — the same shape the catalog snapshot proves — so screens never change.
 *
 * Exposes: fetchProducts() and fetchProduct(id). The seam (mockProducts.ts)
 * delegates to these when `shopifyConfigured` is true, otherwise uses CATALOG.
 */

import { storefront, shopifyConfigured } from './shopifyClient';
import type { Product, Condition } from '../types/product';

export { shopifyConfigured };

/* ------------------------------ brand/category --------------------------- */
// The store sets `vendor` to "Circular Fash", so the actual label lives in the
// title — same parsing the snapshot generator uses.
const KNOWN_BRANDS = [
  'Stone Island', 'C.P. Company', 'Moncler', 'Gucci', 'Off-White', 'Prada',
  'Canada Goose', 'Louis Vuitton', 'Balenciaga', 'Burberry', 'Dior',
  'Saint Laurent', 'Bottega Veneta', 'Dsquared2', 'Versace', 'Fendi',
  'Givenchy', 'Palm Angels', 'Amiri', 'Vivienne Westwood',
  'Balmain', 'Celine', 'Chanel',
];

function brandOf(title: string, vendor?: string): string {
  if (vendor && vendor.toLowerCase() !== 'circular fash' && vendor.trim()) return vendor;
  return KNOWN_BRANDS.find((b) => title.toLowerCase().includes(b.toLowerCase())) || title.split(' ')[0];
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

function categoryOf(title: string, productType?: string): string | undefined {
  if (productType && productType.trim()) return productType;
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
  priceRange: { minVariantPrice: { amount: string } };
  compareAtPriceRange?: { minVariantPrice: Money };
  images: { edges: { node: { url: string } }[] };
  variants: {
    edges: {
      node: {
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
    brand,
    title,
    images: n.images.edges.map((e) => e.node.url),
    price,
    compareAtPrice,
    size,
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
    edges { node { sku availableForSale price { amount } selectedOptions { name value } } }
  }
`;

const PRODUCTS_QUERY = `
  query Products($first: Int!) {
    products(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges { node { ${PRODUCT_FIELDS} } }
    }
  }
`;

const PRODUCT_QUERY = `
  query Product($id: ID!) {
    node(id: $id) { ... on Product { ${PRODUCT_FIELDS} } }
  }
`;

export async function fetchProducts(first = 100): Promise<Product[]> {
  const data = await storefront<{ products: { edges: { node: GqlProduct }[] } }>(PRODUCTS_QUERY, {
    first,
  });
  return data.products.edges.map((e) => mapProduct(e.node));
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const data = await storefront<{ node: GqlProduct | null }>(PRODUCT_QUERY, { id });
  return data.node ? mapProduct(data.node) : null;
}

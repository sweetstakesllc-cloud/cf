/* DEV ONLY — shared field derivation.
 *
 * The store has no structured designer/category/condition field: vendor is
 * "Circular Fash" on every product and product_type holds the style name. These
 * functions recover those fields from the title and description.
 *
 * Used by BOTH generate.js (renders the mockup pages) and cleanup.js (writes the
 * same values back through the Admin API). Keep them here so the pages the client
 * signed off on and the data written to the store can never disagree.
 */

// Longest first, so "Polo Ralph Lauren" wins over "Ralph Lauren".
const DESIGNERS = [
  'Louis Vuitton', 'Christian Louboutin', 'Salvatore Ferragamo', 'Bottega Veneta',
  'Alexander McQueen', 'Vivienne Westwood', 'Maison Margiela', 'Comme des Garcons',
  'Polo Ralph Lauren', 'Emporio Armani', 'Stone Island', 'Canada Goose',
  'Saint Laurent', 'Acne Studios', 'The North Face', 'Tommy Hilfiger',
  'Axel Arigato', 'Palm Angels', 'Isabel Marant', 'Ralph Lauren', 'Hugo Boss',
  'Jimmy Choo', 'Parajumpers', 'CP Company', 'Napapijri', 'Off-White',
  'Balenciaga', 'Dsquared2', 'Longchamp', 'Valentino', 'Givenchy', 'Burberry',
  'Moncler', 'Woolrich', 'Belstaff', 'Mulberry', 'Michael Kors', 'Filippa K',
  'Our Legacy', 'Max Mara', 'Jil Sander', 'Miu Miu', 'Balmain', 'Barbour',
  'Trapstar', 'Corteiz', 'Represent', 'Chrome Hearts', 'Marc Jacobs',
  'Armani', 'Versace', 'Carhartt', 'Patagonia', 'Arcteryx', 'Champion',
  'Lacoste', 'Ellesse', 'Toteme', 'Ganni', 'Loewe', 'Marni', 'Kenzo',
  'Hermes', 'Chanel', 'Celine', 'Fendi', 'Prada', 'Gucci', 'Dior', 'Coach',
  'Furla', 'Amiri', 'Diesel', 'Stussy', 'Adidas', 'Nike', 'Levis', 'Fila',
  'Kappa', 'Nudie',
  // Added after the first pass surfaced them in the unmatched list.
  'Giuseppe Zanotti', 'Alexander Wang', 'Rick Owens', 'Thom Browne',
  'Off White', 'MCM',
  'Lanvin', 'Ami Paris', 'Ami', 'Etro', 'Zegna', 'Brunello Cucinelli',
  'Herno', 'Mackage', 'Nobis', 'Peak Performance', 'Holzweiler', 'Rains',
  'Sandro', 'Maje', 'Iro', 'Pinko', 'Twinset', 'Liu Jo', 'Elisabetta Franchi',
  // Added after running the cleanup over all 524 products rather than only the
  // in-stock 208 — these appear solely on sold items.
  'Alviero Martini', 'Dolce & Gabbana', 'Philippe Model', 'Jacquemus', 'Cartier',
];

// Observed misspellings in the live catalogue.
const TYPOS = [
  [/lo?uis\s+vo?ui?tton/i, 'Louis Vuitton'],
  [/vuiton\b/i,            'Louis Vuitton'],
  [/moncler?r\b/i,         'Moncler'],
  [/c[ée]line/i,           'Celine'],
];

// The catalogue writes brands inconsistently — "C.P. Company", "C.P Company"
// and "CP Company" are all the same label. Flatten punctuation before matching
// so one list entry covers every spelling.
const flatten = s => String(s).toLowerCase().replace(/[.'’\-]/g, '').replace(/\s+/g, ' ');

function designerOf(title) {
  for (const [re, name] of TYPOS) if (re.test(title)) return name;
  const t = flatten(title);
  for (const d of DESIGNERS) if (t.includes(flatten(d))) return d;
  return null;
}

const tidy = s => s.replace(/^[\s\-–—·,|]+|[\s\-–—·,|]+$/g, '').replace(/\s{2,}/g, ' ');

// Remove the designer's words from the title regardless of how they were
// punctuated, by matching on the flattened form of each word window.
function stripDesigner(title, designer) {
  if (!designer) return title;
  let tokens = title.split(/\s+/).filter(Boolean);
  const target = flatten(designer);
  for (let size = Math.min(4, tokens.length); size >= 1; size--) {
    for (let i = 0; i + size <= tokens.length; i++) {
      if (flatten(tokens.slice(i, i + size).join(' ')) === target) {
        return tidy(tokens.slice(0, i).concat(tokens.slice(i + size)).join(' ')) || title;
      }
    }
  }
  let t = title;
  for (const [re] of TYPOS) t = t.replace(re, '');
  return tidy(t) || title;
}

// Every alternative gets a trailing `s?` — the catalogue pluralises freely
// ("Sneakers", "Jeans", "Pants", "Shorts"), and \bsneaker\b does not match
// "Sneakers". Without it ~12% of titles fall through to 'Other'.
//
// Order is significant: "Bucket Hat" must reach Accessories before "bucket"
// claims it for Bags, so the hat rule runs first.
const CATEGORIES = [
  [/\b(bucket hats?|baseball caps?)\b/i, 'Accessories'],
  // "Noé" ends in a non-word character, so a trailing \b can never match it —
  // anchor the front only.
  [/\bno[eé]\b|\bno[eé]$|\bno[eé]\s/i, 'Bags'],
  // Bag model names sit here because the title often names only the model.
  [/\b(keepalls?|speedys?|almas?|neverfulls?|pochettes?|jackies?|totes?|handbags?|shoulder bags?|crossbodys?|clutchs?|clutches|backpacks?|duffles?|bumbags?|belt bags?|bags?|papillons?|berkeleys?|sienas?|montsouris|dianas?|jolicoeurs?|jollys?|messengers?|buckets?|bostons?|saumurs?|trocaderos?|bauletto|pouch|pouches|key cases?)\b/i, 'Bags'],
  [/\b(wallets?|card ?holders?|purses?|belts?|caps?|hats?|beanies?|scarfs?|scarves|gloves?|sunglasses|keychains?|key ?holders?|ties?|bracelets?|necklaces?|rings?|watches|key ?cases?)\b/i, 'Accessories'],
  [/\b(sneakers?|shoes?|boots?|loafers?|trainers?|slides?|sliders?|sandals?|mules?|pumps?|heels?|slippers?|flip ?flops?)\b/i, 'Shoes'],
  [/\b(jackets?|winterjackets?|coats?|parkas?|gilets?|vests?|puffers?|bombers?|windbreakers?|anoraks?|soft ?shells?|overshirts?|blazers?)\b/i, 'Outerwear'],
  [/\b(trousers?|pants?|sweatpants?|joggers?|jeans?|shorts?|chinos?|cargos?|leggings?|boxers?|skirts?)\b/i, 'Bottoms'],
  [/\b(hoodies?|sweaters?|knits?|jumpers?|cardigans?|sweatshirts?|polos?|shirts?|tees?|t-shirts?|tops?|longsleeves?|tracktops?|track tops?)\b/i, 'Tops'],
];

function categoryOf(title) {
  for (const [re, c] of CATEGORIES) if (re.test(title)) return c;
  return 'Other';
}

// Ordered by specificity — "new with tags" must beat "good".
const CONDITIONS = [
  [/new with tags|brand new|never used|unused/i, 'New with tags'],
  [/like new|as new|mint/i,                      'Excellent'],
  [/excellent/i,                                 'Excellent'],
  [/very good|great condition/i,                 'Very Good'],
  [/good condition|\bgood\b/i,                   'Good'],
  [/fair|well used|heavily used/i,               'Fair'],
];

function conditionOf(bodyText) {
  for (const [re, c] of CONDITIONS) if (re.test(bodyText)) return c;
  return null;
}

const stripTags = html => (html || '').replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

module.exports = {
  DESIGNERS, TYPOS, CATEGORIES, CONDITIONS,
  flatten, designerOf, stripDesigner, categoryOf, conditionOf, stripTags,
};

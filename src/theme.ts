/**
 * Circular Fash — design tokens
 * Direction: Street high-contrast ("technical outerwear" coded)
 *
 * Principles
 *  - Single accent (hiVis). Spend boldness in one place; everything else is mono-ink.
 *  - Numeric data (price, size, SKU) is set in MONO, like a garment spec tag.
 *  - Hard edges. Radius lives at 0-4; rounded corners are the exception, not the default.
 *  - SOLD is a flex, not an apology - see components for the inverted stamp treatment.
 */

export const color = {
  // Light direction, matched to circularfash.com: white page, near-black Archivo
  // headings, navy-tinted body text, thin light borders, black CTAs.
  ink: '#FFFFFF',          // page background (white)
  surface: '#FFFFFF',      // card (separated by border, not fill)
  surfaceAlt: '#F2F2F2',   // image wells / inputs / track
  line: '#E7E7E7',         // hairline border
  lineStrong: '#D4D4D4',   // emphasized divider / hover

  paper: '#1F1F1F',        // primary text (site heading color)
  paperDim: '#515A7A',     // secondary text (navy-tinted, from site body)
  paperMute: '#9CA1B0',    // muted, strikethrough, disabled

  // The accent is now near-black, like the site's primary buttons — NEW,
  // scarcity, key CTA, active tab. onAccent is white text/icon on it.
  hiVis: '#1F1F1F',
  onHiVis: '#FFFFFF',
} as const;

/**
 * Font families. Swap the loaded faces here once and the whole app follows.
 * Display: a tight grotesque (Archivo / similar). Mono: a spec-tag mono (Space Mono / SF Mono).
 * Falls back to platform defaults until you load the real faces via expo-font / RN assets.
 */
export const font = {
  display: 'Archivo',      // product names, headers - used uppercase, with restraint
  body: 'Inter',           // descriptions, running text
  mono: 'SpaceMono',       // price, size, SKU, anything numeric/technical
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  bold: '700',             // display only, sparingly
} as const;

/** Type scale. size / lineHeight / letterSpacing tuned per role. */
export const type = {
  eyebrow:  { fontFamily: font.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  caption:  { fontFamily: font.body, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  body:     { fontFamily: font.body, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  title:    { fontFamily: font.display, fontSize: 15, lineHeight: 19, letterSpacing: 0.4, textTransform: 'uppercase' as const },
  price:    { fontFamily: font.mono, fontSize: 15, lineHeight: 18, letterSpacing: 0.2 },
  display:  { fontFamily: font.display, fontSize: 22, lineHeight: 24, letterSpacing: 0.3, textTransform: 'uppercase' as const },
  hero:     { fontFamily: font.display, fontSize: 30, lineHeight: 32, letterSpacing: 0.2, textTransform: 'uppercase' as const },
} as const;

/** 4-based spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Hard-edged by default. */
export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  pill: 999,   // reserve for genuinely round things (avatars), not cards
} as const;

export const border = {
  hairline: 1,        // RN renders sub-px unreliably; 1 is the floor
  heavy: 2,
} as const;

/**
 * Format a price the way the storefront does.
 *
 * The store's own money format is `{{amount_no_decimals}} kr`, so nothing shows
 * cents — that holds for every market, not just SEK. SEK keeps its Swedish
 * shape ("1 700 kr"); everything else gets its normal symbol ("$804", "€282").
 */
export function formatMoney(amount: number, currency: string = 'SEK'): string {
  const rounded = Math.round(amount);

  // sv-SE groups thousands with a (narrow) no-break space depending on the ICU
  // build; normalize every whitespace run to a plain space so layout is
  // predictable: "1 700 kr".
  if (currency === 'SEK') {
    return `${rounded.toLocaleString('sv-SE').replace(/\s/g, ' ')} kr`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(rounded)
      .replace(/\s/g, ' ');
  } catch {
    // Hermes ships Intl on iOS, but an unknown ISO code still throws. Printing
    // "804 USD" is worse than a symbol and better than a crash on a price tag.
    return `${rounded.toLocaleString('en-US')} ${currency}`;
  }
}

/** @deprecated Use formatMoney(amount, product.currencyCode). */
export function formatSEK(amount: number): string {
  return formatMoney(amount, 'SEK');
}

export const theme = { color, font, weight, type, space, radius, border, formatMoney, formatSEK };
export type Theme = typeof theme;
export default theme;

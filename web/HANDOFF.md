# Project Handoff: Circular Fash Website Redesign

## Context

I'm redesigning circularfash.com for a client — a Swedish Shopify store selling authenticated pre-owned luxury fashion (Gucci, Louis Vuitton, Moncler, Burberry, Dior, Celine, Fendi, etc.). The client wants the site to look like https://www.fashionphile.co.uk/ — same structure and conventions, NOT a pixel-clone (avoid imitating their trade dress outright).

A finished homepage mockup exists in this project: `index.html` + `media/live-hero.mp4` + `media/live-replay.mp4` (two TikTok livestream clips). Study `index.html` first — it defines the entire design system. This phase is static HTML/CSS/JS mockups; Shopify implementation comes after client sign-off (Phase 2 below).

## Design system (already established in index.html — do not deviate)

- Colors: `--bg:#FFFFFF; --text:#121212; --text-soft:#5C5C5C; --line:#E8E8E8; --surface:#F7F7F7`. Monochrome only. The ONLY color is `#E02020` for live/pulsing-dot indicators.
- Font: 'Assistant' (Google Fonts), weights 400–700. Headings: uppercase, letter-spacing .05–.3em. No serifs.
- Buttons: `.btn` bordered uppercase; `.solid` = black bg, `.ghost` = outlined.
- Product cards (Fashionphile-style): square image w/ hover-swap to alt image, bold uppercase designer name, descriptive title, "Condition: Excellent/Very Good/Good" line, bold price, then "Est. retail X kr · **Y% below retail**" text line.
- Image frames: `.frame` divs with `data-label` fallback text and `onerror="this.remove()"` on imgs (images hotlink from https://circularfash.com/cdn/shop/files/... — keep this pattern).
- Layout: `.wrap` max-width 1320px; sections `padding: clamp(52px,7vw,92px) 0`; mobile breakpoints at 1080/960/640px.
- Header: utility bar → centered wordmark "CIRCULAR FASH" → centered category nav with hover dropdown for Designers.
- Hero: full-bleed with blur-fill technique (blurred cover copy behind sharp `object-fit:contain` copy, dark gradient overlay, centered white text).
- Livestream is a core brand feature: daily TikTok live at 19:00 (PLACEHOLDER — confirm real time and handle with me; currently linking tiktok.com/@circularfash, verify it).

## Phase 1 — Build remaining pages (static, matching index.html exactly)

Share the header/footer across pages (copy-paste is fine for mockups). Pages needed:

1. `collection.html` — product listing page (PLP). Reuse the homepage filter bar (gender pills + designer/size selects, vanilla JS in index.html) but add: price sort, condition filter, item-count, pagination stub. 4-col grid.
2. `product.html` — product detail page (PDP). Image gallery w/ thumbnails, designer + title + condition + price + est. retail line, "Authenticated" trust block, accordion for details/shipping/returns, "As seen on the live" related row.
3. `sell.html` — consignment page. Hero, 3-step how-it-works, photo-upload form stub (name, email, brand, photos), FAQ accordion.
4. `live.html` — livestream hub. Schedule, embedded clips (reuse media/), "As seen on the live" product grid, TikTok follow CTA.
5. `about.html` and `authenticity.html` — simple content pages.
6. `cart.html` — cart drawer/page mockup.

Real product data for cards (from the live store, prices in kr): LV Alma PM 4200 (retail 20400), LV Speedy 35 3900 (20400), Gucci Jackie GG 3300 (19000), Gucci bucket hat M 2100 (5500), Gucci long wallet 1600 (5000), Celine shoulder bag 2800, Burberry check polo L 900 (4000), Moncler polo S 1200 (3670), Burberry pants W30 800 (3000), Gucci GG Jolly 2500, Fendi Zucca tote 2500, Dior Trotter tote 1500. Image URLs are in index.html.

Test everything at 375px, 768px, and 1440px widths. Keep the local dev loop: `python3 -m http.server` and check in browser. Deployment for client review: zip the folder, drag into Netlify Drop.

## Phase 2 — Shopify implementation (after sign-off)

The store runs Shopify (theme unknown — check `Online Store → Themes` in admin, likely Dawn or similar; tell me before starting). Approach:

- Prefer customizing the existing theme over building a custom theme from scratch: custom CSS + new Liquid sections mirroring the mockup components.
- Filtering: install Shopify's free "Search & Discovery" app for native size/vendor/price filters on collection pages — do NOT hand-build filtering.
- "% below retail": compute in Liquid from `compare_at_price` vs `price`; render the est.-retail text line on cards and PDP. Handle products with no compare_at_price gracefully (Celine bag has none).
- "As seen on the live": automated collection matching tag `seen-live`; client tags items after each stream.
- Livestream sections: rebuild the TikTok Live tile + "Circular Fash TV" card as theme sections with video upload settings; source higher-quality video exported from the client's phone, NOT re-downloaded from TikTok (current clips are 576×1024 and soft).
- Hero: build as a section with image picker; tell the client to shoot one landscape (~16:9) campaign photo — the blur-fill is the fallback treatment if the image is portrait.
- Keep all real store URLs (collections/products/pages) that index.html already links to.

## Known placeholders to resolve with me before launch

- TikTok handle + real stream time (appears in utility bar, hero, tiles, TV card, footer)
- Condition ratings on cards are my invention — client must confirm per item, and define the condition scale
- "Sign In", "Search", cart are stubs
- Currency/region line says "Sweden · SEK kr" — confirm if they want a real currency selector

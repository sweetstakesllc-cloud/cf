# Phase 2 Handoff — Circular Fash → Shopify

Written 2026-08-07. Everything below was verified against the live store, not assumed.
Phase 1 (static mockups) is signed off. This document is what you need to carry the
work to a machine that has Shopify admin access and continue.

---

## 0. State of play

| | |
|---|---|
| Repo | `sweetstakesllc-cloud/cf`, branch `web-mockups`, folder `web/` |
| Mockups | 7 pages, one shared stylesheet at `web/assets/site.css` |
| Generated | `collection.html` + `product.html` are **built by `web/_build/generate.js`** — do not hand-edit |
| Store | circularfash.com (Shopify). **Nothing has been written to it. Zero API writes so far.** |
| Local dev | `cd web && python -m http.server 8000` |
| Regenerate | `node _build/generate.js --refresh` |

Dev-only files, exclude from any client zip: `web/_preview.html`, `web/_build/`.

---

## 1. The catalogue audit (do not skip this)

All figures pulled from `https://circularfash.com/products.json` — a public,
unauthenticated endpoint. No credentials were used to obtain any of this.

**524 published products · 313 tagged `sold` · 208 actually in stock.**

### The three fields Shopify filtering needs, and their real state

| Field | Expected | Actual | Consequence |
|---|---|---|---|
| `vendor` | The designer | **`Circular Fash` on all 524** | No designer facet is possible |
| `product_type` | Category | **The style name** (Noe, Alma, Neverfull, Josh, Maya) | No category facet is possible |
| Condition | A metafield | **Does not exist** | Nothing to migrate |

> This invalidates the original plan of "install Search & Discovery and get
> designer/size/price filters for free." Search & Discovery filters on `vendor`,
> `product_type`, tags and options. As the catalogue stands **there is nothing
> structured for it to filter on.** The cleanup in §3 is a hard prerequisite for
> the collection page, not an optional tidy-up.

### Measured gaps across the 208 in-stock items

| Missing | Count | % |
|---|---|---|
| Condition information anywhere | **93** | 45% |
| Gender tag (`men`/`women`) | 84 | 40% |
| `compare_at_price` → no "% below retail" | 46 | 22% |
| Size option | 28 | 13% |
| Category inferable from title | 24 | 12% |
| Fewer than 2 images | 2 | 1% |

Other data notes:
- Size options are split across `Size` **and `Taille`** (French); colours across `Color` / `Couleur`. Search & Discovery will treat these as separate facets until they are unified.
- Tags are mostly internal codes (`Lilja`, `dstrakt`, `18Dec`, `DonV`, `Oly`, `fattigdrop`). Usable ones: `men` (82), `women` (51), `consignment` (46), `clearance` (21), `sold` (313). There is no `seen-live` tag yet.
- Some tags differ only by case (`men` vs `Men`) — normalise.
- Sold items stay published. Decide whether the new collection page hides them.

---

## 2. Credentials needed

1. **Admin API token** — Shopify admin → Settings → Apps and sales channels → Develop apps → Create an app → Configure Admin API scopes → `read_products`, `write_products` → Install → reveal token once.
2. **Search & Discovery** app (free) — install from the Shopify App Store.
3. **Theme access** — either a Shopify CLI browser login, or the Theme Access app for a scoped password.

Never work on the published theme. Duplicate it first and work on the copy.

---

## 3. Catalogue cleanup — the first thing that writes to the store

The parsing logic already exists and is proven: `web/_build/generate.js` resolves a
designer for **208 of 208** in-stock products (0 unmatched) and a category for 184.
Lift `designerOf()`, `categoryOf()`, `flatten()` and the `DESIGNERS` list from it.

Two details that took two passes to get right — keep them:
- `flatten()` strips `.`, `'`, `-` before matching, so `C.P. Company` / `C.P Company` / `CP Company` all resolve to one label. Without it, ~8% of titles fail to match.
- The same flattened window-match is used to strip the designer back out of the display title, so the card shows `Louis Vuitton` + `Keepall Bandouliere 50` rather than repeating the brand.

**Write plan:**

| Target | Source | Rows |
|---|---|---|
| `vendor` | designer parsed from title | 524 |
| `product_type` | category parsed from title | ~460 |
| `custom.condition` metafield | see §4 — mostly unavailable | ~115 of 208 |
| Unify `Taille` → `Size` | variant options | small |
| Normalise `Men` → `men` | tags | small |

**Run it as a dry run first.** Emit a CSV of `handle, old_vendor, new_vendor,
old_type, new_type` and have the client read it before a single mutation. Bulk-rewriting
`vendor` on 524 live products is not reversible without a backup — export the
products CSV from admin first.

Use GraphQL `productUpdate` in batches, or `bulkOperationRunMutation` for one pass.

---

## 4. What cannot be fixed by any script

These gate launch and are people-work, not dev-work.

1. **Condition — the big one.** 93 of 208 in-stock items have no condition information in any field or in the description. There is nothing to migrate. Someone must physically grade them, against a scale **the client has not yet defined**. Ask for the scale first, then the grading.
   - Where condition *does* appear it is free text in the description: "good condition" (48), "very good" (42), "new with tags" (28), "like new" (14), "excellent" (5), "fair" (3). `conditionOf()` in the generator parses these and can seed a first draft, but a draft is not a grading.
2. **The live stream time.** `19:00` appears in five places across the mockups and is **unverified**. The store's homepage links to `tiktok.com/@circularfash` but publishes no schedule. The weekly schedule on `live.html` (Bags Only, Menswear, The Big Drop…) is **entirely invented** — replace or delete it.
3. **Shipping rates.** `/policies/shipping-policy` exists but is **empty**. The rates on `sell.html`, `product.html` and `cart.html` (49 / 149 / 299 kr, free over 3 000) are invented. Get the real ones from admin → Settings → Shipping and delivery.
4. **Consignment terms** — the payout split and "paid within five working days" on `sell.html` are invented.

---

## 5. Real copy that exists (use this, not the invented text)

The mockups currently contain placeholder copy I wrote. The store already has real
text for most of it. **Fetched and verified — swap these in.**

| Page | Real source | Status |
|---|---|---|
| `about.html` | `/pages/about-us` | Real copy available, **not yet swapped** |
| `authenticity.html` | `/pages/authenticity` | **Partially swapped** — h1 + intro are real, the rest of the page is still invented |
| Returns | `/policies/refund-policy` | Real copy available, **not yet swapped** |
| `sell.html` | `/pages/sell-to-us-1` | Real copy available (brief), **not yet swapped** |
| Shipping | `/policies/shipping-policy` | **Page is empty** — no source exists |
| Contact | `/pages/contact` | Page renders but has no `.rte` body |

### Facts from the real copy that CONTRADICT the current mockups

Fix these before the client sees the pages again:

- **Returns are EU-only.** "RETURNS OUTSIDE OF THE EUROPEAN UNION ARE NOT ACCEPTED." The mockups currently promise blanket worldwide 14-day returns. This is the most serious error in the current copy.
- **Return shipping is not free.** Sweden: prepaid PostNord label for **50 SEK, deducted from the refund**. Other couriers / outside Sweden: customer pays in full.
- **Sale items and gift cards are non-returnable.**
- **Selling:** if a submitted item is fake, a **10% service fee** is charged. They also take sourcing requests ("special product sourced for you") — the mockup's sell page ignores this entirely.
- **Company:** Circular Fash AB, Åbrinksvägen 21, 222 71 Lund. Email `Info@circularfash.com`. Founded in Sweden **2023**.
- **Authentication partners:** Authentic Detective and Real Authentication.
- **Real authentication method** is neck tags, washing labels, seams/construction and branding labels — clothing-led. The mockup invents a bags-led process ("date codes, hardware"). The catalogue is mostly Moncler/Stone Island/Burberry outerwear, so the real copy is also the more accurate one.
- **Guarantee wording:** "Authenticity guaranteed or your money back — no questions asked."
- The `authenticity.html` **condition-grade section is invented and should be deleted** until the client defines a real scale.

---

## 6. Theme build

Customise the existing theme; do not build from scratch. Load `assets/circular.css`
(this repo's `web/assets/site.css`, renamed) **after** the theme's `base.css` — do not
delete `base.css`, the cart drawer, predictive search and modals depend on it.

| Mockup component | Shopify |
|---|---|
| `.util` + `.masthead` + `nav.cats` | `sections/header-cf.liquid` in `header-group.json`; nav from `linklists` |
| `.hero` (blur-fill) | `sections/hero-campaign.liquid` + image picker |
| `.card` | `snippets/product-card.liquid` — used by every grid |
| Filter bar | Search & Discovery facets, restyled to match the pills/selects |
| `.tiles` | `sections/promo-tiles.liquid` |
| `.feat` row | `sections/feature-row.liquid` |
| `footer` | `sections/footer-cf.liquid` |

Write our own header rather than fighting Dawn's, but **render Dawn's snippets inside
it** (`cart-drawer`, predictive search, mobile drawer) to keep their plumbing.

### The one piece of real business logic

```liquid
{%- if product.compare_at_price > product.price -%}
  {%- assign pct = product.compare_at_price | minus: product.price
      | times: 100.0 | divided_by: product.compare_at_price | round -%}
  <div class="retail-line">Est. retail {{ product.compare_at_price | money }} · <b>{{ pct }}% below retail</b></div>
{%- else -%}
  <div class="retail-line">&nbsp;</div>
{%- endif -%}
```

The `&nbsp;` branch matters: 22% of products have no `compare_at_price`, and without
the spacer the grid rows go ragged. Same trick for a missing condition (45%).

Currency: the design renders `4 200 kr` with a space separator. Check
Settings → Store details currency formatting matches (`amount_no_decimals_with_space_separator`).

Font: check whether Assistant is in Shopify's hosted font library and use `font_picker`
+ `font_face` rather than the Google Fonts `<link>`.

### Other Phase 2 notes
- "As seen on the live" → automated collection on a `seen-live` tag; client tags after each stream. Tag does not exist yet.
- Livestream tiles → sections with video settings. Source higher-quality video from the client's phone; the current clips are 576×1024 and soft.
- Hero → section with image picker. Ask the client for one landscape ~16:9 campaign shot; the blur-fill is the fallback for portrait images.
- Keep the real store routes. Every link in the mockups carries `data-shopify="/collections/..."` etc. with the route it maps back to.

---

## 7. Sequence

1. Client defines the **condition scale** → grading can start in parallel with everything below.
2. Create Admin API token + install Search & Discovery.
3. Export products CSV as a backup.
4. Dry-run the cleanup → client reads the diff → apply `vendor` + `product_type`.
5. Create `custom.condition` metafield definition; backfill what can be parsed; client grades the remaining 93.
6. Duplicate the theme; `shopify theme pull`.
7. Build `circular.css` + sections; push to an **unpublished** theme for preview.
8. Swap invented copy for the real copy in §5.
9. Confirm shipping rates, stream time, consignment terms.
10. Client reviews the preview URL against real inventory → publish.

Steps 1 and 9 are the long poles and neither is blocked by code. Start them now.

---

## 8. Open questions for the client

- What is the condition scale, and who grades the 93 ungraded items?
- What is the real TikTok stream time, and is there a weekly schedule at all?
- What are the actual shipping rates and free-shipping threshold?
- Consignment: what split, and what is the real payout timeline?
- Should sold items stay published and visible in collections?
- Is `Taille`/`Couleur` intentional (a French-market thing) or drift to be cleaned up?
- Do they want a real currency/region selector, or is "Sweden · SEK kr" fixed?

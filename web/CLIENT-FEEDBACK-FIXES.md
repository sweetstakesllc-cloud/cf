# Client feedback (Aug 2026) — findings and fixes

Every point was reproduced against the live store before anything was changed.
The live site runs our theme (`sections/header-cf.liquid`), so this is feedback on
our deployed work. The first pass (2026-08-13) read most of it as Shopify **admin**
data. Re-checked on **2026-08-15**, that reading was wrong on the biggest points:
NEW IN, the sold-out mixing, and the buried sourcing form are all **our own theme
code**, and they are fixed here.

## Verified numbers (2026-08-15, storefront-visible)

| Collection | Products | Sold out | In stock |
| --- | --- | --- | --- |
| `/collections/all` | 545 | 342 (63%) | 203 |
| `/collections/women` | 222 | 165 (74%) | 57 |
| `/collections/accessories` | 213 | 166 (78%) | 47 |
| `/collections/mens` | 152 | 65 (43%) | 87 |
| `/collections/new` | 20 | 8 (40%) | 12 |

53 collections. `/apps/help-center` (the FAQ menu target) returns **HTTP 404**.
Of the 28 brands in the BRANDS menu, **5 have no products at all** (Saint Laurent,
Moose Knuckles, Woolrich, Amiri, Acne Studios) and a 6th, Jacquemus, has 2 products
with none in stock.

## Point by point

### ALL — Palm Angels 3-Pack missing images
**Resolved, no action.** No storefront-visible product lacks an image any more; all
Palm Angels products are archived. 89 image-less products remain, all archived or
unpublished, so none are reachable.

### ALL / WOMAN / NEW IN — sold items everywhere
One root cause, and it was ours. Two pieces of our own code:

- `layout/theme.liquid` lands every visitor on `?filter.v.availability=1`.
- `snippets/pagination-cf.liquid` then appends the **sold** items as extra pages at
  the end, renumbered to run on continuously from the in-stock ones.

So NEW IN really did have "two pages, one of them SOLD OUT": page 1 held the 12
in-stock items, page 2 held all 8 sold ones under a *Sold items* heading. Same
shape on ALL, WOMEN, SHOES and the brand pages. The client's screenshot was never
needed — the earlier note calling this "not reproducible" was simply wrong.

A second, worse leak sat behind it: the availability facet is hidden from the filter
drawer, so it was in none of the facet forms, and `assets/facets.js` rebuilds the
query string from form data alone and then calls `history.pushState`. Not being a
navigation, that never re-triggers the redirect. **One click on "Sort by: price"
dropped the filter and refilled WOMEN with sold stock.**

→ **Fixed in theme.**
- `snippets/pagination-cf.liquid` takes a `show_sold` argument, and
  `main-collection-product-grid.liquid` exposes it as **Show sold items after the
  in-stock ones**, default **off**. Off, the snippet falls through to Shopify's own
  pagination, which numbers the in-stock segment 1..n correctly.
- `snippets/facets.liquid` carries the active availability value as a hidden input
  in all three submitted forms, and pins it to the "clear all" target.
  `main-collection-product-grid.liquid` does the same for `FacetSortForm`.
- A sold-through collection now says "Everything in X has sold" with a link to what
  is in stock, instead of "No products found — use fewer filters", which was both
  untrue (the shopper chose no filter) and a dead end (its link bounced off the
  redirect and came straight back).

Verified on CF Staging: NEW IN is one page of 12 with no pagination; ALL is 6 pages
ending cleanly at `1 … 4 5 6`; WOMEN is 2 pages, and sorting by price keeps
`filter.v.availability=1` and returns 36 products, 0 sold.

### BRANDS — mixes photos with drawings; page 2 shows SHORTS, SHOES, SOLD, WOMENS
The BRANDS menu item pointed at `/collections`, Shopify's index of all 53
collections. The "drawings" are Shopify's placeholder image, shown for collections
with no image of their own.
→ **Fixed in theme.** `sections/main-list-collections.liquid` takes `source_menu` +
`source_item`, so the page mirrors the BRANDS menu exactly; `hide_empty` drops
collections with no products.
→ **Also fixed:** `header-cf.liquid` now applies the same test to the dropdown, so
the 5 empty brands stop appearing there too (28 → 23). The two views of the menu
used to disagree.
→ **Remaining in admin:** upload images for the brand collections that lack one;
delete the empty collections.

### CATEGORIES — identical to ALL
The parent link was literally `/collections/all`; the 10 real category links only
existed in its dropdown.
→ **Fixed in theme.** A menu item with children opens its dropdown instead of
navigating. This also stops BRANDS landing on `/collections`. Below 960px the
dropdown used to be `display:none` — it is now a tap-to-open panel.

### ABOUT US — third point displaced, age range, address, READ MORE
→ **DONE, live 2026-08-13.** The `<ol>` now holds three items; the 16–50 age range
is gone; the postal address moved to Contact (Swedish distance-selling rules require
a reachable geographic address, but About was the wrong home for it). The READ MORE
link is deliberate — it goes to `/pages/authenticity` — and is kept, just no longer
buried mid-sentence.

### SELL TO US — Sourcing Requests buried at the bottom
Agreed, and the cause is theme code, not admin. Sell To Us uses the **shared default**
`templates/page.json`, which contains the sourcing form *and* sets the page's own body
to `"disabled": true`. So:
- the sourcing form appears at the bottom of **every** default-template page, and
- the Sell To Us body — its "1. Share Photos / 2. Receive Offer" steps, 681
  characters of real copy — **never renders at all**.

`/pages/questions-answers` is default-template too, which is why it shows Sell To Us
content and nothing of its own.
→ `templates/page.sourcing.json` and `templates/page.sell.json` already exist. The
fix is one coupled step: clean `page.json` back to a bare page, move the Sell To Us
sections into `page.sell.json`, and assign the `sell` and `sourcing` suffixes to the
pages. **The template edit and the page assignment must ship together** — doing
either alone breaks Sell To Us. Held pending the store-write go-ahead.

### FAQ — completely blank
`/apps/help-center` 404s: the help-center app is gone, so the menu points at nothing.
→ **Fixed in theme:** `sections/cf-faq.liquid` + `templates/page.faq.json`, 13
questions in 5 groups. Returns answers come from the real refund policy (EU only, 14
days, 50 SEK PostNord label deducted, sale items excluded) — **not** the "worldwide
14-day free returns" line the mockups used, which is wrong.
→ **Blocked:** no page with handle `faq` or `sourcing-requests` exists, so both
templates are unreachable *even on the staging preview*. Nobody has ever seen the FAQ
render. The pages have to be created before this can be reviewed.

### Overall — should SOLD OUT be a category?
**No, and it is no longer browsable.** With the sold tail off, sold items keep their
URLs and stay in the catalogue but appear in no collection, no filter and no
pagination. `/collections/sold` is linked from nowhere. Nothing was written to any
product to achieve this — it is entirely presentational and reversible from the theme
editor checkbox.

## Still open

**Store writes (need a go-ahead — nothing has been written):**
1. Create the FAQ page (`faq` suffix) and Sourcing Requests page (`sourcing` suffix).
2. Repoint the FAQ menu item off the 404; add Sourcing Requests.
3. Assign the `sell` suffix to Sell To Us, with the `page.json` fix in the same step.
4. Point CATEGORIES somewhere real, and drop the now-redundant
   `?filter.v.availability=1` from the WOMEN menu URL (the theme handles it, and the
   hard-coded absolute URL is why WOMEN never shows as the active nav item).
5. Delete or unpublish the 5 empty brand collections and remove them from the menu.
6. `/policies/shipping-policy` is 15 characters — Shopify links it from checkout.

**Client decisions:**
7. Whether sold products should be archived on sale (Shopify Flow). No longer needed
   to keep the site clean, but 342 sold products still sit published.
8. NEW IN is the rule `tag = DRIPPY`, not a date, so nothing ages out of it.
9. Three sources of truth for returns disagree — the FAQ, `/policies/refund-policy`,
   and `/pages/return-policy` (which omits the 50 SEK clause). Pick one.
10. Search has no in-stock default and still shows sold items. Deliberately left
    alone: forcing a product filter on a search that also returns pages and articles
    needs a decision first.

## Where each fix lives

Theme code is on **CF Staging** (`188182659400`, unpublished), previewable at
`https://circularfash.com/?preview_theme_id=188182659400`. Staging matches the repo
as of 2026-08-15. **The fixes above are not on the live theme yet** — publishing CF
Staging is what delivers them.

Pages and menus are store data shared by every theme, so they cannot be staged;
editing one changes the live site immediately. About Us and Contact are done.

## Theme changes in this batch

- `snippets/pagination-cf.liquid` — `show_sold` argument; sold tail off by default
- `sections/main-collection-product-grid.liquid` — `show_sold_segment` setting,
  sold-through empty state, availability carried on `FacetSortForm`
- `snippets/facets.liquid` — availability carried on all submitted facet forms and
  on "clear all"
- `sections/header-cf.liquid` — parent nav items open their dropdown; empty brands
  hidden from the dropdown
- `sections/main-list-collections.liquid` — `source_menu` + `source_item` + `hide_empty`
- `assets/circular.css` — nav button styles, open state, mobile dropdown panel, FAQ
- `sections/cf-faq.liquid`, `templates/page.faq.json`, `templates/page.sourcing.json` — new

# Client feedback (Aug 2026) — findings and fixes

Every point was reproduced against the live store before anything was changed.
The live site runs our theme (`sections/header-cf.liquid`), so this is feedback on
our deployed work — but most of the causes are Shopify **admin** data, not theme code.

## Verified numbers

| Collection | Products | Sold out |
| --- | --- | --- |
| `/collections/all` | 525 | 326 (62%) |
| `/collections/women` | 222 | 162 (73%) |
| `/collections/accessories` | 203 | 158 (78%) |
| `/collections/mens` | 153 | 61 (40%) |

Store has 53 collections; 10 have no image, 3 are empty (ACNE STUDIOS,
BURBERRY SCARVES, WOOLRICH). `/apps/help-center` (the FAQ menu target) returns
**HTTP 404**. `/policies/shipping-policy` is **empty** — not raised by the client,
but the same class of problem.

## Point by point

### ALL — Palm Angels 3-Pack missing images
The only product of 525 with zero images. Still marked available; `product_type` is
empty and its tags are `men, Naw` (looks like a typo for "New").
→ **Admin fix.** Photograph it or unpublish it.

### ALL — should sold items appear here?
No. 62% of the grid is sold stock.
→ **Fixed by the sold-out policy below.**

### NEW IN — "two pages, one of them SOLD OUT"
Not reproducible today: `/collections/new` ("NEW STOCK") holds 6 products, 1 sold,
at 36 per page — a single page. Ask the client for a screenshot.
Related mess: three overlapping "new" collections exist — NEW STOCK (6),
New photos (24), Moto Photo (46).
→ **Needs client screenshot; consolidate the three collections.**

### BRANDS — mixes photos with drawings; page 2 shows SHORTS, SHOES, SOLD, WOMENS
The BRANDS menu item pointed at `/collections`, Shopify's index of *all 53*
collections — not a brand list. The "drawings" are Shopify's placeholder image,
shown for the 10 collections that have no image of their own.
→ **Fixed in theme.** `sections/main-list-collections.liquid` now takes a
`source_menu` setting: point it at the BRANDS menu and the page mirrors that menu
exactly. `hide_empty` (on by default) drops collections with no products.
→ **Remaining in admin:** pick the BRANDS menu in the theme editor, upload images
for the brand collections that lack one, delete the 3 empty collections.

### CATEGORIES — identical to ALL
The parent link was literally `/collections/all`. The 10 real category links only
existed inside its dropdown.
→ **Fixed in theme.** A menu item that has children now opens its dropdown instead
of navigating anywhere. This also stops BRANDS from landing on `/collections`.
Side fix: below 960px the dropdown used to be `display:none`, so on mobile the
children were unreachable entirely. It is now a tap-to-open panel.

### WOMAN — everything mixed together with sold out
The header link carries `?filter.v.availability=1` (7 pages → 2), but the **footer**
"Women" link and pagination drop the parameter, so you land on all 222 including the
162 sold. A URL parameter is not a fix.
→ **Fixed by the sold-out policy below.**

### ABOUT US — third point displaced to the bottom
Confirmed in the page HTML: the `<ol>` contains a **single** `<li>` holding points 1
and 2 (the "2." is typed by hand inside it), then the "who we serve" paragraph, then
"3. The third: Sustainability" floating loose below it.
→ **Rewritten:** `web/content/about-us.html`, ready to paste into the page editor.
Age range 16–50 removed. The postal address moves to Contact
(`web/content/contact-company-info.html`) — it cannot simply disappear, Swedish
distance-selling rules require a reachable geographic address, but About is the
wrong home for it. The "READ MORE" link is deliberate (it goes to
`/pages/authenticity`) and is kept, just no longer buried mid-sentence.

### SELL TO US — Sourcing Requests buried at the bottom
Agreed, it deserves its own page.
→ **Fixed in theme:** `templates/page.sourcing.json`, copy in
`web/content/sourcing-requests.html`.
→ **Remaining in admin:** create the page, assign the `sourcing` template, add it to
the menu, and remove the sourcing form from the bottom of Sell To Us.

### FAQ — completely blank
Root cause: `/apps/help-center` 404s. The help-center app is uninstalled or its proxy
is gone, so the menu points at nothing.
→ **Fixed in theme:** new `sections/cf-faq.liquid` + `templates/page.faq.json` with
18 questions grouped into Authenticity & Condition, Ordering & Shipping, Returns,
Selling & Sourcing, The Live. Returns answers are taken from the real refund policy
(EU only, 14 days, 50 SEK PostNord label deducted, sale items excluded) — **not** the
"worldwide 14-day free returns" line the mockups used, which is wrong.
→ **Four answers are marked `[TO CONFIRM]`** and must be filled before this goes
public: shipping destinations, delivery time and cost, payment methods, and the live
stream schedule.
→ **Remaining in admin:** create the FAQ page with the `faq` template and repoint the
menu item from `/apps/help-center` to it.

### Overall — should SOLD OUT be a category?
No, and it should not be browsable at all. Decision taken: **unpublish on sale.**

## The sold-out rule (Shopify Flow — free, admin only, cannot be scripted)

Install the Flow app, then create one workflow:

1. **Trigger:** Inventory quantity changed
2. **Condition:** `Product variant → Inventory quantity` **is less than or equal to** `0`
3. **Action:** Update product status → **Archived** (or Unpublish from Online Store if
   you want the product URL to keep resolving)

This removes an item from every collection at once as it sells, so ALL, WOMEN,
NEW IN and the brand pages stay clean without any per-collection work.

**Backlog:** the rule only covers future sales. 326 products are already sold and
still published. Clearing those is a bulk write to live product data — it needs a CSV
dry run and an explicit go-ahead first.

## Theme changes in this batch

- `sections/header-cf.liquid` — parent nav items open their dropdown instead of navigating
- `assets/circular.css` — nav button styles, open state, mobile dropdown panel, FAQ styles
- `sections/main-list-collections.liquid` — `source_menu` + `hide_empty` settings
- `templates/list-collections.json` — `hide_empty` on
- `sections/cf-faq.liquid` — new
- `templates/page.faq.json` — new
- `templates/page.sourcing.json` — new

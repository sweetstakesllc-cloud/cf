// Transforms web/assets/site.css into a .cf-scoped theme asset so the mockup
// design system can coexist with Refresh's base.css (which also uses .card,
// .grid, .price, etc.).
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/shahloshanazarova/Desktop/claude/web';
const src = fs.readFileSync(path.join(ROOT, 'assets/site.css'), 'utf8');

const out = [];
for (const line of src.split('\n')) {
  const t = line.trim();

  // drop rules the theme already handles globally
  if (/^html\{/.test(t)) continue;

  // keyframe steps + at-rules + closing braces + comments pass through
  if (/^@/.test(t) || /^[\d]+%/.test(t) || /^(from|to)[,{]/.test(t) || !t.includes('{') || /^\/\*/.test(t) || /^\}/.test(t)) {
    out.push(line);
    continue;
  }

  const m = line.match(/^(\s*)([^{]+)\{(.*)$/);
  if (!m) { out.push(line); continue; }
  const [, indent, selList, rest] = m;

  const transformed = selList.split(',').map(s => {
    let sel = s.trim();
    if (sel === ':root') return ':root';
    if (sel === '*') return '.cf *';
    if (sel === 'body') return '.cf';
    if (sel === 'img') return '.cf img';
    if (sel === 'a') return '.cf a';
    // element selectors that exist as bare tags in the mockup get cf- classes
    sel = sel.replace(/^section(?![-\w])/, '.cf-section');
    sel = sel.replace(/^footer(?![-\w])/, '.cf-footer');
    if (sel.startsWith(':root')) return sel;
    return '.cf ' + sel;
  }).join(',');

  out.push(indent + transformed + '{' + rest);
}

const header = `/* ==========================================================================
   Circular Fash design system — generated from web/assets/site.css.
   Loaded AFTER base.css. Every rule is scoped under .cf so Refresh's own
   .card/.grid/.price classes are untouched outside CF sections.
   Regenerate with web/_build/make-circular-css.js — do not hand-edit the
   scoped block.
   ========================================================================== */
`;

const extras = `
/* ---------- theme integration (hand-written, keep when regenerating) ---------- */
.cf{background:var(--bg);color:var(--text);font-family:var(--font);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.cf-section{display:block}
.shopify-section .cf{margin:0}
/* the theme's content wrapper adds side padding; .wrap manages its own */
.cf .wrap{max-width:1320px}
/* cart link is plain text in this design; neutralise Refresh icon styles */
.cf #cart-icon-bubble{display:inline;color:inherit}
/* base.css paints h1-h5 with the scheme foreground (a navy on this store);
   CF headings must state their colors explicitly to win over it */
.cf h1,.cf h2,.cf h3,.cf h4,.cf h5{color:var(--text)}
.cf .hero h1,.cf .hero .eyebrow,.cf .tile-inner h3{color:#fff}
.cf .tile-inner .kicker{color:#DADADA}

/* country + currency picker in the utility bar. Refresh styles this control for
   a footer column, so it arrives with padding and a font size that would push
   the 38px bar open, and .cf .util a would render the country list uppercase
   and bold. Reset it to the bar's own small caps, and let the list read at
   normal body scale once it is open. */
.cf .util .cf-locale{display:flex;align-items:center}
.cf .util .cf-locale .localization-form{padding:0;margin:0;display:flex}
/* Refresh gives this button a white fill and a 40px min-height, which punched
   through the 38px bar and hid its bottom rule, reading as a stray box; and it
   positions the caret absolutely, on top of the label. Flatten both. */
.cf .util .cf-locale .localization-form__select{padding:0;margin:0;min-height:0;height:auto;line-height:1;background:none;border:0;display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.08em;font-weight:400;text-transform:none;color:var(--text-soft)}
.cf .util .cf-locale .localization-form__select:hover{color:var(--text);text-decoration:underline;text-underline-offset:3px}
/* Refresh draws a box around this control with ::before/::after — a 1px border
   the width of the label — which is its "selected" treatment in a footer
   column. In the utility bar it just looks like the picker is stuck in a
   pressed state. The element's own computed styles are clean, so the box only
   shows up if you go looking at the pseudo-elements. */
.cf .util .cf-locale .localization-form__select::before,
.cf .util .cf-locale .localization-form__select::after{content:none;display:none}
.cf .util .cf-locale .localization-form__select .svg-wrapper,.cf .util .cf-locale .localization-form__select svg{position:static;width:10px;height:10px;margin:0;transform:none}
/* Refresh opens this panel upward (bottom:12px) because it lives in the footer
   there. In the utility bar that puts it off the top of the page, so flip it to
   open downward, and anchor it right so 46 countries cannot run off screen. */
.cf .util .cf-locale .disclosure__list-wrapper{z-index:6;font-size:14px;letter-spacing:0;text-align:left;top:calc(100% + 10px);bottom:auto;left:auto;right:0}
.cf .util .cf-locale .disclosure__link,.cf .util .cf-locale .disclosure__link .country{text-transform:none;font-weight:400;letter-spacing:0}
/* Refresh fades the currency in only on hover, which is fine when the control
   is a country picker. Here it is the currency picker, so the code is the thing
   the shopper came for: show it on every row, all the time. */
.cf .util .cf-locale .localization-form__currency{opacity:1;text-transform:uppercase}
/* the bar drops .muted below 640px; the picker stays, so tighten it to fit
   alongside SELL NOW and SIGN IN at 375px */
@media(max-width:640px){
  .cf .util-right{gap:13px}
  /* "Sweden | SEK kr" -> "SEK kr". The currency is what is being checked; the
     country name is 50px of the width and none of the answer. */
  .cf .util .cf-locale .cf-locale-country{display:none}
  /* Only the picker goes right. SELL NOW and SIGN IN stay left, where the
     newsletter link used to sit. */
  .cf .util .cf-locale{margin-left:auto}
  .cf .util .cf-locale .localization-form__select{font-size:11px;letter-spacing:.02em}
  .cf .util .cf-locale .disclosure__list-wrapper{position:fixed;top:auto;left:0;right:0;width:100%}
}

/* Trustpilot block */
.cf .cf-tp{text-align:center;padding:4px 0 2px}
.cf .cf-tp-stars{font-size:26px;line-height:1;letter-spacing:.12em;color:#D8D8D8}
.cf .cf-tp-star.is-on{color:#00B67A}
.cf .cf-tp-star.is-half{background:linear-gradient(90deg,#00B67A 50%,#D8D8D8 50%);-webkit-background-clip:text;background-clip:text;color:transparent}
.cf .cf-tp-score{margin:14px 0 2px;font-size:15px}
.cf .cf-tp-score strong{font-size:19px;font-weight:700}
.cf .cf-tp-count{margin:0;font-size:13.5px;color:var(--text-soft)}
.cf .cf-tp-link{display:inline-block;margin-top:14px;font-size:12.5px;font-weight:600;text-transform:uppercase;letter-spacing:.16em;text-decoration:underline;text-underline-offset:4px}
.cf .cf-tp-widget{margin-top:22px}

/* ---------- Refresh component restyle (matches the CF design system) ---------- */
/* buttons + section titles sitewide */
.button,.shopify-challenge__button,.customer button{text-transform:uppercase;letter-spacing:.16em;font-size:12.5px;font-weight:600}
.title,.title-wrapper-with-link .title{text-transform:uppercase;letter-spacing:.06em}

/* One line each on wide screens, so a long grade cannot stagger the prices
   across a row. NOTE this is why the grid tracks are minmax(0,1fr) rather than
   1fr: 1fr floors at min-content, and a line that cannot break makes
   min-content the width of the whole string, which pushed the second column
   clean off a phone screen. */
.cf .card-info .cond,.cf .card-info .retail-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:640px){
  /* Two columns on a phone leaves ~170px a card. Truncating there would eat
     "· 75% below retail", which is the line's whole point, so let it wrap. */
  .cf .card-info .cond,.cf .card-info .retail-line{white-space:normal;overflow:visible;text-overflow:clip}
}

/* product page (PDP) */
.cf-klarna{display:flex;align-items:center;justify-content:center;gap:9px;margin:14px 0 2px;font-size:13px;color:var(--text-soft)}
.cf-klarna .cf-klarna-mark{width:42px;height:auto;display:block}
/* Condition + est. retail, matching the measurement rows they sit under. */
.cf-spec{margin:0 0 4px;font-size:15px}
.cf-spec strong{font-weight:700}
.cf-retail .cf-retail-value{white-space:nowrap}
.product__title>h1,.product__title>h2{font-size:clamp(21px,2.1vw,27px);font-weight:600;letter-spacing:.04em;line-height:1.25;text-transform:none;color:var(--text)}

/* Spec table. A block of records, not a paragraph pile: label left, value
   right, hairline between. The block is centred in the column but reads left
   to right inside itself, which is how a spec is read. */
.cf-specs{max-width:340px;margin:22px auto 4px;text-align:left}
.cf-specs__row{display:flex;align-items:baseline;justify-content:space-between;gap:18px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.cf-specs__row:last-child{border-bottom:0}
.cf-specs dt{color:var(--text-soft);white-space:nowrap}
.cf-specs dd{margin:0;color:var(--text);text-align:right}
.cf-specs__alt{color:var(--text-soft)}

/* Certified Authentic pill. Was a bordered panel with a heading and two lines
   of body copy, carrying more weight than the price for a claim true of every
   item here. */
.cf-badge{display:inline-flex;align-items:center;gap:7px;background:var(--surface);border-radius:999px;padding:6px 14px 6px 8px;font-size:12.5px;font-weight:600;color:var(--text);text-decoration:none;margin-bottom:14px}
.cf-badge__tick{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--text);color:#fff;font-size:10px;line-height:1}
.cf-badge:hover{background:#EFEFEF}

/* "68% Off Est. Retail 18 000 SEK", under the price. */
.cf-saving{margin:4px 0 0;font-size:14px;color:var(--text-soft)}
.cf-saving strong{color:var(--text);font-weight:700}

/* Condition: five named steps with the current one marked. A progress bar
   implied a percentage; condition is a band, not a quantity. */
.cf-cond{max-width:340px;margin:26px auto 4px;padding-top:20px;border-top:1px solid var(--line);text-align:left}
.cf-cond__title{font-size:16px;font-weight:600;margin:0 0 16px;color:var(--text);text-transform:none;letter-spacing:0}
.cf-cond__steps{display:flex;gap:6px}
.cf-cond__step{flex:1;min-width:0}
.cf-cond__seg{display:block;height:4px;border-radius:2px;background:var(--line)}
.cf-cond__name{display:block;margin-top:8px;font-size:10px;line-height:1.25;letter-spacing:.02em;color:var(--text-soft);text-align:center;hyphens:none}
/* "Very good" is the widest label and a fifth of 340px is about 62px, so with
   nowrap it truncated to "Very…" and the scale read as if a step were missing.
   Let it wrap to two lines instead; the row is given a fixed height so a
   wrapping label does not shunt the one beside it out of line. */
.cf-cond__steps{align-items:start}
.cf-cond__name{min-height:2.5em}
.cf-cond__step.is-on .cf-cond__name{color:var(--text);font-weight:700}

/* One green at every step, not a gradient down to rust.

   Grading the colour meant a piece listed Good or Fair was marked in amber or
   rust — the shop flagging its own stock as a warning on the page where it is
   trying to sell it. The step position already carries the grade; the colour
   only needs to say "this is the one". Green reads as verified rather than
   cautionary, which is the right tone for stock that has been inspected and
   authenticated. */
.cf-cond__step.is-on .cf-cond__seg{background:#1B7F4B}
.cf-cond__scale{display:flex;justify-content:space-between;margin-top:7px;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-soft)}
.cf-cond__scale span{flex:1;text-align:center}
.cf-cond__scale span:first-child{text-align:left}
.cf-cond__scale span:last-child{text-align:right}

/* The description is free text written per product; it sits above the record
   with a rule so the two are not read as one list. */
.product__description{border-top:1px solid var(--line);padding-top:16px;margin-top:18px;color:var(--text-soft);font-size:14px}
.product__info-container .price .price-item{font-size:26px;font-weight:700}
.product__info-container .price{margin-top:6px}
/* the whole info column is centred (every block's alignment setting in
   templates/product.json), so the trust panel stacks its tick above the
   heading rather than sitting in a left-aligned row */
.cf-trust{border:1px solid #E8E8E8;background:#F7F7F7;padding:20px 22px;display:flex;flex-direction:column;gap:8px;align-items:center;margin:22px 0 6px;text-align:center}
.cf-trust .cf-tick{font-size:19px;line-height:1.35}
.cf-trust h4{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin:0 0 5px}
.cf-trust p{font-size:13.5px;color:#5C5C5C;max-width:46ch;margin:0 auto}
.cf-trust a{font-weight:600;text-decoration:underline;text-underline-offset:3px;color:#121212}
.accordion summary,.accordion .summary__title{text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:600}

/* collection page (PLP) */
.collection-hero{padding:30px 0 8px}
.collection-hero__title{text-align:center;text-transform:uppercase;letter-spacing:.08em;font-size:clamp(26px,3.2vw,40px);font-weight:600}
.collection-hero__description{color:#5C5C5C;text-align:center;max-width:62ch;margin:12px auto 0}
.facets__summary,.mobile-facets__open,.facet-filters__label,.collection-filters__sort,.facets__sort label{text-transform:uppercase;letter-spacing:.1em;font-size:12px;font-weight:600}
.pagination__item{border:1px solid #E8E8E8;border-radius:0;font-size:12.5px;font-weight:600}
.pagination__item:hover{border-color:#121212}
.pagination__item--current{background:#121212;color:#fff;border-color:#121212;text-decoration:none}

/* Card text is centred to match the product page. This is one component shared
   by the shop front and the category grids, so both move together rather than
   disagreeing about where a product name sits. */
.cf .card-info{text-align:center}
.cf .card-info,.cf .card-info .pname,.cf .card-info .csize,.cf .card-info .price{text-align:center}
.cf .card-info .price{justify-content:center}

/* card images: keep full image visible in the square frame (no crop),
   no border around the image frame */
.cf .card .frame{border:none;background:#fff}
.cf .card .frame img{object-fit:contain;background:#fff}
/* Refresh's component-price.css paints .price with the scheme foreground
   (navy on this store) - force the design's near-black */
.cf .card-info .price{color:var(--text)}
/* hover-swap is desktop-only: touch browsers set :hover on tap, which was
   hiding the extra slides mid-swipe (grey squares) */
@media (hover:hover){
  .cf .card:hover img.alt.extra{opacity:0}
}
/* touch devices: the frame becomes a swipeable snap carousel */
@media (hover:none){
  .cf .card .frame.cf-slides{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
  .cf .card .frame.cf-slides::-webkit-scrollbar{display:none}
  .cf .card .frame.cf-slides img{position:static;flex:0 0 100%;width:100%;opacity:1;scroll-snap-align:center}
  .cf .card:hover img.alt{opacity:1}
}

/* product page: media column stays put while the info column scrolls */
@media(min-width:990px){
  .product__media-wrapper{position:sticky;top:24px;align-self:flex-start}
}

/* search modal (CF header) */
.cf-header-section{position:relative}
.cf .cf-search-toggle{font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;list-style:none;display:inline-block}
.cf .cf-search-toggle::-webkit-details-marker{display:none}
.cf .header__search .search-modal{position:absolute;top:100%;left:0;right:0;z-index:70;background:#fff;border-bottom:1px solid #E8E8E8}
.cf-search-suggest{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;padding:14px 0 4px}
.cf-search-suggest__label{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#5C5C5C;margin-right:6px}
.cf-search-suggest a{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border:1px solid #E8E8E8;padding:7px 14px;color:#121212;text-decoration:none}
.cf-search-suggest a:hover{border-color:#121212}
/* predictive results: Refresh anchors them to its own .header class, which
   the CF header lacks - anchor to the search form instead, cap the height
   so long result lists scroll, and keep them inside the viewport */
.cf .header__search predictive-search{position:relative;display:block}
.cf .header__search .predictive-search{left:0;right:0;width:100%;max-height:min(60dvh,520px);overflow-y:auto;border-radius:0}
.cf .header__search .search-modal__content{position:relative;padding:18px clamp(16px,4vw,48px) 22px;max-width:1320px;margin:0 auto;box-sizing:border-box}
.cf .search-modal__close-button{position:absolute;top:20px;right:clamp(8px,2vw,20px)}
/* mobile: search becomes a full-screen overlay; results flow in-page and
   the whole overlay scrolls, so nothing is clipped by the dropdown box */
@media(max-width:749px){
  .cf .header__search .search-modal{position:fixed;inset:0;height:100dvh;border-bottom:0;z-index:100}
  .cf .header__search .search-modal__content{height:100%;overflow-y:auto;padding:56px 16px 96px;display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch}
  .cf .header__search .search-modal__form{width:100%}
  .cf .header__search .predictive-search{position:static;max-height:none;overflow:visible;border:0;box-shadow:none}
  .cf .search-modal__close-button{position:fixed;top:12px;right:12px;z-index:2}
}
/* while live results are open, the popular-search chips give way so the
   results sit directly under the input */
.cf predictive-search[open] .cf-search-suggest,
.cf predictive-search[loading] .cf-search-suggest{display:none}
/* result-group headings: the .cf h2 display size leaks in here - keep them
   as small caption labels */
.cf .predictive-search__heading{font-size:11.5px;letter-spacing:.18em;font-weight:700;text-transform:uppercase}
/* sticky "Search for ..." row = always-visible bottom edge, so a long
   result list reads as scrollable rather than cut off */
.cf .predictive-search__search-for-button{position:sticky;bottom:0;background:#fff;border-top:1px solid #E8E8E8;margin:0}
.cf .predictive-search__search-for-button .predictive-search__item{background:#fff}
/* search must stay reachable on mobile (mockup hid the left column) */
@media(max-width:960px){.cf .mast-left{display:flex}}

/* ---------- header nav dropdowns ----------
   These were originally hand-added to the generated circular.css, which meant
   the next regeneration silently dropped them. They live here now so they
   survive. .top is an <a> for leaf items and a <button> for items with a
   dropdown, so the button needs the font/background reset an anchor doesn't. */
.cf nav.cats .top{display:block;font:inherit;color:inherit;background:none;border:0;cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;padding:14px 16px;border-bottom:2px solid transparent}
.cf nav.cats>div:hover .top,.cf nav.cats .top[aria-current]{border-bottom-color:var(--text)}
.cf nav.cats>div:hover .drop,.cf nav.cats>div.open .drop{visibility:visible;opacity:1}

/* FAQ page: one .acc per question, so drop the per-block spacing and border that
   .acc carries when it is used once on a PDP. */
.cf .faq{max-width:820px;margin:0 auto}
.cf .faq .acc{margin-top:0;border-top:0}
.cf .faq .acc:first-of-type details,.cf .faq .faq-group+.acc details{border-top:1px solid var(--line)}
.cf .faq .acc-body{max-width:none}
.cf .faq-group{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--text-soft);margin:40px 0 8px}
.cf .faq-group:first-child{margin-top:0}
.cf .faq-foot{max-width:820px;margin:32px auto 0;text-align:center;font-size:14px;color:var(--text-soft)}

@media(max-width:960px){
  /* No hover below 960px, so the dropdown becomes a tap-to-open panel on its own
     full-width row rather than being hidden outright (which left BRANDS and
     CATEGORIES with no reachable children at all on mobile). */
  .cf nav.cats>div{position:static}
  .cf nav.cats>div.open{flex:1 0 100%;display:flex;flex-direction:column;align-items:center}
  .cf .drop{display:none;position:static;transform:none;visibility:visible;opacity:1;width:100%;border:0;border-top:1px solid var(--line);padding:18px 0 22px;grid-template-columns:repeat(2,minmax(0,1fr));justify-items:center;gap:8px 20px}
  .cf nav.cats>div.open .drop{display:grid}
  .cf .drop .head{display:none} /* the open button already says it */
}

/* size line on product cards */
/* The size is a spec, not another line of the title. It sat directly under the
   product name at a HEAVIER weight (600 against the name's 400) and only 2px
   smaller, so the two read as one block of text. A bordered chip is
   unmistakably a different kind of information, and matches the size tag on the
   iOS product card. Pieces with no size (bags, wallets) get the same chip with
   a transparent border and text, rather than a separate spacer rule: an empty
   div collapsed to 0 height and knocked the prices in a row out of line by
   25px. Same box, guaranteed same height. */
.cf .card-info .csize{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--text);border:1px solid var(--line);padding:2px 9px;margin:2px 0 9px;line-height:1.7}
.cf .card-info .csize--empty{border-color:transparent;color:transparent;user-select:none}

/* "Shop All" button under a homepage product grid */
.cf .cf-grid-cta{display:flex;justify-content:center;margin-top:clamp(34px,5vw,54px)}

/* divider announcing the sold tail of a collection's pagination */
.cf-sold-divider{text-transform:uppercase;letter-spacing:.18em;font-size:11.5px;font-weight:700;color:#5C5C5C;border-top:1px solid #E8E8E8;padding-top:18px;margin:0 0 18px}

/* cart page */
.cart-items th{text-transform:uppercase;letter-spacing:.1em;font-size:11.5px;color:#5C5C5C;font-weight:600}
.cart-item{border-bottom:1px solid #E8E8E8}
.totals__total{font-weight:700}
.cart__ctas .cart__checkout-button{max-width:none}
/* keep CF grid card text from inheriting Refresh heading margins */
.cf .card-info *{margin:0}
`;

fs.writeFileSync(path.join(ROOT, 'theme/assets/circular.css'), header + out.join('\n') + extras);
console.log('written', (header + out.join('\n') + extras).length, 'bytes');

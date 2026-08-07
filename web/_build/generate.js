/* DEV ONLY — not part of the deliverable.
 *
 * Rebuilds collection.html and product.html from the live Circular Fash
 * catalogue, using Shopify's public /products.json feed (no credentials).
 *
 *   node _build/generate.js            # use cache if present
 *   node _build/generate.js --refresh  # re-fetch from the store
 *
 * The derivations below (designer, category, condition) exist ONLY because the
 * store has no structured field for them — vendor is "Circular Fash" on every
 * product and product_type holds the style name. The same parsing is what the
 * Phase 2 catalogue cleanup would write back via the Admin API.
 */

const fs   = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const CACHE = path.join(__dirname, 'cache');
const STORE = 'https://circularfash.com';

/* ---------------------------------------------------------------- catalogue */

async function loadCatalogue({ refresh }) {
  fs.mkdirSync(CACHE, { recursive: true });
  const pages = [];
  for (let i = 1; i <= 8; i++) {
    const file = path.join(CACHE, `p${i}.json`);
    let raw;
    if (!refresh && fs.existsSync(file)) {
      raw = fs.readFileSync(file, 'utf8');
    } else {
      const res = await fetch(`${STORE}/products.json?limit=250&page=${i}`);
      if (!res.ok) break;
      raw = await res.text();
      fs.writeFileSync(file, raw);
    }
    const batch = JSON.parse(raw).products || [];
    if (!batch.length) break;
    pages.push(...batch);
  }
  return pages;
}

/* ---------------------------------------------------------- field derivation */

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

const CATEGORIES = [
  [/\b(keepall|speedy|alma|neverfull|pochette|noe|jackie|tote|handbag|shoulder bag|crossbody|clutch|backpack|duffle|bumbag|belt bag|bag)\b/i, 'Bags'],
  [/\b(wallet|card holder|purse|belt|cap|hat|beanie|scarf|glove|sunglasses|keychain|tie)\b/i, 'Accessories'],
  [/\b(sneaker|shoe|boot|loafer|trainer|slide|sandal)\b/i, 'Shoes'],
  [/\b(jacket|coat|parka|gilet|vest|puffer|bomber|windbreaker|anorak)\b/i, 'Outerwear'],
  [/\b(trouser|pant|jean|short|chino|cargo)\b/i, 'Bottoms'],
  [/\b(hoodie|sweater|knit|jumper|cardigan|sweatshirt|polo|shirt|tee|t-shirt|top)\b/i, 'Tops'],
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

function sizesOf(product, variants) {
  const idx = (product.options || []).findIndex(o => /size|taille|storlek/i.test(o.name));
  if (idx === -1) return [];
  const key = `option${idx + 1}`;
  return [...new Set(variants.map(v => v[key]).filter(s => s && s !== 'Default Title'))];
}

function genderOf(tags) {
  const t = (tags || []).map(x => String(x).toLowerCase());
  if (t.includes('women')) return 'women';
  if (t.includes('men'))   return 'men';
  return null;
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const int  = s => Math.round(parseFloat(s || '0'));

function normalise(p) {
  const variants = (p.variants || []).filter(v => v.available);
  if (!variants.length) return null;
  if ((p.tags || []).map(t => String(t).toLowerCase()).includes('sold')) return null;

  const cheapest = variants.reduce((a, b) => (int(a.price) <= int(b.price) ? a : b));
  const price    = int(cheapest.price);
  const retail   = int(cheapest.compare_at_price);
  const designer = designerOf(p.title);
  const body     = stripTags(p.body_html);

  // Strip the designer out of the display name — the card shows it separately.
  const name = stripDesigner(p.title, designer);

  return {
    h : p.handle,
    d : designer || 'Circular Fash',
    dk: slug(designer || 'other'),
    n : name,
    p : price,
    r : retail > price ? retail : 0,
    pc: retail > price ? Math.round((retail - price) / retail * 100) : 0,
    c : conditionOf(body),
    s : sizesOf(p, variants),
    g : genderOf(p.tags),
    cat: categoryOf(p.title),
    i : (p.images || []).slice(0, 6).map(im => im.src),
    b : body.slice(0, 700),
    sku: cheapest.sku || '',
    known: !!designer,
  };
}

/* --------------------------------------------------------------- html helpers */

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const kr = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr';

const img = (src, w) => src ? `${src}${src.includes('?') ? '&' : '?'}width=${w}` : '';

function head(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<!-- GENERATED by _build/generate.js from the live catalogue. Do not hand-edit. -->`;
}

function header(active, designers) {
  const drop = designers.slice(0, 11)
    .map(d => `<a href="collection.html?designer=${d.key}" data-shopify="/collections/all">${esc(d.name)}</a>`)
    .join('') + `<a href="collection.html" data-shopify="/collections/all">Shop All Designers</a>`;
  const cur = k => (active === k ? ' aria-current="page"' : '');
  return `
<div class="util">
  <div class="wrap util-in">
    <a href="index.html#newsletter">Join Our Newsletter</a>
    <div class="util-right">
      <span class="muted">Live on TikTok daily · 19:00</span>
      <a href="sell.html" data-shopify="/pages/sell-to-us-1">Sell Now</a>
      <a href="#">Sign In</a>
      <span class="muted">Sweden · SEK kr</span>
    </div>
  </div>
</div>

<div class="masthead">
  <div class="wrap">
    <div class="mast-top">
      <div class="mast-left"><a href="#">Search</a></div>
      <a class="biglogo" href="index.html" data-shopify="/">Circular Fash</a>
      <div class="mast-right"><a href="cart.html" data-shopify="/cart">Cart (0)</a></div>
    </div>
    <nav class="cats" aria-label="Main">
      <div><a class="top" href="collection.html" data-shopify="/collections/new">New Arrivals</a></div>
      <div>
        <a class="top" href="collection.html"${cur('all')} data-shopify="/collections/all">Designers</a>
        <div class="drop"><span class="head">Top Designers</span>${drop}</div>
      </div>
      <div><a class="top" href="collection.html?cat=Bags" data-shopify="/collections/women">Bags</a></div>
      <div><a class="top" href="collection.html?gender=men" data-shopify="/collections/mens">Men</a></div>
      <div><a class="top" href="collection.html?gender=women" data-shopify="/collections/women">Women</a></div>
      <div><a class="top" href="collection.html?cat=Accessories" data-shopify="/collections/accessories">Accessories</a></div>
      <div><a class="top" href="live.html" data-shopify="/pages/live">Live</a></div>
    </nav>
  </div>
</div>`;
}

const FOOTER = `
<footer id="newsletter">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <span class="flogo">Circular Fash</span>
        <p style="max-width:30ch">Authenticated pre-owned luxury fashion, shipped from Sweden to the world.</p>
      </div>
      <div>
        <h4>Shop With Us</h4>
        <ul>
          <li><a href="collection.html" data-shopify="/collections/new">New Arrivals</a></li>
          <li><a href="collection.html?gender=men" data-shopify="/collections/mens">Men</a></li>
          <li><a href="collection.html?gender=women" data-shopify="/collections/women">Women</a></li>
          <li><a href="authenticity.html" data-shopify="/pages/authenticity">Authenticity</a></li>
        </ul>
      </div>
      <div>
        <h4>Sell With Us</h4>
        <ul>
          <li><a href="sell.html" data-shopify="/pages/sell-to-us-1">Ways to Sell</a></li>
          <li><a href="sell.html#submit" data-shopify="/pages/sell-to-us-1">Submit an Item</a></li>
        </ul>
      </div>
      <div>
        <h4>Customer Service</h4>
        <ul>
          <li><a href="about.html" data-shopify="/pages/about">About Us</a></li>
          <li><a href="#" data-shopify="/pages/contact">Contact Us</a></li>
          <li><a href="#" data-shopify="/pages/return-policy">Returns</a></li>
          <li><a href="#" data-shopify="/apps/help-center">FAQ</a></li>
        </ul>
      </div>
      <div>
        <h4>Join Our Newsletter</h4>
        <p>New drops and live schedule, straight to your inbox.</p>
        <div class="newsletter">
          <input type="email" placeholder="Email address" aria-label="Email address">
          <button type="button">Sign Up</button>
        </div>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 Circular Fash</span>
      <span><a href="https://www.tiktok.com/@circularfash">TikTok</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/circularfash_/">Instagram</a> &nbsp;·&nbsp; <a href="https://www.facebook.com/groups/923079832366605">Facebook</a> &nbsp;·&nbsp; <a href="https://www.trustpilot.com/review/circularfash.com">Trustpilot</a></span>
    </div>
  </div>
</footer>
</body>
</html>`;

/* ------------------------------------------------------------------- the card */

function card(x) {
  const label = `${x.d} — ${x.n}`.slice(0, 60);
  const main  = x.i[0] ? `<img class="main" src="${esc(img(x.i[0], 800))}" alt="${esc(x.d + ' ' + x.n)}" loading="lazy" onerror="this.remove()">` : '';
  const alt   = x.i[1] ? `<img class="alt" src="${esc(img(x.i[1], 800))}" alt="" loading="lazy" onerror="this.remove()">` : '';
  const sizeSuffix = x.s.length === 1 ? ` · ${esc(x.s[0])}` : '';
  const cond  = x.c ? `<div class="cond">Condition: ${x.c}</div>` : `<div class="cond">&nbsp;</div>`;
  const retail = x.r
    ? `<div class="retail-line">Est. retail ${kr(x.r)} · <b>${x.pc}% below retail</b></div>`
    : `<div class="retail-line">&nbsp;</div>`;

  return `      <a class="card" data-gender="${x.g || 'unisex'}" data-brand="${x.dk}" data-cat="${x.cat}" data-sizes="${esc(x.s.join(' ').toLowerCase())}" data-cond="${slug(x.c || 'unknown')}" data-price="${x.p}" href="product.html?p=${encodeURIComponent(x.h)}" data-shopify="/products/${x.h}">
        <div class="frame" data-label="${esc(label)}">${main}${alt}</div>
        <div class="card-info">
          <div class="brand">${esc(x.d)}</div>
          <div class="pname">${esc(x.n)}${sizeSuffix}</div>
          ${cond}
          <div class="price">${kr(x.p)}</div>
          ${retail}
        </div>
      </a>`;
}

/* -------------------------------------------------------------- collection.html */

function buildCollection(items, designers) {
  const sizes = [...new Set(items.flatMap(x => x.s))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }));
  const conds = [...new Set(items.map(x => x.c).filter(Boolean))];
  const cats  = [...new Set(items.map(x => x.cat))].sort();

  const opts = (arr, fmt) => arr.map(fmt).join('\n        ');

  return `${head('Shop All — Circular Fash')}
${header('all', designers)}

<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="index.html">Home</a><span class="sep">/</span><span>Shop All</span>
  </nav>
  <div class="coll-head">
    <h1>Shop All</h1>
    <p>Every authenticated piece currently in the studio — bags, outerwear and accessories, each one inspected in Sweden before it goes live.</p>
  </div>
</div>

<div class="wrap" style="padding-bottom:clamp(52px,7vw,92px)">

  <div class="filters bar" aria-label="Filter and sort products">
    <div class="fset">
      <div class="pill-group" role="group" aria-label="Gender">
        <button class="pill active" data-gender="all">All</button>
        <button class="pill" data-gender="men">Men</button>
        <button class="pill" data-gender="women">Women</button>
      </div>
      <select id="filter-brand" aria-label="Filter by designer">
        <option value="all">Designer: All</option>
        ${opts(designers, d => `<option value="${d.key}">${esc(d.name)} (${d.count})</option>`)}
      </select>
      <select id="filter-cat" aria-label="Filter by category">
        <option value="all">Category: All</option>
        ${opts(cats, c => `<option value="${esc(c)}">${esc(c)}</option>`)}
      </select>
      <select id="filter-size" aria-label="Filter by size">
        <option value="all">Size: All</option>
        ${opts(sizes, s => `<option value="${esc(s.toLowerCase())}">${esc(s)}</option>`)}
      </select>
      <select id="filter-cond" aria-label="Filter by condition">
        <option value="all">Condition: All</option>
        ${opts(conds, c => `<option value="${slug(c)}">${esc(c)}</option>`)}
      </select>
      <button class="clear" id="filter-clear">Clear</button>
    </div>
    <div class="fset right">
      <span class="result-count" id="result-count"></span>
      <select id="sort-by" aria-label="Sort products">
        <option value="featured">Sort: Featured</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="discount">Biggest Discount</option>
      </select>
    </div>
  </div>

  <div class="grid" id="product-grid">

${items.map(card).join('\n\n')}

  </div>

  <p class="no-results" id="no-results">No items match these filters. Clear them to see everything again.</p>

  <nav class="pagination" id="pagination" aria-label="Pagination"></nav>

</div>
${FOOTER.replace('</body>', `
<script>
/* Mockup filtering, sorting and pagination over the real in-stock catalogue.
   Phase 2 replaces all of this with Shopify Search & Discovery facets. */
(function(){
  var PER_PAGE = 48;
  var grid  = document.getElementById('product-grid');
  var cards = [].slice.call(grid.querySelectorAll('.card'));
  var featured = cards.slice();
  var count = document.getElementById('result-count');
  var noRes = document.getElementById('no-results');
  var pager = document.getElementById('pagination');
  var pills = document.querySelectorAll('.pill[data-gender]');
  var sel = {
    brand: document.getElementById('filter-brand'),
    cat:   document.getElementById('filter-cat'),
    size:  document.getElementById('filter-size'),
    cond:  document.getElementById('filter-cond'),
    sort:  document.getElementById('sort-by')
  };
  var state = {gender:'all', brand:'all', cat:'all', size:'all', cond:'all', sort:'featured'}, page = 1;

  var num = function(c){ return parseInt(c.dataset.price,10) || 0; };
  var disc = function(c){
    var m = (c.querySelector('.retail-line b')||{}).textContent;
    return m ? parseInt(m,10) : -1;
  };
  var sorters = {
    featured:null,
    'price-asc':  function(a,b){ return num(a)-num(b); },
    'price-desc': function(a,b){ return num(b)-num(a); },
    discount:     function(a,b){ return disc(b)-disc(a); }
  };

  function matches(c){
    return (state.gender==='all' || c.dataset.gender===state.gender)
        && (state.brand ==='all' || c.dataset.brand===state.brand)
        && (state.cat   ==='all' || c.dataset.cat===state.cat)
        && (state.cond  ==='all' || c.dataset.cond===state.cond)
        && (state.size  ==='all' || (' '+c.dataset.sizes+' ').indexOf(' '+state.size+' ')>-1);
  }

  function drawPager(total){
    var pages = Math.ceil(total/PER_PAGE);
    pager.innerHTML = '';
    if (pages < 2) return;
    var add = function(html){ pager.insertAdjacentHTML('beforeend', html); };
    add(page>1 ? '<a class="step" href="#" data-go="'+(page-1)+'">Prev</a>'
               : '<span class="step off">Prev</span>');
    var list = [];
    for (var i=1;i<=pages;i++){
      if (i===1 || i===pages || Math.abs(i-page)<=1) list.push(i);
      else if (list[list.length-1] !== '…') list.push('…');
    }
    list.forEach(function(i){
      if (i==='…') add('<span class="gap">…</span>');
      else if (i===page) add('<span class="current" aria-current="page">'+i+'</span>');
      else add('<a href="#" data-go="'+i+'">'+i+'</a>');
    });
    add(page<pages ? '<a class="step" href="#" data-go="'+(page+1)+'">Next</a>'
                   : '<span class="step off">Next</span>');
  }

  function apply(resetPage){
    if (resetPage) page = 1;
    var ordered = featured.slice(), fn = sorters[state.sort];
    if (fn) ordered.sort(fn);
    ordered.forEach(function(c){ grid.appendChild(c); });

    var shown = ordered.filter(matches);
    var start = (page-1)*PER_PAGE, end = start+PER_PAGE;
    cards.forEach(function(c){ c.classList.add('hidden'); });
    shown.slice(start,end).forEach(function(c){ c.classList.remove('hidden'); });

    count.textContent = shown.length + ' item' + (shown.length===1?'':'s');
    noRes.classList.toggle('show', shown.length===0);
    drawPager(shown.length);
    if (resetPage === false) window.scrollTo({top:grid.offsetTop-140, behavior:'smooth'});
  }

  pills.forEach(function(p){
    p.addEventListener('click', function(){
      pills.forEach(function(x){ x.classList.remove('active'); });
      p.classList.add('active'); state.gender = p.dataset.gender; apply(true);
    });
  });
  Object.keys(sel).forEach(function(k){
    sel[k].addEventListener('change', function(){ state[k] = this.value; apply(true); });
  });
  document.getElementById('filter-clear').addEventListener('click', function(){
    state = {gender:'all', brand:'all', cat:'all', size:'all', cond:'all', sort:sel.sort.value};
    pills.forEach(function(x){ x.classList.toggle('active', x.dataset.gender==='all'); });
    sel.brand.value='all'; sel.cat.value='all'; sel.size.value='all'; sel.cond.value='all';
    apply(true);
  });
  pager.addEventListener('click', function(e){
    var a = e.target.closest('[data-go]');
    if (!a) return;
    e.preventDefault(); page = +a.dataset.go; apply(false);
  });

  // Deep links from the nav: ?designer= / ?gender= / ?cat=
  var q = new URLSearchParams(location.search);
  if (q.get('designer')) { state.brand = q.get('designer'); sel.brand.value = state.brand; }
  if (q.get('cat'))      { state.cat   = q.get('cat');      sel.cat.value   = state.cat; }
  if (q.get('gender')) {
    state.gender = q.get('gender');
    pills.forEach(function(x){ x.classList.toggle('active', x.dataset.gender===state.gender); });
  }
  apply(true);
})();
</script>
</body>`)}`;
}

/* ----------------------------------------------------------- product.html (PDP) */

function buildProduct(items, designers) {
  const data = items.map(x => ({
    h:x.h, d:x.d, n:x.n, p:x.p, r:x.r, pc:x.pc, c:x.c, s:x.s,
    cat:x.cat, i:x.i, b:x.b, sku:x.sku
  }));

  return `${head('Product — Circular Fash')}
${header(null, designers)}

<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="index.html">Home</a><span class="sep">/</span><a href="collection.html">Shop All</a><span class="sep">/</span><span id="crumb-designer"></span>
  </nav>

  <div class="pdp">
    <div class="gallery">
      <div class="thumbs" id="thumbs" role="tablist" aria-label="Product images"></div>
      <div class="frame stage" id="stage" data-label="Loading">
        <img id="stage-img" alt="" onerror="this.remove()">
      </div>
    </div>

    <div class="pdp-info">
      <div class="brand" id="p-designer"></div>
      <h1 id="p-name"></h1>
      <p class="pdp-cond" id="p-cond"></p>

      <div class="pdp-price" id="p-price"></div>
      <div class="pdp-retail" id="p-retail"></div>

      <div class="pdp-actions">
        <a class="btn solid" href="cart.html" data-shopify="/cart/add">Add to Cart</a>
        <a class="btn ghost" href="#">Ask About This Item</a>
      </div>
      <p class="pdp-note">One of a kind — only one available. Ships from Sweden · 14-day returns.</p>

      <div class="trust">
        <span class="tick" aria-hidden="true">✓</span>
        <div>
          <h4>Authenticated</h4>
          <p>Inspected and verified by our experts before listing — hardware, stitching, date code and materials. <a href="authenticity.html" data-shopify="/pages/authenticity">Our process</a></p>
        </div>
      </div>

      <div class="acc">
        <details open>
          <summary>Details</summary>
          <div class="acc-body">
            <p id="p-body"></p>
            <table class="spec" id="p-spec"></table>
          </div>
        </details>
        <details>
          <summary>Shipping</summary>
          <div class="acc-body">
            <p>Ships from our studio in Sweden within 1–2 business days, tracked and insured.</p>
            <p>Sweden 49 kr · EU 149 kr · Rest of world 299 kr. Free shipping on orders over 3 000 kr.</p>
          </div>
        </details>
        <details>
          <summary>Returns</summary>
          <div class="acc-body">
            <p>14 days from delivery. The item must come back in the condition it was sent, with all included accessories.</p>
          </div>
        </details>
        <details>
          <summary>Authenticity Guarantee</summary>
          <div class="acc-body">
            <p>Every piece is authenticated in-house before it is listed. If an item is ever found not to be genuine, we refund the full purchase price.</p>
          </div>
        </details>
      </div>
    </div>
  </div>
</div>

<section style="border-top:1px solid var(--line)">
  <div class="wrap">
    <div class="sec-head">
      <h2 id="rel-head">More From This Designer</h2>
      <p class="sec-sub">Also authenticated and in the studio now. <a href="collection.html">Shop everything</a></p>
    </div>
    <div class="grid" id="related"></div>
  </div>
</section>
${FOOTER.replace('</body>', `
<script id="catalogue" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
(function(){
  var ALL = JSON.parse(document.getElementById('catalogue').textContent);
  var q   = new URLSearchParams(location.search).get('p');
  var x   = ALL.filter(function(i){ return i.h === q; })[0] || ALL[0];

  function kr(n){ return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + ' kr'; }
  function w(src, px){ return src + (src.indexOf('?')>-1 ? '&' : '?') + 'width=' + px; }
  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  document.title = x.d + ' ' + x.n + ' — Circular Fash';
  document.getElementById('crumb-designer').textContent = x.d;
  document.getElementById('p-designer').textContent = x.d;
  document.getElementById('p-name').textContent = x.n;
  document.getElementById('p-cond').textContent =
    (x.c ? 'Condition: ' + x.c + ' · ' : '') + 'Authenticated in Sweden';
  document.getElementById('p-price').textContent = kr(x.p);
  document.getElementById('p-retail').innerHTML =
    x.r ? 'Est. retail ' + kr(x.r) + ' · <b>' + x.pc + '% below retail</b>' : '&nbsp;';
  document.getElementById('p-body').textContent = x.b || '';

  var spec = [['Designer', x.d], ['Category', x.cat]];
  if (x.s.length) spec.push(['Size', x.s.join(', ')]);
  if (x.c)        spec.push(['Condition', x.c]);
  if (x.r)        spec.push(['Est. retail', kr(x.r)]);
  if (x.sku)      spec.push(['SKU', x.sku]);
  document.getElementById('p-spec').innerHTML = spec.map(function(r){
    return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
  }).join('');

  // Gallery
  var stage = document.getElementById('stage'), simg = document.getElementById('stage-img');
  var thumbs = document.getElementById('thumbs');
  var imgs = x.i.length ? x.i : [];
  stage.setAttribute('data-label', x.d + ' — ' + x.n);
  if (imgs.length) { simg.src = w(imgs[0], 1200); simg.alt = x.d + ' ' + x.n; }
  else simg.style.display = 'none';

  thumbs.innerHTML = imgs.map(function(src, n){
    return '<button class="thumb' + (n===0?' active':'') + '" role="tab" aria-selected="' +
      (n===0) + '" data-full="' + w(src,1200) + '" data-label="View ' + (n+1) + '">' +
      '<img src="' + w(src,200) + '" alt="" onerror="this.remove()"></button>';
  }).join('');

  thumbs.addEventListener('click', function(e){
    var t = e.target.closest('.thumb'); if (!t) return;
    [].forEach.call(thumbs.children, function(b){
      b.classList.remove('active'); b.setAttribute('aria-selected','false');
    });
    t.classList.add('active'); t.setAttribute('aria-selected','true');
    simg.src = t.dataset.full; simg.style.display = '';
  });

  // Related — same designer first, then anything else
  var same  = ALL.filter(function(i){ return i.d === x.d && i.h !== x.h; });
  var pool  = same.length >= 4 ? same : same.concat(ALL.filter(function(i){ return i.d !== x.d; }));
  document.getElementById('rel-head').textContent =
    same.length >= 4 ? 'More From ' + x.d : 'You May Also Like';

  document.getElementById('related').innerHTML = pool.slice(0,4).map(function(i){
    return '<a class="card" href="product.html?p=' + encodeURIComponent(i.h) + '" data-shopify="/products/' + i.h + '">' +
      '<div class="frame" data-label="' + esc(i.d + ' — ' + i.n) + '">' +
      (i.i[0] ? '<img class="main" src="' + w(i.i[0],800) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      (i.i[1] ? '<img class="alt" src="' + w(i.i[1],800) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '</div><div class="card-info">' +
      '<div class="brand">' + esc(i.d) + '</div>' +
      '<div class="pname">' + esc(i.n) + '</div>' +
      '<div class="cond">' + (i.c ? 'Condition: ' + i.c : '&nbsp;') + '</div>' +
      '<div class="price">' + kr(i.p) + '</div>' +
      '<div class="retail-line">' + (i.r ? 'Est. retail ' + kr(i.r) + ' · <b>' + i.pc + '% below retail</b>' : '&nbsp;') + '</div>' +
      '</div></a>';
  }).join('');
})();
</script>
</body>`)}`;
}

/* ---------------------------------------------------------------------- main */

(async function main(){
  const refresh = process.argv.includes('--refresh');
  const raw = await loadCatalogue({ refresh });
  const items = raw.map(normalise).filter(Boolean);

  const counts = {};
  items.forEach(x => { counts[x.d] = (counts[x.d] || 0) + 1; });
  const designers = Object.entries(counts)
    .filter(([n]) => n !== 'Circular Fash')
    .sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))
    .map(([name,count]) => ({ name, count, key: slug(name) }));

  fs.writeFileSync(path.join(ROOT,'collection.html'), buildCollection(items, designers));
  fs.writeFileSync(path.join(ROOT,'product.html'),    buildProduct(items, designers));

  // Report the data gaps — these are the Phase 2 cleanup list.
  const gap = (label, n) => console.log('  ' + label.padEnd(34) + n + '  (' + Math.round(n/items.length*100) + '%)');
  console.log('published products fetched : ' + raw.length);
  console.log('in stock, written to pages : ' + items.length);
  console.log('\nDATA GAPS across the ' + items.length + ' in-stock items:');
  gap('no designer detected in title', items.filter(x => !x.known).length);
  gap('no condition anywhere',          items.filter(x => !x.c).length);
  gap('no compare_at_price',            items.filter(x => !x.r).length);
  gap('no gender tag',                  items.filter(x => !x.g).length);
  gap('no size option',                 items.filter(x => !x.s.length).length);
  gap('fewer than 2 images',            items.filter(x => x.i.length < 2).length);
  gap('category unresolved',            items.filter(x => x.cat === 'Other').length);
  console.log('\ndesigners found: ' + designers.length);
  console.log('  ' + designers.slice(0,10).map(d => d.name+' '+d.count).join(', '));
  console.log('\nunmatched titles (need a manual vendor):');
  items.filter(x => !x.known).slice(0,10).forEach(x => console.log('  · ' + x.n));
})();

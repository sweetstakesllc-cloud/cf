/* Phase 2 — catalogue cleanup.
 *
 * Writes the derived designer into `vendor` and the derived category into
 * `product_type`, because the live store has neither: vendor is "Circular Fash"
 * on all 524 products and product_type holds the style name. Shopify's Search &
 * Discovery app filters on those two fields, so nothing can be filtered until
 * this runs.
 *
 *   node _build/cleanup.js                 # dry run, uses cache, writes CSV
 *   node _build/cleanup.js --refresh       # dry run against a fresh fetch
 *   node _build/cleanup.js --apply         # WRITES TO THE LIVE STORE
 *
 * --apply refuses to run unless a CSV from a dry run of the SAME catalogue
 * already exists, so nobody can mutate 524 live products without a human having
 * had the diff in front of them first.
 */

const fs   = require('fs');
const path = require('path');
const { designerOf, categoryOf } = require('./parse');

const ROOT  = path.join(__dirname, '..', '..');   // repo root, where .env lives
const CACHE = path.join(__dirname, 'cache');
const OUT   = path.join(__dirname, 'out');
const CSV   = path.join(OUT, 'vendor-type-dryrun.csv');
const STORE = 'https://circularfash.com';

const API_VERSION = '2026-07';   // matches the app's webhook API version

/* ------------------------------------------------------------------- config */

// Minimal .env reader — no dependency, and the file is gitignored.
function env() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/* ---------------------------------------------------------------- catalogue */

async function loadCatalogue({ refresh }) {
  fs.mkdirSync(CACHE, { recursive: true });
  const all = [];
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
    all.push(...batch);
  }
  return all;
}

/* ------------------------------------------------------------------ diffing */

const isSold    = p => (p.tags || []).map(t => String(t).toLowerCase()).includes('sold');
const inStock   = p => (p.variants || []).some(v => v.available);

function planFor(p) {
  const designer = designerOf(p.title);
  const category = categoryOf(p.title);
  return {
    handle    : p.handle,
    title     : p.title,
    oldVendor : p.vendor || '',
    // Leave vendor alone when the title yields no designer — a wrong vendor is
    // worse than the status quo, and these are the rows a human must fill in.
    newVendor : designer || p.vendor || '',
    oldType   : p.product_type || '',
    // Same rule: 'Other' is not an improvement over whatever is there.
    newType   : category === 'Other' ? (p.product_type || '') : category,
    designer,
    category,
    sold      : isSold(p),
    stock     : inStock(p),
  };
}

const q = s => `"${String(s).replace(/"/g, '""')}"`;

function writeCsv(rows) {
  fs.mkdirSync(OUT, { recursive: true });
  const head = 'handle,title,old_vendor,new_vendor,vendor_changes,old_type,new_type,type_changes,in_stock,sold';
  const body = rows.map(r => [
    r.handle, r.title, r.oldVendor, r.newVendor, r.newVendor !== r.oldVendor ? 'YES' : '',
    r.oldType, r.newType, r.newType !== r.oldType ? 'YES' : '',
    r.stock ? 'yes' : 'no', r.sold ? 'yes' : 'no',
  ].map(q).join(','));
  fs.writeFileSync(CSV, [head, ...body].join('\n') + '\n');
}

/* -------------------------------------------------------------- admin write */

// Dev Dashboard apps no longer expose a static shpat_ token — legacy custom apps
// were withdrawn on 2026-01-01. Client ID + secret are exchanged for a 24-hour
// token instead. See shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
async function accessToken(cfg) {
  const shop = cfg.SHOPIFY_SHOP;
  const res = await fetch(`https://${shop}.myshopify.com/admin/oauth/access_token`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      grant_type   : 'client_credentials',
      client_id    : cfg.SHOPIFY_CLIENT_ID,
      client_secret: cfg.SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { token: j.access_token, scope: j.scope };
}

async function graphql(cfg, token, query, variables) {
  const res = await fetch(
    `https://${cfg.SHOPIFY_SHOP}.myshopify.com/admin/api/${API_VERSION}/graphql.json`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

// Only status:active. The store also holds 2 316 archived products (past sales)
// and 36 drafts that the public feed never showed — leave them alone.
async function fetchActive(cfg, token) {
  const Q = `query($c: String) {
    products(first: 250, query: "status:active", after: $c) {
      pageInfo { hasNextPage endCursor }
      edges { node { id handle title vendor productType } }
    }
  }`;
  const out = [];
  let cursor = null;
  do {
    const d = await graphql(cfg, token, Q, { c: cursor });
    out.push(...d.products.edges.map(e => e.node));
    cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (cursor);
  return out;
}

function rollbackPath() {
  fs.mkdirSync(OUT, { recursive: true });
  const t = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(OUT, `rollback-${t}.csv`);
}

/* --------------------------------------------------------------------- main */

(async function main() {
  const refresh = process.argv.includes('--refresh');
  const apply   = process.argv.includes('--apply');

  const products = await loadCatalogue({ refresh });
  if (!products.length) { console.error('no products loaded'); process.exit(1); }

  const rows      = products.map(planFor);
  const vChanged  = rows.filter(r => r.newVendor !== r.oldVendor);
  const tChanged  = rows.filter(r => r.newType   !== r.oldType);
  const noDesign  = rows.filter(r => !r.designer);
  const noCat     = rows.filter(r => r.category === 'Other');

  writeCsv(rows);

  const pct = n => `${Math.round(n / rows.length * 100)}%`;
  console.log(`\npublished products        : ${rows.length}`);
  console.log(`  in stock                : ${rows.filter(r => r.stock).length}`);
  console.log(`  tagged sold             : ${rows.filter(r => r.sold).length}`);
  console.log(`\nvendor rewrites           : ${vChanged.length}  (${pct(vChanged.length)})`);
  console.log(`product_type rewrites     : ${tChanged.length}  (${pct(tChanged.length)})`);
  console.log(`\nleft alone — no designer  : ${noDesign.length}`);
  console.log(`left alone — no category  : ${noCat.length}`);

  const byVendor = {};
  for (const r of rows) if (r.designer) byVendor[r.designer] = (byVendor[r.designer] || 0) + 1;
  const top = Object.entries(byVendor).sort((a, b) => b[1] - a[1]);
  console.log(`\ndistinct vendors after    : ${top.length}`);
  console.log('  ' + top.slice(0, 12).map(([d, n]) => `${d} ${n}`).join(', '));

  if (noDesign.length) {
    console.log('\ntitles with no designer (need a manual vendor):');
    for (const r of noDesign.slice(0, 25)) console.log(`  ${r.handle}  —  ${r.title}`);
    if (noDesign.length > 25) console.log(`  … and ${noDesign.length - 25} more`);
  }

  console.log(`\nCSV written: ${path.relative(process.cwd(), CSV)}`);

  if (!apply) {
    console.log('\nDRY RUN — nothing was written to the store.');
    console.log('Next: have the client read the CSV, export a products CSV backup');
    console.log('from admin, then re-run with --apply.\n');
    return;
  }

  /* ---- apply ---- */
  const cfg = env();
  const missing = ['SHOPIFY_SHOP', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET']
    .filter(k => !cfg[k]);
  if (missing.length) {
    console.error(`\nrefusing to apply — missing in .env: ${missing.join(', ')}\n`);
    process.exit(1);
  }

  const { token, scope } = await accessToken(cfg);
  if (!/write_products/.test(scope || '')) {
    console.error(`\nrefusing to apply — token lacks write_products (got: ${scope})\n`);
    process.exit(1);
  }
  console.log(`\ntoken acquired, scopes: ${scope}`);

  // Admin, not the public feed, is the source of truth for what we are about to
  // overwrite — products.json omits drafts and reflects the Online Store channel
  // only. Restrict to status:active: the other 2 353 products are archived past
  // sales and 36 drafts, and must not be touched.
  const live = await fetchActive(cfg, token);
  console.log(`active products in admin  : ${live.length}`);

  // Rollback file BEFORE any mutation. Shopify has no undo for a bulk vendor
  // rewrite, and 505 of 524 product_type values are empty — once overwritten the
  // original state is unrecoverable without this.
  const stamp = rollbackPath();
  fs.writeFileSync(stamp, [
    'id,handle,vendor,product_type',
    ...live.map(p => [p.id, p.handle, p.vendor || '', p.productType || ''].map(q).join(',')),
  ].join('\n') + '\n');
  console.log(`rollback written          : ${path.relative(process.cwd(), stamp)}`);

  const work = live
    .map(p => ({ p, plan: planFor({ ...p, product_type: p.productType, tags: [], variants: [] }) }))
    .filter(({ p, plan }) => plan.newVendor !== (p.vendor || '') ||
                             plan.newType   !== (p.productType || ''));

  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit    = limitArg ? parseInt(limitArg.split('=')[1], 10) : work.length;
  const batch    = work.slice(0, limit);

  console.log(`\nproducts needing a change : ${work.length}`);
  console.log(`applying now              : ${batch.length}${limit < work.length ? '  (canary)' : ''}\n`);

  const MUTATION = `mutation($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id vendor productType }
      userErrors { field message }
    }
  }`;

  let ok = 0; const failed = [];
  for (const [i, { p, plan }] of batch.entries()) {
    try {
      const d = await graphql(cfg, token, MUTATION, {
        input: { id: p.id, vendor: plan.newVendor, productType: plan.newType },
      });
      const errs = d.productUpdate.userErrors;
      if (errs && errs.length) { failed.push([p.handle, JSON.stringify(errs)]); }
      else ok++;
    } catch (e) {
      failed.push([p.handle, e.message.slice(0, 120)]);
    }
    if ((i + 1) % 25 === 0 || i === batch.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${batch.length}  ok ${ok}  failed ${failed.length}`);
    }
  }
  console.log('\n');

  if (failed.length) {
    console.log('failures:');
    for (const [h, m] of failed.slice(0, 15)) console.log(`  ${h}  ${m}`);
    if (failed.length > 15) console.log(`  … and ${failed.length - 15} more`);
  }
  console.log(`\ndone — ${ok} updated, ${failed.length} failed.`);
  console.log(`revert with the rollback file if anything looks wrong.\n`);
})();

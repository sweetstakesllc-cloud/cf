/* Rewrites the main menu. Dry run by default; pass --apply to write.
 *   - FAQ            /apps/help-center (404)  ->  the FAQ page
 *   - SOURCING REQUESTS                       ->  new top-level item after SELL TO US
 *   - WOMEN          absolute + hard-coded availability param -> plain /collections/women
 *   - BRANDS         drops children whose collection has no products
 */
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/shahloshanazarova/Desktop/claude';
const API = '2026-07';
const APPLY = process.argv.includes('--apply');

const EMPTY_BRANDS = ['saint-laurent', 'moose-knuckles', 'woolrich', 'amiri', 'acne-studios'];

function env() {
  const o = {};
  for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return o;
}

(async () => {
  const E = env();
  const url = `https://${E.SHOPIFY_SHOP}.myshopify.com/admin/api/${API}/graphql.json`;
  const tr = await fetch(`https://${E.SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: E.SHOPIFY_CLIENT_ID, client_secret: E.SHOPIFY_CLIENT_SECRET, grant_type: 'client_credentials' }),
  });
  const tok = (await tr.json()).access_token;
  const gql = async (query, variables) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': tok }, body: JSON.stringify({ query, variables }) });
    const j = await r.json();
    if (j.errors) throw new Error(JSON.stringify(j.errors));
    return j.data;
  };

  const d = await gql(`{
    menus(first:20){ nodes{ id handle title
      items{ id title type url resourceId tags
        items{ id title type url resourceId tags } } } }
  }`);
  const menu = d.menus.nodes.find(m => m.handle === 'main-menu');
  fs.writeFileSync(path.join(__dirname, 'menu-backup.json'), JSON.stringify(menu, null, 2));
  console.log(`backed up main-menu to menu-backup.json (${menu.items.length} top-level items)\n`);

  const pages = await gql(`{ pages(first:60){ nodes{ id handle title } } }`);
  const pageBy = new Map(pages.pages.nodes.map(p => [p.handle, p]));
  const faqPage = pageBy.get('faq');
  const sourcingPage = pageBy.get('sourcing-requests');
  if (!faqPage || !sourcingPage) throw new Error('faq / sourcing-requests page missing');

  // Which brand children point at an empty collection?
  const cols = await gql(`{ collections(first:250){ nodes{ id handle productsCount{count} } } }`);
  const emptyIds = new Set(cols.collections.nodes.filter(c => EMPTY_BRANDS.includes(c.handle)).map(c => c.id));

  const strip = it => {
    const base = { id: it.id, title: it.title, type: it.type };
    if (it.url != null) base.url = it.url;
    if (it.resourceId != null) base.resourceId = it.resourceId;
    if (it.tags && it.tags.length) base.tags = it.tags;
    return base;
  };

  const out = [];
  for (const top of menu.items) {
    const item = strip(top);

    if (top.title === 'FAQ') {
      item.type = 'PAGE';
      item.resourceId = faqPage.id;
      delete item.url;
      console.log(`FAQ            ${top.url}  ->  page /pages/faq`);
    }

    if (top.title === 'WOMEN') {
      item.type = 'COLLECTION';
      if (!item.resourceId) { item.type = 'HTTP'; item.url = '/collections/women'; }
      else delete item.url;
      console.log(`WOMEN          ${top.url}  ->  ${item.type === 'COLLECTION' ? 'collection resource (no query string)' : '/collections/women'}`);
    }

    if (top.items && top.items.length) {
      const kept = [], dropped = [];
      for (const child of top.items) {
        if (top.title === 'BRANDS' && child.resourceId && emptyIds.has(child.resourceId)) dropped.push(child.title);
        else kept.push(strip(child));
      }
      item.items = kept;
      if (dropped.length) console.log(`${top.title.padEnd(14)} drops ${dropped.length} empty: ${dropped.join(', ')}  (${top.items.length} -> ${kept.length})`);
    }

    out.push(item);

    if (top.title === 'SELL TO US') {
      out.push({ title: 'SOURCING REQUESTS', type: 'PAGE', resourceId: sourcingPage.id });
      console.log(`SOURCING REQUESTS  added after SELL TO US -> /pages/sourcing-requests`);
    }
  }

  console.log(`\nresult: ${out.length} top-level items: ${out.map(i => i.title).join(' | ')}`);

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to write'); return; }

  const res = await gql(`
    mutation($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
        menu { id items { title url items { title } } }
        userErrors { field message }
      }
    }`, { id: menu.id, title: menu.title, handle: menu.handle, items: out });
  if (res.menuUpdate.userErrors.length) throw new Error(JSON.stringify(res.menuUpdate.userErrors));
  console.log('\nAPPLIED. Live menu now:');
  for (const i of res.menuUpdate.menu.items) console.log(`  ${i.title.padEnd(20)} ${i.url}${i.items.length ? `  (${i.items.length} children)` : ''}`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

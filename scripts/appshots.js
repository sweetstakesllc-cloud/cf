// Capture every main app screen from the running Expo web server and frame each
// in the same light-backdrop iPhone mockup used by scripts/mockup.js.
// Drives the app by tapping the bottom tab bar (no URL linking is configured).
//
// Usage: node scripts/appshots.js   (Expo web must be running on :8081)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const URL = 'http://localhost:8081';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Find an element's center in CSS px (viewport coords). Returns null if absent.
async function centerOf(page, finder, arg) {
  return page.evaluate(new Function('arg', `
    const find = ${finder};
    const el = find(arg);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  `), arg);
}

// Tap a Pressable by its visible text (the bottom tabs). Picks the bottom-most
// match so a tab label wins over any same-named header text. Uses a REAL mouse
// click — RN Web Pressable ignores synthetic dispatched events.
async function tapText(page, label) {
  const finder = `(label) => {
    const leaves = Array.from(document.querySelectorAll('div,span,a,button'))
      .filter((e) => e.childElementCount === 0 && (e.textContent || '').trim().toUpperCase() === label.toUpperCase());
    if (!leaves.length) return null;
    leaves.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return leaves[0];
  }`;
  const pt = await centerOf(page, finder, label);
  if (!pt) throw new Error('could not find tappable: ' + label);
  await page.mouse.click(pt.x, pt.y);
  await sleep(2200);
}

// Tap the first large product image in the grid -> opens Product detail.
async function tapFirstProduct(page) {
  const finder = `() => {
    const imgs = Array.from(document.querySelectorAll('[role="img"], img'))
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 90 && r.top > 120; })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return imgs[0] || null;
  }`;
  const pt = await centerOf(page, finder);
  if (!pt) throw new Error('no product image found');
  await page.mouse.click(pt.x, pt.y);
  await sleep(2600);
}

function frameHtml(screenDataUri) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1080px; height:1920px; }
    .stage {
      width:1080px; height:1920px;
      background: radial-gradient(130% 100% at 50% 32%, #FAFAFB 0%, #E6E6E9 55%, #D3D3D7 100%);
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .phone {
      position:relative; width:664px; height:1437px;
      background:#0b0b0b; border-radius:80px; padding:16px;
      box-shadow: 0 2px 0 2px #2a2a2a inset, 0 50px 110px -25px rgba(0,0,0,0.5), 0 0 0 2px #000;
    }
    .screen { width:100%; height:100%; border-radius:64px; overflow:hidden; background:#fff; }
    .screen img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
    .island { position:absolute; top:32px; left:50%; transform:translateX(-50%);
      width:126px; height:35px; background:#000; border-radius:19px; z-index:3; }
  </style></head><body>
    <div class="stage"><div class="phone"><div class="island"></div>
      <div class="screen"><img src="${screenDataUri}" /></div></div></div>
  </body></html>`;
}

async function frame(browser, platePath, outPath) {
  const dataUri = 'data:image/png;base64,' + fs.readFileSync(platePath).toString('base64');
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
  await page.setContent(frameHtml(dataUri), { waitUntil: 'networkidle0' });
  await sleep(300);
  const stage = await page.$('.stage');
  await stage.screenshot({ path: outPath });
  await page.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const page = await browser.newPage();
  // 4x so the plate downsamples into the phone screen (sharp, not blurry).
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 4, isMobile: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(6000); // first bundle + fonts + images

  const plate = (name) => path.join(SHOTS, `plate-${name}.png`);
  const out = (name) => path.join(SHOTS, `app-${name}.png`);

  // Each entry: [outputName, navigate()]. Home is already on screen.
  const steps = [
    ['home', async () => {}],
    ['saved', async () => tapText(page, 'Saved')],
    ['alerts', async () => tapText(page, 'Alerts')],
    ['sell', async () => tapText(page, 'Sell')],
    ['account', async () => tapText(page, 'Account')],
    ['product', async () => { await tapText(page, 'Home'); await tapFirstProduct(page); }],
  ];

  for (const [name, nav] of steps) {
    try {
      await nav();
      await page.screenshot({ path: plate(name) });
      await frame(browser, plate(name), out(name));
      console.log('saved', out(name));
    } catch (e) {
      console.warn('SKIP', name, '-', e.message);
    }
  }

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });

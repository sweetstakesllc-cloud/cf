// Build story-ready iPhone mockups (1080x1920 @2x) for Circular Fash.
//  - captures the Home screen from the running Expo web server (localhost:8081)
//  - captures the Coming Soon landing page (landing/index.html)
//  - frames each inside a CSS iPhone on the brand backdrop with a WIP caption
//
// Usage: node scripts/mockup.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const LANDING = 'file://' + path.join(ROOT, 'landing', 'index.html').replace(/\\/g, '/');
const HOME_URL = 'http://localhost:8081';

// Brand tokens (from src/theme.ts)
const INK = '#1F1F1F';
const NAVY = '#515A7A';

// Capture a page at iPhone logical size, 4x retina -> 1560x3376 px screen plate.
// The plate must be LARGER than the phone-screen area in the final composite
// (~1264px wide @ dsf2) so it downsamples (sharp) instead of upscaling (blurry).
async function captureScreen(browser, target, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 4, isMobile: true });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );
  await page.goto(target, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, target === HOME_URL ? 6000 : 2500));
  await page.screenshot({ path: outPath });
  await page.close();
  return outPath;
}

const LOGO_URI = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'logo.png')).toString('base64');

// Compose: brand backdrop + CSS iPhone holding the screen plate + WIP caption.
function mockupHtml(screenDataUri) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1080px; height:1920px; }
    /* Light studio backdrop so the black iPhone reads clearly. */
    .stage {
      width:1080px; height:1920px;
      background: radial-gradient(130% 100% at 50% 32%, #FAFAFB 0%, #E6E6E9 55%, #D3D3D7 100%);
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .phone {
      position:relative;
      width:664px; height:1437px;          /* 664 * (2532/1170) */
      background:#0b0b0b;
      border-radius:80px;
      padding:16px;
      box-shadow:
        0 2px 0 2px #2a2a2a inset,
        0 50px 110px -25px rgba(0,0,0,0.5),
        0 0 0 2px #000;
    }
    .screen {
      width:100%; height:100%;
      border-radius:64px; overflow:hidden;
      background:#fff; position:relative;
    }
    .screen img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
    .island {
      position:absolute; top:32px; left:50%; transform:translateX(-50%);
      width:126px; height:35px; background:#000; border-radius:19px; z-index:3;
    }
  </style></head>
  <body>
    <div class="stage">
      <div class="phone">
        <div class="island"></div>
        <div class="screen"><img src="${screenDataUri}" /></div>
      </div>
    </div>
  </body></html>`;
}

async function renderMockup(browser, screenPng, outPath) {
  const dataUri = 'data:image/png;base64,' + fs.readFileSync(screenPng).toString('base64');
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
  await page.setContent(mockupHtml(dataUri), { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const stage = await page.$('.stage');
  await stage.screenshot({ path: outPath });
  await page.close();
  console.log('saved', outPath);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars'],
  });

  // 1) screen plates
  const homePlate = await captureScreen(browser, HOME_URL, path.join(SHOTS, 'home.png'));
  const soonPlate = await captureScreen(browser, LANDING, path.join(SHOTS, 'coming-soon.png'));

  // 2) framed mockups
  await renderMockup(browser, homePlate, path.join(SHOTS, 'mockup-home.png'));
  await renderMockup(browser, soonPlate, path.join(SHOTS, 'mockup-coming-soon.png'));

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });

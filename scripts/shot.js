// One-off: capture mobile-framed screenshots of the running Expo web app.
// Usage: node scripts/shot.js
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8081';
const OUT_DIR = 'C:\\Users\\AK\\Desktop\\cf\\shots';

const fs = require('fs');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=3'],
  });
  const page = await browser.newPage();
  // iPhone 13/14 logical size, 3x for retina crispness -> 1170x2532 px
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );

  console.log('navigating...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  // give RN-web + fonts + images time to settle
  await new Promise((r) => setTimeout(r, 6000));

  const file = `${OUT_DIR}\\home.png`;
  await page.screenshot({ path: file });
  console.log('saved', file);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

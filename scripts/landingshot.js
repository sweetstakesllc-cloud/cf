// Quick: screenshot the live landing page as a phone browser sees it.
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8081/landing/index.html';
const OUT = 'C:\\Users\\AK\\Desktop\\cf\\shots\\landing-mobile.png';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: OUT, fullPage: true });
  console.log('saved', OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

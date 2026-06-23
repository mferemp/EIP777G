const { chromium } = require('playwright');

(async () => {
  const url = process.env.LIVE_URL || 'https://gate777.vercel.app';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(url + '?visual=' + Date.now(), { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'outputs/gate777-visual.png', fullPage: false });
  await browser.close();
})();

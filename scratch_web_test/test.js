const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log('Navigating to http://localhost:8081...');
  try {
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('Navigation complete.');
  } catch (e) {
    console.log('Navigation error:', e.message);
  }

  await browser.close();
})();

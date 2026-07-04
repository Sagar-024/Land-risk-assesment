const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto('http://localhost:3000');
  
  await page.type('input[placeholder*="address"]', '1500 Gulf Blvd, Indian Rocks Beach, FL 33785');
  await page.select('select', 'residential');
  await page.click('button[type="submit"]');
  
  // Just wait fixed 10 seconds for everything to load and render
  await new Promise(r => setTimeout(r, 10000));
  
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
})();

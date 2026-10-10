import { chromium } from 'playwright-core';

async function testLaunch() {
  console.log('Testing Playwright launch with installed Chrome...');
  try {
    const browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    });
    console.log('Browser launched successfully!');
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/');
    const title = await page.title();
    console.log('Page Title:', title);
    await page.screenshot({ path: 'tests/screenshot-main.png' });
    console.log('Screenshot saved to tests/screenshot-main.png');
    await browser.close();
    console.log('Browser test complete!');
  } catch (err) {
    console.error('Browser launch error:', err);
    process.exit(1);
  }
}

testLaunch();

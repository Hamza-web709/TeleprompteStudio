import { chromium } from 'playwright-core';
import path from 'path';

async function captureParagraphScreenshots() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Disable text outline and shadow
  await page.evaluate(() => {
    const shadowSwitch = document.getElementById('switch-text-shadow');
    if (shadowSwitch && shadowSwitch.checked) shadowSwitch.click();
    const outlineSwitch = document.getElementById('switch-text-outline');
    if (outlineSwitch && outlineSwitch.checked) outlineSwitch.click();

    const script = {
      id: 'test-typography-script',
      title: 'Typography Verification Script',
      content: `<p>The quick brown fox jumps over the lazy dog near the riverbank on a warm sunny afternoon. Professional creators and speakers rely on clear typography and precise line spacing to maintain an engaging speaking cadence without stumbling over wrapped lines of speech.</p>
<p>Teleprompter reading requires perfect visual separation so that the presenter's eyes can effortlessly track each line across the prompter glass while maintaining natural eye contact with the camera lens.</p>`
    };
    window.teleprompterApp.scriptManager.setActiveScript(script);
  });
  await page.waitForTimeout(500);

  const outDir = 'C:\\Users\\ADVANCES  PC\\.gemini\\antigravity-ide\\brain\\25993bf9-8b20-40b9-9e99-0a978de3b0bf';

  // 1. Weight 300, Line-height 1.5
  await page.evaluate(() => {
    const fw = document.getElementById('slider-font-weight');
    fw.value = '300';
    fw.dispatchEvent(new Event('input', { bubbles: true }));
    const lh = document.getElementById('slider-line-height');
    lh.value = '1.5';
    lh.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'para_weight_300.png') });

  // 2. Weight 900, Line-height 1.5
  await page.evaluate(() => {
    const fw = document.getElementById('slider-font-weight');
    fw.value = '900';
    fw.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'para_weight_900.png') });

  // 3. Weight 600, Line-height 1.1
  await page.evaluate(() => {
    const fw = document.getElementById('slider-font-weight');
    fw.value = '600';
    fw.dispatchEvent(new Event('input', { bubbles: true }));
    const lh = document.getElementById('slider-line-height');
    lh.value = '1.1';
    lh.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'para_lineheight_1.1.png') });

  // 4. Weight 600, Line-height 2.4
  await page.evaluate(() => {
    const lh = document.getElementById('slider-line-height');
    lh.value = '2.4';
    lh.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'para_lineheight_2.4.png') });

  console.log('Paragraph screenshots captured');
  await browser.close();
}

captureParagraphScreenshots().catch(console.error);

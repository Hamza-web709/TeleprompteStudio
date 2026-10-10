import { chromium } from 'playwright-core';
import path from 'path';

async function testParagraphScript() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Set a test script with only multi-line paragraphs (no h1)
  await page.evaluate(() => {
    const script = {
      id: 'test-typography-script',
      title: 'Typography Verification Script',
      content: `<p>The quick brown fox jumps over the lazy dog near the riverbank on a warm sunny afternoon. Professional creators and speakers rely on clear typography and precise line spacing to maintain an engaging speaking cadence without stumbling over wrapped lines of speech.</p>
<p>Teleprompter reading requires perfect visual separation so that the presenter's eyes can effortlessly track each line across the prompter glass while maintaining natural eye contact with the camera lens.</p>`
    };
    window.teleprompterApp.scriptManager.setActiveScript(script);
  });
  await page.waitForTimeout(500);

  // Test Font Weight 300 vs 900
  await page.evaluate(() => {
    const fw = document.getElementById('slider-font-weight');
    fw.value = '300';
    fw.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const data300 = await page.evaluate(() => {
    const p = document.querySelector('#prompter-text-container p');
    const word = p ? p.querySelector('.prompter-word') : null;
    return {
      weight: getComputedStyle(p).fontWeight,
      fontSize: getComputedStyle(p).fontSize,
      wordWidth: word ? word.getBoundingClientRect().width : 0
    };
  });

  await page.evaluate(() => {
    const fw = document.getElementById('slider-font-weight');
    fw.value = '900';
    fw.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const data900 = await page.evaluate(() => {
    const p = document.querySelector('#prompter-text-container p');
    const word = p ? p.querySelector('.prompter-word') : null;
    return {
      weight: getComputedStyle(p).fontWeight,
      fontSize: getComputedStyle(p).fontSize,
      wordWidth: word ? word.getBoundingClientRect().width : 0
    };
  });

  console.log('Paragraph Weight 300:', data300);
  console.log('Paragraph Weight 900:', data900);

  await browser.close();
}

testParagraphScript().catch(console.error);

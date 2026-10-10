import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function testWeightsAndLines() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Disable text outline and shadow as user did
  await page.evaluate(() => {
    const shadowSwitch = document.getElementById('switch-text-shadow');
    if (shadowSwitch && shadowSwitch.checked) {
      shadowSwitch.click();
    }
    const outlineSwitch = document.getElementById('switch-text-outline');
    if (outlineSwitch && outlineSwitch.checked) {
      outlineSwitch.click();
    }
  });

  const weights = [300, 400, 500, 600, 700, 800, 900];
  const weightResults = [];

  for (const w of weights) {
    await page.evaluate((targetWeight) => {
      const slider = document.getElementById('slider-font-weight');
      slider.value = targetWeight.toString();
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, w);
    await page.waitForTimeout(300);

    const data = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p');
      const pWord = p ? p.querySelector('.prompter-word') : null;
      const h1 = document.querySelector('#prompter-text-container h1');
      const h1Word = h1 ? h1.querySelector('.prompter-word') : null;

      return {
        pComputedWeight: p ? getComputedStyle(p).fontWeight : null,
        pWordComputedWeight: pWord ? getComputedStyle(pWord).fontWeight : null,
        h1ComputedWeight: h1 ? getComputedStyle(h1).fontWeight : null,
        h1WordComputedWeight: h1Word ? getComputedStyle(h1Word).fontWeight : null,
        // Measure canvas text width of a word to check if glyph thickness/width changes
        wordClientWidth: pWord ? pWord.getBoundingClientRect().width : null
      };
    });

    // Capture screenshot of text container
    const clip = await page.evaluate(() => {
      const el = document.getElementById('prompter-text-container');
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(1440, r.width), height: Math.min(500, r.height) };
    });

    weightResults.push({ weight: w, ...data });
  }

  console.log('Weight Results:', JSON.stringify(weightResults, null, 2));

  // Now test line spacing
  const lineHeights = [1.1, 1.3, 1.5, 1.8, 2.0, 2.4];
  const lhResults = [];

  for (const lh of lineHeights) {
    await page.evaluate((targetLh) => {
      const slider = document.getElementById('slider-line-height');
      slider.value = targetLh.toString();
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, lh);
    await page.waitForTimeout(300);

    const data = await page.evaluate(() => {
      const h1 = document.querySelector('#prompter-text-container h1');
      const p = document.querySelector('#prompter-text-container p');

      return {
        h1ComputedLineHeight: h1 ? getComputedStyle(h1).lineHeight : null,
        pComputedLineHeight: p ? getComputedStyle(p).lineHeight : null
      };
    });

    lhResults.push({ lineHeight: lh, ...data });
  }

  console.log('Line Height Results:', JSON.stringify(lhResults, null, 2));

  await browser.close();
}

testWeightsAndLines().catch(console.error);

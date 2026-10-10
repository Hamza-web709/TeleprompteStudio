import { chromium } from 'playwright-core';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'tests', 'screenshots-typography-fix');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runTypographyVerification() {
  console.log('================================================================');
  console.log('🔬 TELEPROMPTER STUDIO PRO — TYPOGRAPHY RENDERING FIX VERIFICATION');
  console.log('Target: http://localhost:3201/');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon.ico')) return;
      console.log('Console Error Location:', msg.location(), 'Text:', text);
      consoleErrors.push(text);
    }
  });
  page.on('response', r => {
    if (r.status() >= 400) {
      console.log('HTTP Error Response:', r.status(), r.url());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Initial Load & Multi-line Paragraph Script Setup
    // -------------------------------------------------------------------------
    console.log('[1/11] Loading application and mounting test script...');
    await page.goto('http://localhost:3201/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Disable outlines and text shadows for clean measurement
    await page.evaluate(() => {
      const shadowSwitch = document.getElementById('switch-text-shadow');
      if (shadowSwitch && shadowSwitch.checked) shadowSwitch.click();
      const outlineSwitch = document.getElementById('switch-text-outline');
      if (outlineSwitch && outlineSwitch.checked) outlineSwitch.click();

      const testScript = {
        id: 'test-typography-script',
        title: 'Typography Verification Script',
        content: `<h1>Welcome to Teleprompter Studio Pro</h1>
<p>The quick brown fox jumps over the lazy dog near the riverbank on a warm sunny afternoon. Professional creators and speakers rely on clear typography and precise line spacing to maintain an engaging speaking cadence without stumbling over wrapped lines of speech.</p>
<p>Teleprompter reading requires perfect visual separation so that the presenter's eyes can effortlessly track each line across the prompter glass while maintaining natural eye contact with the camera lens.</p>`
      };
      window.teleprompterApp.scriptManager.setActiveScript(testScript);
    });
    await page.waitForTimeout(500);
    console.log('✓ Multi-line test script loaded.');

    // -------------------------------------------------------------------------
    // 2. Set Font Size to 40px
    // -------------------------------------------------------------------------
    console.log('\n[2/11] Setting baseline font size to 40px...');
    await page.evaluate(() => {
      const slider = document.getElementById('slider-font-size');
      slider.value = '40';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const computedFontSize = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p');
      return getComputedStyle(p).fontSize;
    });
    assert.strictEqual(computedFontSize, '40px', 'Font size must compute to 40px');
    console.log(`✓ Font size computed to ${computedFontSize}.`);

    // -------------------------------------------------------------------------
    // 3. Test Font Weight 300 (Light)
    // -------------------------------------------------------------------------
    console.log('\n[3/11] Testing Font Weight 300 (Light)...');
    await page.evaluate(() => {
      const fw = document.getElementById('slider-font-weight');
      fw.value = '300';
      fw.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const fw300Data = await page.evaluate(() => {
      const h1 = document.querySelector('#prompter-text-container h1');
      const p = document.querySelector('#prompter-text-container p');
      const word = p.querySelector('.prompter-word');
      return {
        h1Weight: getComputedStyle(h1).fontWeight,
        pWeight: getComputedStyle(p).fontWeight,
        wordWeight: getComputedStyle(word).fontWeight,
        wordWidth: word.getBoundingClientRect().width
      };
    });

    assert.strictEqual(fw300Data.h1Weight, '300', 'H1 must inherit font weight 300');
    assert.strictEqual(fw300Data.pWeight, '300', 'Paragraph must compute font weight 300');
    assert.strictEqual(fw300Data.wordWeight, '300', 'Word must compute font weight 300');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_font_weight_300.png') });
    console.log(`✓ Weight 300 verified (h1: ${fw300Data.h1Weight}, p: ${fw300Data.pWeight}, word width: ${fw300Data.wordWidth.toFixed(2)}px).`);

    // -------------------------------------------------------------------------
    // 4. Test Font Weight 900 (Black) & Visual Glyph Thickness Comparison
    // -------------------------------------------------------------------------
    console.log('\n[4/11] Testing Font Weight 900 (Black)...');
    await page.evaluate(() => {
      const fw = document.getElementById('slider-font-weight');
      fw.value = '900';
      fw.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const fw900Data = await page.evaluate(() => {
      const h1 = document.querySelector('#prompter-text-container h1');
      const p = document.querySelector('#prompter-text-container p');
      const word = p.querySelector('.prompter-word');
      return {
        h1Weight: getComputedStyle(h1).fontWeight,
        pWeight: getComputedStyle(p).fontWeight,
        wordWeight: getComputedStyle(word).fontWeight,
        wordWidth: word.getBoundingClientRect().width
      };
    });

    assert.strictEqual(fw900Data.h1Weight, '900', 'H1 must inherit font weight 900');
    assert.strictEqual(fw900Data.pWeight, '900', 'Paragraph must compute font weight 900');
    assert.strictEqual(fw900Data.wordWeight, '900', 'Word must compute font weight 900');
    assert(fw900Data.wordWidth > fw300Data.wordWidth, `Weight 900 word width (${fw900Data.wordWidth}px) must be wider than weight 300 (${fw300Data.wordWidth}px) due to thicker glyphs`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_font_weight_900.png') });
    console.log(`✓ Weight 900 verified (h1: ${fw900Data.h1Weight}, p: ${fw900Data.pWeight}, word width: ${fw900Data.wordWidth.toFixed(2)}px).`);
    console.log(`✓ Visible glyph thickness difference: +${(fw900Data.wordWidth - fw300Data.wordWidth).toFixed(2)}px increase.`);

    // -------------------------------------------------------------------------
    // 5. Test Line Spacing 1.0 (Compact Geometry)
    // -------------------------------------------------------------------------
    console.log('\n[5/11] Testing Line Spacing 1.0 (Compact Spacing)...');
    await page.evaluate(() => {
      const lh = document.getElementById('slider-line-height');
      lh.value = '1.0';
      lh.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const lh10Data = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p');
      const words = Array.from(p.querySelectorAll('.prompter-word'));
      const wordRects = words.map(w => ({ text: w.textContent, top: w.getBoundingClientRect().top }));

      const lines = [];
      let currentLine = [];
      let currentTop = -999;
      for (const wr of wordRects) {
        if (Math.abs(wr.top - currentTop) > 5) {
          if (currentLine.length) lines.push(currentLine);
          currentLine = [wr];
          currentTop = wr.top;
        } else {
          currentLine.push(wr);
        }
      }
      if (currentLine.length) lines.push(currentLine);

      const distances = lines.slice(1).map((l, i) => l[0].top - lines[i][0].top);
      return {
        computedLineHeight: getComputedStyle(p).lineHeight,
        lineCount: lines.length,
        averageLineDistance: distances.reduce((a, b) => a + b, 0) / (distances.length || 1),
        distances
      };
    });

    assert.strictEqual(lh10Data.computedLineHeight, '40px', 'Line height 1.0 on 40px font must compute to 40px');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_line_spacing_1.0.png') });
    console.log(`✓ Line spacing 1.0 verified (computed: ${lh10Data.computedLineHeight}, avg line distance: ${lh10Data.averageLineDistance.toFixed(2)}px).`);

    // -------------------------------------------------------------------------
    // 6. Test Line Spacing 3.0 (Maximum Spacious Geometry)
    // -------------------------------------------------------------------------
    console.log('\n[6/11] Testing Line Spacing 3.0 (Spacious Spacing)...');
    await page.evaluate(() => {
      const lh = document.getElementById('slider-line-height');
      lh.value = '3.0';
      lh.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const lh30Data = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p');
      const words = Array.from(p.querySelectorAll('.prompter-word'));
      const wordRects = words.map(w => ({ text: w.textContent, top: w.getBoundingClientRect().top }));

      const lines = [];
      let currentLine = [];
      let currentTop = -999;
      for (const wr of wordRects) {
        if (Math.abs(wr.top - currentTop) > 5) {
          if (currentLine.length) lines.push(currentLine);
          currentLine = [wr];
          currentTop = wr.top;
        } else {
          currentLine.push(wr);
        }
      }
      if (currentLine.length) lines.push(currentLine);

      const distances = lines.slice(1).map((l, i) => l[0].top - lines[i][0].top);
      return {
        computedLineHeight: getComputedStyle(p).lineHeight,
        lineCount: lines.length,
        averageLineDistance: distances.reduce((a, b) => a + b, 0) / (distances.length || 1),
        distances
      };
    });

    assert.strictEqual(lh30Data.computedLineHeight, '120px', 'Line height 3.0 on 40px font must compute to 120px');
    assert(lh30Data.averageLineDistance > lh10Data.averageLineDistance * 2.5, `Line distance at 3.0 (${lh30Data.averageLineDistance}px) must be ~3x distance at 1.0 (${lh10Data.averageLineDistance}px)`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_line_spacing_3.0.png') });
    console.log(`✓ Line spacing 3.0 verified (computed: ${lh30Data.computedLineHeight}, avg line distance: ${lh30Data.averageLineDistance.toFixed(2)}px).`);
    console.log(`✓ Real vertical line distance increased from ${lh10Data.averageLineDistance.toFixed(2)}px to ${lh30Data.averageLineDistance.toFixed(2)}px (+${(lh30Data.averageLineDistance - lh10Data.averageLineDistance).toFixed(2)}px increase).`);

    // -------------------------------------------------------------------------
    // 7. Verify Settings Survive Re-rendering (Content Updates & Re-render)
    // -------------------------------------------------------------------------
    console.log('\n[7/11] Verifying Settings Survive Text Re-rendering...');
    await page.evaluate(() => {
      // Re-render prompter with new content
      window.teleprompterApp.scriptManager.updateActiveScript({
        content: '<p>Updated paragraph during rehearsal session. Ensuring typography settings persist seamlessly across dynamic script content updates.</p>'
      });
    });
    await page.waitForTimeout(400);

    const postRerenderData = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p');
      return {
        weight: getComputedStyle(p).fontWeight,
        lineHeight: getComputedStyle(p).lineHeight
      };
    });
    assert.strictEqual(postRerenderData.weight, '900', 'Weight 900 must persist after re-render');
    assert.strictEqual(postRerenderData.lineHeight, '120px', 'Line height 3.0 (120px) must persist after re-render');
    console.log(`✓ Re-render persistence verified (weight: ${postRerenderData.weight}, lineHeight: ${postRerenderData.lineHeight}).`);

    // -------------------------------------------------------------------------
    // 8. Verify Settings Persist Across Page Reload (IndexedDB / LocalStorage)
    // -------------------------------------------------------------------------
    console.log('\n[8/11] Verifying Settings Persist Across Page Reload...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const reloadedData = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p') || document.getElementById('prompter-text-container');
      const typo = window.teleprompterApp?.appState?.get('typography') || {};
      return {
        stateWeight: typo.fontWeight,
        stateLineHeight: typo.lineHeight,
        computedWeight: getComputedStyle(p).fontWeight,
        computedLineHeight: getComputedStyle(p).lineHeight
      };
    });
    assert.strictEqual(reloadedData.stateWeight, 900, 'Typography state weight must be 900');
    assert.strictEqual(reloadedData.stateLineHeight, 3.0, 'Typography state line-height must be 3.0');
    assert.strictEqual(reloadedData.computedWeight, '900', 'Computed weight after reload must be 900');
    console.log(`✓ Page reload persistence verified (state: ${reloadedData.stateWeight} / ${reloadedData.stateLineHeight}, computed: ${reloadedData.computedWeight}).`);

    // -------------------------------------------------------------------------
    // 9. Verify Font Family Selection Remains Functional
    // -------------------------------------------------------------------------
    console.log('\n[9/11] Verifying Font Family Switching...');
    await page.evaluate(() => {
      const select = document.getElementById('select-font-family');
      select.value = "'Outfit', sans-serif";
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const outfitFamily = await page.evaluate(() => {
      const p = document.querySelector('#prompter-text-container p');
      return getComputedStyle(p).fontFamily;
    });
    assert(outfitFamily.includes('Outfit'), `Font family must switch to Outfit (actual: ${outfitFamily})`);
    console.log(`✓ Font family switch verified: ${outfitFamily}.`);

    // -------------------------------------------------------------------------
    // 10. Verify Mobile Viewport & Responsive Layout Integrity
    // -------------------------------------------------------------------------
    console.log('\n[10/11] Verifying Mobile Viewport Layout & Typography...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    const mobileMetrics = await page.evaluate(() => {
      const container = document.getElementById('prompter-text-container');
      const p = container.querySelector('p');
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerHeight: document.getElementById('top-navigation')?.offsetHeight,
        pWeight: getComputedStyle(p).fontWeight
      };
    });
    assert(mobileMetrics.scrollWidth <= 391, `Zero horizontal overflow on mobile (${mobileMetrics.scrollWidth} <= 390)`);
    assert.strictEqual(mobileMetrics.pWeight, '900', 'Mobile typography must reflect font-weight');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_mobile_typography_390x844.png') });
    console.log(`✓ Mobile viewport verified: 390x844, 0px overflow, header: ${mobileMetrics.headerHeight}px.`);

    // -------------------------------------------------------------------------
    // 11. Console Error Audit
    // -------------------------------------------------------------------------
    console.log('\n[11/11] Checking browser console error log...');
    assert.strictEqual(consoleErrors.length, 0, `Browser console must have 0 errors (found: ${consoleErrors.join(', ')})`);
    console.log('✓ 0 browser console errors recorded.');

    console.log('\n================================================================');
    console.log('🎉 ALL TYPOGRAPHY RENDERING FIX VERIFICATION TESTS PASSED (11/11)!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ VERIFICATION TEST FAILED:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runTypographyVerification().catch(err => {
  console.error(err);
  process.exit(1);
});

import { chromium } from 'playwright-core';

async function investigate() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Inspect the current prompter text container & children
  const initialData = await page.evaluate(() => {
    const container = document.getElementById('prompter-text-container');
    const p = container ? container.querySelector('p') : null;
    const sent = container ? container.querySelector('.prompter-sentence') : null;
    const word = container ? container.querySelector('.prompter-word') : null;

    function getStyles(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        className: el.className,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        display: cs.display
      };
    }

    return {
      container: getStyles(container),
      p: getStyles(p),
      sentence: getStyles(sent),
      word: getStyles(word),
      rootVars: {
        promptFontWeight: getComputedStyle(document.documentElement).getPropertyValue('--prompt-font-weight'),
        promptLineHeight: getComputedStyle(document.documentElement).getPropertyValue('--prompt-line-height')
      }
    };
  });

  console.log('Initial Inspection:', JSON.stringify(initialData, null, 2));

  // Now let's change font-weight to 300 and line-height to 2.4 via the sliders
  await page.evaluate(() => {
    const fwSlider = document.getElementById('slider-font-weight');
    if (fwSlider) {
      fwSlider.value = '300';
      fwSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const lhSlider = document.getElementById('slider-line-height');
    if (lhSlider) {
      lhSlider.value = '2.4';
      lhSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  await page.waitForTimeout(500);

  const afterChangeData = await page.evaluate(() => {
    const container = document.getElementById('prompter-text-container');
    const p = container ? container.querySelector('p') : null;
    const sent = container ? container.querySelector('.prompter-sentence') : null;
    const word = container ? container.querySelector('.prompter-word') : null;

    function getStyles(el) {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        className: el.className,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        display: cs.display
      };
    }

    return {
      container: getStyles(container),
      p: getStyles(p),
      sentence: getStyles(sent),
      word: getStyles(word),
      rootVars: {
        promptFontWeight: getComputedStyle(document.documentElement).getPropertyValue('--prompt-font-weight'),
        promptLineHeight: getComputedStyle(document.documentElement).getPropertyValue('--prompt-line-height')
      }
    };
  });

  console.log('\nAfter Slider Changes (300 weight, 2.4 line-height):', JSON.stringify(afterChangeData, null, 2));

  // Let's check paragraph & sentence geometry and line rects
  const geometryData = await page.evaluate(() => {
    const container = document.getElementById('prompter-text-container');
    const words = Array.from(container?.querySelectorAll('.prompter-word') || []);
    if (words.length < 5) return null;

    const wordRects = words.map(w => {
      const r = w.getBoundingClientRect();
      return { text: w.textContent, top: r.top, bottom: r.bottom, height: r.height };
    });

    // Group into visual lines by approximate 'top'
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

    return {
      totalWords: words.length,
      lineCount: lines.length,
      lineTops: lines.map(l => l[0].top),
      lineDistances: lines.slice(1).map((l, i) => l[0].top - lines[i][0].top)
    };
  });

  console.log('\nGeometry Data at 2.4 line-height:', JSON.stringify(geometryData, null, 2));

  // Now change line-height to 1.1 and recheck geometry!
  await page.evaluate(() => {
    const lhSlider = document.getElementById('slider-line-height');
    if (lhSlider) {
      lhSlider.value = '1.1';
      lhSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(500);

  const geometryData11 = await page.evaluate(() => {
    const container = document.getElementById('prompter-text-container');
    const words = Array.from(container?.querySelectorAll('.prompter-word') || []);
    if (words.length < 5) return null;

    const wordRects = words.map(w => {
      const r = w.getBoundingClientRect();
      return { text: w.textContent, top: r.top, bottom: r.bottom, height: r.height };
    });

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

    return {
      totalWords: words.length,
      lineCount: lines.length,
      lineTops: lines.map(l => l[0].top),
      lineDistances: lines.slice(1).map((l, i) => l[0].top - lines[i][0].top)
    };
  });

  console.log('\nGeometry Data at 1.1 line-height:', JSON.stringify(geometryData11, null, 2));

  await browser.close();
}

investigate().catch(console.error);

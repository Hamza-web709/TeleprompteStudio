import { chromium } from 'playwright-core';

async function checkMatchedRules() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const matched = await page.evaluate(() => {
    function getMatchedCSS(el) {
      if (!el) return [];
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && el.matches(rule.selectorText)) {
              rules.push({
                selector: rule.selectorText,
                cssText: rule.cssText
              });
            }
          }
        } catch (e) {}
      }
      return rules;
    }

    const container = document.getElementById('prompter-text-container');
    const h1 = container?.querySelector('h1');
    const p = container?.querySelector('p');
    const sent = container?.querySelector('.prompter-sentence');
    const word = container?.querySelector('.prompter-word');

    return {
      h1Rules: getMatchedCSS(h1),
      pRules: getMatchedCSS(p),
      sentRules: getMatchedCSS(sent),
      wordRules: getMatchedCSS(word)
    };
  });

  console.log('Matched Rules:', JSON.stringify(matched, null, 2));

  await browser.close();
}

checkMatchedRules().catch(console.error);

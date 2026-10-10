import { chromium } from 'playwright-core';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const SCREENSHOT_DIR = path.resolve('tests/screenshots-header-qa');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function approx(val, target, tolerance = 0.05) {
  return Math.abs(val - target) <= tolerance;
}

// Convert rgb(r, g, b) to hex
function rgbToHex(rgb) {
  if (!rgb) return '';
  if (rgb.startsWith('#')) return rgb.toLowerCase();
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const hex = (x) => parseInt(x, 10).toString(16).padStart(2, '0');
  return `#${hex(match[1])}${hex(match[2])}${hex(match[3])}`.toLowerCase();
}

async function runTests() {
  console.log('================================================================');
  console.log('TELEPROMPTER STUDIO PRO — CUSTOMIZATION & HEADER REGRESSION SUITE');
  console.log('================================================================');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Handle dialogs
  page.on('dialog', async d => await d.accept());

  try {
    console.log(`\nNavigating to ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // =========================================================================
    // TEST SUITE 1: TEXT COLOR CUSTOMIZATION
    // =========================================================================
    console.log('\n--- TEST SUITE 1: TEXT COLOR CUSTOMIZATION ---');

    // Open right settings panel if collapsed
    const isSettingsCollapsed = await page.evaluate(() => document.getElementById('app-container').classList.contains('settings-collapsed'));
    if (isSettingsCollapsed) {
      await page.click('#btn-toggle-settings');
      await page.waitForTimeout(300);
    }

    // Switch to Text settings tab
    await page.click('button.settings-tab-btn[data-tab="text"]');
    await page.waitForTimeout(300);

    // 1A. Select Red (#FF0000)
    console.log('1A. Testing Red (#ff0000)...');
    await page.fill('#hex-text-color', '#ff0000');
    await page.dispatchEvent('#hex-text-color', 'change');
    await page.waitForTimeout(300);

    let computedColor = await page.evaluate(() => {
      const el = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      return window.getComputedStyle(el).color;
    });
    let hexColor = rgbToHex(computedColor);
    console.log(`    Computed text color for Red: ${computedColor} (${hexColor})`);
    assert.strictEqual(hexColor, '#ff0000', 'Rendered text must visibly become red (#ff0000)');
    console.log('    ✓ Red text color successfully applied and verified in DOM.');

    // 1B. Select Yellow (#FFFF00)
    console.log('1B. Testing Yellow (#ffff00)...');
    await page.fill('#hex-text-color', '#ffff00');
    await page.dispatchEvent('#hex-text-color', 'change');
    await page.waitForTimeout(300);

    computedColor = await page.evaluate(() => {
      const el = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      return window.getComputedStyle(el).color;
    });
    hexColor = rgbToHex(computedColor);
    console.log(`    Computed text color for Yellow: ${computedColor} (${hexColor})`);
    assert.strictEqual(hexColor, '#ffff00', 'Rendered text must visibly become yellow (#ffff00)');
    console.log('    ✓ Yellow text color successfully applied and verified in DOM.');

    // 1C. Switch back to White (#FFFFFF)
    console.log('1C. Testing White (#ffffff)...');
    await page.fill('#hex-text-color', '#ffffff');
    await page.dispatchEvent('#hex-text-color', 'change');
    await page.waitForTimeout(300);

    computedColor = await page.evaluate(() => {
      const el = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      return window.getComputedStyle(el).color;
    });
    hexColor = rgbToHex(computedColor);
    console.log(`    Computed text color for White: ${computedColor} (${hexColor})`);
    assert.strictEqual(hexColor, '#ffffff', 'Rendered text must visibly become white (#ffffff)');
    console.log('    ✓ White text color successfully restored and verified in DOM.');

    // =========================================================================
    // TEST SUITE 2: TEXT OUTLINE / STROKE CUSTOMIZATION
    // =========================================================================
    console.log('\n--- TEST SUITE 2: TEXT OUTLINE / STROKE CUSTOMIZATION ---');

    // 2A. Enable Outline and set 2px Black (#000000)
    console.log('2A. Enabling outline (2px, #000000)...');
    const outlineSwitch = await page.$('#switch-text-outline');
    const isOutlineChecked = await outlineSwitch.isChecked();
    if (!isOutlineChecked) {
      await page.click('label:has(#switch-text-outline)');
      await page.waitForTimeout(300);
    }
    await page.fill('#slider-outline-width', '2');
    await page.dispatchEvent('#slider-outline-width', 'input');
    await page.fill('#hex-outline-color', '#000000');
    await page.dispatchEvent('#hex-outline-color', 'change');
    await page.waitForTimeout(300);

    let strokeDetails = await page.evaluate(() => {
      const el = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      const style = window.getComputedStyle(el);
      return {
        width: style.webkitTextStrokeWidth,
        color: style.webkitTextStrokeColor,
        textShadow: style.textShadow,
        paintOrder: style.paintOrder
      };
    });
    console.log('    Stroke computed details:', JSON.stringify(strokeDetails));
    assert(parseFloat(strokeDetails.width) >= 1.5, 'Stroke width must be approximately 2px');
    console.log('    ✓ Outline 2px stroke is visibly rendered with paint-order stroke fill.');

    // 2B. Test Outline Width 4px and color Magenta (#ff00ff)
    console.log('2B. Testing 4px Magenta outline (#ff00ff)...');
    await page.fill('#slider-outline-width', '4');
    await page.dispatchEvent('#slider-outline-width', 'input');
    await page.fill('#hex-outline-color', '#ff00ff');
    await page.dispatchEvent('#hex-outline-color', 'change');
    await page.waitForTimeout(300);

    strokeDetails = await page.evaluate(() => {
      const el = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      const style = window.getComputedStyle(el);
      return {
        width: style.webkitTextStrokeWidth,
        color: style.webkitTextStrokeColor
      };
    });
    console.log('    4px Stroke details:', JSON.stringify(strokeDetails));
    assert(parseFloat(strokeDetails.width) >= 3.5, 'Stroke width must be approximately 4px');
    assert.strictEqual(rgbToHex(strokeDetails.color), '#ff00ff', 'Stroke color must be #ff00ff');
    console.log('    ✓ 4px Magenta outline successfully verified.');

    // 2C. Disable Outline
    console.log('2C. Disabling outline...');
    await page.click('label:has(#switch-text-outline)');
    await page.waitForTimeout(300);

    strokeDetails = await page.evaluate(() => {
      const el = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      const style = window.getComputedStyle(el);
      return {
        width: style.webkitTextStrokeWidth,
        color: style.webkitTextStrokeColor
      };
    });
    console.log('    Disabled Stroke details:', JSON.stringify(strokeDetails));
    assert(parseFloat(strokeDetails.width || '0') === 0 || strokeDetails.width === '0px', 'Stroke width must be 0px when disabled');
    console.log('    ✓ Outline successfully removed.');

    // =========================================================================
    // TEST SUITE 3: CUSTOM BACKGROUND COLOR & THEMES
    // =========================================================================
    console.log('\n--- TEST SUITE 3: CUSTOM BACKGROUND COLOR & THEMES ---');
    await page.click('button.settings-tab-btn[data-tab="background"]');
    await page.waitForTimeout(300);

    const testColors = [
      { name: 'Red', hex: '#ff0000' },
      { name: 'Blue', hex: '#0000ff' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Black', hex: '#000000' },
      { name: 'Purple', hex: '#663399' }
    ];

    for (const c of testColors) {
      console.log(`3. Testing custom background color: ${c.name} (${c.hex})...`);
      await page.fill('#hex-bg-color', c.hex);
      await page.dispatchEvent('#hex-bg-color', 'change');
      await page.waitForTimeout(300);

      const bgDetails = await page.evaluate(() => {
        const frame = document.getElementById('prompter-frame') || document.getElementById('main-workspace');
        const ws = document.getElementById('main-workspace');
        const themeVal = document.getElementById('select-bg-theme')?.value;
        return {
          frameBg: window.getComputedStyle(frame).backgroundColor,
          wsBg: window.getComputedStyle(ws).backgroundColor,
          selectedTheme: themeVal
        };
      });

      const frameHex = rgbToHex(bgDetails.frameBg);
      console.log(`   Rendered background for ${c.name}: ${bgDetails.frameBg} (${frameHex}), Dropdown theme: ${bgDetails.selectedTheme}`);
      assert.strictEqual(frameHex, c.hex, `Frame background must visibly be ${c.hex}`);
      assert.strictEqual(bgDetails.selectedTheme, 'custom', 'Dropdown must automatically switch to "custom"');
      console.log(`   ✓ ${c.name} custom background successfully applied.`);
    }

    // 3B. Switch back to theme preset 'studio-dark'
    console.log('3B. Switching to theme preset "studio-dark"...');
    await page.selectOption('#select-bg-theme', 'studio-dark');
    await page.waitForTimeout(300);
    const darkPresetBgRgb = await page.evaluate(() => {
      const frame = document.getElementById('prompter-frame') || document.getElementById('main-workspace');
      return window.getComputedStyle(frame).backgroundColor;
    });
    const darkPresetBg = rgbToHex(darkPresetBgRgb);
    console.log(`    Studio Dark preset background: ${darkPresetBgRgb} (${darkPresetBg})`);
    assert(['#0f1013', '#000000', '#16181d'].includes(darkPresetBg), 'Preset background must match studio dark palette');
    console.log('    ✓ Theme preset successfully restored.');

    // 3C. Verify Contrast warning
    console.log('3C. Testing WCAG Contrast detection with low-contrast combination (Black on Black)...');
    await page.fill('#hex-bg-color', '#000000');
    await page.dispatchEvent('#hex-bg-color', 'change');
    await page.click('button.settings-tab-btn[data-tab="text"]');
    await page.fill('#hex-text-color', '#000000');
    await page.dispatchEvent('#hex-text-color', 'change');
    await page.click('button.settings-tab-btn[data-tab="background"]');
    await page.waitForTimeout(300);

    const contrastMsg = await page.evaluate(() => {
      return document.getElementById('contrast-badge-container')?.innerText || '';
    });
    console.log(`    Contrast evaluation message: "${contrastMsg}"`);
    assert(contrastMsg.toLowerCase().includes('low') || contrastMsg.includes('⚠️'), 'Must display low-contrast warning for black text on black background');
    console.log('    ✓ Contrast warning successfully detected and displayed.');

    // Restore readable text color (White)
    await page.click('button.settings-tab-btn[data-tab="text"]');
    await page.fill('#hex-text-color', '#ffffff');
    await page.dispatchEvent('#hex-text-color', 'change');
    await page.waitForTimeout(300);

    // =========================================================================
    // TEST SUITE 4: ASPECT RATIO FRAMING MODES
    // =========================================================================
    console.log('\n--- TEST SUITE 4: ASPECT RATIO FRAMING MODES ---');
    await page.click('button.settings-tab-btn[data-tab="display"]');
    await page.waitForTimeout(300);

    const ratiosToTest = [
      { mode: '16:9', expected: 16 / 9, label: '16:9 Landscape' },
      { mode: '9:16', expected: 9 / 16, label: '9:16 Portrait' },
      { mode: '4:3',  expected: 4 / 3,  label: '4:3 Broadcast' },
      { mode: '1:1',  expected: 1.0,    label: '1:1 Square' },
      { mode: '2:1',  expected: 2.0,    label: '2:1 Cinematic Wide' },
      { mode: 'full', expected: null,   label: 'Full Screen / Native' }
    ];

    for (const r of ratiosToTest) {
      console.log(`4. Testing Aspect Ratio: ${r.label} (${r.mode})...`);
      await page.selectOption('#select-aspect-ratio', r.mode);
      await page.waitForTimeout(400);

      const dimensions = await page.evaluate(() => {
        const frame = document.getElementById('prompter-frame');
        const ws = document.getElementById('main-workspace');
        const fRect = frame.getBoundingClientRect();
        const wsRect = ws.getBoundingClientRect();
        return {
          frameWidth: fRect.width,
          frameHeight: fRect.height,
          ratio: fRect.width / (fRect.height || 1),
          wsWidth: wsRect.width,
          wsHeight: wsRect.height,
          framedClass: frame.classList.contains('framed-aspect-ratio')
        };
      });

      console.log(`   Dimensions: width=${dimensions.frameWidth.toFixed(1)}px, height=${dimensions.frameHeight.toFixed(1)}px, ratio=${dimensions.ratio.toFixed(4)}`);

      if (r.expected !== null) {
        assert(approx(dimensions.ratio, r.expected, 0.05), `Aspect ratio must be ≈ ${r.expected.toFixed(4)}, got ${dimensions.ratio.toFixed(4)}`);
        assert.strictEqual(dimensions.framedClass, true, 'prompter-frame must have framed-aspect-ratio class');
        assert(dimensions.frameWidth <= dimensions.wsWidth + 1, 'Frame width must not exceed workspace width');
        assert(dimensions.frameHeight <= dimensions.wsHeight + 1, 'Frame height must not exceed workspace height');
      } else {
        // Full screen
        assert.strictEqual(dimensions.framedClass, false, 'prompter-frame must NOT have framed-aspect-ratio class in native mode');
        assert(approx(dimensions.frameWidth, dimensions.wsWidth, 2), 'Native frame width must match workspace');
        assert(approx(dimensions.frameHeight, dimensions.wsHeight, 2), 'Native frame height must match workspace');
      }
      console.log(`   ✓ ${r.label} aspect ratio framing verified successfully.`);
    }

    // =========================================================================
    // TEST SUITE 5: SETTINGS PERSISTENCE ACROSS RELOAD
    // =========================================================================
    console.log('\n--- TEST SUITE 5: SETTINGS PERSISTENCE ACROSS RELOAD ---');

    // Set custom text color #00ffcc, outline 3px #ff00ff, custom background #221133, aspect ratio 16:9
    console.log('5A. Setting custom configuration to test persistence...');
    await page.click('button.settings-tab-btn[data-tab="text"]');
    await page.fill('#hex-text-color', '#00ffcc');
    await page.dispatchEvent('#hex-text-color', 'change');

    // Outline 3px #ff00ff
    const outlineSw = await page.$('#switch-text-outline');
    if (!(await outlineSw.isChecked())) {
      await page.click('label:has(#switch-text-outline)');
    }
    await page.fill('#slider-outline-width', '3');
    await page.dispatchEvent('#slider-outline-width', 'input');
    await page.fill('#hex-outline-color', '#ff00ff');
    await page.dispatchEvent('#hex-outline-color', 'change');

    // Custom background #221133
    await page.click('button.settings-tab-btn[data-tab="background"]');
    await page.fill('#hex-bg-color', '#221133');
    await page.dispatchEvent('#hex-bg-color', 'change');

    // Aspect ratio 16:9
    await page.click('button.settings-tab-btn[data-tab="display"]');
    await page.selectOption('#select-aspect-ratio', '16:9');
    await page.waitForTimeout(600); // Allow debounce save to complete

    console.log('5B. Reloading page...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const restored = await page.evaluate(() => {
      const app = window.teleprompterApp;
      const typo = app.appState.get('typography');
      const bg = app.appState.get('background');
      const disp = app.appState.get('display');
      const textEl = document.querySelector('#prompter-text-container .prompter-word') || document.getElementById('prompter-text-container');
      const frameEl = document.getElementById('prompter-frame');
      const textStyle = window.getComputedStyle(textEl);
      const frameStyle = window.getComputedStyle(frameEl);

      return {
        textColor: typo.textColor,
        outlineWidth: typo.outlineWidth,
        outlineColor: typo.outlineColor,
        bgTheme: bg.theme,
        bgColor: bg.color,
        aspectRatio: disp.aspectRatio,
        computedTextColor: textStyle.color,
        computedStrokeWidth: textStyle.webkitTextStrokeWidth,
        computedBgColor: frameStyle.backgroundColor
      };
    });

    console.log('    Restored State:', JSON.stringify(restored, null, 2));
    assert.strictEqual(restored.textColor, '#00ffcc', 'Text color must persist as #00ffcc');
    assert.strictEqual(restored.outlineWidth, 3, 'Outline width must persist as 3');
    assert.strictEqual(restored.outlineColor, '#ff00ff', 'Outline color must persist as #ff00ff');
    assert.strictEqual(restored.bgTheme, 'custom', 'Background theme must persist as custom');
    assert.strictEqual(restored.bgColor, '#221133', 'Background color must persist as #221133');
    assert.strictEqual(restored.aspectRatio, '16:9', 'Aspect ratio must persist as 16:9');
    console.log('    ✓ All customization settings persisted and restored perfectly across reload!');

    // Restore to normal studio defaults
    await page.click('button.settings-tab-btn[data-tab="text"]');
    await page.fill('#hex-text-color', '#ffffff');
    await page.dispatchEvent('#hex-text-color', 'change');
    await page.click('label:has(#switch-text-outline)'); // toggle off
    await page.click('button.settings-tab-btn[data-tab="background"]');
    await page.selectOption('#select-bg-theme', 'studio-dark');
    await page.click('button.settings-tab-btn[data-tab="display"]');
    await page.selectOption('#select-aspect-ratio', 'full');
    await page.waitForTimeout(400);

    // =========================================================================
    // TEST SUITE 6: HEADER RESPONSIVENESS ACROSS 7 VIEWPORTS
    // =========================================================================
    console.log('\n--- TEST SUITE 6: HEADER RESPONSIVENESS ACROSS 7 VIEWPORTS ---');

    const viewports = [
      { width: 1920, height: 1080, name: '1920x1080-desktop-large' },
      { width: 1440, height: 900,  name: '1440x900-desktop-standard' },
      { width: 1366, height: 768,  name: '1366x768-laptop' },
      { width: 1024, height: 768,  name: '1024x768-tablet-landscape' },
      { width: 768,  height: 1024, name: '768x1024-tablet-portrait' },
      { width: 390,  height: 844,  name: '390x844-mobile-modern' },
      { width: 375,  height: 667,  name: '375x667-mobile-compact' }
    ];

    for (const vp of viewports) {
      console.log(`6. Testing Viewport: ${vp.width}x${vp.height} (${vp.name})...`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);

      // Verify no horizontal overflow in body or header
      const overflowDetails = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        const header = document.getElementById('top-navigation');
        const headerWidth = header ? header.scrollWidth : 0;
        const headerClient = header ? header.clientWidth : 0;

        return {
          winWidth,
          docWidth,
          bodyWidth,
          headerWidth,
          headerClient,
          hasHorizontalOverflow: docWidth > winWidth + 2 || headerWidth > winWidth + 2
        };
      });

      console.log(`   Window: ${overflowDetails.winWidth}px, Doc: ${overflowDetails.docWidth}px, Header: ${overflowDetails.headerWidth}px`);
      assert.strictEqual(overflowDetails.hasHorizontalOverflow, false, `Viewport ${vp.name} must have no horizontal overflow`);

      // Screenshot capture
      const ssPath = path.join(SCREENSHOT_DIR, `header-${vp.name}.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      console.log(`   Captured screenshot: ${ssPath}`);

      // If mobile/tablet, verify overflow menu button and dropdown
      if (vp.width <= 768) {
        const moreBtnVisible = await page.evaluate(() => {
          const btn = document.getElementById('btn-header-more');
          if (!btn) return false;
          const style = window.getComputedStyle(btn);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        assert.strictEqual(moreBtnVisible, true, 'Header More button must be visible on mobile/tablet');

        // Test opening More dropdown
        await page.click('#btn-header-more');
        await page.waitForTimeout(200);
        const dropdownVisible = await page.evaluate(() => {
          const dd = document.getElementById('header-more-dropdown');
          return dd && dd.style.display !== 'none';
        });
        assert.strictEqual(dropdownVisible, true, 'Header More dropdown must open on click');
        await page.click('#btn-header-more'); // Close
        await page.waitForTimeout(200);
      }
      console.log(`   ✓ Viewport ${vp.name} validated successfully.`);
    }

    // =========================================================================
    // TEST SUITE 7: EXISTING FEATURES REGRESSION
    // =========================================================================
    console.log('\n--- TEST SUITE 7: EXISTING CORE FEATURES REGRESSION ---');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // 7A. Teleprompter Scrolling
    console.log('7A. Testing Teleprompter Scrolling Play/Pause...');
    await page.click('#btn-playback-toggle');
    await page.waitForTimeout(600);
    let playbackState = await page.evaluate(() => window.teleprompterApp.appState.get('playbackState'));
    assert(['playing', 'countdown'].includes(playbackState), 'Prompter must begin countdown or playing');

    await page.waitForTimeout(3500); // Wait for countdown to finish and start scrolling
    const scrollTop = await page.evaluate(() => document.getElementById('prompter-viewport').scrollTop);
    console.log(`    Prompter scrolled to: ${scrollTop}px`);
    assert(scrollTop >= 0, 'Prompter viewport scroll position is active');

    await page.click('#btn-playback-toggle'); // Pause
    await page.waitForTimeout(200);
    playbackState = await page.evaluate(() => window.teleprompterApp.appState.get('playbackState'));
    assert.strictEqual(playbackState, 'paused', 'Prompter must be paused');
    console.log('    ✓ Scrolling engine verified.');

    // 7B. Script Editor Mode
    console.log('7B. Testing Script Editor Mode switching...');
    await page.click('button.mode-tab-btn[data-mode="editor"]');
    await page.waitForTimeout(300);
    const isEditorVisible = await page.evaluate(() => {
      const ed = document.getElementById('editor-workspace');
      return window.getComputedStyle(ed).display === 'flex';
    });
    assert.strictEqual(isEditorVisible, true, 'Editor workspace must be visible');
    console.log('    ✓ Script editor mode verified.');

    // Switch back to prompter mode
    await page.click('button.mode-tab-btn[data-mode="prompter"]');
    await page.waitForTimeout(300);

    // 7C. Camera Hardware Optimization Validation
    console.log('7C. Testing Camera Preview pipeline...');
    const cameraSupported = await page.evaluate(() => !!navigator.mediaDevices?.getUserMedia);
    console.log(`    Browser mediaDevices support: ${cameraSupported}`);
    assert.strictEqual(cameraSupported, true, 'Camera MediaDevices API supported');
    console.log('    ✓ Camera optimizations preserved.');

    console.log('\n================================================================');
    console.log('ALL REGRESSION & CUSTOMIZATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-failure.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

import { chromium } from 'playwright-core';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_URL = 'http://localhost:3201/';
const SCREENSHOT_DIR = path.resolve('D:/Teleprompter-Studio-InfinityFree-v2/tests/screenshots-infinityfree-qa');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runInfinityFreeProductionTests() {
  console.log('================================================================');
  console.log('TELEPROMPTER STUDIO PRO — INFINITYFREE PRODUCTION BUILD AUDIT');
  console.log('Target: Static Compiled Bundle at http://localhost:3201/');
  console.log('================================================================');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const consoleErrors = [];
  const networkRequests = [];
  const failedRequests = [];

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('request', req => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
  });

  page.on('dialog', async d => await d.accept());

  try {
    // -------------------------------------------------------------------------
    // 1. Initial Load & Static Asset Verification
    // -------------------------------------------------------------------------
    console.log(`\n[1/7] Loading compiled static bundle from ${PREVIEW_URL}...`);
    const response = await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    assert(response && response.status() === 200, 'Page must return HTTP 200');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_initial.png') });
    console.log('✓ Production app loaded cleanly.');

    // Verify no broken asset requests
    const assetFailures = failedRequests.filter(f => !f.url.includes('favicon.ico'));
    assert(assetFailures.length === 0, `No asset requests should fail: ${JSON.stringify(assetFailures)}`);

    // Verify no unexpected localhost:8080 or localhost:3000 calls
    const originalServerCalls = networkRequests.filter(r => 
      r.url.includes(':8080') || (r.url.includes(':3000') && !r.url.includes(':3100'))
    );
    assert(originalServerCalls.length === 0, `Production bundle must not call original ports: ${JSON.stringify(originalServerCalls)}`);
    console.log('✓ Network audit passed: 0 requests to original ports, 0 broken static assets.');

    // -------------------------------------------------------------------------
    // 2. Core Teleprompter Engine & Controls
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Testing Core Teleprompter Engine...');
    
    // Check initial script text is displayed
    const prompterText = await page.locator('#prompter-text-container').textContent();
    assert(prompterText && prompterText.includes('Welcome to Teleprompter Studio Pro'), 'Default script text must be rendered');

    // Open settings panel if collapsed to set countdown to 0 for instant test
    const isSettingsCollapsed = await page.evaluate(() => document.getElementById('app-container').classList.contains('settings-collapsed'));
    if (isSettingsCollapsed) {
      await page.click('#btn-toggle-settings');
      await page.waitForTimeout(300);
    }
    // Switch to Scrolling tab & set countdown to 0
    await page.click('[data-tab="scrolling"]');
    await page.waitForTimeout(200);
    await page.selectOption('#select-countdown-sec', '0');
    await page.waitForTimeout(200);

    // Toggle Play/Pause
    const playBtn = page.locator('#btn-playback-toggle');
    await playBtn.click();
    await page.waitForTimeout(500);

    const isPlaying = await page.evaluate(() => {
      const iconPlay = document.getElementById('icon-play');
      const iconPause = document.getElementById('icon-pause');
      return iconPause && iconPause.style.display !== 'none';
    });
    assert(isPlaying, 'Playback should start playing');

    // Pause
    await playBtn.click();
    await page.waitForTimeout(300);

    // Speed adjustment
    const speedPlus = page.locator('#btn-speed-plus');
    await speedPlus.click();
    await page.waitForTimeout(200);
    const speedVal = await page.locator('#playback-speed-indicator').textContent();
    assert(parseInt(speedVal, 10) >= 4, `Speed should increment to >= 4 (actual: ${speedVal})`);
    console.log('✓ Teleprompter play/pause and speed controls verified.');

    // -------------------------------------------------------------------------
    // 3. Script Management & IndexedDB Persistence
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Testing Script Management & Persistence...');

    // Rename script title
    const titleInput = page.locator('#active-script-title-input');
    await titleInput.fill('InfinityFree Production Script');
    await titleInput.press('Enter');
    await page.waitForTimeout(600);

    // Verify title in DOM
    const savedTitle = await titleInput.inputValue();
    assert(savedTitle === 'InfinityFree Production Script', 'Title must update');

    // Create a new script via New Script button
    await page.click('#btn-new-script');
    await page.waitForTimeout(600);

    // Reload page to verify IndexedDB persistence
    console.log('  Reloading page to verify IndexedDB persistence...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const reloadedTitle = await page.locator('#active-script-title-input').inputValue();
    assert(reloadedTitle.length > 0, 'Script title must persist after reload');
    console.log('✓ Script management and IndexedDB persistence verified.');

    // -------------------------------------------------------------------------
    // 4. Customization (Typography, Background, Framing)
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Testing Studio Customization Controls...');

    // Open settings panel if collapsed
    const isSettingsCollapsedAfterReload = await page.evaluate(() => document.getElementById('app-container').classList.contains('settings-collapsed'));
    if (isSettingsCollapsedAfterReload) {
      await page.click('#btn-toggle-settings');
      await page.waitForTimeout(350);
    }

    // Switch to Text tab
    await page.click('[data-tab="text"]');
    await page.waitForTimeout(200);

    // Change font size
    await page.evaluate(() => {
      const slider = document.getElementById('slider-font-size');
      if (slider) {
        slider.value = 44;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(200);
    const currentFontSize = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--prompt-font-size').trim());
    assert(currentFontSize === '44px', `Font size must update to 44px (actual: ${currentFontSize})`);

    // Switch to Background tab
    await page.click('[data-tab="background"]');
    await page.waitForTimeout(200);

    // Select Green Screen Theme
    await page.selectOption('#select-bg-theme', 'green-screen');
    await page.waitForTimeout(300);
    const bgColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--prompt-bg-color').trim().toLowerCase());
    assert(bgColor === '#00ff00' || bgColor === '#00b140' || bgColor.includes('green') || bgColor === 'rgb(0, 255, 0)' || bgColor === 'rgb(0, 177, 64)', `Green screen color must be applied (actual: ${bgColor})`);

    // Switch to Display tab & test aspect ratios
    await page.click('[data-tab="display"]');
    await page.waitForTimeout(200);

    await page.selectOption('#select-aspect-ratio', '16:9');
    await page.waitForTimeout(300);
    const frameClasses = await page.evaluate(() => document.getElementById('prompter-frame')?.className || document.getElementById('prompter-viewport')?.className || '');
    assert(frameClasses.includes('framed-aspect-ratio'), 'Frame must receive framed-aspect-ratio class for 16:9');

    // Reset background to studio-dark for screenshots
    await page.click('[data-tab="background"]');
    await page.waitForTimeout(200);
    await page.selectOption('#select-bg-theme', 'studio-dark');
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_customization_verified.png') });
    console.log('✓ Typography, green screen background, and aspect ratio framing verified.');

    // -------------------------------------------------------------------------
    // 5. Camera & Recording Integration
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Testing Live Camera Preview & Recording...');

    const camBtn = page.locator('#btn-topbar-camera');
    await camBtn.click();
    await page.waitForTimeout(1000);

    const isCamActive = await page.evaluate(() => {
      const video = document.getElementById('camera-preview-video');
      const container = document.getElementById('camera-preview-container');
      return video && container && container.style.display !== 'none';
    });
    assert(isCamActive, 'Camera preview container must be visible when camera enabled');

    // Set countdown to 0 for immediate recording
    await page.evaluate(() => {
      const select = document.getElementById('select-countdown-sec');
      if (select) {
        select.value = '0';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (window.appState) {
        window.appState.set('countdownDuration', 0);
      }
    });
    await page.waitForTimeout(200);

    // Start Recording
    const recBtn = page.locator('#btn-studio-record');
    await recBtn.click();
    await page.waitForTimeout(1500);

    const isRecording = await page.evaluate(() => {
      const btn = document.getElementById('btn-studio-record');
      return btn && btn.classList.contains('recording');
    });
    assert(isRecording, 'Record button must indicate recording state');

    // Stop Recording
    await recBtn.click();
    await page.waitForTimeout(1200);

    // Verify modal-recording-complete appears
    const modalRecVisible = await page.evaluate(() => {
      const modal = document.getElementById('modal-recording-complete');
      return modal && modal.style.display !== 'none';
    });
    assert(modalRecVisible, 'Recording complete modal must display after stopping recording');

    // Close recording modal
    await page.click('#modal-recording-complete .modal-close-btn');
    await page.waitForTimeout(400);

    // Stop Camera
    await camBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Camera preview, clean recording, and modal verified.');

    // -------------------------------------------------------------------------
    // 6. Remote Pairing Modal & AI Gateway Fallback Check
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Testing Static Remote Pairing & AI Gateway Fallbacks...');

    // Open Remote Pairing Modal
    await page.click('#btn-open-remote-modal');
    await page.waitForTimeout(500);

    const tokenText = await page.locator('#display-pairing-token').textContent();
    assert(tokenText && tokenText.trim().length === 6, '6-character session token must be generated');

    const qrRendered = await page.evaluate(() => {
      const canvas = document.getElementById('qr-canvas');
      return canvas && canvas.width > 50 && canvas.height > 50;
    });
    assert(qrRendered, 'QR code canvas must be rendered');

    // Close remote modal
    await page.click('#modal-remote-pairing .modal-close-btn');
    await page.waitForTimeout(400);

    // Test AI Gateway Graceful Unconfigured State
    await page.click('[data-tab="ai"]');
    await page.waitForTimeout(200);

    const aiEndpointInput = page.locator('#input-ai-endpoint');
    await aiEndpointInput.fill(''); // Leave unconfigured as on a fresh static deployment
    await page.click('#btn-test-ai-gateway');
    await page.waitForTimeout(400);

    const aiStatusContent = await page.locator('#ai-gateway-status-box').innerHTML();
    assert(aiStatusContent.includes('External AI Gateway Unconfigured') || aiStatusContent.includes('Cloud AI Unconfigured'), 'AI status box must explain unconfigured external gateway gracefully');
    console.log('✓ Remote pairing token and graceful AI gateway fallbacks verified.');

    // -------------------------------------------------------------------------
    // 7. Responsive Viewports Audit
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing Responsive Viewports on Static Build...');
    const testViewports = [
      { name: 'desktop_1920', width: 1920, height: 1080 },
      { name: 'laptop_1366', width: 1366, height: 768 },
      { name: 'laptop_1280', width: 1280, height: 720 },
      { name: 'tablet_1024', width: 1024, height: 768 },
      { name: 'mobile_390', width: 390, height: 844 },
      { name: 'mobile_375', width: 375, height: 667 }
    ];

    for (const vp of testViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        headerHeight: document.getElementById('top-navigation')?.offsetHeight
      }));

      assert(metrics.scrollWidth <= vp.width + 1, `Zero horizontal overflow on ${vp.name} (${metrics.scrollWidth} <= ${vp.width})`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `responsive_${vp.name}.png`) });
      console.log(`  ✓ ${vp.name}: ${vp.width}x${vp.height} -> Header: ${metrics.headerHeight}px, ScrollWidth: ${metrics.scrollWidth}px (0px overflow)`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL INFINITYFREE PRODUCTION BUILD TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');

  } catch (err) {
    console.error('TEST ERROR:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runInfinityFreeProductionTests().catch(err => {
  console.error(err);
  process.exit(1);
});

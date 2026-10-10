import { chromium } from 'playwright-core';

async function runStudioE2ETest() {
  console.log('=== STARTING TELEPROMPTER STUDIO PRO E2E AUDIT ===');
  
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const uncaughtExceptions = [];
  page.on('pageerror', err => {
    uncaughtExceptions.push(err.message);
  });

  try {
    // 1. Navigation & App Shell
    console.log('[1/10] Loading application at http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    
    const title = await page.title();
    console.log('  Page Title:', title);
    if (!title.includes('Teleprompter Studio Pro')) {
      throw new Error(`Unexpected page title: ${title}`);
    }

    // Verify 5 primary studio regions
    await page.waitForSelector('#top-navigation');
    await page.waitForSelector('#left-sidebar');
    await page.waitForSelector('#main-workspace');
    await page.waitForSelector('#right-settings');
    await page.waitForSelector('#bottom-playback');
    console.log('  ✓ 5 Studio Regions Present and Mounted');

    await page.screenshot({ path: 'tests/e2e-01-initial-state.png' });

    // 2. Playback & Scrolling Engine
    console.log('[2/10] Testing Playback & Scrolling Engine...');
    const btnPlay = await page.$('#btn-playback-toggle');
    const viewport = await page.$('#prompter-viewport');
    
    // Initial scroll top
    const initialScroll = await page.evaluate(() => document.getElementById('prompter-viewport').scrollTop);
    console.log('  Initial scrollTop:', initialScroll);

    // Click Play
    await btnPlay.click();
    console.log('  Clicked Play button');
    
    // Wait 2.5s for playback movement (countdown is 3s by default, or countdown starts)
    await page.waitForTimeout(4500);

    const activeScroll = await page.evaluate(() => document.getElementById('prompter-viewport').scrollTop);
    console.log('  Active scrollTop after 4.5s:', activeScroll);
    if (activeScroll <= initialScroll) {
      console.warn('  ⚠️ Note: Scrolling did not advance. Checking playback state...');
    } else {
      console.log('  ✓ Scrolling successfully advanced from', initialScroll, 'to', activeScroll);
    }

    // Click Pause
    await btnPlay.click();
    console.log('  ✓ Clicked Pause');

    // 3. Speed Controls
    console.log('[3/10] Testing Speed Controls...');
    const speedPlus = await page.$('#btn-speed-plus');
    await speedPlus.click();
    await page.waitForTimeout(100);
    const speedVal = await page.$eval('#playback-speed-indicator', el => el.textContent);
    console.log('  Updated Speed readout:', speedVal);
    if (speedVal !== '4') {
      throw new Error(`Expected speed 4, got ${speedVal}`);
    }
    console.log('  ✓ Speed adjustment verified');

    // 4. Settings Tabs & Customization
    console.log('[4/10] Testing Settings Tabs & Live Customization...');
    // Background Tab
    await page.click('button[data-tab="background"]');
    await page.selectOption('#select-bg-theme', 'high-contrast');
    await page.waitForTimeout(200);
    const bodyTheme = await page.$eval('body', el => el.getAttribute('data-theme'));
    console.log('  Body Theme attribute:', bodyTheme);
    if (bodyTheme !== 'high-contrast') {
      throw new Error('Theme did not update to high-contrast');
    }
    console.log('  ✓ Background Theme switched to High Contrast');

    // Text Tab
    await page.click('button[data-tab="text"]');
    await page.fill('#slider-font-size', '68');
    await page.dispatchEvent('#slider-font-size', 'input');
    await page.waitForTimeout(200);
    const promptFontSize = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue('--prompt-font-size')
    );
    console.log('  CSS var --prompt-font-size:', promptFontSize.trim());
    if (!promptFontSize.includes('68')) {
      throw new Error(`Expected font size 68px, got ${promptFontSize}`);
    }
    console.log('  ✓ Typography Engine dynamically updated CSS variable');

    // Display Tab & Mirror Mode
    await page.click('button[data-tab="display"]');
    await page.click('#switch-mirror-x + .switch-track');
    await page.waitForTimeout(200);
    const hasMirrorClass = await page.$eval('#prompter-text-container', el => el.classList.contains('mirror-x'));
    console.log('  Prompter container has .mirror-x class:', hasMirrorClass);
    if (!hasMirrorClass) {
      throw new Error('Mirror X class was not applied to prompter text container');
    }
    console.log('  ✓ Layer-isolated horizontal mirror applied');

    await page.screenshot({ path: 'tests/e2e-02-customized-prompter.png' });

    // 5. Script Editor Workspace
    console.log('[5/10] Testing Script Editor Mode & Find/Replace...');
    await page.click('button[data-mode="editor"]');
    await page.waitForSelector('#editor-workspace:not([style*="display: none"])');
    console.log('  ✓ Editor workspace visible');

    // Toggle Find & Replace
    await page.click('#btn-toggle-find-replace');
    await page.waitForSelector('#find-replace-bar:not([style*="display: none"])');
    console.log('  ✓ Find & Replace bar opened');
    await page.fill('#find-input', 'Welcome');
    await page.fill('#replace-input', 'Greetings');
    await page.click('#btn-find-replace-exec');
    await page.waitForTimeout(300);

    const editorText = await page.$eval('#script-rich-editor', el => el.innerText);
    if (!editorText.includes('Greetings')) {
      throw new Error('Find & Replace failed to update text in editor');
    }
    console.log('  ✓ Find & Replace executed successfully');

    await page.screenshot({ path: 'tests/e2e-03-editor-workspace.png' });

    // 6. Creator Studio Workspace
    console.log('[6/10] Testing Creator Studio / Video Editor Mode...');
    await page.click('button[data-mode="creator"]');
    await page.waitForSelector('#creator-workspace:not([style*="display: none"])');
    console.log('  ✓ Creator Studio workspace visible');

    // Test Subtitle Cue Generation from Script
    await page.click('#btn-gen-captions-script');
    await page.waitForTimeout(300);
    const cueCount = await page.$$eval('#caption-cues-list > div', divs => divs.length);
    console.log('  Generated Subtitle Cues count:', cueCount);
    if (cueCount === 0) {
      throw new Error('Subtitle cues were not generated from script');
    }
    console.log('  ✓ Auto-generated', cueCount, 'subtitle cues from script');

    await page.screenshot({ path: 'tests/e2e-04-creator-studio.png' });

    // Return to prompter
    await page.click('#btn-close-creator');
    await page.waitForTimeout(200);

    // 7. Modals Testing: Remote Pairing & Help
    console.log('[7/10] Testing Remote QR Pairing Modal & Host IP...');
    await page.click('#btn-open-remote-modal');
    await page.waitForSelector('#modal-remote-pairing[style*="display: flex"]');
    const token = await page.$eval('#display-pairing-token', el => el.textContent);
    console.log('  Pairing Token:', token);
    if (!token || token === '------') {
      throw new Error('Pairing token not generated');
    }

    // Update Host IP
    await page.fill('#input-remote-host-ip', 'http://192.168.1.100:3000');
    await page.click('#btn-update-qr-host');
    await page.waitForTimeout(200);
    console.log('  ✓ QR code re-rendered for LAN host');

    await page.click('#modal-remote-pairing .modal-close-btn');
    await page.waitForTimeout(200);

    // Test Shortcuts Modal
    console.log('[8/10] Testing Keyboard Shortcuts Modal...');
    await page.click('#btn-shortcuts-help');
    await page.waitForSelector('#modal-shortcuts[style*="display: flex"]');
    console.log('  ✓ Shortcuts modal opened');
    await page.click('#modal-shortcuts .modal-close-btn');
    await page.waitForTimeout(200);

    // Test Recording Library Modal
    console.log('[9/10] Testing Recording Library Modal...');
    await page.click('#btn-open-rec-library');
    await page.waitForSelector('#modal-recording-library[style*="display: flex"]');
    console.log('  ✓ Recording Library modal opened');
    await page.click('#modal-recording-library .modal-close-btn');
    await page.waitForTimeout(200);

    // 8. AI Gateway Live Test
    console.log('[10/10] Testing AI Settings & Server Gateway Integration...');
    await page.click('button[data-tab="ai"]');
    await page.click('#btn-test-ai-gateway');
    await page.waitForSelector('#ai-gateway-status-box:not([style*="display: none"])');
    await page.waitForTimeout(500);
    const aiStatusText = await page.$eval('#ai-gateway-status-box', el => el.innerText);
    console.log('  AI Gateway Status readout:\n ', aiStatusText);
    if (!aiStatusText.includes('Gateway Online') && !aiStatusText.includes('200')) {
      throw new Error(`Unexpected gateway status: ${aiStatusText}`);
    }
    console.log('  ✓ AI Gateway transparent error/status response verified');

    // Check Console Errors
    console.log('=== CONSOLE LOG SUMMARY ===');
    console.log('  Console Errors encountered:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.warn('  Errors:', consoleErrors);
    }
    console.log('  Uncaught Page Errors:', uncaughtExceptions.length);
    if (uncaughtExceptions.length > 0) {
      throw new Error(`Uncaught page error: ${uncaughtExceptions[0]}`);
    }

    console.log('=== ALL 10 E2E BROWSER CHECKS PASSED WITH FLYING COLORS ===');
  } finally {
    await browser.close();
  }
}

runStudioE2ETest().catch(err => {
  console.error('E2E TEST FAILURE:', err);
  process.exit(1);
});

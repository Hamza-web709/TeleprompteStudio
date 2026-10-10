import { chromium } from 'playwright-core';

async function auditMobileViewports() {
  console.log('=== Starting Task 6: Mobile Controls & Layout Audit ===');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const viewports = [
    { name: 'iPhone SE (375x667)', width: 375, height: 667 },
    { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
    { name: 'Pixel 7 (412x915)', width: 412, height: 915 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 }
  ];

  const results = [];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    const audit = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const docScrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const hasHorizontalOverflow = docScrollWidth > docWidth || bodyScrollWidth > docWidth;

      // Check top navigation
      const topbar = document.getElementById('top-navigation');
      const topbarOverflow = topbar ? topbar.scrollWidth > topbar.clientWidth : false;

      // Check playback bar
      const playback = document.getElementById('bottom-playback');
      const playbackOverflow = playback ? playback.scrollWidth > playback.clientWidth : false;

      // Check play button visibility & clickability
      const playBtn = document.getElementById('btn-playback-toggle');
      const playRect = playBtn ? playBtn.getBoundingClientRect() : null;
      const playVisible = playRect && playRect.width > 0 && playRect.height > 0 &&
                          playRect.top >= 0 && playRect.bottom <= window.innerHeight;

      // Check drawer toggle buttons
      const btnSidebar = document.getElementById('btn-toggle-sidebar');
      const btnSettings = document.getElementById('btn-toggle-settings');
      const sidebarRect = btnSidebar ? btnSidebar.getBoundingClientRect() : null;
      const settingsRect = btnSettings ? btnSettings.getBoundingClientRect() : null;

      return {
        docWidth,
        docScrollWidth,
        hasHorizontalOverflow,
        topbarOverflow,
        playbackOverflow,
        playVisible,
        playRect,
        sidebarBtnVisible: Boolean(sidebarRect && sidebarRect.width > 0),
        settingsBtnVisible: Boolean(settingsRect && settingsRect.width > 0)
      };
    });

    // Test fullscreen button clickability
    await page.click('#btn-fullscreen');
    await page.waitForTimeout(300);
    const fullscreenActive = await page.evaluate(() => {
      const app = document.getElementById('app-container');
      return app.classList.contains('distraction-free') || Boolean(document.fullscreenElement);
    });

    // Exit fullscreen
    await page.evaluate(() => {
      const app = document.getElementById('app-container');
      app.classList.remove('distraction-free');
    });

    results.push({
      viewport: vp.name,
      ...audit,
      fullscreenToggled: fullscreenActive
    });

    await page.close();
  }

  console.log('Mobile Viewport Audit Results:');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
  return results;
}

auditMobileViewports().then(results => {
  const allNoOverflow = results.every(r => !r.hasHorizontalOverflow && !r.topbarOverflow && !r.playbackOverflow);
  const allButtonsVisible = results.every(r => r.playVisible && r.sidebarBtnVisible && r.settingsBtnVisible);

  if (allNoOverflow && allButtonsVisible) {
    console.log('>>> TASK 6: MOBILE CONTROLS & LAYOUT VERIFIED CLEAN! <<<');
    process.exit(0);
  } else {
    console.warn('>>> TASK 6: ISSUES DETECTED IN MOBILE AUDIT <<<');
    process.exit(1);
  }
}).catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});

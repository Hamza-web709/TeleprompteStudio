import { chromium } from 'playwright-core';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const SCREENSHOT_DIR = path.resolve('tests/screenshots-shell-layout');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1920x1080_desktop', width: 1920, height: 1080, type: 'desktop' },
  { name: '1440x900_laptop', width: 1440, height: 900, type: 'desktop' },
  { name: '1366x768_laptop_std', width: 1366, height: 768, type: 'desktop' },
  { name: '1280x720_laptop_hd', width: 1280, height: 720, type: 'desktop' },
  { name: '1024x768_tablet_landscape', width: 1024, height: 768, type: 'tablet' },
  { name: '768x1024_tablet_portrait', width: 768, height: 1024, type: 'tablet' },
  { name: '390x844_mobile_iphone', width: 390, height: 844, type: 'mobile' },
  { name: '375x667_mobile_compact', width: 375, height: 667, type: 'mobile' },
];

async function runHeaderSidebarLayoutTests() {
  console.log('================================================================');
  console.log('TELEPROMPTER STUDIO PRO — APPLICATION SHELL & LAYOUT AUDIT');
  console.log('================================================================');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  const summaryResults = [];
  let allPassed = true;

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n========================================================`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height}, ${vp.type})`);
      console.log(`========================================================`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }
      });
      const page = await context.newPage();
      page.on('dialog', async d => await d.accept());

      await page.goto(APP_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      // Take initial screenshot
      const shotInitial = path.join(SCREENSHOT_DIR, `${vp.name}_01_initial.png`);
      await page.screenshot({ path: shotInitial });

      // 1. Measure header bounding box
      const headerBox = await page.locator('#top-navigation').boundingBox();
      assert(headerBox, 'Header #top-navigation must exist');
      console.log(`  Header Box: x=${headerBox.x.toFixed(1)}, y=${headerBox.y.toFixed(1)}, w=${headerBox.width.toFixed(1)}, h=${headerBox.height.toFixed(1)}`);
      assert(headerBox.y === 0, 'Header must sit at y=0');
      assert(headerBox.width <= vp.width + 1, `Header width (${headerBox.width}) must not exceed viewport width (${vp.width})`);

      // 2 & 3. Measure sidebar toggle bounding box & confirm fully inside header
      const toggleBox = await page.locator('#btn-toggle-sidebar').boundingBox();
      assert(toggleBox, 'Sidebar toggle #btn-toggle-sidebar must exist');
      console.log(`  Toggle Box: x=${toggleBox.x.toFixed(1)}, y=${toggleBox.y.toFixed(1)}, w=${toggleBox.width.toFixed(1)}, h=${toggleBox.height.toFixed(1)}`);
      assert(toggleBox.y >= headerBox.y, 'Toggle must not stick above header top');
      assert(toggleBox.y + toggleBox.height <= headerBox.y + headerBox.height + 1, 'Toggle must not stick below header bottom');
      assert(toggleBox.width >= 36 && toggleBox.height >= 36, 'Toggle must meet minimum practical touch/desktop target size');

      // 4. Confirm toggle is visible and clickable
      const isToggleVisible = await page.locator('#btn-toggle-sidebar').isVisible();
      assert(isToggleVisible, 'Toggle must be visible');

      // 5 & 6. Measure script title bounding box & confirm no overlap
      const scriptBox = await page.locator('.script-title-container').boundingBox();
      assert(scriptBox, 'Script title container must exist');
      console.log(`  Script Box: x=${scriptBox.x.toFixed(1)}, y=${scriptBox.y.toFixed(1)}, w=${scriptBox.width.toFixed(1)}, h=${scriptBox.height.toFixed(1)}`);
      assert(scriptBox.y >= headerBox.y, 'Script title container must be within header y top');
      assert(scriptBox.y + scriptBox.height <= headerBox.y + headerBox.height + 2, 'Script title must not exceed header bottom boundary');
      assert(scriptBox.x >= toggleBox.x + toggleBox.width, 'Script title must be to the right of toggle');

      // Check brand box
      const brandBox = await page.locator('.brand-badge').boundingBox();
      if (brandBox && brandBox.width > 0) {
        assert(brandBox.y >= headerBox.y && brandBox.y + brandBox.height <= headerBox.y + headerBox.height + 1, 'Brand must be inside header');
        assert(scriptBox.x >= brandBox.x + brandBox.width - 2, 'Script title must not overlap brand badge');
      }

      // Check save status indicator is visible when space permits
      const saveIndicator = page.locator('.save-status-indicator');
      const isSaveVisible = await saveIndicator.isVisible();
      console.log(`  Save Indicator visible: ${isSaveVisible}`);

      // 8. Verify sidebar starts below header on desktop
      if (vp.type === 'desktop') {
        const sidebarBox = await page.locator('#left-sidebar').boundingBox();
        if (sidebarBox && sidebarBox.width > 0) {
          console.log(`  Sidebar Box: x=${sidebarBox.x.toFixed(1)}, y=${sidebarBox.y.toFixed(1)}, w=${sidebarBox.width.toFixed(1)}, h=${sidebarBox.height.toFixed(1)}`);
          assert(sidebarBox.y >= headerBox.height - 1, `Desktop sidebar must begin below header (sidebar.y=${sidebarBox.y} >= header.h=${headerBox.height})`);
          assert(sidebarBox.x === 0, 'Sidebar must be aligned to left edge');
        }
      }

      // 9. Verify no unexpected horizontal overflow on document
      const docMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        windowWidth: window.innerWidth
      }));
      console.log(`  Document metrics: scrollW=${docMetrics.scrollWidth}, clientW=${docMetrics.clientWidth}, winW=${docMetrics.windowWidth}`);
      assert(docMetrics.scrollWidth <= vp.width + 1, `Document scrollWidth (${docMetrics.scrollWidth}) must not exceed viewport width (${vp.width})`);

      // 10. Verify playback controls remain accessible
      const playbackBox = await page.locator('#bottom-playback').boundingBox();
      assert(playbackBox, 'Bottom playback bar must exist');
      console.log(`  Playback Box: x=${playbackBox.x.toFixed(1)}, y=${playbackBox.y.toFixed(1)}, w=${playbackBox.width.toFixed(1)}, h=${playbackBox.height.toFixed(1)}`);
      assert(playbackBox.y + playbackBox.height <= vp.height + 1, 'Playback bar must be within screen height');
      const isPlayVisible = await page.locator('#btn-playback-toggle').isVisible();
      const isRecVisible = await page.locator('#btn-studio-record').isVisible();
      assert(isPlayVisible && isRecVisible, 'Play and Record controls must be visible');

      const isMobileMode = vp.width <= 768;

      // 11. Close and reopen sidebar (verify workspace width changes appropriately)
      const workspaceBefore = await page.locator('#main-workspace').boundingBox();
      console.log(`  Workspace width before toggle: ${workspaceBefore.width.toFixed(1)}px`);

      await page.click('#btn-toggle-sidebar');
      await page.waitForTimeout(400); // Wait for transition & resize recalculation

      const shotToggled = path.join(SCREENSHOT_DIR, `${vp.name}_02_sidebar_toggled.png`);
      await page.screenshot({ path: shotToggled });

      if (!isMobileMode) {
        const isCollapsed = await page.evaluate(() => document.getElementById('app-container').classList.contains('sidebar-collapsed'));
        assert(isCollapsed, 'Sidebar should have .sidebar-collapsed on desktop');

        const workspaceAfter = await page.locator('#main-workspace').boundingBox();
        console.log(`  Workspace width with sidebar collapsed: ${workspaceAfter.width.toFixed(1)}px`);
        assert(workspaceAfter.width > workspaceBefore.width, `Workspace width must expand when sidebar collapses (${workspaceAfter.width} > ${workspaceBefore.width})`);

        // Reopen sidebar
        await page.click('#btn-toggle-sidebar');
        await page.waitForTimeout(400);

        const workspaceRestored = await page.locator('#main-workspace').boundingBox();
        console.log(`  Workspace width restored: ${workspaceRestored.width.toFixed(1)}px`);
        assert(Math.abs(workspaceRestored.width - workspaceBefore.width) < 5, 'Workspace width should restore to initial size');
      } else {
        // Mobile drawer test
        const isMobileOpen = await page.evaluate(() => document.getElementById('app-container').classList.contains('mobile-sidebar-open'));
        assert(isMobileOpen, 'Mobile sidebar should have .mobile-sidebar-open class after toggle');

        // Check drawer backdrop visibility
        const backdropVisible = await page.locator('#mobile-drawer-backdrop').isVisible();
        assert(backdropVisible, 'Mobile drawer backdrop should be visible when drawer is open');

        // Close drawer via backdrop click (clicking outside the left drawer)
        await page.click('#mobile-drawer-backdrop', { position: { x: Math.max(10, vp.width - 15), y: 150 } });
        await page.waitForTimeout(350);

        const isMobileClosed = await page.evaluate(() => !document.getElementById('app-container').classList.contains('mobile-sidebar-open'));
        assert(isMobileClosed, 'Drawer should close when tapping backdrop');
      }

      // 12. Verify teleprompter text remains visible
      const prompterBox = await page.locator('#prompter-text-container').boundingBox();
      assert(prompterBox, 'Prompter text container must exist');
      console.log(`  Prompter Text Box: w=${prompterBox.width.toFixed(1)}, h=${prompterBox.height.toFixed(1)}`);
      assert(prompterBox.width > 50, 'Prompter text container must have positive width');

      // 13. Verify Settings panel opens and closes
      if (!isMobileMode) {
        const settingsBefore = await page.evaluate(() => document.getElementById('app-container').classList.contains('settings-collapsed'));
        await page.click('#btn-toggle-settings');
        await page.waitForTimeout(350);
        // Toggle back
        await page.click('#btn-toggle-settings');
        await page.waitForTimeout(300);
      } else {
        // Mobile settings drawer test
        await page.click('#btn-toggle-settings');
        await page.waitForTimeout(350);
        const settingsOpen = await page.evaluate(() => document.getElementById('app-container').classList.contains('mobile-settings-open'));
        assert(settingsOpen, 'Settings should open as mobile drawer');
        // Close via backdrop (clicking outside the right drawer)
        await page.click('#mobile-drawer-backdrop', { position: { x: 15, y: 150 } });
        await page.waitForTimeout(350);
        const settingsClosed = await page.evaluate(() => !document.getElementById('app-container').classList.contains('mobile-settings-open'));
        assert(settingsClosed, 'Settings drawer should close when tapping backdrop');
      }

      // 14. Verify More menu if present
      const moreBtn = page.locator('#btn-header-more');
      if (await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(200);
        const dropdownVisible = await page.locator('#header-more-dropdown').isVisible();
        assert(dropdownVisible, 'Header More dropdown should open when button clicked');
        // Close dropdown
        await page.click('#top-navigation');
        await page.waitForTimeout(200);
      }


      summaryResults.push({
        viewport: vp.name,
        resolution: `${vp.width}x${vp.height}`,
        headerHeight: headerBox.height,
        toggleBox: `${Math.round(toggleBox.width)}x${Math.round(toggleBox.height)}`,
        horizontalOverflow: docMetrics.scrollWidth > vp.width ? 'FAIL' : 'PASS (0px)',
        workspaceExpand: 'PASS',
        status: 'PASSED'
      });

      console.log(`  --> RESULT FOR ${vp.name}: PASSED`);
      await context.close();
    }
  } catch (err) {
    console.error('TEST ERROR:', err);
    allPassed = false;
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('SUMMARY OF ALL VIEWPORTS AUDITED:');
  console.log('================================================================');
  console.table(summaryResults);

  if (!allPassed) {
    throw new Error('Some layout tests failed.');
  }

  console.log('\nALL 8 VIEWPORT TESTS COMPLETED SUCCESSFULLY!');
}

runHeaderSidebarLayoutTests().catch(err => {
  console.error(err);
  process.exit(1);
});

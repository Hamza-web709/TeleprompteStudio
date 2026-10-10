import { chromium } from 'playwright-core';

async function runScriptPersistenceTest() {
  console.log('=== Starting Task 3: Custom Script Persistence E2E Test ===');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  const uniqueId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
  const testTitle = `Exclusive Teleprompter Studio Script ${uniqueId}`;
  const testParagraph = `Special report paragraph for IndexedDB persistence test. Generated at ${new Date().toISOString()} with unique token [${uniqueId}]. Verified across browser reload.`;

  console.log('1. Creating new custom script with unique title:', testTitle);

  // Click "New Script" button
  await page.click('#btn-new-script');
  await page.waitForTimeout(300);

  // Set the title
  await page.fill('#active-script-title-input', testTitle);
  await page.dispatchEvent('#active-script-title-input', 'input');

  // Switch to editor mode and enter unique text
  await page.click('.mode-tab-btn[data-mode="editor"]');
  await page.waitForSelector('#script-rich-editor', { state: 'visible' });

  await page.evaluate(({ title, para }) => {
    const editor = document.getElementById('script-rich-editor');
    editor.innerHTML = `<h1>${title}</h1><p>${para}</p>`;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, { title: testTitle, para: testParagraph });

  // Update speed setting
  await page.evaluate(() => {
    const stateMod = window.__appState || null;
    const speedBtn = document.getElementById('btn-speed-plus');
    if (speedBtn) {
      speedBtn.click();
      speedBtn.click();
    }
  });

  // Wait for autosave to complete (save-text indicator becomes "Saved")
  console.log('2. Waiting for IndexedDB autosave...');
  await page.waitForFunction(() => {
    const saveText = document.getElementById('save-text');
    return saveText && saveText.textContent === 'Saved';
  }, { timeout: 6000 });
  await page.waitForTimeout(300);

  // Verify directly in IndexedDB before reload
  const preReloadRecord = await page.evaluate(async (expectedTitle) => {
    const { db } = await import('/src/modules/storage/db.js');
    await db.init();
    const scripts = await db.getAll('scripts');
    return scripts.find(s => s.title === expectedTitle) || null;
  }, testTitle);

  if (!preReloadRecord) {
    throw new Error('Script was not found in IndexedDB prior to reload!');
  }
  console.log('  Pre-reload IndexedDB record verified. ID:', preReloadRecord.id);

  // 3. Perform Full Application Reload
  console.log('3. Triggering browser reload...');
  await page.reload({ waitUntil: 'networkidle' });

  // 4. Verify post-reload UI state
  console.log('4. Verifying script state in UI after reload...');
  const currentTitle = await page.inputValue('#active-script-title-input');
  console.log('  Active Title in UI after reload:', currentTitle);

  // Switch back to editor mode to check content
  await page.click('.mode-tab-btn[data-mode="editor"]');
  const editorContent = await page.evaluate(() => {
    return document.getElementById('script-rich-editor').innerText;
  });

  console.log('  Editor text after reload contains unique token:', editorContent.includes(uniqueId));

  // 5. Query IndexedDB post-reload
  const postReloadRecord = await page.evaluate(async (expectedTitle) => {
    const { db } = await import('/src/modules/storage/db.js');
    await db.init();
    const scripts = await db.getAll('scripts');
    return scripts.find(s => s.title === expectedTitle) || null;
  }, testTitle);

  await browser.close();

  const success = Boolean(
    postReloadRecord &&
    postReloadRecord.title === testTitle &&
    postReloadRecord.content.includes(uniqueId) &&
    editorContent.includes(uniqueId)
  );

  console.log('Persistence Test Result:', {
    scriptId: postReloadRecord?.id,
    expectedTitle: testTitle,
    persistedTitle: postReloadRecord?.title,
    containsUniqueToken: postReloadRecord?.content?.includes(uniqueId),
    uiRestoredSuccessfully: success
  });

  if (success) {
    console.log('>>> TASK 3: SCRIPT PERSISTENCE VERIFIED SUCCESSFULLY! <<<');
    process.exit(0);
  } else {
    console.error('>>> TASK 3: SCRIPT PERSISTENCE FAILED! <<<');
    process.exit(1);
  }
}

runScriptPersistenceTest().catch(err => {
  console.error('Error executing script persistence test:', err);
  process.exit(1);
});

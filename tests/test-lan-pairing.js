import { chromium } from 'playwright-core';

async function runLanPairingTest() {
  console.log('=== Starting Task 5: Mobile Remote Pairing with Real LAN IP Test ===');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  // Browser 1: Host Studio on localhost
  const hostPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await hostPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Click Remote Pairing Modal button
  await hostPage.click('#btn-open-remote-modal');
  await hostPage.waitForSelector('#modal-remote-pairing', { state: 'visible' });

  // Verify that the LAN IP is auto-detected and populated
  const populatedHost = await hostPage.inputValue('#input-remote-host-ip');
  const pairingToken = await hostPage.textContent('#display-pairing-token');
  console.log('Host Studio Remote Modal:');
  console.log('  Pairing Token:', pairingToken);
  console.log('  Populated Host URL:', populatedHost);

  if (!populatedHost.includes('192.168.100.122')) {
    throw new Error(`Expected LAN IP 192.168.100.122 to be populated, got: ${populatedHost}`);
  }

  // Verify that QR code canvas is drawn
  const qrCanvasValid = await hostPage.evaluate(() => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return pixel[3] > 0; // Alpha > 0 means canvas was drawn
  });
  console.log('  QR Canvas Drawn:', qrCanvasValid);

  // Browser 2: Simulated Smartphone opening the exact LAN URL
  console.log('Simulating Smartphone on local network loading LAN remote URL...');
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 dimensions
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });
  const phonePage = await phoneContext.newPage();

  const phoneUrl = `http://192.168.100.122:3000/remote.html?session=${pairingToken}`;
  console.log('  Navigating Smartphone to:', phoneUrl);
  await phonePage.goto(phoneUrl, { waitUntil: 'networkidle' });

  // Wait for remote connection status badge to show Connected
  await phonePage.waitForFunction(() => {
    const badge = document.getElementById('conn-status');
    return badge && badge.textContent.includes('Connected');
  }, { timeout: 8000 });

  const phoneStatus = await phonePage.textContent('#conn-status');
  console.log('  Smartphone Connection Status:', phoneStatus);

  // Send speed adjustment and play command from smartphone
  console.log('  Smartphone sending speed change to 8...');
  await phonePage.evaluate(() => {
    const slider = document.getElementById('remote-speed-slider');
    slider.value = 8;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await hostPage.waitForTimeout(1000);

  // Verify host received and reflected speed = 8
  const hostSpeed = await hostPage.textContent('#playback-speed-indicator');
  console.log('  Host Playback Speed Indicator:', hostSpeed);

  await browser.close();

  if (populatedHost.includes('192.168.100.122') && phoneStatus.includes('Connected') && hostSpeed === '8') {
    console.log('>>> TASK 5: LAN MOBILE PAIRING VERIFIED SUCCESSFULLY! <<<');
    process.exit(0);
  } else {
    console.error('>>> TASK 5: LAN MOBILE PAIRING FAILED! <<<');
    process.exit(1);
  }
}

runLanPairingTest().catch(err => {
  console.error('LAN pairing test error:', err);
  process.exit(1);
});

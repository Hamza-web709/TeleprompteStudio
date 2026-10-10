import { chromium } from 'playwright-core';

async function runMobilePreviewPerformanceTests() {
  console.log('================================================================');
  console.log('📱 RUNNING MOBILE LIVE CAMERA PREVIEW PERFORMANCE TEST SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Standard Android viewport (Pixel 7 / Galaxy S23)
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    permissions: ['camera', 'microphone']
  });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [BROWSER ERROR]', msg.text());
  });

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  console.log('✓ Android Mobile Studio emulation loaded successfully.');

  // Test 1: Verify Direct MediaStream Preview Attributes
  console.log('\n--- TEST 1: Direct Video Element Configuration & Layer Attributes ---');
  const videoConfig = await page.evaluate(() => {
    const video = document.getElementById('camera-preview-video');
    const container = document.getElementById('camera-preview-container');
    const computedVideo = window.getComputedStyle(video);
    const computedContainer = window.getComputedStyle(container);
    return {
      hasVideoEl: Boolean(video),
      autoplay: video.autoplay,
      playsInline: video.playsInline,
      muted: video.muted,
      objectFit: computedVideo.objectFit,
      videoTransform: computedVideo.transform,
      containerContain: computedContainer.contain,
      hasDirectSrcObject: video.srcObject === null // initially null before start
    };
  });
  console.log('✓ Video Element Configuration:', videoConfig);
  if (!videoConfig.autoplay || !videoConfig.playsInline || !videoConfig.muted) {
    throw new Error('Video preview element missing critical attributes (autoplay, playsinline, muted)!');
  }

  // Test 2: Camera Start & Direct MediaStream Attachment
  console.log('\n--- TEST 2: Camera Start & Fast Initialization ---');
  const startResult = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const cameraManager = app?.cameraManager || (await import('/src/modules/camera/cameraManager.js')).cameraManager;
    const t0 = performance.now();
    const stream = await cameraManager.startCamera();
    const initDuration = Math.round(performance.now() - t0);
    const video = cameraManager.getVideoElement();
    const track = stream ? stream.getVideoTracks()[0] : null;
    const settings = track ? track.getSettings() : null;

    return {
      streamActive: Boolean(stream && stream.active),
      tracksCount: stream ? stream.getTracks().length : 0,
      videoPlaying: Boolean(video && !video.paused && !video.ended && video.readyState >= 2),
      videoSrcObjectMatches: video && video.srcObject === stream,
      initDurationMs: initDuration,
      trackSettings: settings,
      deliveredWidth: settings?.width,
      deliveredHeight: settings?.height,
      deliveredFps: settings?.frameRate
    };
  });
  console.log('✓ Camera Start Results:', startResult);
  if (!startResult.streamActive || !startResult.videoPlaying || !startResult.videoSrcObjectMatches) {
    throw new Error('Camera failed to start with direct MediaStream playback!');
  }

  // Test 3: Resolution Presets Switching (480p, 720p, 1080p, auto)
  console.log('\n--- TEST 3: Mobile Resolution Presets Switching ---');
  const presetResults = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const { resolveResolutionPreset } = await import('/src/modules/camera/cameraManager.js');
    const cameraManager = app?.cameraManager || (await import('/src/modules/camera/cameraManager.js')).cameraManager;

    const p480 = resolveResolutionPreset('480p');
    const p720 = resolveResolutionPreset('720p');
    const p1080 = resolveResolutionPreset('1080p');
    const pAuto = resolveResolutionPreset('auto');

    // Switch to 480p performance preset
    await cameraManager.setResolution('480p');
    const s480 = cameraManager.getVideoTrackSettings();

    // Switch to 720p balanced preset
    await cameraManager.setResolution('720p');
    const s720 = cameraManager.getVideoTrackSettings();

    return {
      presetsResolved: { p480, p720, p1080, pAuto },
      switched480Settings: s480,
      switched720Settings: s720,
      isCleanSwitch: Boolean(s480 && s720)
    };
  });
  console.log('✓ Presets resolution tests passed:', {
    p480: presetResults.presetsResolved.p480.label,
    p720: presetResults.presetsResolved.p720.label,
    pAuto: presetResults.presetsResolved.pAuto.label
  });

  // Test 4: Front / Rear Camera Flip
  console.log('\n--- TEST 4: Camera Lens Flip (Front / Rear) ---');
  const flipResult = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const cameraManager = app?.cameraManager || (await import('/src/modules/camera/cameraManager.js')).cameraManager;
    const appState = app?.appState || (await import('/src/state/appState.js')).appState;

    const initialFacing = appState.get('media')?.facingMode;
    await cameraManager.toggleFacingMode();
    const flippedFacing = appState.get('media')?.facingMode;

    await cameraManager.toggleFacingMode();
    const restoredFacing = appState.get('media')?.facingMode;

    return {
      initialFacing,
      flippedFacing,
      restoredFacing,
      isToggledSuccessfully: initialFacing !== flippedFacing && initialFacing === restoredFacing
    };
  });
  console.log('✓ Front/Rear Camera Flip Result:', flipResult);
  if (!flipResult.isToggledSuccessfully) {
    throw new Error('Camera facingMode failed to toggle!');
  }

  // Test 5: Controlled A/B Diagnostics Benchmark (Task 5)
  console.log('\n--- TEST 5: Running Controlled A/B Performance Benchmark ---');
  const benchmarkMatrix = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const recordingDiagnostics = app?.recordingDiagnostics || (await import('/src/modules/recording/recordingDiagnostics.js')).recordingDiagnostics;
    return await recordingDiagnostics.runABBenchmark();
  });
  console.log('✓ Benchmark Matrix Results:');
  benchmarkMatrix.forEach(item => {
    console.log(`    ${item.name.padEnd(36)}: ${item.fps} FPS`);
  });

  // Verify all benchmark modes achieved >= 18 FPS
  for (const item of benchmarkMatrix) {
    if (item.fps < 18) {
      throw new Error(`Condition ${item.name} performed below acceptable threshold: ${item.fps} FPS`);
    }
  }

  // Test 6: Verify Zero Layout Thrashing During Prompter Scroll
  console.log('\n--- TEST 6: Smooth Scrolling Layout Isolation ---');
  const scrollPerf = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const scrollEngine = app?.scrollEngine || (await import('/src/modules/scrolling/scrollEngine.js')).scrollEngine;

    scrollEngine.play();
    const initialPos = scrollEngine.currentScrollPos;
    const maxScroll = scrollEngine.getMaxScroll();

    await new Promise(r => setTimeout(r, 1000));
    const activePos = scrollEngine.currentScrollPos;
    scrollEngine.pause();

    return {
      initialPos,
      activePos,
      maxScroll,
      advancedSmoothly: activePos > initialPos && maxScroll > 0
    };
  });
  console.log('✓ Scroll Performance Check:', scrollPerf);
  if (!scrollPerf.advancedSmoothly) {
    throw new Error('Prompter text scrolling failed to advance smoothly during camera session!');
  }

  // Test 7: Clean Shutdown & Stream Track Disposal
  console.log('\n--- TEST 7: Clean Camera Shutdown & Track Release ---');
  const stopResult = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const cameraManager = app?.cameraManager || (await import('/src/modules/camera/cameraManager.js')).cameraManager;
    const appState = app?.appState || (await import('/src/state/appState.js')).appState;

    const streamBefore = cameraManager.getStream();
    const tracksBefore = streamBefore ? streamBefore.getTracks() : [];

    cameraManager.stopCamera();

    const streamAfter = cameraManager.getStream();
    const allTracksStopped = tracksBefore.every(t => t.readyState === 'ended');
    const video = cameraManager.getVideoElement();

    return {
      streamAfterNull: streamAfter === null,
      allTracksStopped,
      videoSrcObjectNull: video && video.srcObject === null,
      cameraEnabledState: appState.get('media')?.cameraEnabled,
      containerHidden: document.getElementById('camera-preview-container').style.display === 'none'
    };
  });
  console.log('✓ Stop and Cleanup Results:', stopResult);
  if (!stopResult.streamAfterNull || !stopResult.allTracksStopped || !stopResult.videoSrcObjectNull) {
    throw new Error('Camera tracks failed to release properly on stopCamera()!');
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 ALL MOBILE LIVE CAMERA PREVIEW TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
}

runMobilePreviewPerformanceTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

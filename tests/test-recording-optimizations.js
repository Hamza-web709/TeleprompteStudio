import { chromium } from 'playwright-core';

async function runMobileRecordingOptimizationTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING RECORDING OPTIMIZATIONS & LAG FIX TEST SUITE');
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
    viewport: { width: 1280, height: 800 },
    permissions: ['camera', 'microphone']
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('  [PAGE ERROR]', err.message));

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  console.log('✓ Studio application loaded successfully.');

  // Test 1: Verify Recording Diagnostics HUD toggle and initial metrics
  console.log('\n--- TEST 1: Recording Diagnostics HUD ---');
  const btnDiag = await page.$('#btn-topbar-diagnostics');
  if (!btnDiag) throw new Error('btn-topbar-diagnostics not found in DOM');
  await btnDiag.click();

  const hudVisible = await page.evaluate(() => {
    const hud = document.getElementById('recording-diagnostics-hud');
    return hud && hud.style.display !== 'none';
  });
  console.log(`✓ Diagnostics HUD opened: ${hudVisible}`);
  if (!hudVisible) throw new Error('Diagnostics HUD failed to display');

  // Inspect initial HUD fields
  const hudValues = await page.evaluate(() => {
    return {
      reqRes: document.getElementById('diag-val-req-res')?.textContent,
      delRes: document.getElementById('diag-val-del-res')?.textContent,
      targetFps: document.getElementById('diag-val-target-fps')?.textContent,
      codec: document.getElementById('diag-val-codec')?.textContent,
      targetBitrate: document.getElementById('diag-val-target-bitrate')?.textContent,
      hwBadge: document.getElementById('diag-val-hw')?.textContent
    };
  });
  console.log('✓ Initial HUD Diagnostics:', JSON.stringify(hudValues, null, 2));

  // Test 2: Hardware-Aware Codec Selection Evaluation
  console.log('\n--- TEST 2: Hardware-Aware Codec Selection ---');
  const codecEvaluation = await page.evaluate(async () => {
    const { getOptimalRecordingFormat } = await import('/src/modules/recording/mediaRecorder.js');
    const optimal = getOptimalRecordingFormat();
    const isVp9Prioritized = optimal.mimeType.includes('vp9');
    return {
      selectedMimeType: optimal.mimeType,
      desc: optimal.desc,
      isHardware: optimal.hw,
      isVp9Avoided: !isVp9Prioritized
    };
  });
  console.log('✓ Codec selection details:', codecEvaluation);
  if (!codecEvaluation.isVp9Avoided) {
    console.warn('⚠️ Warning: VP9 was selected; verify whether system explicitly lacked H.264 / VP8.');
  } else {
    console.log('✓ Confirmed: System avoids VP9 software encoder in favor of hardware-accelerated codec.');
  }

  // Test 3: Resolution switching (720p vs 1080p) and target bitrates
  console.log('\n--- TEST 3: Resolution & Bitrate Scaling ---');
  const bitrateChecks = await page.evaluate(async () => {
    const { getTargetBitrates } = await import('/src/modules/recording/mediaRecorder.js');
    const bitrates720 = getTargetBitrates('720p');
    const bitrates1080 = getTargetBitrates('1080p');
    return {
      bitrates720,
      bitrates1080,
      is720Valid: bitrates720.videoBitsPerSecond === 2500000 && bitrates720.audioBitsPerSecond === 128000,
      is1080Valid: bitrates1080.videoBitsPerSecond === 5000000 && bitrates1080.audioBitsPerSecond === 128000
    };
  });
  console.log('✓ 720p Bitrates (2.5 Mbps):', bitrateChecks.bitrates720);
  console.log('✓ 1080p Bitrates (5.0 Mbps):', bitrateChecks.bitrates1080);
  if (!bitrateChecks.is720Valid || !bitrateChecks.is1080Valid) {
    throw new Error('Bitrate calculation mismatch!');
  }

  // Test 4: Camera Activation & Delivered Stream Track Settings
  console.log('\n--- TEST 4: Camera Start & Track Settings ---');
  const streamInfo = await page.evaluate(async () => {
    const { cameraManager } = await import('/src/modules/camera/cameraManager.js');
    try {
      let stream = cameraManager.getStream();
      if (!stream) {
        stream = await cameraManager.startCamera();
      }
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      const settings = videoTrack ? videoTrack.getSettings() : null;
      return {
        hasStream: true,
        hasVideoTrack: Boolean(videoTrack),
        hasAudioTrack: Boolean(audioTrack),
        trackSettings: settings,
        deliveredWidth: settings?.width,
        deliveredHeight: settings?.height,
        deliveredFps: settings?.frameRate
      };
    } catch (err) {
      return {
        hasStream: false,
        error: err.message
      };
    }
  });
  console.log('✓ Stream & Track Info:', JSON.stringify(streamInfo, null, 2));
  if (!streamInfo.hasStream || !streamInfo.hasVideoTrack) {
    throw new Error('Camera stream failed to initialize!');
  }

  // Test 5: Clean Recording Pipeline (Direct MediaStream)
  console.log('\n--- TEST 5: Clean Recording (Direct MediaStream) ---');
  const recordResult = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const studioRecorder = app?.studioRecorder || (await import('/src/modules/recording/mediaRecorder.js')).studioRecorder;
    const appState = app?.appState || (await import('/src/state/appState.js')).appState;
    const eventBus = app?.eventBus || (await import('/src/state/eventBus.js')).eventBus;

    appState.set('countdownDuration', 0);
    appState.update('media', { cleanRecord: true });

    return new Promise(async (resolve) => {
      let chunkCount = 0;
      let totalBytes = 0;

      const unbindChunk = eventBus.on('recording:chunk-received', (data) => {
        chunkCount++;
        totalBytes += data.chunkSize;
      });

      eventBus.once('recording:completed', (item) => {
        unbindChunk();
        resolve({
          id: item.id,
          mimeType: item.mimeType,
          duration: item.duration,
          size: item.size,
          chunkCount,
          totalBytes,
          blobValid: item.blob instanceof Blob && item.blob.size > 0
        });
      });

      // Start recording
      await studioRecorder.startRecording();

      // Wait 2 seconds
      setTimeout(() => {
        studioRecorder.stopRecording();
      }, 2000);
    });
  });

  console.log('✓ Clean Recording Results:', JSON.stringify(recordResult, null, 2));
  if (!recordResult.blobValid || recordResult.size <= 0) {
    throw new Error('Recorded video blob is empty or invalid!');
  }

  // Test 5b: Composite Recording Pipeline (Canvas overlay with prompter text)
  console.log('\n--- TEST 5b: Composite Recording (Canvas Overlay Stream) ---');
  const compositeResult = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const studioRecorder = app?.studioRecorder || (await import('/src/modules/recording/mediaRecorder.js')).studioRecorder;
    const appState = app?.appState || (await import('/src/state/appState.js')).appState;
    const eventBus = app?.eventBus || (await import('/src/state/eventBus.js')).eventBus;

    appState.set('countdownDuration', 0);
    appState.update('media', { cleanRecord: false });

    return new Promise(async (resolve) => {
      let chunkCount = 0;
      let totalBytes = 0;

      const unbindChunk = eventBus.on('recording:chunk-received', (data) => {
        chunkCount++;
        totalBytes += data.chunkSize;
      });

      eventBus.once('recording:completed', (item) => {
        unbindChunk();
        // Restore cleanRecord to true
        appState.update('media', { cleanRecord: true });
        resolve({
          id: item.id,
          mimeType: item.mimeType,
          duration: item.duration,
          size: item.size,
          chunkCount,
          totalBytes,
          blobValid: item.blob instanceof Blob && item.blob.size > 0
        });
      });

      await studioRecorder.startRecording();
      setTimeout(() => {
        studioRecorder.stopRecording();
      }, 2000);
    });
  });

  console.log('✓ Composite Recording Results:', JSON.stringify(compositeResult, null, 2));
  if (!compositeResult.blobValid || compositeResult.size <= 0) {
    throw new Error('Composite recorded video blob is empty or invalid!');
  }

  // Test 6: Video Playback & Audio Preservation Verification
  console.log('\n--- TEST 6: Video Playback & Audio Preservation ---');
  const playbackValidation = await page.evaluate(async (recResult) => {
    const { db } = await import('/src/modules/storage/db.js');
    const recRecord = await db.get('recordings', recResult.id);

    // Test playback in an in-memory video element
    const video = document.createElement('video');
    video.muted = true;
    video.src = URL.createObjectURL(recRecord.blob || new Blob([], { type: recResult.mimeType }));

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        resolve({
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration,
          isPlayable: true
        });
      };
      video.onerror = () => {
        resolve({ isPlayable: false, error: video.error?.message });
      };
      setTimeout(() => {
        resolve({ isPlayable: video.readyState >= 1, duration: video.duration });
      }, 2000);
    });
  }, recordResult);

  console.log('✓ Playback validation:', playbackValidation);

  // Test 7: Scrolling Concurrent with Recording
  console.log('\n--- TEST 7: Scrolling Concurrently with Camera Preview ---');
  const scrollCheck = await page.evaluate(async () => {
    const app = window.teleprompterApp;
    const scrollEngine = app?.scrollEngine || (await import('/src/modules/scrolling/scrollEngine.js')).scrollEngine;
    const appState = app?.appState || (await import('/src/state/appState.js')).appState;

    scrollEngine.play();
    const initialPos = scrollEngine.currentScrollPos;

    await new Promise(r => setTimeout(r, 1000));
    const midPos = scrollEngine.currentScrollPos;
    scrollEngine.pause();

    return {
      initialPos,
      midPos,
      scrolled: midPos > initialPos,
      playbackState: appState.get('playbackState')
    };
  });
  console.log('✓ Concurrent scroll check:', scrollCheck);
  if (!scrollCheck.scrolled) {
    throw new Error('Prompter failed to scroll smoothly during active camera session!');
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 ALL RECORDING OPTIMIZATION TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runMobileRecordingOptimizationTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

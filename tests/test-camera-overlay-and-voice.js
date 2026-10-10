import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function runCameraOverlayAndVoiceTestSuite() {
  console.log('================================================================');
  console.log('🔬 TELEPROMPTER STUDIO PRO — CAMERA OVERLAY & VOICE LIFECYCLE QA');
  console.log('Target: http://localhost:3201/');
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
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const backendRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes(':8080') || (url.includes('localhost') && !url.includes(':3201'))) {
      backendRequests.push(url);
    }
  });

  page.on('pageerror', err => console.log('  [BROWSER ERROR]', err.message));

  await page.goto('http://localhost:3201/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // -------------------------------------------------------------
  // TEST SCRIPT SETUP (>= 100 words)
  // -------------------------------------------------------------
  console.log('[1/13] Loading 100+ word test script into Teleprompter Studio...');
  const longScript = `
    Welcome to Teleprompter Studio Pro high performance broadcast studio edition.
    Today we are demonstrating complete camera overlay integration paired with robust voice command recognition.
    Our mission is to empower creators, journalists, and educators to deliver flawless on camera presentations.
    Notice how the live camera video stream operates beneath the scrolling teleprompter text.
    The text maintains crisp contrast, solid typography, and customizable line spacing at all times.
    Focus guides and eye contact indicators assist the presenter in maintaining a steady gaze into the camera lens.
    Hands free voice control allows effortless play, pause, resume, and stop commands without touching any hardware controls.
    Even when the presenter takes a natural pause, voice listening remains active and ready for the next command.
    Every frame is rendered smoothly without dropped frames, lag, or visual glitches.
    Thank you for choosing Teleprompter Studio Pro for your broadcast studio workflow.
  `.trim().replace(/\s+/g, ' ');

  await page.evaluate((text) => {
    const { scriptManager } = window.teleprompterApp;
    const paragraphs = text.split('. ').map(p => `<p>${p.trim()}.</p>`).join('');
    const testScript = {
      id: 'camera-voice-qa-script',
      title: 'Camera & Voice QA Master Script',
      content: paragraphs
    };
    scriptManager.setActiveScript(testScript);
  }, longScript);

  await page.waitForTimeout(500);

  // -------------------------------------------------------------
  // BUG 1 - STEP 1: CAMERA OFF BASELINE
  // -------------------------------------------------------------
  console.log('\n[2/13] Verifying Camera OFF Baseline Stacking & Visibility...');
  const baselineStyles = await page.evaluate(() => {
    const frame = document.querySelector('.prompter-frame-container');
    const viewport = document.getElementById('prompter-viewport');
    const textEl = document.getElementById('prompter-text-container');
    const camContainer = document.getElementById('camera-preview-container');

    const frameRect = frame.getBoundingClientRect();
    const textRect = textEl.getBoundingClientRect();

    return {
      camDisplay: window.getComputedStyle(camContainer).display,
      camZIndex: window.getComputedStyle(camContainer).zIndex,
      frameZIndex: window.getComputedStyle(frame).zIndex,
      viewportZIndex: window.getComputedStyle(viewport).zIndex,
      frameBg: window.getComputedStyle(frame).backgroundColor,
      wordsCount: textEl.querySelectorAll('.prompter-word').length,
      textVisible: textRect.height > 100 && frameRect.height > 100
    };
  });
  console.log('✓ Baseline Styles:', JSON.stringify(baselineStyles, null, 2));
  if (!baselineStyles.textVisible || baselineStyles.wordsCount < 50) {
    throw new Error('Baseline test script was not properly rendered in DOM');
  }

  const screenshotDir = path.resolve('tests', 'screenshots-camera-voice-qa');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, '01-camera-off-baseline.png') });
  console.log('✓ Saved screenshot: 01-camera-off-baseline.png');

  // -------------------------------------------------------------
  // BUG 1 - STEP 2: CAMERA ON — OVERLAY STACKING VERIFICATION
  // -------------------------------------------------------------
  console.log('\n[3/13] Activating Camera and Verifying Live Video + Text Layering...');
  await page.evaluate(async () => {
    await window.teleprompterApp.cameraManager.startCamera();
  });
  await page.waitForTimeout(1000);

  const cameraActiveStyles = await page.evaluate(() => {
    const body = document.body;
    const frame = document.querySelector('.prompter-frame-container');
    const viewport = document.getElementById('prompter-viewport');
    const textEl = document.getElementById('prompter-text-container');
    const camContainer = document.getElementById('camera-preview-container');
    const camVideo = document.getElementById('camera-preview-video');
    const focusLine = document.getElementById('focus-line-indicator');
    const firstWord = textEl.querySelector('.prompter-word');

    const camRect = camContainer.getBoundingClientRect();
    const firstWordRect = firstWord ? firstWord.getBoundingClientRect() : null;

    return {
      bodyHasCameraActive: body.classList.contains('camera-active'),
      frameHasCameraActive: frame.classList.contains('camera-active'),
      frameBg: window.getComputedStyle(frame).backgroundColor,
      camContainerDisplay: window.getComputedStyle(camContainer).display,
      camZIndex: parseInt(window.getComputedStyle(camContainer).zIndex, 10),
      frameZIndex: parseInt(window.getComputedStyle(frame).zIndex, 10),
      viewportZIndex: parseInt(window.getComputedStyle(viewport).zIndex, 10),
      camVideoReadyState: camVideo.readyState,
      camVideoPaused: camVideo.paused,
      camVideoVisible: camRect.width > 0 && camRect.height > 0,
      firstWordVisible: firstWordRect && firstWordRect.width > 0 && firstWordRect.height > 0,
      firstWordColor: firstWord ? window.getComputedStyle(firstWord).color : null,
      focusLineZIndex: parseInt(window.getComputedStyle(focusLine).zIndex, 10)
    };
  });
  console.log('✓ Camera Active Layering:', JSON.stringify(cameraActiveStyles, null, 2));

  // Assertions for Bug 1:
  // Layer 1: Camera (z-index: 1)
  // Layer 2: Frame transparent background with dimming ::before
  // Layer 3: Text (viewport z-index: 2 inside frame z-index: 10)
  // Layer 4: Focus line (z-index: 30)
  if (!cameraActiveStyles.bodyHasCameraActive || !cameraActiveStyles.frameHasCameraActive) {
    throw new Error('camera-active class missing from body or prompter-frame-container');
  }
  if (cameraActiveStyles.camZIndex >= cameraActiveStyles.frameZIndex) {
    throw new Error(`Camera zIndex (${cameraActiveStyles.camZIndex}) must be LOWER than prompter frame (${cameraActiveStyles.frameZIndex})`);
  }
  if (cameraActiveStyles.viewportZIndex < 2) {
    throw new Error(`Prompter viewport zIndex (${cameraActiveStyles.viewportZIndex}) must be at least 2`);
  }
  if (cameraActiveStyles.frameBg !== 'rgba(0, 0, 0, 0)' && cameraActiveStyles.frameBg !== 'transparent') {
    throw new Error(`Prompter frame background (${cameraActiveStyles.frameBg}) must be transparent when camera is active`);
  }
  if (!cameraActiveStyles.firstWordVisible) {
    throw new Error('Prompter script words are not visible over camera video!');
  }
  console.log('✓ PASS: Camera underlay and teleprompter text overlay verified!');

  await page.screenshot({ path: path.join(screenshotDir, '02-camera-on-overlay.png') });
  console.log('✓ Saved screenshot: 02-camera-on-overlay.png');

  // -------------------------------------------------------------
  // BUG 1 - STEP 3: SCROLLING WHILE CAMERA IS ACTIVE
  // -------------------------------------------------------------
  console.log('\n[4/13] Verifying Playback & Scrolling Operation Over Camera Feed...');
  const scrollBefore = await page.evaluate(() => document.getElementById('prompter-viewport').scrollTop);
  
  // Start scrolling
  await page.evaluate(() => window.teleprompterApp.scrollEngine.play());
  await page.waitForTimeout(1500);

  const scrollDuring = await page.evaluate(() => {
    const { appState } = window.teleprompterApp;
    const vp = document.getElementById('prompter-viewport');
    const camVideo = document.getElementById('camera-preview-video');
    return {
      scrollTop: vp.scrollTop,
      isPlaying: appState.get('playbackState') === 'playing',
      videoStillPlaying: !camVideo.paused && camVideo.readyState >= 2
    };
  });
  console.log('✓ Scroll during playback:', scrollDuring);
  if (scrollDuring.scrollTop <= scrollBefore) {
    throw new Error('Prompter failed to scroll while camera was running');
  }
  if (!scrollDuring.videoStillPlaying) {
    throw new Error('Camera video paused or stalled during scrolling');
  }
  await page.screenshot({ path: path.join(screenshotDir, '03-camera-on-scrolling.png') });
  console.log('✓ Saved screenshot: 03-camera-on-scrolling.png');

  // Pause scrolling
  await page.evaluate(() => window.teleprompterApp.scrollEngine.pause());
  await page.waitForTimeout(500);
  const scrollPaused = await page.evaluate(() => ({
    scrollTop: document.getElementById('prompter-viewport').scrollTop,
    isPaused: window.teleprompterApp.appState.get('playbackState') === 'paused'
  }));
  console.log('✓ Scroll paused state:', scrollPaused);
  if (!scrollPaused.isPaused) throw new Error('Prompter failed to pause');

  // -------------------------------------------------------------
  // BUG 1 - STEP 4: FRONT / REAR CAMERA SWITCHING
  // -------------------------------------------------------------
  console.log('\n[5/13] Verifying Front/Rear Camera Switching with Overlay Intact...');
  const switchResult = await page.evaluate(async () => {
    const { cameraManager, appState } = window.teleprompterApp;
    const prevFacing = appState.get('media')?.facingMode || 'user';
    await cameraManager.toggleFacingMode();
    const newFacing = appState.get('media')?.facingMode || 'user';
    const frame = document.querySelector('.prompter-frame-container');
    const camVideo = document.getElementById('camera-preview-video');
    return {
      prevFacing,
      newFacing,
      isTransparent: window.getComputedStyle(frame).backgroundColor === 'rgba(0, 0, 0, 0)',
      videoPlaying: !camVideo.paused
    };
  });
  console.log('✓ Camera switch result:', switchResult);
  if (!switchResult.isTransparent || !switchResult.videoPlaying) {
    throw new Error('Overlay broke after camera switch');
  }

  // -------------------------------------------------------------
  // BUG 1 - STEP 5: ASPECT RATIO FRAMING OVER CAMERA
  // -------------------------------------------------------------
  console.log('\n[6/13] Verifying Aspect Ratio Framing (16:9, 9:16, 1:1, full)...');
  const ratios = ['16:9', '9:16', '1:1', 'full'];
  for (const ratio of ratios) {
    const ratioCheck = await page.evaluate((r) => {
      const { appState } = window.teleprompterApp;
      appState.update('display', { aspectRatio: r });
      const frame = document.querySelector('.prompter-frame-container');
      const text = document.getElementById('prompter-text-container');
      const frameRect = frame.getBoundingClientRect();
      const textRect = text.getBoundingClientRect();
      return {
        ratio: r,
        frameWidth: Math.round(frameRect.width),
        frameHeight: Math.round(frameRect.height),
        textInsideFrame: textRect.top >= frameRect.top - 100,
        frameBg: window.getComputedStyle(frame).backgroundColor
      };
    }, ratio);
    console.log(`  ✓ Ratio ${ratio}: ${ratioCheck.frameWidth}x${ratioCheck.frameHeight}, transparent: ${ratioCheck.frameBg === 'rgba(0, 0, 0, 0)'}`);
    if (ratioCheck.frameBg !== 'rgba(0, 0, 0, 0)') {
      throw new Error(`Frame background was not transparent in ratio ${ratio}`);
    }
  }
  // Restore full ratio
  await page.evaluate(() => window.teleprompterApp.appState.update('display', { aspectRatio: 'full' }));

  // -------------------------------------------------------------
  // BUG 1 - STEP 6: CAMERA OFF TRANSITION
  // -------------------------------------------------------------
  console.log('\n[7/13] Turning Camera OFF and Verifying Clean Background Restoration...');
  const camOffCheck = await page.evaluate(async () => {
    const { cameraManager } = window.teleprompterApp;
    const scrollPosBefore = document.getElementById('prompter-viewport').scrollTop;
    await cameraManager.stopCamera();
    const frame = document.querySelector('.prompter-frame-container');
    const body = document.body;
    const camContainer = document.getElementById('camera-preview-container');
    const scrollPosAfter = document.getElementById('prompter-viewport').scrollTop;

    return {
      bodyHasCameraActive: body.classList.contains('camera-active'),
      frameHasCameraActive: frame.classList.contains('camera-active'),
      frameBg: window.getComputedStyle(frame).backgroundColor,
      camDisplay: window.getComputedStyle(camContainer).display,
      scrollPreserved: scrollPosBefore === scrollPosAfter
    };
  });
  console.log('✓ Camera OFF result:', camOffCheck);
  if (camOffCheck.bodyHasCameraActive || camOffCheck.frameHasCameraActive) {
    throw new Error('camera-active class was not removed after camera stop');
  }
  if (camOffCheck.frameBg === 'rgba(0, 0, 0, 0)' || camOffCheck.frameBg === 'transparent') {
    throw new Error('Prompter frame did not restore solid background color after camera stop');
  }
  if (!camOffCheck.scrollPreserved) {
    throw new Error('Scroll position was altered during camera toggle');
  }
  await page.screenshot({ path: path.join(screenshotDir, '04-camera-off-restored.png') });
  console.log('✓ Saved screenshot: 04-camera-off-restored.png');
  console.log('✓ PASS: Camera OFF cleanly restored background and preserved scroll position!');

  // -------------------------------------------------------------
  // BUG 2 - STEP 7: VOICE ENGINE INITIALIZATION & TOGGLE
  // -------------------------------------------------------------
  console.log('\n[8/13] Initializing Voice Engine & Enabling Voice Control...');
  const voiceInitial = await page.evaluate(() => {
    const { appState } = window.teleprompterApp;
    const btnVoice = document.getElementById('btn-toggle-voice');
    const badge = document.getElementById('voice-status-badge');
    return {
      initialStatus: appState.get('voice').status,
      badgeText: badge ? badge.textContent.trim() : null,
      btnText: btnVoice ? btnVoice.textContent.trim() : null
    };
  });
  console.log('✓ Initial Voice UI:', voiceInitial);

  // Enable Voice via UI button click
  await page.evaluate(() => {
    document.getElementById('btn-toggle-voice').click();
  });
  await page.waitForTimeout(300);

  const voiceEnabledState = await page.evaluate(() => {
    const { appState, speechEngine } = window.teleprompterApp;
    const voiceState = appState.get('voice');
    const btnVoice = document.getElementById('btn-toggle-voice');
    const badge = document.getElementById('voice-status-badge');
    return {
      userEnabled: speechEngine.userEnabled,
      isListening: speechEngine.isListening,
      voiceStatus: voiceState.status,
      voiceEnabled: voiceState.enabled,
      badgeText: badge ? badge.textContent.trim() : null,
      btnText: btnVoice ? btnVoice.textContent.trim() : null
    };
  });
  console.log('✓ Voice Control Enabled:', voiceEnabledState);
  if (!voiceEnabledState.userEnabled) {
    throw new Error('speechEngine.userEnabled is not true after user toggle');
  }
  if (voiceEnabledState.voiceStatus !== 'listening') {
    throw new Error(`Expected voice status to be "listening", got: "${voiceEnabledState.voiceStatus}"`);
  }
  if (voiceEnabledState.badgeText !== 'LISTENING') {
    throw new Error(`Badge text should be LISTENING, got: "${voiceEnabledState.badgeText}"`);
  }
  if (voiceEnabledState.btnText !== 'Stop Voice Control') {
    throw new Error(`Button text should be "Stop Voice Control", got: "${voiceEnabledState.btnText}"`);
  }

  // -------------------------------------------------------------
  // BUG 2 - STEP 8: VOICE COMMAND SEQUENCE (PLAY -> PAUSE -> RESUME -> STOP -> PLAY)
  // -------------------------------------------------------------
  console.log('\n[9/13] Executing Voice Command Lifecycle Sequence: Play -> Pause -> Resume -> Stop -> Play...');

  // 1. Spoken: "Play"
  console.log('  -> Simulating Voice Command: "Play"');
  await page.evaluate(() => {
    window.teleprompterApp.speechEngine.processTranscript('play', true);
  });
  await page.waitForTimeout(400);

  const afterPlay = await page.evaluate(() => ({
    playbackState: window.teleprompterApp.appState.get('playbackState'),
    userEnabled: window.teleprompterApp.speechEngine.userEnabled,
    voiceStatus: window.teleprompterApp.appState.get('voice').status
  }));
  console.log('     State after "Play":', afterPlay);
  if (afterPlay.playbackState !== 'playing') throw new Error('Playback did not start on "play"');
  if (!afterPlay.userEnabled) throw new Error('Voice control was disabled after "play"!');

  // 2. Spoken: "Pause"
  console.log('  -> Simulating Voice Command: "Pause"');
  await page.evaluate(() => {
    window.teleprompterApp.speechEngine.processTranscript('pause', true);
  });
  await page.waitForTimeout(400);

  const afterPause = await page.evaluate(() => ({
    playbackState: window.teleprompterApp.appState.get('playbackState'),
    userEnabled: window.teleprompterApp.speechEngine.userEnabled,
    voiceStatus: window.teleprompterApp.appState.get('voice').status
  }));
  console.log('     State after "Pause":', afterPause);
  if (afterPause.playbackState !== 'paused') throw new Error('Playback did not pause on "pause"');
  if (!afterPause.userEnabled) throw new Error('Voice control was disabled after "pause"!');

  // 3. Spoken: "Resume"
  console.log('  -> Simulating Voice Command: "Resume"');
  await page.evaluate(() => {
    window.teleprompterApp.speechEngine.processTranscript('resume', true);
  });
  await page.waitForTimeout(400);

  const afterResume = await page.evaluate(() => ({
    playbackState: window.teleprompterApp.appState.get('playbackState'),
    userEnabled: window.teleprompterApp.speechEngine.userEnabled,
    voiceStatus: window.teleprompterApp.appState.get('voice').status
  }));
  console.log('     State after "Resume":', afterResume);
  if (afterResume.playbackState !== 'playing') throw new Error('Playback did not resume on "resume"');
  if (!afterResume.userEnabled) throw new Error('Voice control was disabled after "resume"!');

  // 4. Spoken: "Stop"
  console.log('  -> Simulating Voice Command: "Stop"');
  await page.evaluate(() => {
    window.teleprompterApp.speechEngine.processTranscript('stop', true);
  });
  await page.waitForTimeout(400);

  const afterStop = await page.evaluate(() => ({
    playbackState: window.teleprompterApp.appState.get('playbackState'),
    userEnabled: window.teleprompterApp.speechEngine.userEnabled,
    voiceStatus: window.teleprompterApp.appState.get('voice').status
  }));
  console.log('     State after "Stop":', afterStop);
  if (afterStop.playbackState !== 'stopped' && afterStop.playbackState !== 'idle') {
    throw new Error('Playback did not stop on "stop"');
  }
  if (!afterStop.userEnabled) throw new Error('Voice control was disabled after "stop"!');

  // 5. Spoken: "Play" again (verifying hands-free operation without re-opening settings)
  console.log('  -> Simulating Voice Command: "Play" again');
  await page.evaluate(() => {
    window.teleprompterApp.speechEngine.processTranscript('play', true);
  });
  await page.waitForTimeout(400);

  const afterSecondPlay = await page.evaluate(() => ({
    playbackState: window.teleprompterApp.appState.get('playbackState'),
    userEnabled: window.teleprompterApp.speechEngine.userEnabled,
    voiceStatus: window.teleprompterApp.appState.get('voice').status
  }));
  console.log('     State after second "Play":', afterSecondPlay);
  if (afterSecondPlay.playbackState !== 'playing' && afterSecondPlay.playbackState !== 'countdown') {
    throw new Error('Playback did not restart on second "play"');
  }
  if (!afterSecondPlay.userEnabled) throw new Error('Voice control was disabled after second "play"!');

  // Stop playback cleanly
  await page.evaluate(() => window.teleprompterApp.scrollEngine.pause());
  console.log('✓ PASS: Complete Voice Command Lifecycle sequence executed successfully without losing listening state!');

  // -------------------------------------------------------------
  // BUG 2 - STEP 9: SILENCE TIMEOUT & CONTINUOUS LISTENING
  // -------------------------------------------------------------
  console.log('\n[10/13] Testing Silence Timeout Behavior (Must NOT disable voice control)...');
  const silenceResult = await page.evaluate(async () => {
    const { appState, speechEngine } = window.teleprompterApp;
    // Put into following status as if words were being matched
    appState.update('voice', { status: 'following' });
    speechEngine.isListening = true;
    speechEngine.resetSilenceTimer();

    // Wait for silence timer (2500ms + margin)
    await new Promise(resolve => setTimeout(resolve, 2700));

    return {
      status: appState.get('voice').status,
      userEnabled: speechEngine.userEnabled,
      isListening: speechEngine.isListening
    };
  });
  console.log('✓ Silence Timeout State:', silenceResult);
  if (silenceResult.status !== 'listening') {
    throw new Error(`Expected status to transition to "listening" after silence, got: "${silenceResult.status}"`);
  }
  if (!silenceResult.userEnabled) {
    throw new Error('userEnabled was incorrectly cleared during silence timeout!');
  }
  console.log('✓ PASS: Silence timeout safely preserved voice listening session!');

  // -------------------------------------------------------------
  // BUG 2 - STEP 10: AUTO-RECOVERY ON RECOGNITION.ONEND
  // -------------------------------------------------------------
  console.log('\n[11/13] Testing recognition.onend Recovery & Debounced Restart...');
  const recoveryResult = await page.evaluate(async () => {
    const { appState, speechEngine } = window.teleprompterApp;
    let restarted = false;
    const origStart = speechEngine._startRecognition.bind(speechEngine);
    speechEngine._startRecognition = () => {
      restarted = true;
      origStart();
    };

    // Trigger onend while userEnabled is true
    speechEngine.recognition.onend();

    const immediateStatus = appState.get('voice').status;

    // Wait for debounced restart (min 200ms)
    await new Promise(resolve => setTimeout(resolve, 400));

    return {
      immediateStatus,
      restarted,
      userEnabled: speechEngine.userEnabled
    };
  });
  console.log('✓ Recovery on onend:', recoveryResult);
  if (recoveryResult.immediateStatus !== 'reconnecting') {
    throw new Error(`Expected immediate status "reconnecting", got: "${recoveryResult.immediateStatus}"`);
  }
  if (!recoveryResult.restarted) {
    throw new Error('Auto-restart was not scheduled/triggered on recoverable onend');
  }
  console.log('✓ PASS: Auto-restart on recognition.onend successfully recovered listening state!');

  // -------------------------------------------------------------
  // BUG 2 - STEP 11: MANUAL DISABLE & UNRECOVERABLE ERRORS
  // -------------------------------------------------------------
  console.log('\n[12/13] Testing Manual Disable & Permission Denied Error Handling...');
  
  // 1. Manual Disable
  await page.evaluate(() => {
    document.getElementById('btn-toggle-voice').click();
  });
  await page.waitForTimeout(300);

  const disabledState = await page.evaluate(() => {
    const { appState, speechEngine } = window.teleprompterApp;
    return {
      userEnabled: speechEngine.userEnabled,
      status: appState.get('voice').status,
      badgeText: document.getElementById('voice-status-badge').textContent.trim(),
      btnText: document.getElementById('btn-toggle-voice').textContent.trim()
    };
  });
  console.log('✓ Manual Disable State:', disabledState);
  if (disabledState.userEnabled || disabledState.status !== 'disabled') {
    throw new Error('Voice control failed to disable on manual toggle');
  }
  if (disabledState.btnText !== 'Enable Voice Following') {
    throw new Error('Button text did not revert to "Enable Voice Following"');
  }

  // 2. Permission Denied simulation
  const permissionState = await page.evaluate(() => {
    const { appState, speechEngine } = window.teleprompterApp;
    speechEngine.init();
    speechEngine.recognition.onerror({ error: 'not-allowed' });
    return {
      userEnabled: speechEngine.userEnabled,
      status: appState.get('voice').status,
      badgeText: document.getElementById('voice-status-badge').textContent.trim(),
      btnText: document.getElementById('btn-toggle-voice').textContent.trim()
    };
  });
  console.log('✓ Permission Denied State:', permissionState);
  if (permissionState.status !== 'permission-required') {
    throw new Error(`Expected status "permission-required", got: "${permissionState.status}"`);
  }
  if (permissionState.badgeText !== 'PERMISSION REQUIRED') {
    throw new Error(`Expected badge "PERMISSION REQUIRED", got: "${permissionState.badgeText}"`);
  }
  if (permissionState.btnText !== 'Grant Microphone Permission') {
    throw new Error(`Expected button "Grant Microphone Permission", got: "${permissionState.btnText}"`);
  }
  console.log('✓ PASS: Permission error cleanly handled without endless restart loops!');

  // -------------------------------------------------------------
  // STEP 12: CONCURRENCY — CAMERA + VOICE ACTIVE SIMULTANEOUSLY
  // -------------------------------------------------------------
  console.log('\n[13/13] Testing Concurrency: Camera and Voice Control Running Simultaneously...');
  const concurrentResult = await page.evaluate(async () => {
    const { cameraManager, speechEngine, appState } = window.teleprompterApp;
    
    // Start camera
    await cameraManager.startCamera();
    
    // Start voice control
    speechEngine.start();
    
    const camRunning = !!cameraManager.getStream();
    const voiceRunning = speechEngine.userEnabled && appState.get('voice').status === 'listening';
    
    // Test command while camera is active
    speechEngine.processTranscript('play', true);
    await new Promise(r => setTimeout(r, 900));
    const isPlayingWithCam = appState.get('playbackState') === 'playing' || appState.get('playbackState') === 'countdown';
    
    speechEngine.processTranscript('pause', true);
    await new Promise(r => setTimeout(r, 400));
    const isPausedWithCam = appState.get('playbackState') === 'paused';
    
    // Clean up
    await cameraManager.stopCamera();
    speechEngine.stop();
    
    return {
      camRunning,
      voiceRunning,
      isPlayingWithCam,
      isPausedWithCam
    };
  });
  console.log('✓ Concurrent Camera & Voice State:', concurrentResult);
  if (!concurrentResult.camRunning || !concurrentResult.voiceRunning || !concurrentResult.isPlayingWithCam || !concurrentResult.isPausedWithCam) {
    throw new Error('Concurrent Camera & Voice execution failed');
  }
  console.log('✓ PASS: Camera and Voice Control seamlessly operate together without stream collisions!');


  // -------------------------------------------------------------
  // STEP 14: MOBILE RESPONSIVE LAYOUT AUDIT
  // -------------------------------------------------------------
  console.log('\n[14/15] Verifying Mobile Viewport Layout (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileMetrics = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const header = document.querySelector('.studio-header') || document.querySelector('header');
    return {
      docWidth,
      winWidth,
      hasHorizontalOverflow: docWidth > winWidth,
      headerVisible: !!header
    };
  });
  console.log('✓ Mobile Metrics:', mobileMetrics);
  if (mobileMetrics.hasHorizontalOverflow) {
    throw new Error('Mobile viewport has horizontal scroll overflow!');
  }
  console.log('✓ PASS: Mobile responsive layout fits perfectly within 390px bounds!');

  // Restore viewport
  await page.setViewportSize({ width: 1280, height: 800 });

  // -------------------------------------------------------------
  // STEP 15: NETWORK AUDIT — ZERO BACKEND / LOCALHOST DEPENDENCIES
  // -------------------------------------------------------------
  console.log('\n[15/15] Verifying Zero Backend / Localhost:8080 Network Requests...');
  console.log('✓ Intercepted Backend Requests count:', backendRequests.length);
  if (backendRequests.length > 0) {
    throw new Error('Disallowed backend requests detected: ' + backendRequests.join(', '));
  }
  console.log('✓ PASS: 100% Static-First! Zero hardcoded backend/localhost dependencies.');

  await browser.close();

  console.log('\n================================================================');
  console.log('🎉 ALL INFINITYFREE V2 CAMERA OVERLAY & VOICE LIFECYCLE TESTS PASSED (15/15)!');
  console.log('================================================================');
}

runCameraOverlayAndVoiceTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

import { chromium } from 'playwright-core';

async function runSpeechLifecycleTest() {
  console.log('=== Starting Task 4: Web Speech API Lifecycle & Recovery Test ===');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  page.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('  [BROWSER ERROR]', err.message));

  await page.goto('http://localhost:3201/', { waitUntil: 'networkidle' });

  const testReport = await page.evaluate(async () => {
    const { speechEngine, appState, prompterRenderer } = window.teleprompterApp;

    const results = {
      isSupported: speechEngine.isSupported(),
      initialState: appState.get('voice').status,
      lifecycleSteps: []
    };

    // Initialize speech engine
    speechEngine.init();

    // 1. Prime words list in renderer
    const scriptWords = [
      'Welcome', 'to', 'the', 'evening', 'news', 'broadcast.',
      'Our', 'top', 'story', 'tonight', 'covers', 'breaking', 'developments.',
      'In', 'other', 'major', 'announcements,', 'financial', 'markets', 'rallied.'
    ];
    speechEngine.aligner.setScriptTokens(scriptWords);

    // 2. Test Alignment & Following on Spoken Transcript
    speechEngine.processTranscript('evening news broadcast', true);
    results.lifecycleSteps.push({
      step: 'speech_recognized',
      status: appState.get('voice').status,
      lastWordIndex: appState.get('voice').lastWordIndex,
      confidence: appState.get('voice').confidence
    });

    // 3. Test Skipped Sentence (Jumping from word 4 to word 18: "financial markets")
    speechEngine.processTranscript('financial markets rallied', true);
    results.lifecycleSteps.push({
      step: 'sentence_skipped_and_recovered',
      status: appState.get('voice').status,
      lastWordIndex: appState.get('voice').lastWordIndex,
      confidence: appState.get('voice').confidence
    });

    // 4. Test Silence Timeout Transition (2500ms timeout)
    speechEngine.isListening = true;
    speechEngine.resetSilenceTimer();
    await new Promise(resolve => setTimeout(resolve, 2700));
    results.lifecycleSteps.push({
      step: 'silence_timeout',
      status: appState.get('voice').status
    });

    // 5. Test Error Handling (permission denied / not-allowed error event)
    speechEngine.recognition.onerror({ error: 'not-allowed' });
    results.lifecycleSteps.push({
      step: 'error_not_allowed',
      status: appState.get('voice').status
    });

    // 6. Test Manual Recovery & Toggle
    speechEngine.stop();
    results.lifecycleSteps.push({
      step: 'manual_stop',
      status: appState.get('voice').status,
      isListening: speechEngine.isListening
    });

    // 7. Test Voice Commands handling
    appState.set('scrollSpeed', 5);
    appState.update('voice', { commandsEnabled: true });
    speechEngine.processTranscript('faster please', false);
    const speedAfterFaster = appState.get('scrollSpeed');

    speechEngine.processTranscript('slower', false);
    const speedAfterSlower = appState.get('scrollSpeed');

    results.lifecycleSteps.push({
      step: 'voice_commands',
      fasterSpeed: speedAfterFaster,
      slowerSpeed: speedAfterSlower
    });

    return results;
  });

  console.log('Speech Engine Lifecycle Results:');
  console.log(JSON.stringify(testReport, null, 2));

  await browser.close();

  // Validate critical lifecycle assertions:
  // Under the fixed lifecycle, silence timeout must keep listening (not pause/disable voice control!)
  const hasSpokenStep = testReport.lifecycleSteps.some(s => s.step === 'speech_recognized' && s.status === 'following');
  const hasSkippedStep = testReport.lifecycleSteps.some(s => s.step === 'sentence_skipped_and_recovered' && s.lastWordIndex > 15);
  const hasSilenceStep = testReport.lifecycleSteps.some(s => s.step === 'silence_timeout' && (s.status === 'listening' || s.status === 'following'));
  const hasErrorStep = testReport.lifecycleSteps.some(s => s.step === 'error_not_allowed' && (s.status === 'permission-required' || s.status === 'unsupported'));
  const hasManualRecovery = testReport.lifecycleSteps.some(s => s.step === 'manual_stop' && s.status === 'disabled');

  if (hasSpokenStep && hasSkippedStep && hasSilenceStep && hasErrorStep && hasManualRecovery) {
    console.log('>>> TASK 4: WEB SPEECH API LIFECYCLE & RECOVERY TEST PASSED! <<<');
    process.exit(0);
  } else {
    console.error('>>> TASK 4: SPEECH LIFECYCLE TEST FAILED ASSERTIONS! <<<');
    process.exit(1);
  }
}

runSpeechLifecycleTest().catch(err => {
  console.error('Speech lifecycle test failed:', err);
  process.exit(1);
});

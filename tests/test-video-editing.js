import { chromium } from 'playwright-core';

async function runVideoEditingTest() {
  console.log('--- Starting Genuine End-to-End Video Editing Pipeline Test ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  console.log('Page loaded. Creating synthetic video blob with audio track in browser context...');

  const result = await page.evaluate(async () => {
    // 1. Create a synthetic 3-second video with distinct visual frame pattern and audio oscillator
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    let frameCount = 0;
    const animId = setInterval(() => {
      frameCount++;
      ctx.fillStyle = (frameCount % 2 === 0) ? '#336699' : '#993366';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px sans-serif';
      ctx.fillText(`Frame ${frameCount}`, 50, 180);
    }, 33);

    const videoStream = canvas.captureStream(30);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // 440 Hz A tone
    const dest = audioCtx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();

    const audioTrack = dest.stream.getAudioTracks()[0];
    const sourceStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      audioTrack
    ]);

    const chunks = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    const rec = new MediaRecorder(sourceStream, { mimeType: mime });

    rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    const originalBlob = await new Promise(resolve => {
      rec.onstop = () => {
        clearInterval(animId);
        osc.stop();
        resolve(new Blob(chunks, { type: mime }));
      };
      rec.start();
      setTimeout(() => { rec.stop(); }, 3500); // Record for 3.5 seconds
    });

    // 2. Load into Teleprompter Studio videoEditor
    const videoEditorMod = await import('/src/modules/video-editor/videoEditor.js');
    const { videoEditor } = videoEditorMod;

    // Switch to creator mode so UI elements are active
    document.querySelector('.mode-tab-btn[data-mode="creator"]')?.click();

    const editorVideo = document.getElementById('editor-video-preview');
    const editorCanvas = document.getElementById('editor-canvas-helper');
    videoEditor.mount({ videoEl: editorVideo, canvasEl: editorCanvas });

    videoEditor.loadVideoBlob(originalBlob);

    // Wait for videoEditor duration to populate
    let attempts = 0;
    while ((!videoEditor.duration || videoEditor.duration <= 0) && attempts < 30) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    const initialDuration = videoEditor.duration;

    // 3. Apply Trim (0.5s to 2.5s -> 2.0s duration)
    videoEditor.setTrim(0.5, 2.5);

    // 4. Apply Brightness and Contrast filters
    videoEditor.setFilter('brightness', 130);
    videoEditor.setFilter('contrast', 120);

    // 5. Export Edited Video
    const exportedBlob = await videoEditor.exportEditedVideo();

    const testVideo = document.createElement('video');
    testVideo.preload = 'auto';
    testVideo.muted = true;
    testVideo.src = URL.createObjectURL(exportedBlob);

    await new Promise(resolve => {
      testVideo.addEventListener('loadeddata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });

    // Compute WebM duration in Chromium
    testVideo.currentTime = 1e101;
    await new Promise(r => setTimeout(r, 200));
    const finalReportedDuration = testVideo.duration;
    testVideo.currentTime = 0;

    let exportedAudioTracks = 0;
    let exportedVideoTracks = 0;
    try {
      if (typeof testVideo.captureStream === 'function') {
        const exportedStream = testVideo.captureStream();
        exportedAudioTracks = exportedStream.getAudioTracks().length;
        exportedVideoTracks = exportedStream.getVideoTracks().length;
      }
    } catch (e) {
      console.warn('captureStream check failed:', e);
    }

    return {
      originalSize: originalBlob.size,
      initialDuration: initialDuration,
      exportedSize: exportedBlob ? exportedBlob.size : 0,
      exportedType: exportedBlob ? exportedBlob.type : '',
      exportedDuration: finalReportedDuration,
      exportedAudioTracks: exportedAudioTracks,
      exportedVideoTracks: exportedVideoTracks,
      trimStart: videoEditor.trimStart,
      trimEnd: videoEditor.trimEnd,
      filtersApplied: videoEditor.filters
    };
  });

  console.log('Video Editing Test Results:', JSON.stringify(result, null, 2));

  await browser.close();
  return result;
}

runVideoEditingTest().then(res => {
  if (res.exportedSize > 1000 && res.exportedDuration > 0) {
    console.log('>>> VIDEO EDITING E2E TEST PASSED! <<<');
    process.exit(0);
  } else {
    console.error('>>> VIDEO EDITING E2E TEST FAILED! <<<');
    process.exit(1);
  }
}).catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

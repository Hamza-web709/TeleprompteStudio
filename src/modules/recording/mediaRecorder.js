import { cameraManager } from '../camera/cameraManager.js';
import { countdownManager } from '../scrolling/countdown.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { db } from '../storage/db.js';

/**
 * Determine the optimal recording format and codec.
 * On mobile/Android devices, VP9 MediaRecorder causes severe software encoding CPU lag
 * and frame drops. We prioritize hardware-accelerated H.264 (MP4) and VP8 (WebM).
 */
export function getOptimalRecordingFormat() {
  const isMobile = appState.get('isMobileDevice') || 
    (typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent));

  // Candidate codec lists ordered by hardware acceleration likelihood and low CPU overhead
  const mobileCandidates = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', desc: 'H.264 Baseline / AAC (Hardware MP4)', hw: true },
    { mimeType: 'video/mp4;codecs=avc1', desc: 'H.264 / AAC (Hardware MP4)', hw: true },
    { mimeType: 'video/mp4', desc: 'MP4 Video (Hardware Accelerated)', hw: true },
    { mimeType: 'video/webm;codecs=vp8,opus', desc: 'VP8 / Opus (Hardware WebM)', hw: true },
    { mimeType: 'video/webm;codecs=vp8', desc: 'VP8 (Hardware WebM)', hw: true },
    { mimeType: 'video/webm', desc: 'WebM Default', hw: false },
    { mimeType: 'video/webm;codecs=vp9,opus', desc: 'VP9 / Opus (Software CPU Fallback)', hw: false }
  ];

  const desktopCandidates = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', desc: 'H.264 Baseline / AAC (Hardware MP4)', hw: true },
    { mimeType: 'video/mp4;codecs=avc1', desc: 'H.264 / AAC (Hardware MP4)', hw: true },
    { mimeType: 'video/mp4', desc: 'MP4 Video (Hardware Accelerated)', hw: true },
    { mimeType: 'video/webm;codecs=vp9,opus', desc: 'VP9 / Opus (WebM High-Quality)', hw: true },
    { mimeType: 'video/webm;codecs=vp8,opus', desc: 'VP8 / Opus (WebM Standard)', hw: true },
    { mimeType: 'video/webm', desc: 'WebM Default', hw: false }
  ];

  const candidates = isMobile ? mobileCandidates : desktopCandidates;

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  // Generic fallback
  return { mimeType: '', desc: 'Browser Default Codec', hw: false };
}

/**
 * Calculate recommended bitrates based on resolution
 */
export function getTargetBitrates(resolution = '720p') {
  switch (resolution) {
    case '4k':
      return { videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 128_000 };
    case '1080p':
      return { videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 };
    case '720p':
    default:
      return { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 };
  }
}

class StudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = 0;
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.compositeCanvas = null;
    this.compositeCtx = null;
    this.compositeRafId = null;
    this.compositeVideoEl = null;
    this.activeRecordingFormat = null;
    this.activeBitrates = null;
  }

  getSupportedMimeType() {
    return getOptimalRecordingFormat().mimeType;
  }

  getActiveFormatDetails() {
    return {
      format: this.activeRecordingFormat || getOptimalRecordingFormat(),
      bitrates: this.activeBitrates || getTargetBitrates(appState.get('media')?.resolution || '720p'),
      elapsedSeconds: this.elapsedSeconds,
      isRecording: appState.get('recordingState') === 'recording'
    };
  }

  async startRecording() {
    if (appState.get('recordingState') === 'recording') return;

    // Ensure camera is active
    let stream = cameraManager.getStream();
    if (!stream) {
      try {
        stream = await cameraManager.startCamera();
      } catch (err) {
        eventBus.emit('ui:toast', { type: 'error', message: err.message });
        return;
      }
    }

    // Recording Countdown
    const countdownSecs = appState.get('countdownDuration') || 0;
    if (countdownSecs > 0) {
      appState.set('recordingState', 'countdown');
      await countdownManager.start(countdownSecs);
    }

    const formatInfo = getOptimalRecordingFormat();
    this.activeRecordingFormat = formatInfo;
    const mediaSettings = appState.get('media') || {};
    const bitrates = getTargetBitrates(mediaSettings.resolution || '720p');
    this.activeBitrates = bitrates;

    this.recordedChunks = [];
    let recordStream = stream;

    // Check Clean vs Composite Recording
    // Clean recording directly records hardware MediaStream without Canvas overhead
    const isCleanRecord = mediaSettings.cleanRecord !== false;
    if (!isCleanRecord) {
      recordStream = this.createCompositeStream(stream);
    }

    try {
      const options = {
        videoBitsPerSecond: bitrates.videoBitsPerSecond,
        audioBitsPerSecond: bitrates.audioBitsPerSecond
      };
      if (formatInfo.mimeType) {
        options.mimeType = formatInfo.mimeType;
      }

      this.mediaRecorder = new MediaRecorder(recordStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          eventBus.emit('recording:chunk-received', {
            chunkSize: event.data.size,
            totalChunks: this.recordedChunks.length
          });
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.stopCompositeLoop();
        const mime = this.mediaRecorder.mimeType || formatInfo.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mime });
        this.recordedChunks = [];

        const activeScript = appState.get('activeScript');
        const recordingItem = {
          id: `rec-${Date.now()}`,
          scriptId: activeScript?.id || 'none',
          scriptTitle: activeScript?.title || 'Recording',
          blob,
          mimeType: mime,
          duration: this.elapsedSeconds,
          size: blob.size,
          createdAt: Date.now()
        };

        // Save metadata to IndexedDB
        await db.put('recordings', {
          id: recordingItem.id,
          scriptId: recordingItem.scriptId,
          scriptTitle: recordingItem.scriptTitle,
          mimeType: recordingItem.mimeType,
          duration: recordingItem.duration,
          size: recordingItem.size,
          createdAt: recordingItem.createdAt
        });

        appState.set('recordingState', 'inactive');
        eventBus.emit('recording:completed', recordingItem);
      };

      this.mediaRecorder.start(1000); // chunk every second
      appState.set('recordingState', 'recording');
      this.recordingStartTime = Date.now();
      this.elapsedSeconds = 0;
      this.startTimer();
      eventBus.emit('recording:started', {
        mimeType: this.mediaRecorder.mimeType || formatInfo.mimeType,
        bitrates,
        cleanRecord: isCleanRecord
      });
    } catch (err) {
      console.error('[StudioRecorder] Failed to start MediaRecorder:', err);
      appState.set('recordingState', 'inactive');
      eventBus.emit('ui:toast', { type: 'error', message: 'Could not initialize video recorder: ' + err.message });
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.stopTimer();
    }
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.stopTimer();
      appState.set('recordingState', 'paused');
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.startTimer();
      appState.set('recordingState', 'recording');
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      appState.set('recordingTime', this.elapsedSeconds);
      eventBus.emit('recording:timer-tick', this.elapsedSeconds);
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  createCompositeStream(cameraStream) {
    const videoTrack = cameraStream.getVideoTracks()[0];
    const trackSettings = videoTrack?.getSettings?.() || {};
    const width = trackSettings.width || 1280;
    const height = trackSettings.height || 720;

    if (!this.compositeCanvas) {
      this.compositeCanvas = document.createElement('canvas');
    }
    this.compositeCanvas.width = width;
    this.compositeCanvas.height = height;
    this.compositeCtx = this.compositeCanvas.getContext('2d');

    const audioTracks = cameraStream.getAudioTracks();

    const tempVideo = document.createElement('video');
    tempVideo.playsInline = true;
    tempVideo.muted = true;
    tempVideo.srcObject = new MediaStream([videoTrack]);
    tempVideo.play().catch(e => console.warn('[StudioRecorder] tempVideo play warning:', e));
    this.compositeVideoEl = tempVideo;

    const prompterTextContainer = document.getElementById('prompter-text-container');

    const drawFrame = () => {
      if (!this.compositeCtx || !this.compositeVideoEl) return;
      this.compositeCtx.drawImage(this.compositeVideoEl, 0, 0, width, height);

      // Render text overlay onto canvas only if composite enabled
      if (prompterTextContainer) {
        const fontSize = Math.max(24, Math.round(width * 0.035));
        this.compositeCtx.font = `bold ${fontSize}px sans-serif`;
        this.compositeCtx.fillStyle = '#ffffff';
        this.compositeCtx.textAlign = 'center';
        this.compositeCtx.shadowColor = 'rgba(0,0,0,0.85)';
        this.compositeCtx.shadowBlur = 6;
        const textSnippet = prompterTextContainer.innerText.slice(0, 80);
        this.compositeCtx.fillText(textSnippet, width / 2, height - (fontSize * 1.5));
      }

      this.compositeRafId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    const canvasStream = this.compositeCanvas.captureStream(30);
    audioTracks.forEach(track => canvasStream.addTrack(track));
    return canvasStream;
  }

  stopCompositeLoop() {
    if (this.compositeRafId) {
      cancelAnimationFrame(this.compositeRafId);
      this.compositeRafId = null;
    }
    if (this.compositeVideoEl) {
      this.compositeVideoEl.pause();
      this.compositeVideoEl.srcObject = null;
      this.compositeVideoEl = null;
    }
  }
}

export const studioRecorder = new StudioRecorder();


import { eventBus } from '../../state/eventBus.js';
import { getOptimalRecordingFormat } from '../recording/mediaRecorder.js';

class VideoEditor {
  constructor() {
    this.videoEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this.currentBlob = null;
    this.trimStart = 0;
    this.trimEnd = 0;
    this.duration = 0;
    this.filters = {
      brightness: 100,
      contrast: 100,
      saturation: 100
    };
    this.aspectRatio = '16:9';
    this.isExporting = false;
  }

  mount({ videoEl, canvasEl }) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d');
    }
  }

  loadVideoBlob(blob) {
    if (!blob) return;
    this.currentBlob = blob;
    if (!this.videoEl) return;

    const url = URL.createObjectURL(blob);
    this.videoEl.src = url;

    this.videoEl.onloadedmetadata = () => {
      this.duration = this.videoEl.duration || 0;
      this.trimStart = 0;
      this.trimEnd = this.duration;
      eventBus.emit('editor:video-loaded', {
        duration: this.duration,
        blob: this.currentBlob
      });
    };

    this.videoEl.ontimeupdate = () => {
      if (this.videoEl.currentTime > this.trimEnd) {
        this.videoEl.currentTime = this.trimStart;
      }
      eventBus.emit('editor:time-updated', {
        currentTime: this.videoEl.currentTime,
        duration: this.duration
      });
    };
  }

  hasVideo() {
    return Boolean(this.currentBlob);
  }

  setTrim(startSec, endSec) {
    this.trimStart = Math.max(0, startSec);
    this.trimEnd = Math.min(this.duration, Math.max(this.trimStart + 0.1, endSec));
    if (this.videoEl) {
      this.videoEl.currentTime = this.trimStart;
    }
    eventBus.emit('editor:trim-changed', {
      trimStart: this.trimStart,
      trimEnd: this.trimEnd
    });
  }

  setFilter(key, value) {
    if (this.filters[key] !== undefined) {
      this.filters[key] = value;
      this.applyFilterStyle();
    }
  }

  applyFilterStyle() {
    if (!this.videoEl) return;
    const { brightness, contrast, saturation } = this.filters;
    this.videoEl.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  }

  setPlaybackSpeed(speed = 1.0) {
    if (this.videoEl) {
      this.videoEl.playbackRate = speed;
    }
  }

  extractThumbnail() {
    if (!this.videoEl || !this.canvasEl || !this.ctx) return null;

    this.canvasEl.width = this.videoEl.videoWidth || 1280;
    this.canvasEl.height = this.videoEl.videoHeight || 720;
    const { brightness, contrast, saturation } = this.filters;
    this.ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    this.ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);

    return this.canvasEl.toDataURL('image/jpeg', 0.9);
  }

  downloadThumbnail() {
    const dataUrl = this.extractThumbnail();
    if (!dataUrl) {
      eventBus.emit('ui:toast', { type: 'warn', message: 'No video loaded to extract thumbnail.' });
      return;
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `thumbnail-${Date.now()}.jpg`;
    a.click();
  }

  async exportEditedVideo() {
    if (!this.videoEl || !this.canvasEl || !this.ctx || !this.currentBlob) {
      eventBus.emit('ui:toast', { type: 'warn', message: 'No video loaded to export.' });
      return null;
    }

    if (this.isExporting) return null;
    this.isExporting = true;
    eventBus.emit('ui:toast', { type: 'info', message: 'Rendering edited video...' });

    const w = this.videoEl.videoWidth || 1280;
    const h = this.videoEl.videoHeight || 720;
    this.canvasEl.width = w;
    this.canvasEl.height = h;

    const stream = this.canvasEl.captureStream(30);

    // Capture and attach audio track from source video if available
    try {
      if (typeof this.videoEl.captureStream === 'function') {
        const sourceStream = this.videoEl.captureStream();
        const audioTracks = sourceStream.getAudioTracks();
        if (audioTracks && audioTracks.length > 0) {
          audioTracks.forEach(t => stream.addTrack(t));
        }
      } else if (typeof this.videoEl.mozCaptureStream === 'function') {
        const sourceStream = this.videoEl.mozCaptureStream();
        const audioTracks = sourceStream.getAudioTracks();
        if (audioTracks && audioTracks.length > 0) {
          audioTracks.forEach(t => stream.addTrack(t));
        }
      }
    } catch (err) {
      console.warn('[VideoEditor] Could not attach audio track:', err);
    }

    // Ensure video is seeked to trimStart before recording begins
    if (Math.abs(this.videoEl.currentTime - this.trimStart) > 0.05) {
      await new Promise(resolve => {
        const onSeeked = () => {
          this.videoEl.removeEventListener('seeked', onSeeked);
          resolve();
        };
        this.videoEl.addEventListener('seeked', onSeeked);
        this.videoEl.currentTime = this.trimStart;
        setTimeout(resolve, 600);
      });
    }

    const optimalFormat = getOptimalRecordingFormat();
    const mime = optimalFormat.mimeType || (MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm');

    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    return new Promise(async (resolve) => {
      recorder.onstop = () => {
        const editedBlob = new Blob(chunks, { type: mime });
        this.isExporting = false;

        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(editedBlob);
          a.download = `edited-video-${Date.now()}.webm`;
          a.click();
        }

        eventBus.emit('ui:toast', { type: 'success', message: 'Edited video exported!' });
        resolve(editedBlob);
      };

      recorder.start(100);

      try {
        await this.videoEl.play();
      } catch (err) {
        console.warn('[VideoEditor] Play failed, retrying muted:', err);
        this.videoEl.muted = true;
        try {
          await this.videoEl.play();
        } catch (e2) {}
      }

      const { brightness, contrast, saturation } = this.filters;
      const filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

      let hasStarted = false;
      const startTime = performance.now();
      const maxDurationMs = ((this.trimEnd - this.trimStart) + 1.5) * 1000;

      const drawLoop = () => {
        if (!this.isExporting) return;
        this.ctx.filter = filterStr;
        this.ctx.drawImage(this.videoEl, 0, 0, w, h);

        if (this.videoEl.currentTime > this.trimStart + 0.05) {
          hasStarted = true;
        }

        const elapsedMs = performance.now() - startTime;
        const reachedEnd = (hasStarted && (this.videoEl.currentTime >= this.trimEnd || this.videoEl.ended)) || elapsedMs >= maxDurationMs;

        if (reachedEnd) {
          this.videoEl.pause();
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        } else {
          requestAnimationFrame(drawLoop);
        }
      };

      requestAnimationFrame(drawLoop);
    });
  }
}

export const videoEditor = new VideoEditor();

import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { countdownManager } from './countdown.js';

class ScrollEngine {
  constructor() {
    this.viewportEl = null;
    this.rafId = null;
    this.lastTimestamp = 0;
    this.currentScrollPos = 0;
    this.isPlaying = false;
    this.wakeLock = null;
    this.elapsedPlayTime = 0; // seconds
    this.elapsedTimer = null;
    this.cachedMaxScroll = 0;
    this.cachedScrollHeight = 0;
    this.cachedClientHeight = 0;
    this._needsRecalc = true;
  }

  mount(viewportElement) {
    this.viewportEl = viewportElement;

    // Listen to manual scrolling to keep position synchronized
    this.viewportEl.addEventListener('scroll', () => {
      if (!this.isPlaying) {
        this.currentScrollPos = this.viewportEl.scrollTop;
        this.updateProgress();
      }
    }, { passive: true });

    // Handle tab visibility changes to prevent huge frame delta skips
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.lastTimestamp = 0;
      } else {
        this.lastTimestamp = performance.now();
      }
    });

    // Invalidate cached dimensions on resize, typography changes, or content updates
    const invalidate = () => {
      this._needsRecalc = true;
      if (!this.isPlaying) {
        this.recalculateDimensions();
      }
    };

    window.addEventListener('resize', invalidate, { passive: true });
    eventBus.on('prompter:rendered', invalidate);
    eventBus.on('state:typography', invalidate);
    eventBus.on('script:selected', invalidate);
  }

  recalculateDimensions() {
    if (!this.viewportEl) return 0;
    this.cachedScrollHeight = this.viewportEl.scrollHeight;
    this.cachedClientHeight = this.viewportEl.clientHeight;
    this.cachedMaxScroll = Math.max(0, this.cachedScrollHeight - this.cachedClientHeight);
    this._needsRecalc = false;
    return this.cachedMaxScroll;
  }

  getMaxScroll() {
    if (this._needsRecalc || this.cachedMaxScroll === 0) {
      return this.recalculateDimensions();
    }
    return this.cachedMaxScroll;
  }

  async play() {
    const currentState = appState.get('playbackState');
    if (currentState === 'playing' || currentState === 'countdown') return;

    const countdownSecs = appState.get('countdownDuration') || 0;
    if (countdownSecs > 0 && currentState !== 'paused') {
      appState.set('playbackState', 'countdown');
      await countdownManager.start(countdownSecs);
    }

    this.recalculateDimensions();
    this.isPlaying = true;
    appState.set('playbackState', 'playing');
    this.lastTimestamp = performance.now();
    this.requestWakeLock();
    this.startElapsedTimer();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
    eventBus.emit('playback:started');
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stopElapsedTimer();
    this.releaseWakeLock();
    appState.set('playbackState', 'paused');
    eventBus.emit('playback:paused');
  }

  stop() {
    this.pause();
    this.currentScrollPos = 0;
    if (this.viewportEl) {
      this.viewportEl.scrollTop = 0;
    }
    this.elapsedPlayTime = 0;
    appState.set('playbackState', 'stopped');
    this.updateProgress(true);
    eventBus.emit('playback:stopped');
  }

  restart() {
    this.stop();
    this.play();
  }

  togglePlayPause() {
    const state = appState.get('playbackState');
    if (state === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  loop(timestamp) {
    if (!this.isPlaying || !this.viewportEl) return;

    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Guard against huge jumps after browser stalls
    const deltaSec = Math.min(deltaMs / 1000, 0.1);

    // Calculate velocity (pixels per second)
    const pixelsPerSec = this.calculateSpeedPixelsPerSec();
    const isReversed = appState.get('isReversed');
    const direction = isReversed ? -1 : 1;

    this.currentScrollPos += pixelsPerSec * deltaSec * direction;

    const maxScroll = this.getMaxScroll();

    // Boundary checks
    if (this.currentScrollPos >= maxScroll) {
      this.currentScrollPos = maxScroll;
      this.viewportEl.scrollTop = maxScroll;
      this.updateProgress(true);

      if (appState.get('isLooping')) {
        this.currentScrollPos = 0;
        this.viewportEl.scrollTop = 0;
      } else {
        this.pause();
        appState.set('playbackState', 'stopped');
        eventBus.emit('playback:ended');
        return;
      }
    } else if (this.currentScrollPos < 0) {
      this.currentScrollPos = 0;
      this.viewportEl.scrollTop = 0;
    } else {
      this.viewportEl.scrollTop = this.currentScrollPos;
      this.updateProgress();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  calculateSpeedPixelsPerSec() {
    const mode = appState.get('scrollMode');
    const speedSetting = appState.get('scrollSpeed') || 3; // 1 to 20

    if (mode === 'wpm') {
      const targetWpm = appState.get('targetWPM') || 130;
      // Convert WPM to pixels/sec based on average text dimensions
      return (targetWpm / 60) * (appState.get('typography').fontSize * 0.8);
    }

    // Continuous mode: exponential/linear curve from ~15px/s to 320px/s
    return speedSetting * 16;
  }

  jumpSeconds(seconds = 5) {
    if (!this.viewportEl) return;
    const pixels = this.calculateSpeedPixelsPerSec() * seconds;
    this.currentScrollPos = Math.max(0, this.currentScrollPos + pixels);
    this.viewportEl.scrollTop = this.currentScrollPos;
    this.updateProgress(true);
  }

  jumpToProgress(percentage = 0) {
    if (!this.viewportEl) return;
    const maxScroll = this.getMaxScroll();
    this.currentScrollPos = maxScroll * (percentage / 100);
    this.viewportEl.scrollTop = this.currentScrollPos;
    this.updateProgress(true);
  }

  jumpToOffset(offsetTop) {
    if (!this.viewportEl) return;
    const focusLineRatio = (appState.get('focus').linePosition || 40) / 100;
    const clientH = this.cachedClientHeight || (this.viewportEl ? this.viewportEl.clientHeight : 600);
    const targetScroll = offsetTop - (clientH * focusLineRatio);
    this.currentScrollPos = Math.max(0, targetScroll);
    this.viewportEl.scrollTop = this.currentScrollPos;
    this.updateProgress(true);
  }

  updateProgress(force = false) {
    if (!this.viewportEl) return;
    const now = performance.now();
    if (!force && this._lastProgressEmit && (now - this._lastProgressEmit < 50)) {
      return;
    }
    this._lastProgressEmit = now;
    const maxScroll = Math.max(1, this.getMaxScroll());
    const progress = Math.min(1, Math.max(0, this.currentScrollPos / maxScroll));
    appState.set('scrollProgress', progress);
    eventBus.emit('scroll:progress', {
      progress,
      scrollTop: this.currentScrollPos,
      maxScroll,
      elapsedTime: this.elapsedPlayTime
    });
  }

  startElapsedTimer() {
    clearInterval(this.elapsedTimer);
    this.elapsedTimer = setInterval(() => {
      if (this.isPlaying) {
        this.elapsedPlayTime += 1;
        this.updateProgress();
      }
    }, 1000);
  }

  stopElapsedTimer() {
    clearInterval(this.elapsedTimer);
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Ignore wakeLock failures
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch {
        // Ignore
      }
    }
  }
}

export const scrollEngine = new ScrollEngine();

import { eventBus } from '../../state/eventBus.js';

class CountdownManager {
  constructor() {
    this.overlayEl = null;
    this.digitsEl = null;
    this.audioCtx = null;
    this.intervalId = null;
  }

  mount(overlayElement, digitsElement) {
    this.overlayEl = overlayElement;
    this.digitsEl = digitsElement;
  }

  playBeep(frequency = 880, duration = 0.1) {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      }
    } catch {
      // Audio cue fallback if not permitted
    }
  }

  start(seconds = 3) {
    return new Promise((resolve) => {
      if (seconds <= 0) {
        resolve();
        return;
      }

      if (!this.overlayEl || !this.digitsEl) {
        resolve();
        return;
      }

      this.overlayEl.style.display = 'flex';
      let remaining = seconds;
      this.digitsEl.textContent = remaining;
      this.playBeep(880, 0.15);

      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          this.digitsEl.textContent = remaining;
          this.playBeep(880, 0.15);
        } else if (remaining === 0) {
          this.digitsEl.textContent = 'GO!';
          this.playBeep(1760, 0.25);
        } else {
          clearInterval(this.intervalId);
          this.overlayEl.style.display = 'none';
          resolve();
        }
      }, 1000);
    });
  }

  cancel() {
    clearInterval(this.intervalId);
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
  }
}

export const countdownManager = new CountdownManager();

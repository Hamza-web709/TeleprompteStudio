import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.gainNode = null;
    this.rafVuId = null;
    this.stream = null;
    this.availableMics = [];
  }

  async listMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableMics = devices.filter(d => d.kind === 'audioinput');
      return this.availableMics;
    } catch {
      return [];
    }
  }

  async setupAudioStream(audioTrack) {
    if (!audioTrack) return;
    this.audioTrack = audioTrack;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.stream = new MediaStream([audioTrack]);
      if (this.source) {
        this.source.disconnect();
      }

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();

      this.analyser.fftSize = 256;
      this.gainNode.gain.value = appState.get('media').audioGain || 1.0;

      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      if (appState.get('media')?.micMonitoringEnabled) {
        this.startVuMonitor();
      }
    } catch (err) {
      console.warn('[AudioManager] Web Audio setup warning:', err);
    }
  }

  enableMonitoring() {
    appState.update('media', { micMonitoringEnabled: true });
    if (this.analyser) {
      this.startVuMonitor();
    } else if (this.audioTrack) {
      this.setupAudioStream(this.audioTrack);
    }
  }

  disableMonitoring() {
    appState.update('media', { micMonitoringEnabled: false, vuLevel: 0 });
    this.stopVuMonitor();
    eventBus.emit('audio:vu-meter', 0);
  }

  startVuMonitor() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let lastUpdateTime = 0;
    let lastLevel = -1;

    const checkLevel = (timestamp) => {
      if (!this.analyser) return;

      // Throttle calculations to ~20Hz (every 50ms) to conserve CPU during recording/scrolling
      if (!timestamp || (timestamp - lastUpdateTime) >= 50) {
        lastUpdateTime = timestamp || performance.now();

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const level = Math.min(100, Math.round((average / 128) * 100));

        if (Math.abs(level - lastLevel) >= 2 || (level === 0 && lastLevel !== 0)) {
          lastLevel = level;
          appState.update('media', { vuLevel: level });
          eventBus.emit('audio:vu-meter', level);
        }
      }

      this.rafVuId = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }

  stopVuMonitor() {
    if (this.rafVuId) {
      cancelAnimationFrame(this.rafVuId);
      this.rafVuId = null;
    }
  }

  setGain(value) {
    const gainVal = Math.max(0, Math.min(2.0, parseFloat(value) || 1.0));
    appState.update('media', { audioGain: gainVal });
    if (this.gainNode) {
      this.gainNode.gain.value = gainVal;
    }
  }

  cleanup() {
    this.stopVuMonitor();
    if (this.source) this.source.disconnect();
    if (this.gainNode) this.gainNode.disconnect();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioManager = new AudioManager();

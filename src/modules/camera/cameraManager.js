import { appState, isMobileDevice } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { audioManager } from './audioManager.js';

export const CAMERA_PRESETS = {
  'auto': { key: 'auto', label: 'Automatic (Capability-Aware)' },
  '480p': { key: '480p', width: 640, height: 480, fps: 30, minFps: 24, label: 'Performance (640x480 @ 30 FPS)' },
  '720p': { key: '720p', width: 1280, height: 720, fps: 30, minFps: 24, label: 'Balanced Mobile (1280x720 @ 30 FPS)' },
  '1080p': { key: '1080p', width: 1920, height: 1080, fps: 30, minFps: 24, label: 'High Quality (1920x1080 @ 30 FPS)' },
  '4k': { key: '4k', width: 3840, height: 2160, fps: 30, minFps: 24, label: '4K Ultra HD (3840x2160)' }
};

/**
 * Resolve resolution key into dimension constraints
 */
export function resolveResolutionPreset(presetKey = '720p') {
  if (presetKey === 'auto') {
    if (isMobileDevice) {
      // Conservative on constrained mobile devices
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
      const mem = typeof navigator !== 'undefined' ? navigator.deviceMemory || 4 : 4;
      if (cores <= 4 || mem <= 3) {
        return CAMERA_PRESETS['480p'];
      }
      return CAMERA_PRESETS['720p'];
    }
    return CAMERA_PRESETS['1080p'];
  }

  return CAMERA_PRESETS[presetKey] || CAMERA_PRESETS['720p'];
}

class CameraManager {
  constructor() {
    this.videoEl = null;
    this.containerEl = null;
    this.stream = null;
    this.availableCameras = [];
    this.lastInitDurationMs = 0;
    this.activeSettings = null;
    this.isStarting = false;
  }

  mount({ videoEl, containerEl }) {
    this.videoEl = videoEl;
    this.containerEl = containerEl;
    if (this.videoEl) {
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.autoplay = true;
    }
  }

  async listCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices.filter(d => d.kind === 'videoinput');
      return this.availableCameras;
    } catch {
      return [];
    }
  }

  async startCamera() {
    if (this.isStarting) return this.stream;
    this.isStarting = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isStarting = false;
      throw new Error('Camera access is not supported by this browser.');
    }

    const initStartTime = performance.now();
    const mediaSettings = appState.get('media') || {};
    const preset = resolveResolutionPreset(mediaSettings.resolution || (isMobileDevice ? '720p' : '1080p'));

    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

    // Apply orientation-aware dimension targets
    const targetWidth = isPortrait ? preset.height : preset.width;
    const targetHeight = isPortrait ? preset.width : preset.height;

    const videoConstraints = {
      width: { ideal: targetWidth },
      height: { ideal: targetHeight },
      frameRate: { ideal: preset.fps || 30, max: 30 }
    };

    if (isPortrait) {
      videoConstraints.aspectRatio = { ideal: 9 / 16 };
    } else {
      videoConstraints.aspectRatio = { ideal: 16 / 9 };
    }

    // Specific device or front/back facingMode
    if (mediaSettings.cameraDeviceId) {
      videoConstraints.deviceId = { ideal: mediaSettings.cameraDeviceId };
    } else {
      videoConstraints.facingMode = { ideal: mediaSettings.facingMode || 'user' };
    }

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    if (mediaSettings.micDeviceId) {
      audioConstraints.deviceId = { ideal: mediaSettings.micDeviceId };
    }

    try {
      this.stopCamera();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints
      });

      if (!this.videoEl && typeof document !== 'undefined') {
        this.videoEl = document.getElementById('camera-preview-video');
        this.containerEl = document.getElementById('camera-preview-container');
      }

      if (this.videoEl) {
        this.videoEl.srcObject = this.stream;
        this.videoEl.muted = true;
        this.videoEl.playsInline = true;
        await this.videoEl.play();
      }

      if (this.containerEl) {
        this.containerEl.style.display = 'block';
      }

      if (typeof document !== 'undefined') {
        document.body.classList.add('camera-active');
        document.body.setAttribute('data-camera-active', 'true');
        const prompterFrame = document.getElementById('prompter-frame');
        if (prompterFrame) prompterFrame.classList.add('camera-active');
      }

      const videoTrack = this.stream.getVideoTracks()[0];
      this.activeSettings = videoTrack && typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : null;
      this.lastInitDurationMs = Math.round(performance.now() - initStartTime);

      appState.update('media', {
        cameraEnabled: true,
        micEnabled: true,
        facingMode: mediaSettings.facingMode || this.activeSettings?.facingMode || 'user'
      });

      // Connect audio to VU meter ONLY if mic monitoring is explicitly active
      const audioTrack = this.stream.getAudioTracks()[0];
      if (audioTrack && mediaSettings.micMonitoringEnabled) {
        audioManager.setupAudioStream(audioTrack);
      }

      // Schedule background device enumeration without blocking preview start
      this.listCameras().catch(() => {});
      audioManager.listMicrophones().catch(() => {});

      eventBus.emit('camera:started', {
        stream: this.stream,
        settings: this.activeSettings,
        initDurationMs: this.lastInitDurationMs,
        preset
      });

      this.isStarting = false;
      return this.stream;
    } catch (err) {
      this.isStarting = false;
      console.error('[CameraManager] Failed to access camera/mic:', err);
      let errorMsg = 'Could not access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera/Microphone permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera or microphone device was found.';
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Camera is in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback to minimal unconstrained stream if preset is not supported
        console.warn('[CameraManager] OverconstrainedError, falling back to default constraints...');
        return await this.startFallbackCamera();
      }
      eventBus.emit('camera:error', errorMsg);
      throw new Error(errorMsg);
    }
  }

  async startFallbackCamera() {
    try {
      if (!this.videoEl && typeof document !== 'undefined') {
        this.videoEl = document.getElementById('camera-preview-video');
        this.containerEl = document.getElementById('camera-preview-container');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      if (this.videoEl) {
        this.videoEl.srcObject = this.stream;
        this.videoEl.muted = true;
        this.videoEl.playsInline = true;
        await this.videoEl.play();
      }
      if (this.containerEl) {
        this.containerEl.style.display = 'block';
      }
      if (typeof document !== 'undefined') {
        document.body.classList.add('camera-active');
        document.body.setAttribute('data-camera-active', 'true');
        const prompterFrame = document.getElementById('prompter-frame');
        if (prompterFrame) prompterFrame.classList.add('camera-active');
      }
      const videoTrack = this.stream.getVideoTracks()[0];
      this.activeSettings = videoTrack && typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : null;
      appState.update('media', { cameraEnabled: true, micEnabled: true });
      eventBus.emit('camera:started', { stream: this.stream, settings: this.activeSettings });
      this.isStarting = false;
      return this.stream;
    } catch (err) {
      this.isStarting = false;
      throw new Error('Fallback camera access failed: ' + err.message);
    }
  }

  stopCamera() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('camera-active');
      document.body.removeAttribute('data-camera-active');
      const prompterFrame = document.getElementById('prompter-frame');
      if (prompterFrame) prompterFrame.classList.remove('camera-active');
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      this.stream = null;
    }

    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }

    if (this.containerEl) {
      this.containerEl.style.display = 'none';
    }

    audioManager.stopVuMonitor();
    this.activeSettings = null;
    appState.update('media', { cameraEnabled: false, micEnabled: false });
    eventBus.emit('camera:stopped');
  }

  toggleCamera() {
    if (appState.get('media')?.cameraEnabled) {
      this.stopCamera();
    } else {
      return this.startCamera();
    }
  }

  async toggleFacingMode() {
    const current = appState.get('media')?.facingMode || 'user';
    const nextFacing = current === 'user' ? 'environment' : 'user';
    appState.update('media', { facingMode: nextFacing, cameraDeviceId: '' });
    eventBus.emit('camera:facing-changed', nextFacing);

    if (appState.get('media')?.cameraEnabled) {
      return this.startCamera();
    }
  }

  async setCameraDevice(deviceId) {
    appState.update('media', { cameraDeviceId: deviceId });
    if (appState.get('media')?.cameraEnabled) {
      return this.startCamera();
    }
  }

  async setResolution(resKey) {
    appState.update('media', { resolution: resKey });
    if (appState.get('media')?.cameraEnabled) {
      return this.startCamera();
    }
  }

  getStream() {
    return this.stream;
  }

  getVideoTrackSettings() {
    if (!this.stream) return null;
    const videoTrack = this.stream.getVideoTracks()[0];
    return videoTrack && typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : null;
  }

  getVideoElement() {
    if (!this.videoEl && typeof document !== 'undefined') {
      this.videoEl = document.getElementById('camera-preview-video');
    }
    return this.videoEl;
  }

  getLastInitDuration() {
    return this.lastInitDurationMs;
  }
}

export const cameraManager = new CameraManager();

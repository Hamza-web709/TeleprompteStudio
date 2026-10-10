import { eventBus } from './eventBus.js';

export const isMobileDevice = typeof navigator !== 'undefined' && 
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

export function getDefaultResolution(isMobile = isMobileDevice) {
  return isMobile ? '720p' : '1080p';
}

/**
 * AppState - Centralized Application State Management
 */
class AppState {
  constructor() {
    this.state = {
      // Mode: 'prompter' | 'editor' | 'rehearsal' | 'creator'
      activeMode: 'prompter',

      // Playback Engine State
      playbackState: 'idle', // 'idle' | 'ready' | 'countdown' | 'playing' | 'paused' | 'stopped'
      scrollSpeed: 3, // 1 to 20
      scrollMode: 'continuous', // 'continuous' | 'wpm' | 'timed' | 'sentence' | 'voice'
      targetWPM: 130,
      scrollProgress: 0, // 0 to 1
      isReversed: false,
      isLooping: false,
      countdownDuration: 3, // 0, 3, 5, 10, or custom seconds

      // Active Script
      activeScript: {
        id: null,
        title: 'Untitled Script',
        content: '',
        notes: '',
        folder: 'General',
        tags: [],
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      isSaved: true,

      // Typography Settings
      typography: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 52,
        fontWeight: 600,
        textColor: '#ffffff',
        textAlign: 'center',
        lineHeight: 1.5,
        letterSpacing: 0.5,
        wordSpacing: 1,
        containerWidth: 85,
        textTransform: 'none',
        textShadow: true,
        textOutline: false,
        outlineWidth: 2,
        outlineColor: '#000000'
      },

      // Background & Theme Settings
      background: {
        theme: 'studio-dark',
        type: 'solid', // 'solid' | 'gradient' | 'image'
        color: '#000000',
        gradient: 'linear-gradient(180deg, #0f1013 0%, #000000 100%)',
        imageUrl: null,
        blur: 0,
        brightness: 100,
        opacity: 100
      },

      // Focus Reading Guides
      focus: {
        enabled: true,
        lineVisible: true,
        linePosition: 40, // percentage from top (30% to 70%)
        rulerVisible: true,
        rulerThickness: 120, // px
        rulerColor: '#f59e0b',
        fadeMask: true,
        activeHighlight: true,
        eyeGuide: true
      },

      // Mirror & Display
      display: {
        mirrorX: false,
        mirrorY: false,
        aspectRatio: 'full', // 'full' | '16:9' | '9:16' | '4:3' | '1:1' | '2:1'
        fullscreen: false,
        distractionFree: false
      },

      // Camera & Audio Hardware
      media: {
        cameraEnabled: false,
        micEnabled: false,
        cameraDeviceId: '',
        micDeviceId: '',
        facingMode: isMobileDevice ? 'user' : 'user', // 'user' (front) | 'environment' (rear)
        resolution: isMobileDevice ? '720p' : '1080p', // 'auto' | '480p' | '720p' | '1080p' | '4k'
        fps: 30,
        cleanRecord: true, // true = raw camera only (no text); false = composite with text
        isMirroredCamera: true,
        audioGain: 1.0,
        vuLevel: 0,
        diagnosticsVisible: false,
        micMonitoringEnabled: false
      },

      // Recording Engine State
      recordingState: 'inactive', // 'inactive' | 'countdown' | 'recording' | 'paused' | 'processing'
      recordingTime: 0,

      // Voice Tracking State
      voice: {
        enabled: false,
        status: 'disabled', // 'disabled' | 'listening' | 'following' | 'paused' | 'unsupported'
        language: 'en-US', // 'en-US' | 'ur-PK' | 'hi-IN' | 'mixed'
        commandsEnabled: true,
        confidence: 0,
        lastWordIndex: 0
      },

      // Remote Session
      remote: {
        token: null,
        connectedClients: 0,
        serverConnected: false
      },

      // UI Panels
      ui: {
        sidebarCollapsed: false,
        settingsCollapsed: false,
        activeSettingsTab: 'text'
      }
    };
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    eventBus.emit(`state:${key}`, value);
    eventBus.emit('state:changed', { key, value, fullState: this.state });
  }

  update(key, partialObj) {
    if (typeof this.state[key] === 'object' && this.state[key] !== null) {
      this.state[key] = { ...this.state[key], ...partialObj };
      eventBus.emit(`state:${key}`, this.state[key]);
      eventBus.emit('state:changed', { key, value: this.state[key], fullState: this.state });
    } else {
      this.set(key, partialObj);
    }
  }

  getState() {
    return { ...this.state };
  }
}

export const appState = new AppState();

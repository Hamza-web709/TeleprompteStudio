import { db } from '../storage/db.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

export const DEFAULT_PRESETS = [
  {
    id: 'preset-standard',
    name: 'Standard Teleprompter',
    isBuiltin: true,
    typography: { fontFamily: "'Inter', sans-serif", fontSize: 52, fontWeight: 600, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.5, letterSpacing: 0.5, containerWidth: 85 },
    background: { theme: 'studio-dark', type: 'solid', color: '#000000' },
    scrolling: { speed: 3, mode: 'continuous', targetWpm: 130 },
    focus: { enabled: true, linePosition: 40, rulerThickness: 120, rulerColor: '#f59e0b' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: 'full' }
  },
  {
    id: 'preset-dark-studio',
    name: 'Dark Studio',
    isBuiltin: true,
    typography: { fontFamily: "'Inter', sans-serif", fontSize: 56, fontWeight: 700, textColor: '#f8fafc', textAlign: 'center', lineHeight: 1.6, letterSpacing: 1, containerWidth: 80 },
    background: { theme: 'studio-dark', type: 'solid', color: '#090a0d' },
    scrolling: { speed: 4, mode: 'continuous', targetWpm: 140 },
    focus: { enabled: true, linePosition: 45, rulerThickness: 140, rulerColor: '#6366f1' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: 'full' }
  },
  {
    id: 'preset-light-reading',
    name: 'Light Reading',
    isBuiltin: true,
    typography: { fontFamily: "'Inter', sans-serif", fontSize: 48, fontWeight: 500, textColor: '#0f172a', textAlign: 'left', lineHeight: 1.6, letterSpacing: 0.5, containerWidth: 75 },
    background: { theme: 'light-reading', type: 'solid', color: '#f8fafc' },
    scrolling: { speed: 3, mode: 'continuous', targetWpm: 125 },
    focus: { enabled: true, linePosition: 35, rulerThickness: 100, rulerColor: '#4f46e5' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: 'full' }
  },
  {
    id: 'preset-podcast',
    name: 'Podcast Recording',
    isBuiltin: true,
    typography: { fontFamily: "'Outfit', sans-serif", fontSize: 54, fontWeight: 600, textColor: '#f1f5f9', textAlign: 'center', lineHeight: 1.55, letterSpacing: 0.8, containerWidth: 80 },
    background: { theme: 'studio-dark', type: 'solid', color: '#111318' },
    scrolling: { speed: 3, mode: 'wpm', targetWpm: 135 },
    focus: { enabled: true, linePosition: 50, rulerThickness: 130, rulerColor: '#0ea5e9' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: '16:9' }
  },
  {
    id: 'preset-motivational',
    name: 'Motivational Video',
    isBuiltin: true,
    typography: { fontFamily: "'Outfit', sans-serif", fontSize: 64, fontWeight: 800, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.4, letterSpacing: 1.2, containerWidth: 90, textTransform: 'uppercase' },
    background: { theme: 'studio-dark', type: 'solid', color: '#000000' },
    scrolling: { speed: 5, mode: 'continuous', targetWpm: 160 },
    focus: { enabled: true, linePosition: 40, rulerThickness: 160, rulerColor: '#ef4444' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: '9:16' }
  },
  {
    id: 'preset-youtube-landscape',
    name: 'YouTube Landscape',
    isBuiltin: true,
    typography: { fontFamily: "'Inter', sans-serif", fontSize: 50, fontWeight: 600, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.5, letterSpacing: 0.5, containerWidth: 80 },
    background: { theme: 'studio-dark', type: 'solid', color: '#050505' },
    scrolling: { speed: 3, mode: 'wpm', targetWpm: 140 },
    focus: { enabled: true, linePosition: 38, rulerThickness: 110, rulerColor: '#f59e0b' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: '16:9' }
  },
  {
    id: 'preset-tiktok-portrait',
    name: 'TikTok Portrait',
    isBuiltin: true,
    typography: { fontFamily: "'Outfit', sans-serif", fontSize: 44, fontWeight: 700, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.4, letterSpacing: 0.5, containerWidth: 90 },
    background: { theme: 'studio-dark', type: 'solid', color: '#000000' },
    scrolling: { speed: 4, mode: 'continuous', targetWpm: 150 },
    focus: { enabled: true, linePosition: 30, rulerThickness: 90, rulerColor: '#06b6d4' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: '9:16' }
  },
  {
    id: 'preset-insta-reels',
    name: 'Instagram Reels',
    isBuiltin: true,
    typography: { fontFamily: "'Outfit', sans-serif", fontSize: 42, fontWeight: 600, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.45, letterSpacing: 0.5, containerWidth: 88 },
    background: { theme: 'studio-dark', type: 'solid', color: '#000000' },
    scrolling: { speed: 4, mode: 'wpm', targetWpm: 145 },
    focus: { enabled: true, linePosition: 32, rulerThickness: 95, rulerColor: '#ec4899' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: '9:16' }
  },
  {
    id: 'preset-classroom',
    name: 'Classroom Presentation',
    isBuiltin: true,
    typography: { fontFamily: "'Inter', sans-serif", fontSize: 58, fontWeight: 600, textColor: '#f8fafc', textAlign: 'left', lineHeight: 1.6, letterSpacing: 0.6, containerWidth: 85 },
    background: { theme: 'studio-dark', type: 'solid', color: '#141824' },
    scrolling: { speed: 2, mode: 'wpm', targetWpm: 115 },
    focus: { enabled: true, linePosition: 40, rulerThickness: 130, rulerColor: '#10b981' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: '4:3' }
  },
  {
    id: 'preset-high-contrast',
    name: 'High Contrast',
    isBuiltin: true,
    typography: { fontFamily: "'JetBrains Mono', monospace", fontSize: 54, fontWeight: 800, textColor: '#ffff00', textAlign: 'center', lineHeight: 1.5, letterSpacing: 1, containerWidth: 85 },
    background: { theme: 'high-contrast', type: 'solid', color: '#000000' },
    scrolling: { speed: 3, mode: 'continuous', targetWpm: 130 },
    focus: { enabled: true, linePosition: 40, rulerThickness: 120, rulerColor: '#00ffff' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: 'full' }
  },
  {
    id: 'preset-green-screen',
    name: 'Green Screen',
    isBuiltin: true,
    typography: { fontFamily: "'Inter', sans-serif", fontSize: 52, fontWeight: 700, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.5, letterSpacing: 0.5, containerWidth: 85 },
    background: { theme: 'green-screen', type: 'solid', color: '#00b140' },
    scrolling: { speed: 3, mode: 'continuous', targetWpm: 130 },
    focus: { enabled: true, linePosition: 40, rulerThickness: 120, rulerColor: '#ffffff' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: 'full' }
  },
  {
    id: 'preset-creator-custom',
    name: 'Custom Creator Preset',
    isBuiltin: true,
    typography: { fontFamily: "'Outfit', sans-serif", fontSize: 50, fontWeight: 600, textColor: '#ffffff', textAlign: 'center', lineHeight: 1.5, letterSpacing: 0.5, containerWidth: 85 },
    background: { theme: 'studio-dark', type: 'solid', color: '#0f172a' },
    scrolling: { speed: 3, mode: 'continuous', targetWpm: 130 },
    focus: { enabled: true, linePosition: 40, rulerThickness: 120, rulerColor: '#8b5cf6' },
    display: { mirrorX: false, mirrorY: false, aspectRatio: 'full' }
  }
];

class PresetManager {
  async init() {
    // Seed default presets if none exist
    const presets = await db.getAll('presets');
    if (!presets || presets.length === 0) {
      for (const p of DEFAULT_PRESETS) {
        await db.put('presets', p);
      }
    }
  }

  async getAllPresets() {
    const list = await db.getAll('presets');
    return list.length > 0 ? list : DEFAULT_PRESETS;
  }

  applyPreset(preset) {
    if (!preset) return;

    if (preset.typography) appState.update('typography', preset.typography);
    if (preset.background) appState.update('background', preset.background);
    if (preset.scrolling) {
      if (preset.scrolling.speed) appState.set('scrollSpeed', preset.scrolling.speed);
      if (preset.scrolling.mode) appState.set('scrollMode', preset.scrolling.mode);
      if (preset.scrolling.targetWpm) appState.set('targetWPM', preset.scrolling.targetWpm);
    }
    if (preset.focus) appState.update('focus', preset.focus);
    if (preset.display) appState.update('display', preset.display);

    eventBus.emit('preset:applied', preset);
  }

  async saveCustomPreset(name) {
    const newPreset = {
      id: `preset-custom-${Date.now()}`,
      name: name || 'My Custom Preset',
      isBuiltin: false,
      typography: { ...appState.get('typography') },
      background: { ...appState.get('background') },
      scrolling: {
        speed: appState.get('scrollSpeed'),
        mode: appState.get('scrollMode'),
        targetWpm: appState.get('targetWPM')
      },
      focus: { ...appState.get('focus') },
      display: { ...appState.get('display') }
    };

    await db.put('presets', newPreset);
    eventBus.emit('presets:updated');
    return newPreset;
  }

  async deletePreset(presetId) {
    const preset = await db.get('presets', presetId);
    if (preset && !preset.isBuiltin) {
      await db.delete('presets', presetId);
      eventBus.emit('presets:updated');
      return true;
    }
    return false;
  }
}

export const presetManager = new PresetManager();

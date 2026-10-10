import { db } from './db.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

const SETTINGS_KEYS = ['typography', 'background', 'display', 'focus', 'media'];

class SettingsSync {
  constructor() {
    this.saveTimers = {};
  }

  async init() {
    // 1. Load persisted settings into appState before render
    await this.restoreSettings();

    // 2. Bind autosave listeners on state updates
    SETTINGS_KEYS.forEach(key => {
      eventBus.on(`state:${key}`, (val) => {
        this.debouncedSave(key, val);
      });
    });
  }

  debouncedSave(key, value) {
    if (this.saveTimers[key]) clearTimeout(this.saveTimers[key]);
    this.saveTimers[key] = setTimeout(() => {
      this.saveSetting(key, value);
    }, 250);
  }

  async saveSetting(key, value) {
    try {
      // Fast sync local storage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`tp_setting_${key}`, JSON.stringify(value));
      }
      // Robust async IndexedDB
      await db.put('settings', { key, value, updatedAt: Date.now() });
    } catch (err) {
      console.warn(`[SettingsSync] Failed to persist setting ${key}:`, err);
    }
  }

  async restoreSettings() {
    try {
      // 1. First attempt from localStorage (instant sync)
      const localLoaded = {};
      if (typeof localStorage !== 'undefined') {
        SETTINGS_KEYS.forEach(key => {
          const raw = localStorage.getItem(`tp_setting_${key}`);
          if (raw) {
            try {
              localLoaded[key] = JSON.parse(raw);
            } catch {}
          }
        });
      }

      // 2. Supplement / fallback from IndexedDB
      const dbEntries = await db.getAll('settings').catch(() => []);
      const dbLoaded = {};
      if (Array.isArray(dbEntries)) {
        dbEntries.forEach(entry => {
          if (entry?.key && entry?.value) {
            dbLoaded[entry.key] = entry.value;
          }
        });
      }

      // Merge and update appState
      SETTINGS_KEYS.forEach(key => {
        const saved = localLoaded[key] || dbLoaded[key];
        if (saved && typeof saved === 'object') {
          appState.update(key, saved);
        }
      });
    } catch (err) {
      console.warn('[SettingsSync] Failed to restore settings:', err);
    }
  }
}

export const settingsSync = new SettingsSync();

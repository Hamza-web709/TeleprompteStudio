import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class FocusSystem {
  constructor() {
    this.lineEl = null;
    this.rulerEl = null;
    this.topFadeEl = null;
    this.bottomFadeEl = null;
    this.eyeGuideEl = null;
  }

  mount({ lineEl, rulerEl, topFadeEl, bottomFadeEl, eyeGuideEl }) {
    this.lineEl = lineEl;
    this.rulerEl = rulerEl;
    this.topFadeEl = topFadeEl;
    this.bottomFadeEl = bottomFadeEl;
    this.eyeGuideEl = eyeGuideEl;

    this.applySettings(appState.get('focus'));

    eventBus.on('state:focus', (focus) => {
      this.applySettings(focus);
    });
  }

  applySettings(focus) {
    if (!focus) return;

    const root = document.documentElement;
    root.style.setProperty('--focus-line-top', `${focus.linePosition || 40}%`);
    root.style.setProperty('--focus-ruler-height', `${focus.rulerThickness || 120}px`);
    root.style.setProperty('--focus-line-color', focus.rulerColor || '#f59e0b');

    if (this.lineEl) {
      this.lineEl.style.display = (focus.enabled && focus.lineVisible) ? 'block' : 'none';
    }

    if (this.rulerEl) {
      this.rulerEl.style.display = (focus.enabled && focus.rulerVisible) ? 'block' : 'none';
    }

    if (this.topFadeEl && this.bottomFadeEl) {
      const showFade = focus.enabled && focus.fadeMask;
      this.topFadeEl.style.display = showFade ? 'block' : 'none';
      this.bottomFadeEl.style.display = showFade ? 'block' : 'none';
    }

    if (this.eyeGuideEl) {
      this.eyeGuideEl.style.display = (focus.enabled && focus.eyeGuide) ? 'flex' : 'none';
    }
  }

  update(key, value) {
    const current = appState.get('focus');
    appState.set('focus', { ...current, [key]: value });
  }

  toggleFocus() {
    const current = appState.get('focus');
    this.update('enabled', !current.enabled);
  }
}

export const focusSystem = new FocusSystem();

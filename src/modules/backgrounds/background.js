import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { isContrastAcceptable } from './contrast.js';

class BackgroundManager {
  constructor() {
    this.root = typeof document !== 'undefined' ? document.documentElement : null;
    this.lastCustomColor = '#000000';
  }

  init() {
    const initialBg = appState.get('background');
    if (initialBg?.color) {
      this.lastCustomColor = initialBg.color;
    }
    this.applySettings(initialBg);

    eventBus.on('state:background', (bg) => {
      this.applySettings(bg);
    });
  }

  applySettings(bg) {
    if (!bg || typeof document === 'undefined') return;

    let effectiveBg = bg.color || '#000000';
    if (bg.type === 'gradient' && bg.gradient) {
      effectiveBg = bg.gradient;
    } else if (bg.type === 'image' && bg.imageUrl) {
      effectiveBg = `url("${bg.imageUrl}") center/cover no-repeat`;
    }

    const solidColor = bg.color || '#000000';

    // Apply to :root
    this.root.style.setProperty('--prompt-bg-color', effectiveBg);
    this.root.style.setProperty('--custom-bg-color', solidColor);

    // Apply directly to body to override theme attribute selector specificity
    if (document.body) {
      document.body.style.setProperty('--prompt-bg-color', effectiveBg);
      document.body.style.setProperty('--custom-bg-color', solidColor);
      document.body.setAttribute('data-theme', bg.theme || 'studio-dark');
    }

    // Apply to main workspace and prompter frame
    const workspaceEl = document.getElementById('main-workspace');
    if (workspaceEl) {
      workspaceEl.style.setProperty('--prompt-bg-color', effectiveBg);
      workspaceEl.style.background = effectiveBg;
    }

    const prompterFrame = document.getElementById('prompter-frame');
    if (prompterFrame) {
      prompterFrame.style.setProperty('--prompt-bg-color', effectiveBg);
    }

    // Update gradient fade masks to blend into current background
    const topFade = document.getElementById('top-fade-mask');
    const bottomFade = document.getElementById('bottom-fade-mask');
    if (topFade) {
      topFade.style.background = `linear-gradient(to bottom, ${solidColor} 0%, transparent 100%)`;
    }
    if (bottomFade) {
      bottomFade.style.background = `linear-gradient(to top, ${solidColor} 0%, transparent 100%)`;
    }

    // Evaluate WCAG contrast against current text color
    const textColor = appState.get('typography')?.textColor || '#ffffff';
    const contrastResult = isContrastAcceptable(textColor, solidColor);
    eventBus.emit('contrast:checked', contrastResult);
  }

  setTheme(themeName) {
    const themeMap = {
      'studio-dark': { color: '#000000', type: 'solid' },
      'light-reading': { color: '#f8fafc', type: 'solid' },
      'high-contrast': { color: '#000000', type: 'solid' },
      'green-screen': { color: '#00b140', type: 'solid' },
      'blue-screen': { color: '#0047bb', type: 'solid' },
      'custom': { color: this.lastCustomColor || '#000000', type: 'solid' }
    };

    const target = themeMap[themeName] || themeMap['studio-dark'];
    const updated = {
      ...appState.get('background'),
      theme: themeName,
      type: target.type,
      color: target.color
    };

    appState.set('background', updated);

    // Adjust text color defaults for light-reading vs dark themes if unchanged
    if (themeName === 'light-reading') {
      if (appState.get('typography')?.textColor === '#ffffff') {
        appState.update('typography', { textColor: '#0f172a' });
      }
    } else if (themeName === 'high-contrast') {
      appState.update('typography', { textColor: '#ffff00' });
    } else if (themeName !== 'custom' && appState.get('typography')?.textColor === '#0f172a') {
      appState.update('typography', { textColor: '#ffffff' });
    }
  }

  setColor(colorHex) {
    if (!colorHex) return;
    this.lastCustomColor = colorHex;
    const current = appState.get('background') || {};

    // Changing custom color automatically activates Custom Background mode
    appState.set('background', {
      ...current,
      theme: 'custom',
      type: 'solid',
      color: colorHex
    });
  }

  setImage(dataUrl) {
    const current = appState.get('background');
    appState.set('background', {
      ...current,
      theme: 'custom',
      type: 'image',
      imageUrl: dataUrl
    });
  }
}

export const backgroundManager = new BackgroundManager();

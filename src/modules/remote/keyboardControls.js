import { scrollEngine } from '../scrolling/scrollEngine.js';
import { mirrorManager } from '../display/mirror.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class KeyboardController {
  constructor() {
    this.enabled = true;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    if (!this.enabled) return;

    // Do NOT trigger shortcuts when typing inside editor, input, textarea, or contenteditable
    const activeEl = document.activeElement;
    const isTextInput = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.classList.contains('script-editor-area')
    );

    if (isTextInput) {
      if (e.key === 'Escape') {
        activeEl.blur();
      }
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        scrollEngine.togglePlayPause();
        break;

      case 'ArrowUp':
        e.preventDefault();
        {
          const currentSpeed = appState.get('scrollSpeed');
          const newSpeed = Math.min(20, currentSpeed + 1);
          appState.set('scrollSpeed', newSpeed);
          eventBus.emit('ui:toast', { type: 'info', message: `Speed: ${newSpeed}` });
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        {
          const currentSpeed = appState.get('scrollSpeed');
          const newSpeed = Math.max(1, currentSpeed - 1);
          appState.set('scrollSpeed', newSpeed);
          eventBus.emit('ui:toast', { type: 'info', message: `Speed: ${newSpeed}` });
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        scrollEngine.jumpSeconds(-5);
        eventBus.emit('ui:toast', { type: 'info', message: 'Jump -5s' });
        break;

      case 'ArrowRight':
        e.preventDefault();
        scrollEngine.jumpSeconds(5);
        eventBus.emit('ui:toast', { type: 'info', message: 'Jump +5s' });
        break;

      case 'Home':
        e.preventDefault();
        scrollEngine.restart();
        eventBus.emit('ui:toast', { type: 'info', message: 'Restarted' });
        break;

      case 'KeyM':
        e.preventDefault();
        mirrorManager.toggleMirrorX();
        break;

      case 'KeyF':
        e.preventDefault();
        this.toggleFullscreen();
        break;

      case 'Escape':
        eventBus.emit('ui:close-modals');
        break;
    }
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        appState.update('display', { fullscreen: true });
      } else {
        await document.exitFullscreen();
        appState.update('display', { fullscreen: false });
      }
    } catch {
      // Fullscreen not permitted
    }
  }
}

export const keyboardController = new KeyboardController();

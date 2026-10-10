import { eventBus } from '../state/eventBus.js';
import { a11y } from '../modules/accessibility/a11y.js';

class ToastManager {
  constructor() {
    this.containerEl = null;
  }

  mount(containerElement) {
    this.containerEl = containerElement;

    eventBus.on('ui:toast', ({ type = 'info', message = '' }) => {
      this.show(message, type);
    });
  }

  show(message, type = 'info', duration = 3000) {
    if (!this.containerEl) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.containerEl.appendChild(toast);
    a11y.announce(message);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }
}

export const toast = new ToastManager();

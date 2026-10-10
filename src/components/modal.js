import { eventBus } from '../state/eventBus.js';

class ModalManager {
  constructor() {
    this.activeModal = null;
    this.previousFocusedEl = null;

    eventBus.on('ui:close-modals', () => this.closeAll());
  }

  open(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    this.previousFocusedEl = document.activeElement;
    this.activeModal = modalEl;
    modalEl.style.display = 'flex';
    modalEl.setAttribute('aria-hidden', 'false');

    // Focus first interactive control
    const firstFocusable = modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();

    // Close on backdrop click
    modalEl.onclick = (e) => {
      if (e.target === modalEl) this.close(modalId);
    };

    // Close button click
    const closeBtn = modalEl.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.close(modalId);
    }
  }

  close(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
    this.activeModal = null;

    if (this.previousFocusedEl) {
      this.previousFocusedEl.focus();
      this.previousFocusedEl = null;
    }
  }

  closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      m.style.display = 'none';
      m.setAttribute('aria-hidden', 'true');
    });
    this.activeModal = null;
  }
}

export const modalManager = new ModalManager();

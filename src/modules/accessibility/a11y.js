class AccessibilityManager {
  constructor() {
    this.announcerEl = null;
  }

  init() {
    // Create screen reader live announcer
    this.announcerEl = document.createElement('div');
    this.announcerEl.id = 'a11y-announcer';
    this.announcerEl.className = 'sr-only';
    this.announcerEl.setAttribute('aria-live', 'polite');
    this.announcerEl.setAttribute('aria-atomic', 'true');
    document.body.appendChild(this.announcerEl);

    // Detect prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      document.documentElement.classList.add('reduced-motion');
    }
  }

  announce(message) {
    if (this.announcerEl) {
      this.announcerEl.textContent = '';
      setTimeout(() => {
        this.announcerEl.textContent = message;
      }, 50);
    }
  }

  toggleDyslexicFont(enable) {
    if (enable) {
      document.body.classList.add('font-dyslexic');
      this.announce('Dyslexia-friendly font enabled');
    } else {
      document.body.classList.remove('font-dyslexic');
      this.announce('Standard studio font restored');
    }
  }
}

export const a11y = new AccessibilityManager();

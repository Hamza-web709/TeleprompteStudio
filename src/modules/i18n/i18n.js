import { LOCALES } from './locales.js';
import { eventBus } from '../../state/eventBus.js';

class I18nManager {
  constructor() {
    this.currentLocale = 'en';
  }

  setLocale(langKey) {
    if (LOCALES[langKey]) {
      this.currentLocale = langKey;
      const localeData = LOCALES[langKey];
      document.documentElement.lang = langKey;
      document.documentElement.dir = localeData.dir;

      // Update prompter font if specialized language font exists
      if (localeData.font) {
        document.documentElement.style.setProperty('--font-multilingual', localeData.font);
      }

      this.updateDOMTranslations();
      eventBus.emit('i18n:changed', { lang: langKey, dir: localeData.dir });
    }
  }

  t(key) {
    const dict = LOCALES[this.currentLocale]?.translations || LOCALES.en.translations;
    return dict[key] || LOCALES.en.translations[key] || key;
  }

  updateDOMTranslations() {
    const translatableElements = document.querySelectorAll('[data-i18n]');
    translatableElements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });
  }
}

export const i18n = new I18nManager();

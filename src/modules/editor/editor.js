import { sanitizeHTML, isRTLText } from './sanitizer.js';
import { scriptManager } from '../scripts/scriptManager.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class ScriptEditor {
  constructor() {
    this.editorEl = null;
    this.isEditing = false;
  }

  mount(element) {
    this.editorEl = element;
    this.setupListeners();
    this.syncFromState();

    eventBus.on('script:selected', (script) => {
      if (this.editorEl && document.activeElement !== this.editorEl) {
        this.editorEl.innerHTML = sanitizeHTML(script.content);
        this.updateDirection();
      }
    });
  }

  setupListeners() {
    if (!this.editorEl) return;

    this.editorEl.addEventListener('input', () => {
      const dirtyHtml = this.editorEl.innerHTML;
      const cleanHtml = sanitizeHTML(dirtyHtml);
      this.updateDirection();
      scriptManager.updateActiveScript({ content: cleanHtml });
      eventBus.emit('editor:content-changed', cleanHtml);
    });

    // Paste handling: sanitize rich text
    this.editorEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  }

  syncFromState() {
    const active = appState.get('activeScript');
    if (this.editorEl && active) {
      this.editorEl.innerHTML = sanitizeHTML(active.content || '');
      this.updateDirection();
    }
  }

  updateDirection() {
    if (!this.editorEl) return;
    const text = this.editorEl.innerText || '';
    if (isRTLText(text)) {
      this.editorEl.setAttribute('dir', 'rtl');
      this.editorEl.classList.add('rtl-text');
    } else {
      this.editorEl.setAttribute('dir', 'ltr');
      this.editorEl.classList.remove('rtl-text');
    }
  }

  executeFormat(command, value = null) {
    if (!this.editorEl) return;
    this.editorEl.focus();
    document.execCommand(command, false, value);
    const cleanHtml = sanitizeHTML(this.editorEl.innerHTML);
    scriptManager.updateActiveScript({ content: cleanHtml });
    eventBus.emit('editor:content-changed', cleanHtml);
  }

  findAndReplace(findText, replaceText) {
    if (!this.editorEl || !findText) return;
    const content = this.editorEl.innerHTML;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const newContent = content.replace(regex, replaceText);
    this.editorEl.innerHTML = newContent;
    scriptManager.updateActiveScript({ content: sanitizeHTML(newContent) });
    eventBus.emit('editor:content-changed', newContent);
  }
}

export const scriptEditor = new ScriptEditor();

import { db } from '../storage/db.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { exportToDocx, importFromDocx, exportToPdf, importFromPdf } from './documentConverter.js';

class ScriptManager {
  constructor() {
    this.autosaveTimer = null;
    this.autosaveDelay = 1200; // ms
  }

  async init() {
    // Load initial scripts or seed default script if empty
    const scripts = await db.getAll('scripts');
    if (!scripts || scripts.length === 0) {
      await this.seedDefaultScript();
    } else {
      // Load most recently updated script
      scripts.sort((a, b) => b.updatedAt - a.updatedAt);
      this.setActiveScript(scripts[0]);
    }
  }

  async seedDefaultScript() {
    const welcomeScript = {
      id: 'script-welcome-1',
      title: 'Welcome to Teleprompter Studio Pro',
      content: `<h1>Welcome to Teleprompter Studio Pro</h1>
<p>This is your professional, studio-grade creative teleprompter. You can write, record, mirror, and deliver speeches with confidence.</p>
<p>To start prompt scrolling, press the <strong>SPACEBAR</strong> or click the large circular Play button below.</p>
<p>Adjust your reading speed anytime using the <strong>UP</strong> and <strong>DOWN</strong> arrow keys, or use the speed slider in the bottom toolbar.</p>
<p>You can customize typography, colors, background, and focus ruler from the right panel at any time without losing your scroll position.</p>
<p>Connect your camera to record clean presenter footage while reading, or enable voice-tracking to let the prompter follow your voice in real time.</p>
<p>Have a wonderful recording session!</p>`,
      notes: 'Introductory guide for new creators.',
      folder: 'General',
      tags: ['Guide', 'Onboarding'],
      isFavorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.put('scripts', welcomeScript);
    this.setActiveScript(welcomeScript);
  }

  setActiveScript(script) {
    appState.set('activeScript', { ...script });
    appState.set('isSaved', true);
    eventBus.emit('script:selected', script);
  }

  async createNewScript(title = 'Untitled Script', content = '') {
    const newScript = {
      id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title,
      content,
      notes: '',
      folder: 'General',
      tags: [],
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.put('scripts', newScript);
    this.setActiveScript(newScript);
    eventBus.emit('script:created', newScript);
    eventBus.emit('scripts:list-updated');
    return newScript;
  }

  async updateActiveScript(partialData) {
    const current = appState.get('activeScript');
    if (!current || !current.id) return;

    const updated = {
      ...current,
      ...partialData,
      updatedAt: Date.now()
    };

    appState.set('activeScript', updated);
    appState.set('isSaved', false);

    // Schedule debounced autosave
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(async () => {
      await db.put('scripts', updated);
      appState.set('isSaved', true);
      eventBus.emit('script:saved', updated);
      eventBus.emit('scripts:list-updated');
    }, this.autosaveDelay);
  }

  async saveNow() {
    clearTimeout(this.autosaveTimer);
    const current = appState.get('activeScript');
    if (!current || !current.id) return;

    const updated = {
      ...current,
      updatedAt: Date.now()
    };
    await db.put('scripts', updated);
    appState.set('activeScript', updated);
    appState.set('isSaved', true);
    eventBus.emit('script:saved', updated);
    eventBus.emit('scripts:list-updated');
  }

  async duplicateScript(scriptId) {
    const orig = await db.get('scripts', scriptId);
    if (!orig) return null;

    const copy = {
      ...orig,
      id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: `${orig.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.put('scripts', copy);
    eventBus.emit('scripts:list-updated');
    return copy;
  }

  async deleteScript(scriptId) {
    await db.delete('scripts', scriptId);
    eventBus.emit('scripts:list-updated');

    const active = appState.get('activeScript');
    if (active && active.id === scriptId) {
      const remaining = await db.getAll('scripts');
      if (remaining.length > 0) {
        remaining.sort((a, b) => b.updatedAt - a.updatedAt);
        this.setActiveScript(remaining[0]);
      } else {
        await this.createNewScript();
      }
    }
  }

  async toggleFavorite(scriptId) {
    const script = await db.get('scripts', scriptId);
    if (script) {
      script.isFavorite = !script.isFavorite;
      script.updatedAt = Date.now();
      await db.put('scripts', script);
      const active = appState.get('activeScript');
      if (active && active.id === scriptId) {
        appState.update('activeScript', { isFavorite: script.isFavorite });
      }
      eventBus.emit('scripts:list-updated');
    }
  }

  async getAllScripts() {
    return await db.getAll('scripts');
  }

  async importScriptFile(file) {
    if (!file) return null;
    const title = file.name.replace(/\.[^/.]+$/, '');
    let htmlContent = '';

    if (file.name.toLowerCase().endsWith('.docx')) {
      htmlContent = await importFromDocx(file);
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      htmlContent = await importFromPdf(file);
    } else if (file.name.toLowerCase().endsWith('.md')) {
      const rawText = await file.text();
      htmlContent = rawText
        .split(/(?:\r?\n){2,}/)
        .map(block => {
          let b = block.trim();
          if (b.startsWith('### ')) return `<h3>${b.slice(4)}</h3>`;
          if (b.startsWith('## ')) return `<h2>${b.slice(3)}</h2>`;
          if (b.startsWith('# ')) return `<h1>${b.slice(2)}</h1>`;
          b = b.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          b = b.replace(/\*(.*?)\*/g, '<em>$1</em>');
          return `<p>${b.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');
    } else {
      // Plain text fallback
      const rawText = await file.text();
      htmlContent = rawText
        .split(/(?:\r?\n){2,}/)
        .map(para => `<p>${para.trim().replace(/\n/g, '<br>')}</p>`)
        .join('\n');
    }

    return await this.createNewScript(title, htmlContent);
  }

  async exportCurrentScript(format = 'txt') {
    const script = appState.get('activeScript');
    if (!script) return;

    if (format === 'docx' || format === 'doc') {
      return await exportToDocx(script.title, script.content);
    }

    if (format === 'pdf') {
      return await exportToPdf(script.title, script.content);
    }

    if (format === 'print') {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${script.title}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
              h1 { border-bottom: 2px solid #ccc; padding-bottom: 8px; margin-bottom: 24px; }
              p { margin-bottom: 16px; font-size: 16px; }
            </style>
          </head>
          <body>
            <h1>${script.title}</h1>
            <div>${script.content}</div>
            <script>
              window.onload = function() { window.print(); window.close(); };
            <\/script>
          </body>
          </html>
        `);
        printWin.document.close();
      }
      return;
    }

    let content = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    if (format === 'txt') {
      content = script.content.replace(/<[^>]*>/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
      mimeType = 'text/plain';
      ext = 'txt';
    } else if (format === 'md') {
      content = `# ${script.title}\n\n` + script.content.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n')
        .replace(/<strong>(.*?)<\/strong>|<b>(.*?)<\/b>/gi, '**$1$2**')
        .replace(/<em>(.*?)<\/em>|<i>(.*?)<\/i>/gi, '*$1$2*')
        .replace(/<[^>]*>/g, '\n');
      mimeType = 'text/markdown';
      ext = 'md';
    } else if (format === 'html') {
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${script.title}</title></head><body><h1>${script.title}</h1>${script.content}</body></html>`;
      mimeType = 'text/html';
      ext = 'html';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title.replace(/[^a-z0-9_-]/gi, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    return blob;
  }
}

export const scriptManager = new ScriptManager();

import { db } from './db.js';

/**
 * Backup and Restore service
 */
export async function exportAllData() {
  const scripts = await db.getAll('scripts');
  const folders = await db.getAll('folders');
  const presets = await db.getAll('presets');
  const rehearsals = await db.getAll('rehearsals');
  const settings = await db.getAll('settings');

  const payload = {
    appName: 'Teleprompter Studio Pro',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    data: {
      scripts,
      folders,
      presets,
      rehearsals,
      settings
    }
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teleprompter-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Invalid backup file format.');
    }

    const { scripts, folders, presets, rehearsals, settings } = parsed.data;

    if (Array.isArray(scripts)) {
      for (const s of scripts) {
        if (s.id && s.title) await db.put('scripts', s);
      }
    }
    if (Array.isArray(folders)) {
      for (const f of folders) {
        if (f.id && f.name) await db.put('folders', f);
      }
    }
    if (Array.isArray(presets)) {
      for (const p of presets) {
        if (p.id && p.name) await db.put('presets', p);
      }
    }
    if (Array.isArray(rehearsals)) {
      for (const r of rehearsals) {
        if (r.id) await db.put('rehearsals', r);
      }
    }
    if (Array.isArray(settings)) {
      for (const st of settings) {
        if (st.key) await db.put('settings', st);
      }
    }

    return { success: true, count: scripts?.length || 0 };
  } catch (err) {
    console.error('[Backup] Restore failed:', err);
    throw err;
  }
}

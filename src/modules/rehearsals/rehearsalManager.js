import { db } from '../storage/db.js';
import { appState } from '../../state/appState.js';
import { calculateScriptStats } from '../scripts/analytics.js';
import { eventBus } from '../../state/eventBus.js';

class RehearsalManager {
  constructor() {
    this.timerId = null;
    this.elapsedSeconds = 0;
    this.isRehearsing = false;
  }

  startRehearsal() {
    this.isRehearsing = true;
    this.elapsedSeconds = 0;
    clearInterval(this.timerId);

    this.timerId = setInterval(() => {
      this.elapsedSeconds++;
      eventBus.emit('rehearsal:tick', this.elapsedSeconds);
    }, 1000);

    eventBus.emit('rehearsal:started');
  }

  async stopRehearsal() {
    if (!this.isRehearsing) return null;
    this.isRehearsing = false;
    clearInterval(this.timerId);

    const script = appState.get('activeScript');
    const targetWpm = appState.get('targetWPM') || 130;
    const stats = calculateScriptStats(script?.content || '', targetWpm);

    const actualWpm = stats.words > 0 && this.elapsedSeconds > 0
      ? Math.round((stats.words / this.elapsedSeconds) * 60)
      : 0;

    const sessionData = {
      id: `reh-${Date.now()}`,
      scriptId: script?.id || 'unknown',
      scriptTitle: script?.title || 'Rehearsal',
      totalWords: stats.words,
      targetDurationSecs: stats.estimatedSeconds,
      actualDurationSecs: this.elapsedSeconds,
      targetWpm,
      actualWpm,
      timestamp: Date.now()
    };

    await db.put('rehearsals', sessionData);
    eventBus.emit('rehearsal:completed', sessionData);
    return sessionData;
  }

  async getRehearsalHistory(scriptId = null) {
    const list = await db.getAll('rehearsals');
    if (scriptId) {
      return list.filter(r => r.scriptId === scriptId);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const rehearsalManager = new RehearsalManager();

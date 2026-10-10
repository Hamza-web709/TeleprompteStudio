import { ScriptSpeechAligner } from './aligner.js';
import { prompterRenderer } from '../teleprompter/renderer.js';
import { scrollEngine } from '../scrolling/scrollEngine.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.aligner = new ScriptSpeechAligner([]);
    this.userEnabled = false;       // Explicit user intent
    this.isListening = false;       // Active Web Speech recognition session
    this.isExplicitlyStopping = false; // Flag to prevent auto-restarts on user stop
    this.restartTimer = null;       // Debounced recovery restart timer
    this.restartAttempts = 0;      // Bounded retry guard
    this.maxRestartAttempts = 5;
    this.lastRestartTimestamp = 0;
    this.lastCommand = '';
    this.lastCommandTimestamp = 0;
    this.silenceTimeout = null;
  }

  isSupported() {
    return typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  init() {
    if (!this.isSupported()) {
      appState.update('voice', { enabled: false, status: 'unsupported' });
      return;
    }

    if (this.recognition) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    // Listen to prompter rendered tokens to prime aligner
    eventBus.on('prompter:rendered', () => {
      this.aligner.setScriptTokens(prompterRenderer.wordsList);
    });

    this.recognition.onstart = () => {
      this.isListening = true;
      this.isExplicitlyStopping = false;
      this.restartAttempts = 0;
      appState.update('voice', { enabled: true, status: 'listening' });
      eventBus.emit('voice:started');
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.processTranscript(transcript, true);
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        this.processTranscript(interimTranscript, false);
      }

      this.resetSilenceTimer();
    };

    this.recognition.onerror = (event) => {
      console.warn('[SpeechEngine] Recognition error:', event.error);
      const errorType = event.error;

      if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        // Permission denied by user/browser
        this.userEnabled = false;
        this.isListening = false;
        this.isExplicitlyStopping = true;
        clearTimeout(this.restartTimer);
        appState.update('voice', { enabled: false, status: 'permission-required' });
        eventBus.emit('voice:error', { error: errorType, message: 'Microphone permission denied.' });
        return;
      }

      if (errorType === 'audio-capture') {
        this.userEnabled = false;
        this.isListening = false;
        clearTimeout(this.restartTimer);
        appState.update('voice', { enabled: false, status: 'error' });
        eventBus.emit('voice:error', { error: errorType, message: 'No microphone available.' });
        return;
      }

      // Recoverable interruptions: 'no-speech', 'aborted', 'network'
      // Normal playback transitions or brief silences must NOT disable listening!
      if (this.userEnabled && !this.isExplicitlyStopping) {
        appState.update('voice', { status: 'reconnecting' });
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;

      // If voice control is still requested and end is recoverable, auto-restart
      if (this.userEnabled && !this.isExplicitlyStopping) {
        appState.update('voice', { status: 'reconnecting' });
        this.scheduleRestart();
      } else {
        clearTimeout(this.restartTimer);
        appState.update('voice', { enabled: false, status: 'disabled' });
        eventBus.emit('voice:stopped');
      }
    };
  }

  scheduleRestart() {
    clearTimeout(this.restartTimer);
    if (!this.userEnabled || this.isExplicitlyStopping) return;

    const now = performance.now();
    if (now - this.lastRestartTimestamp > 10000) {
      this.restartAttempts = 0;
    }
    this.lastRestartTimestamp = now;

    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.warn('[SpeechEngine] Maximum restart attempts reached. Backing off...');
      this.restartTimer = setTimeout(() => {
        this.restartAttempts = 0;
        this._startRecognition();
      }, 3000);
      return;
    }

    this.restartAttempts++;
    const delay = Math.min(200 * this.restartAttempts, 1000);
    this.restartTimer = setTimeout(() => {
      this._startRecognition();
    }, delay);
  }

  _startRecognition() {
    if (!this.userEnabled || this.isExplicitlyStopping || !this.recognition) return;
    try {
      this.recognition.lang = appState.get('voice').language || 'en-US';
      this.recognition.start();
    } catch (err) {
      if (err.name === 'InvalidStateError') {
        this.isListening = true;
      } else {
        console.warn('[SpeechEngine] start() error:', err.message);
        this.scheduleRestart();
      }
    }
  }

  processTranscript(transcript = '', isFinal = false) {
    const rawText = transcript.trim().toLowerCase();
    if (!rawText) return;

    // Check voice commands first
    if (appState.get('voice').commandsEnabled) {
      const commandHandled = this.handleVoiceCommand(rawText);
      if (commandHandled) {
        return;
      }
    }

    // Dynamic Token Alignment
    const match = this.aligner.alignTranscript(transcript);
    if (match) {
      appState.update('voice', {
        status: 'following',
        confidence: match.confidence,
        lastWordIndex: match.matchedIndex
      });

      prompterRenderer.highlightWord(match.matchedIndex);

      // Smoothly advance teleprompter to offset of spoken word
      const offsetTop = prompterRenderer.getWordOffsetTop(match.matchedIndex);
      if (offsetTop > 0) {
        scrollEngine.jumpToOffset(offsetTop);
      }
    }
  }

  handleVoiceCommand(text) {
    const now = performance.now();
    const isRecentDuplicate = (cmd) => {
      if (this.lastCommand === cmd && (now - this.lastCommandTimestamp) < 800) {
        return true;
      }
      this.lastCommand = cmd;
      this.lastCommandTimestamp = now;
      return false;
    };

    // 1. STOP
    if (/\b(stop|halt)\b/.test(text)) {
      if (!isRecentDuplicate('stop')) {
        scrollEngine.stop();
        eventBus.emit('ui:toast', { type: 'info', message: 'Voice Command: Stop' });
      }
      return true;
    }

    // 2. PAUSE
    if (/\b(pause|freeze|hold)\b/.test(text)) {
      if (!isRecentDuplicate('pause')) {
        scrollEngine.pause();
        eventBus.emit('ui:toast', { type: 'info', message: 'Voice Command: Pause' });
      }
      return true;
    }

    // 3. RESUME
    if (/\b(resume|continue|go on)\b/.test(text)) {
      if (!isRecentDuplicate('resume')) {
        scrollEngine.play();
        eventBus.emit('ui:toast', { type: 'info', message: 'Voice Command: Resume' });
      }
      return true;
    }

    // 4. PLAY / START
    if (/\b(play|start|start prompter|scroll)\b/.test(text)) {
      if (!isRecentDuplicate('play')) {
        scrollEngine.play();
        eventBus.emit('ui:toast', { type: 'info', message: 'Voice Command: Play' });
      }
      return true;
    }

    // 5. FASTER / SPEED UP
    if (/\b(faster|speed up|quicker)\b/.test(text)) {
      if (!isRecentDuplicate('faster')) {
        const currentSpeed = appState.get('scrollSpeed') || 3;
        const newSpeed = Math.min(20, currentSpeed + 1);
        appState.set('scrollSpeed', newSpeed);
        eventBus.emit('ui:toast', { type: 'info', message: `Voice Command: Faster (${newSpeed})` });
      }
      return true;
    }

    // 6. SLOWER / SLOW DOWN
    if (/\b(slower|slow down)\b/.test(text)) {
      if (!isRecentDuplicate('slower')) {
        const currentSpeed = appState.get('scrollSpeed') || 3;
        const newSpeed = Math.max(1, currentSpeed - 1);
        appState.set('scrollSpeed', newSpeed);
        eventBus.emit('ui:toast', { type: 'info', message: `Voice Command: Slower (${newSpeed})` });
      }
      return true;
    }

    return false;
  }

  resetSilenceTimer() {
    clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      // In following mode, silence indicates speaker pause, but recognition remains actively listening for commands!
      if (this.isListening && appState.get('voice').status === 'following') {
        appState.update('voice', { status: 'listening' });
      }
    }, 2500);
  }

  start() {
    this.userEnabled = true;
    this.isExplicitlyStopping = false;
    clearTimeout(this.restartTimer);

    if (!this.recognition) this.init();
    if (!this.recognition) return;

    this.aligner.setScriptTokens(prompterRenderer.wordsList);
    appState.update('voice', { enabled: true, status: 'listening' });
    this._startRecognition();
  }

  stop() {
    this.userEnabled = false;
    this.isExplicitlyStopping = true;
    clearTimeout(this.restartTimer);
    clearTimeout(this.silenceTimeout);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
    appState.update('voice', { enabled: false, status: 'disabled' });
    eventBus.emit('voice:stopped');
  }

  toggle() {
    if (this.userEnabled) {
      this.stop();
    } else {
      this.start();
    }
  }
}

export const speechEngine = new SpeechEngine();

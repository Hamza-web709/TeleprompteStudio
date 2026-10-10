import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class ExternalDisplayManager {
  constructor() {
    this.channel = null;
    this.externalWindow = null;
    this.initChannel();
  }

  initChannel() {
    try {
      this.channel = new BroadcastChannel('teleprompter-studio-sync');
      this.channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'remote:command') {
          eventBus.emit('remote:command', payload);
        }
      };

      // Forward relevant events to external window
      eventBus.on('scroll:progress', (data) => {
        this.broadcast('sync:scroll', data);
      });
      eventBus.on('state:playbackState', (state) => {
        this.broadcast('sync:playback', { state });
      });
      eventBus.on('state:typography', (typography) => {
        this.broadcast('sync:typography', typography);
      });
      eventBus.on('state:background', (background) => {
        this.broadcast('sync:background', background);
      });
      eventBus.on('state:display', (display) => {
        this.broadcast('sync:display', display);
      });
      eventBus.on('script:selected', (script) => {
        this.broadcast('sync:script', script);
      });
    } catch (e) {
      console.warn('[ExternalDisplay] BroadcastChannel not supported in this environment', e);
    }
  }

  broadcast(type, payload) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type, payload });
      } catch {
        // channel error
      }
    }
  }

  openPresenterWindow() {
    // Open clean reader window
    const popoutUrl = `${window.location.origin}${window.location.pathname}?mode=presenter`;
    this.externalWindow = window.open(
      popoutUrl,
      'TeleprompterPresenter',
      'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!this.externalWindow) {
      return { success: false, error: 'Popup blocked. Please allow popups for external display.' };
    }

    // Send initial handshake state after window loads
    setTimeout(() => {
      this.broadcast('sync:init', {
        script: appState.get('activeScript'),
        typography: appState.get('typography'),
        background: appState.get('background'),
        display: appState.get('display'),
        playbackState: appState.get('playbackState')
      });
    }, 1000);

    return { success: true };
  }
}

export const externalDisplayManager = new ExternalDisplayManager();

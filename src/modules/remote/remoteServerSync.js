import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { scrollEngine } from '../scrolling/scrollEngine.js';

class RemoteServerSync {
  constructor() {
    this.ws = null;
    this.session = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.broadcastChannel = null;

    // Enable same-origin tab/window synchronization via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('teleprompter-studio-sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'remote:command') {
            this.handleIncomingCommand(event.data.payload);
          }
        };
      }
    } catch {
      // BroadcastChannel not available in this context
    }
  }

  connect(sessionToken) {
    this.session = sessionToken;

    // Check if an external WebSocket relay URL is configured
    const configuredRelay = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('tp_ws_relay_url') || '').trim()
      : '';

    let wsUrl = configuredRelay || null;

    // In static hosting mode (e.g. InfinityFree) with no external relay configured:
    // Do NOT attempt to connect to localhost or unconfigured ports.
    // Local BroadcastChannel sync remains active for same-device tabs.
    if (!wsUrl) {
      console.info('[RemoteServerSync] Static hosting mode: BroadcastChannel tab sync active. (External wss:// relay not configured)');
      this.subscribeStateEvents();
      return;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        appState.update('remote', { serverConnected: true });
        this.ws.send(JSON.stringify({
          type: 'register',
          session: this.session,
          role: 'host'
        }));
        eventBus.emit('ui:toast', { type: 'success', message: 'Remote relay server connected.' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingCommand(data);
        } catch {
          // message error
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        appState.update('remote', { serverConnected: false });
      };

      this.ws.onerror = () => {
        // Fallback or server offline
      };
    } catch {
      // WS connection not available
    }

    this.subscribeStateEvents();
  }

  subscribeStateEvents() {
    // Forward state changes to both WebSocket (if connected) and BroadcastChannel
    eventBus.on('state:playbackState', (state) => {
      this.send({ type: 'status:playback', state });
    });
    eventBus.on('state:scrollSpeed', (speed) => {
      this.send({ type: 'status:speed', speed });
    });
    eventBus.on('scroll:progress', (data) => {
      this.send({ type: 'status:progress', progress: data.progress });
    });
    eventBus.on('script:selected', (script) => {
      this.send({ type: 'status:script', title: script.title });
    });
  }

  send(data) {
    // Send over WebSocket if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {
        // send error
      }
    }
    // Always mirror to BroadcastChannel for local-tab sync
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(data);
      } catch {
        // broadcast error
      }
    }
  }

  handleIncomingCommand(data) {
    if (!data) return;

    switch (data.action) {
      case 'togglePlay':
        scrollEngine.togglePlayPause();
        break;
      case 'play':
        scrollEngine.play();
        break;
      case 'pause':
        scrollEngine.pause();
        break;
      case 'restart':
        scrollEngine.restart();
        break;
      case 'setSpeed':
        if (typeof data.speed === 'number') {
          appState.set('scrollSpeed', Math.min(20, Math.max(1, data.speed)));
        }
        break;
      case 'jump':
        scrollEngine.jumpSeconds(data.seconds || 5);
        break;
    }
  }
}

export const remoteServerSync = new RemoteServerSync();

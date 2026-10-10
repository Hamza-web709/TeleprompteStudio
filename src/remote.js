// Mobile Remote Script — InfinityFree Static Compatible
const urlParams = new URLSearchParams(window.location.search);
const sessionToken = urlParams.get('session');
const customRelay = urlParams.get('relay') || (typeof localStorage !== 'undefined' ? localStorage.getItem('tp_ws_relay_url') : '');

const statusBadge = document.getElementById('conn-status');
const scriptTitleEl = document.getElementById('remote-script-title');
const progressFill = document.getElementById('remote-progress');
const speedSlider = document.getElementById('remote-speed-slider');
const speedVal = document.getElementById('speed-val');
const btnPlay = document.getElementById('btn-toggle-play');
const playText = document.getElementById('play-text');
const btnJumpBack = document.getElementById('btn-jump-back');
const btnJumpFwd = document.getElementById('btn-jump-fwd');
const btnRestart = document.getElementById('btn-restart');

let isPlaying = false;
let ws = null;
let broadcastChannel = null;

// Initialize BroadcastChannel fallback for same-origin multi-tab sync
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('teleprompter-studio-sync');
    broadcastChannel.onmessage = (event) => {
      handleStateUpdate(event.data);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        statusBadge.textContent = 'Local Tab Sync (Active)';
        statusBadge.className = 'status-badge';
      }
    };
  }
} catch {
  // BroadcastChannel not available
}

function handleStateUpdate(data) {
  if (!data) return;
  if (data.type === 'status:playback') {
    isPlaying = data.state === 'playing';
    btnPlay.classList.toggle('playing', isPlaying);
    playText.textContent = isPlaying ? 'PAUSE' : 'PLAY';
  } else if (data.type === 'status:speed') {
    speedSlider.value = data.speed;
    speedVal.textContent = data.speed;
  } else if (data.type === 'status:progress') {
    progressFill.style.width = `${Math.round(data.progress * 100)}%`;
  } else if (data.type === 'status:script') {
    scriptTitleEl.textContent = data.title;
  }
}

function sendCommand(action, data = {}) {
  const payload = { action, ...data };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'remote:command', payload });
  }
}

function initConnection() {
  if (!sessionToken) {
    statusBadge.textContent = 'No Session Token';
    return;
  }

  let wsUrl = null;
  if (customRelay) {
    wsUrl = customRelay;
  }

  if (!wsUrl) {
    // Static hosting mode without external relay
    if (broadcastChannel) {
      statusBadge.textContent = 'Local Tab Sync (Same Device)';
      statusBadge.className = 'status-badge';
    } else {
      statusBadge.textContent = 'Standby (Requires external wss:// relay)';
      statusBadge.className = 'status-badge disconnected';
    }
    return;
  }

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      statusBadge.textContent = 'Relay Connected';
      statusBadge.className = 'status-badge';
      ws.send(JSON.stringify({
        type: 'register',
        session: sessionToken,
        role: 'remote'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleStateUpdate(data);
      } catch {
        // parse error
      }
    };

    ws.onclose = () => {
      if (broadcastChannel) {
        statusBadge.textContent = 'Local Tab Sync (Active)';
        statusBadge.className = 'status-badge';
      } else {
        statusBadge.textContent = 'Disconnected';
        statusBadge.className = 'status-badge disconnected';
      }
      setTimeout(initConnection, 5000);
    };

    ws.onerror = () => {
      // ws error handled in onclose
    };
  } catch {
    if (broadcastChannel) {
      statusBadge.textContent = 'Local Tab Sync (Active)';
      statusBadge.className = 'status-badge';
    }
  }
}

// UI Listeners
btnPlay.addEventListener('click', () => {
  sendCommand('togglePlay');
});

btnJumpBack.addEventListener('click', () => {
  sendCommand('jump', { seconds: -5 });
});

btnJumpFwd.addEventListener('click', () => {
  sendCommand('jump', { seconds: 5 });
});

btnRestart.addEventListener('click', () => {
  sendCommand('restart');
});

speedSlider.addEventListener('input', (e) => {
  const speed = parseInt(e.target.value, 10);
  speedVal.textContent = speed;
  sendCommand('setSpeed', { speed });
});

initConnection();

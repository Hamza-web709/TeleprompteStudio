import http from 'http';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 8280;

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: 'Teleprompter Studio Pro Server',
      websocketPort: PORT,
      lanIp: getLanIp(),
      timestamp: Date.now()
    }));
    return;
  }

  if (url.pathname === '/api/ai/process') {
    // Configurable AI Provider Integration Gateway
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const providerApiKey = process.env.AI_PROVIDER_KEY;

        if (!providerApiKey) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'AI_PROVIDER_KEY is not configured in the server environment. Set AI_PROVIDER_KEY in .env to enable cloud AI processing.',
            code: 'PROVIDER_UNCONFIGURED'
          }));
          return;
        }

        // Provider processing logic here when key is supplied
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          jobId: `job-${Date.now()}`,
          status: 'queued',
          provider: payload.provider || 'default'
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// WebSocket Server for Real-Time Remote Control Sync
const wss = new WebSocketServer({ server });
const rooms = new Map(); // sessionToken -> { host: ws, remotes: Set<ws> }

wss.on('connection', (ws) => {
  let userSession = null;
  let userRole = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'register') {
        const { session, role } = data;
        userSession = session;
        userRole = role;

        if (!rooms.has(session)) {
          rooms.set(session, { host: null, remotes: new Set() });
        }

        const room = rooms.get(session);

        if (role === 'host') {
          room.host = ws;
          ws.send(JSON.stringify({ type: 'registered', role: 'host', session }));
        } else if (role === 'remote') {
          room.remotes.add(ws);
          ws.send(JSON.stringify({ type: 'registered', role: 'remote', session }));
          if (room.host && room.host.readyState === WebSocket.OPEN) {
            room.host.send(JSON.stringify({ type: 'remote:connected', count: room.remotes.size }));
          }
        }
        return;
      }

      if (!userSession || !rooms.has(userSession)) return;
      const room = rooms.get(userSession);

      // If remote sent command -> forward to host
      if (userRole === 'remote' && room.host && room.host.readyState === WebSocket.OPEN) {
        room.host.send(JSON.stringify(data));
      }

      // If host sent status update -> broadcast to all connected remotes in room
      if (userRole === 'host') {
        room.remotes.forEach(remoteWs => {
          if (remoteWs.readyState === WebSocket.OPEN) {
            remoteWs.send(JSON.stringify(data));
          }
        });
      }
    } catch (err) {
      console.error('[WebSocket] Message handling error:', err);
    }
  });

  ws.on('close', () => {
    if (userSession && rooms.has(userSession)) {
      const room = rooms.get(userSession);
      if (userRole === 'host') {
        room.host = null;
      } else if (userRole === 'remote') {
        room.remotes.delete(ws);
        if (room.host && room.host.readyState === WebSocket.OPEN) {
          room.host.send(JSON.stringify({ type: 'remote:disconnected', count: room.remotes.size }));
        }
      }
      if (!room.host && room.remotes.size === 0) {
        rooms.delete(userSession);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Teleprompter Studio Server] Running on http://localhost:${PORT}`);
  console.log(`[WebSocket Server] Ready for Remote Pairing on port ${PORT}`);
});

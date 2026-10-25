import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptWebSocket } from './websocket.js';
import { RoomManager } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const VERSION = readVersion();
const GAME_NAME = 'Království';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    return pkg.version || '2.0.0';
  } catch (err) {
    return '2.0.0';
  }
}

const rooms = new RoomManager();
rooms.start();

function log(message) {
  const time = new Date().toLocaleTimeString('cs-CZ');
  console.log(`[${time}] ${message}`);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function statusPayload() {
  return {
    status: 'online',
    game: GAME_NAME,
    version: VERSION,
    timestamp: Date.now(),
    uptime: Math.round(process.uptime()),
    rooms: rooms.roomCount,
    players: rooms.onlinePlayers,
    maxPlayersPerRoom: 4
  };
}

/**
 * Bezpečně převede URL cestu na soubor v CLIENT_DIR.
 * Vrací null, pokud by cesta vedla mimo složku klienta.
 */
function resolveStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const relative = decoded.replace(/^\/+/, '');
  const target = path.resolve(CLIENT_DIR, relative);
  if (target !== CLIENT_DIR && !target.startsWith(CLIENT_DIR + path.sep)) {
    return null;
  }
  return target;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch (err) {
    return false;
  }
}

function serveFile(req, res, target, { fallback = false } = {}) {
  let filePath = target;

  if (isDirectory(filePath)) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (!fallback) {
        sendNotFound(res);
        return;
      }
      serveFile(req, res, path.join(CLIENT_DIR, 'index.html'));
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    const revalidate = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.mjs';

    const headers = {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) sendNotFound(res);
      else res.destroy();
    });
    stream.pipe(res);
  });
}

function sendNotFound(res) {
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end('404 – soubor nenalezen');
}

function handleRequest(req, res) {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('405 – metoda není povolena');
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  log(`${method} ${pathname}`);

  if (pathname === '/api/status') {
    sendJson(res, 200, statusPayload());
    return;
  }

  if (pathname === '/api/rooms') {
    sendJson(res, 200, {
      rooms: rooms.roomCount,
      players: rooms.onlinePlayers,
      maxPlayersPerRoom: 4
    });
    return;
  }

  const target = resolveStaticPath(pathname);
  if (!target) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 – přístup odmítnut');
    return;
  }

  const hasExtension = path.extname(pathname) !== '';
  if (pathname === '/' || pathname === '') {
    serveFile(req, res, path.join(CLIENT_DIR, 'index.html'));
    return;
  }

  serveFile(req, res, target, { fallback: !hasExtension });
}

const server = http.createServer(handleRequest);

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const ws = acceptWebSocket(req, socket, head);
  if (ws) {
    rooms.attach(ws);
    log('WebSocket připojen');
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log('========================================================');
  console.log(`🏰 ${GAME_NAME} ${VERSION} – server běží`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   API:       http://localhost:${PORT}/api/status`);
  console.log('========================================================');
  log('Server připraven. Stiskněte Ctrl+C pro ukončení.');
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Přijat signál ${signal}, ukončuji server…`);
  rooms.stop();
  server.close(() => {
    log('Server ukončen.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

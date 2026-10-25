import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE_BYTES = 1024 * 1024;
const HEARTBEAT_MS = 2000;
const HEARTBEAT_TIMEOUT_MS = 10000;

const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

/**
 * Dokončí RFC 6455 handshake a vrátí obousměrné WebSocket spojení.
 * Implementace je záměrně bez externích závislostí.
 */
export function acceptWebSocket(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  const version = String(req.headers['sec-websocket-version'] || '');
  const upgrade = String(req.headers.upgrade || '').toLowerCase();

  if (!key || version !== '13' || upgrade !== 'websocket') {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return null;
  }

  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    '\r\n'
  );
  socket.setNoDelay(true);
  socket.setTimeout(0);

  return new WebSocketConnection(socket, head);
}

export class WebSocketConnection extends EventEmitter {
  constructor(socket, head) {
    super();
    this.socket = socket;
    this.buffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
    this.closed = false;
    this.finished = false;
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.fragmentBytes = 0;
    this.lastPong = Date.now();
    this.heartbeat = setInterval(() => this.heartbeatTick(), HEARTBEAT_MS);
    if (this.heartbeat.unref) this.heartbeat.unref();

    socket.on('data', (chunk) => this.receive(chunk));
    socket.on('error', () => this.finish());
    socket.on('close', () => this.finish());
    socket.on('end', () => this.finish());

    // Data z HTTP upgradu zpracujeme až po navěšení posluchačů.
    queueMicrotask(() => this.parse());
  }

  get alive() {
    return !this.closed && !this.socket.destroyed;
  }

  receive(chunk) {
    if (this.closed || !chunk || !chunk.length) return;
    this.buffer = this.buffer.length
      ? Buffer.concat([this.buffer, chunk])
      : chunk;
    if (this.buffer.length > MAX_MESSAGE_BYTES * 2) {
      this.close(1009, 'Zpráva je příliš velká.');
      return;
    }
    this.parse();
  }

  parse() {
    while (!this.closed && this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const rsv = b0 & 0x70;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let length = b1 & 0x7f;
      let offset = 2;

      if (rsv !== 0) {
        this.close(1002, 'Nepovolené bity RSV.');
        return;
      }

      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const big = this.buffer.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE_BYTES)) {
          this.close(1009, 'Zpráva je příliš velká.');
          return;
        }
        length = Number(big);
        offset = 10;
      }

      if (length > MAX_MESSAGE_BYTES) {
        this.close(1009, 'Zpráva je příliš velká.');
        return;
      }

      // Klient musí všechny rámce maskovat.
      if (!masked) {
        this.close(1002, 'Neplatný rámec.');
        return;
      }

      const total = offset + 4 + length;
      if (this.buffer.length < total) return;

      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.allocUnsafe(length);
      for (let i = 0; i < length; i++) {
        payload[i] = this.buffer[offset + 4 + i] ^ mask[i & 3];
      }
      this.buffer = this.buffer.subarray(total);

      this.handleFrame(fin, opcode, payload);
    }
  }

  handleFrame(fin, opcode, payload) {
    if (opcode === OPCODE.CLOSE) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
      this.close(code >= 1000 && code < 5000 ? code : 1000, '');
      return;
    }

    if (opcode === OPCODE.PING) {
      this.sendFrame(OPCODE.PONG, payload);
      return;
    }

    if (opcode === OPCODE.PONG) {
      this.lastPong = Date.now();
      return;
    }

    if (opcode === OPCODE.TEXT || opcode === OPCODE.BINARY) {
      if (this.fragments.length) {
        this.close(1002, 'Neplatné fragmentování.');
        return;
      }
      if (!fin) {
        this.fragments = [payload];
        this.fragmentOpcode = opcode;
        this.fragmentBytes = payload.length;
        return;
      }
      this.deliver(opcode, payload);
      return;
    }

    if (opcode === OPCODE.CONTINUATION) {
      if (!this.fragments.length) {
        this.close(1002, 'Neočekávané pokračování.');
        return;
      }
      this.fragments.push(payload);
      this.fragmentBytes += payload.length;
      if (this.fragmentBytes > MAX_MESSAGE_BYTES) {
        this.close(1009, 'Zpráva je příliš velká.');
        return;
      }
      if (fin) {
        const full = Buffer.concat(this.fragments);
        const original = this.fragmentOpcode;
        this.fragments = [];
        this.fragmentOpcode = 0;
        this.fragmentBytes = 0;
        if (original === OPCODE.BINARY) return;
        this.deliver(original, full);
      }
      return;
    }

    this.close(1002, 'Neznámý typ rámce.');
  }

  deliver(opcode, payload) {
    if (opcode !== OPCODE.TEXT) return;
    let text;
    try {
      text = payload.toString('utf8');
    } catch (err) {
      return;
    }
    try {
      this.emit('message', text);
    } catch (err) {
      this.emit('handlerError', err);
    }
  }

  sendFrame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return false;
    const body = payload || Buffer.alloc(0);
    const length = body.length;
    let header;

    if (length < 126) {
      header = Buffer.allocUnsafe(2);
      header[0] = 0x80 | opcode;
      header[1] = length;
    } else if (length < 65536) {
      header = Buffer.allocUnsafe(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    try {
      this.socket.write(Buffer.concat([header, body]));
      return true;
    } catch (err) {
      this.finish();
      return false;
    }
  }

  sendText(text) {
    return this.sendFrame(OPCODE.TEXT, Buffer.from(String(text), 'utf8'));
  }

  sendJson(value) {
    try {
      return this.sendText(JSON.stringify(value));
    } catch (err) {
      return false;
    }
  }

  ping() {
    return this.sendFrame(OPCODE.PING, Buffer.alloc(0));
  }

  heartbeatTick() {
    if (this.closed) return;
    if (Date.now() - this.lastPong > HEARTBEAT_TIMEOUT_MS) {
      this.close(1001, 'Heartbeat vypršel.');
      return;
    }
    this.ping();
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const reasonBuf = Buffer.from(String(reason).slice(0, 123), 'utf8');
    const payload = Buffer.allocUnsafe(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    this.sendFrame(OPCODE.CLOSE, payload);
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    try {
      this.socket.end();
    } catch (err) { /* ignore */ }
    const socket = this.socket;
    const timer = setTimeout(() => {
      try { socket.destroy(); } catch (err) { /* ignore */ }
    }, 1000);
    if (timer.unref) timer.unref();
    this.finish();
  }

  terminate() {
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    try { this.socket.destroy(); } catch (err) { /* ignore */ }
    this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.emit('close');
  }
}

import { t } from './i18n/index.js';
/**
 * WebSocket klient pro multiplayer. Servery se hledají na stejné adrese,
 * na které běží klient (Node server zároveň servíruje hru i websockety).
 */
export class NetClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.closedByUser = false;
    this.serverInfo = null;
  }

  static async findServer(timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('/api/status', { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(t("Server neodpovídá."));
      const data = await res.json();
      if (data.status !== 'online') throw new Error(t("Server není dostupný."));
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  static url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  connect(join = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { this.ws && this.ws.close(); } catch (e) { /* ignore */ }
        reject(new Error(t("Server není dostupný.")));
      }, timeoutMs);

      try {
        this.ws = new WebSocket(NetClient.url());
      } catch (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      this.closedByUser = false;

      this.ws.onopen = () => {
        this.send({ type: 'join', ...join });
      };
      this.ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch (err) {
          return;
        }
        if (msg.type === 'welcome') {
          settled = true;
          clearTimeout(timer);
          resolve(msg);
        } else if (msg.type === 'error' && !settled) {
          settled = true;
          clearTimeout(timer);
          const error = new Error(msg.message || t("Server odmítl připojení."));
          error.code = msg.code || 'ERROR';
          try { this.ws.close(); } catch (e) { /* ignore */ }
          reject(error);
          return;
        }
        if (this.handlers.onMessage) this.handlers.onMessage(msg);
      };
      this.ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(t("Server není dostupný.")));
        }
      };
      this.ws.onclose = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(t("Spojení se serverem bylo uzavřeno.")));
        }
        if (!this.closedByUser && this.handlers.onClose) this.handlers.onClose();
      };
    });
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  close() {
    this.closedByUser = true;
    try {
      if (this.ws) this.ws.close();
    } catch (err) {
      // ignore
    }
    this.ws = null;
  }
}

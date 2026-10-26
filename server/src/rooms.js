import { MAX_PLAYERS } from '../../client/js/sim/constants.js';
import { TICK_MS, MAX_ROOMS, validNick } from './room-config.js';
import { Room } from './room.js';

export { Room };

/**
 * Spravuje všechny místnosti a přiřazuje nové hráče do volné lobby.
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.nextRoomId = 1;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.update(), TICK_MS);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
  }

  update() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      try {
        room.update(now);
      } catch (err) {
        console.error(`[room ${room.id}] Chyba simulace:`, err);
      }
    }
    for (const room of [...this.rooms.values()]) {
      if (room.participants.length === 0 && room.state === 'lobby') {
        room.destroy();
        this.rooms.delete(room.id);
      }
    }
  }

  get roomCount() {
    return this.rooms.size;
  }

  get onlinePlayers() {
    let count = 0;
    for (const room of this.rooms.values()) count += room.connected().length;
    return count;
  }

  findByToken(token) {
    if (!token) return null;
    for (const room of this.rooms.values()) {
      const participant = room.findByToken(token);
      if (participant) return { room, participant };
    }
    return null;
  }

  pickRoom(nick) {
    let nickTaken = false;

    for (const room of this.rooms.values()) {
      if (room.state !== 'lobby' && room.state !== 'countdown') continue;
      if (room.participants.length >= MAX_PLAYERS) continue;
      if (room.hasNick(nick)) {
        nickTaken = true;
        continue;
      }
      return room;
    }

    if (nickTaken && this.rooms.size > 0) {
      // Nick je obsazený ve všech volných lobby; nová místnost by nebyla
      // potřeba, ale hráč musí zvolit jiný nick.
      const anyJoinable = [...this.rooms.values()].some(
        r => (r.state === 'lobby' || r.state === 'countdown') && r.participants.length < MAX_PLAYERS
      );
      if (anyJoinable) return { error: 'NICK_TAKEN' };
    }

    if (this.rooms.size >= MAX_ROOMS) return { error: 'FULL' };
    const room = new Room(this, this.nextRoomId++);
    this.rooms.set(room.id, room);
    return room;
  }

  cleanupRoom(room) {
    if (!room || room.destroyed) return;
    if (room.participants.length === 0 && room.state === 'lobby') {
      room.destroy();
      this.rooms.delete(room.id);
    }
  }

  /** Navěsí WebSocket a čeká na zprávu join. */
  attach(ws) {
    let joined = false;
    const timeout = setTimeout(() => {
      if (!joined) ws.close(1008, 'Přihlášení vypršelo.');
    }, 15000);
    if (timeout.unref) timeout.unref();

    ws.on('message', (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch (err) {
        return;
      }
      if (!joined) {
        if (!msg || msg.type !== 'join') return;
        joined = true;
        clearTimeout(timeout);
        this.handleJoin(ws, msg);
        return;
      }
      const room = ws.room;
      const participant = ws.participant;
      if (room && participant) room.handleClientMessage(participant, msg);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (!joined) return;
      const room = ws.room;
      const participant = ws.participant;
      ws.room = null;
      ws.participant = null;
      if (room && participant) room.handleDisconnect(participant);
    });

    ws.on('handlerError', (err) => {
      console.error('[ws] Chyba obsluhy zprávy:', err);
    });
  }

  handleJoin(ws, msg) {
    const nick = typeof msg.nick === 'string' ? msg.nick.trim() : '';
    if (!validNick(nick)) {
      ws.sendJson({
        type: 'error',
        code: 'BAD_NICK',
        message: 'Nick musí mít 3–16 znaků: písmena, číslice, mezera nebo podtržítko.'
      });
      ws.close(1008, 'BAD_NICK');
      return;
    }

    const token = typeof msg.token === 'string' && msg.token.length <= 120
      ? msg.token
      : null;

    if (token) {
      const found = this.findByToken(token);
      if (found) {
        if (found.participant.nick.toLowerCase() !== nick.toLowerCase()) {
          ws.sendJson({
            type: 'error',
            code: 'BAD_TOKEN',
            message: 'Uložený token nepatří tomuto nicku.'
          });
          ws.close(1008, 'BAD_TOKEN');
          return;
        }
        found.room.reconnect(found.participant, ws);
        return;
      }
    }

    const picked = this.pickRoom(nick);
    if (!picked) {
      ws.sendJson({
        type: 'error',
        code: 'FULL',
        message: 'Všechny servery jsou plné.'
      });
      ws.close(1013, 'FULL');
      return;
    }
    if (picked.error) {
      const message = picked.error === 'NICK_TAKEN'
        ? 'Tento nick je na serveru již obsazený. Zvolte prosím jiný.'
        : 'Všechny servery jsou plné.';
      ws.sendJson({ type: 'error', code: picked.error, message });
      ws.close(1008, picked.error);
      return;
    }
    picked.join(ws, nick);
  }
}

import crypto from 'node:crypto';
import { GameSim } from '../../client/js/sim/sim.js';
import {
  MAP_PRESETS, PLAYER_COLORS, PLAYER_COLOR_NAMES, MAX_PLAYERS
} from '../../client/js/sim/constants.js';

const TICK_MS = 50;                 // 20 ticků za sekundu
const SNAPSHOT_MS = 200;            // 5 snímků za sekundu
const COUNTDOWN_SECONDS = positiveInt(process.env.LOBBY_COUNTDOWN, 20);
const RETURN_SECONDS = positiveInt(process.env.RETURN_DELAY, 30);
const RECONNECT_SECONDS = positiveInt(process.env.RECONNECT_GRACE, 120);
const MAX_ROOMS = positiveInt(process.env.MAX_ROOMS, 8);
const MAX_COMMANDS_PER_SECOND = 60;

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function validNick(nick) {
  return typeof nick === 'string' &&
    /^[A-Za-z0-9_ ]{3,16}$/.test(nick) &&
    nick.trim().length >= 3;
}

function randomSeed() {
  return crypto.randomBytes(4).readUInt32BE(0);
}

function randomMapKey() {
  const keys = Object.keys(MAP_PRESETS);
  return keys[crypto.randomInt(keys.length)];
}

function publicPlayer(p) {
  return {
    id: p.playerId,
    name: p.nick,
    color: p.color,
    colorName: p.colorName
  };
}

/**
 * Místnost = jeden herní server. Hráči se automaticky přiřazují do volné
 * lobby; rozehraná místnost nové hráče nepřijímá.
 */
export class Room {
  constructor(manager, id) {
    this.manager = manager;
    this.id = id;
    this.name = `Království #${id}`;
    this.state = 'lobby'; // lobby | countdown | playing | ended
    this.participants = [];
    this.mapKey = randomMapKey();
    this.fog = false;
    this.capital = 'medium';
    this.countdownEnd = 0;
    this.lastCountdown = -1;
    this.sim = null;
    this.seed = 0;
    this.gameOverSent = false;
    this.returnAt = 0;
    this.eventCursor = 0;
    this.acc = 0;
    this.lastUpdate = 0;
    this.lastSnapshotAt = 0;
    this.destroyed = false;
  }

  get maxPlayers() {
    return MAX_PLAYERS;
  }

  connected() {
    return this.participants.filter(p => p.connected && !p.left);
  }

  usedSlots() {
    return new Set(this.participants.map(p => p.slot));
  }

  freeSlot() {
    const used = this.usedSlots();
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  hasNick(nick) {
    const lower = nick.toLowerCase();
    return this.participants.some(p => p.nick.toLowerCase() === lower);
  }

  findByToken(token) {
    if (!token) return null;
    return this.participants.find(p => p.token === token) || null;
  }

  // ------------------------------------------------------------------
  //  Připojení a odpojení
  // ------------------------------------------------------------------

  join(ws, nick) {
    if (this.state === 'playing' || this.state === 'ended') {
      return this.fail(ws, 'FULL', 'Tento server právě hraje. Zkuste to znovu později.');
    }
    if (this.participants.length >= MAX_PLAYERS) {
      return this.fail(ws, 'FULL', 'Server je plný.');
    }
    if (this.hasNick(nick)) {
      return this.fail(ws, 'NICK_TAKEN', 'Tento nick je na serveru již obsazený.');
    }

    const slot = this.freeSlot();
    if (slot === -1) {
      return this.fail(ws, 'FULL', 'Server je plný.');
    }

    const now = Date.now();
    const participant = {
      token: crypto.randomUUID(),
      nick,
      slot,
      playerId: slot + 1,
      color: PLAYER_COLORS[slot],
      colorName: PLAYER_COLOR_NAMES[slot],
      ws,
      connected: true,
      disconnectedAt: 0,
      left: false,
      joinedAt: now,
      mapCursor: 0,
      commands: []
    };
    this.participants.push(participant);
    ws.room = this;
    ws.participant = participant;

    this.sendWelcome(participant, false);
    this.broadcastLobby();
    this.updateLobbyState(now);
    return participant;
  }

  reconnect(participant, ws) {
    if (participant.left) {
      return this.fail(ws, 'GONE', 'Vaše hra již skončila. Připojte se prosím znovu.');
    }
    if (participant.connected && participant.ws && participant.ws !== ws) {
      try { participant.ws.close(1000, 'Připojeno z jiného zařízení.'); } catch (err) { /* ignore */ }
    }
    participant.connected = true;
    participant.disconnectedAt = 0;
    participant.ws = ws;
    ws.room = this;
    ws.participant = participant;

    this.sendWelcome(participant, true);
    if (this.state === 'playing' || this.state === 'ended') {
      this.sendSnapshot(participant);
      if (this.sim && this.sim.ended) this.sendGameOver(participant);
    } else {
      this.broadcastLobby();
      this.updateLobbyState(Date.now());
    }
    return participant;
  }

  handleDisconnect(participant) {
    if (!participant || participant.left) return;
    participant.connected = false;
    participant.ws = null;
    participant.disconnectedAt = Date.now();

    if (this.state === 'lobby' || this.state === 'countdown') {
      this.participants = this.participants.filter(p => p !== participant);
      this.broadcastLobby();
      this.updateLobbyState(Date.now());
      this.manager.cleanupRoom(this);
      return;
    }

    if (this.state === 'ended') {
      this.participants = this.participants.filter(p => p !== participant);
      this.manager.cleanupRoom(this);
      return;
    }

    if (this.state === 'playing') {
      this.broadcastInfo(`${participant.nick} se odpojil. Má ${RECONNECT_SECONDS} s na návrat.`);
    }
  }

  leave(participant) {
    if (!participant || participant.left) return;
    participant.left = true;
    participant.connected = false;
    const now = Date.now();

    if (this.state === 'playing' && this.sim) {
      this.sim.eliminatePlayer(participant.playerId);
      this.broadcastInfo(`${participant.nick} opustil hru a prohrává.`);
      if (this.sim.ended) this.finishGame(now);
    } else if (this.state === 'lobby' || this.state === 'countdown') {
      this.participants = this.participants.filter(p => p !== participant);
      this.broadcastLobby();
      this.updateLobbyState(now);
    } else if (this.state === 'ended') {
      this.participants = this.participants.filter(p => p !== participant);
    }

    const ws = participant.ws;
    participant.ws = null;
    if (ws) {
      ws.room = null;
      ws.participant = null;
      try { ws.close(1000, 'Hráč opustil hru.'); } catch (err) { /* ignore */ }
    }
    this.manager.cleanupRoom(this);
  }

  fail(ws, code, message) {
    try {
      ws.sendJson({ type: 'error', code, message });
      ws.close(1008, code);
    } catch (err) { /* ignore */ }
    return null;
  }

  // ------------------------------------------------------------------
  //  Lobby
  // ------------------------------------------------------------------

  lobbyMessage() {
    const map = MAP_PRESETS[this.mapKey] || MAP_PRESETS.desert;
    const countdown = this.state === 'countdown'
      ? Math.max(0, Math.ceil((this.countdownEnd - Date.now()) / 1000))
      : 0;
    return {
      type: 'lobby',
      serverName: this.name,
      maxPlayers: MAX_PLAYERS,
      players: this.connected().map(publicPlayer),
      countdown,
      state: this.state,
      fog: this.fog,
      capital: this.capital,
      map
    };
  }

  broadcastLobby() {
    if (this.state !== 'lobby' && this.state !== 'countdown') return;
    const msg = this.lobbyMessage();
    for (const p of this.connected()) {
      if (p.ws) p.ws.sendJson(msg);
    }
  }

  updateLobbyState(now = Date.now()) {
    if (this.state !== 'lobby' && this.state !== 'countdown') return;
    const connected = this.connected();

    if (connected.length < 2) {
      if (this.state === 'countdown') {
        this.state = 'lobby';
        this.countdownEnd = 0;
        this.lastCountdown = -1;
        this.broadcastLobby();
      }
      return;
    }

    if (this.state === 'lobby') {
      this.state = 'countdown';
      this.countdownEnd = now + COUNTDOWN_SECONDS * 1000;
      this.lastCountdown = -1;
      this.broadcastLobby();
    }

    const left = Math.max(0, Math.ceil((this.countdownEnd - now) / 1000));
    if (left !== this.lastCountdown) {
      this.lastCountdown = left;
      this.broadcastLobby();
    }
    if (now >= this.countdownEnd) this.startGame(now);
  }

  startGame(now = Date.now()) {
    const list = this.connected().sort((a, b) => a.slot - b.slot);
    if (list.length < 2) {
      this.state = 'lobby';
      this.broadcastLobby();
      return;
    }

    // Simulace přiděluje id podle pořadí, proto je před startem zkompaktujeme.
    list.forEach((p, index) => { p.playerId = index + 1; });
    this.seed = randomSeed();
    this.state = 'playing';
    this.countdownEnd = 0;
    this.gameOverSent = false;
    this.eventCursor = 0;
    this.acc = 0;
    this.lastUpdate = now;
    this.lastSnapshotAt = 0;
    this.sim = new GameSim({
      seed: this.seed,
      mapType: this.mapKey,
      mode: 'multiplayer',
      capital: this.capital,
      fog: this.fog,
      players: list.map(p => ({
        name: p.nick,
        color: p.color,
        isBot: false
      }))
    });

    for (const p of list) {
      p.left = false;
      p.mapCursor = this.sim.mapChangeSeq;
      if (!p.ws) continue;
      p.ws.sendJson({ type: 'start', config: this.gameConfig(p) });
    }
    this.lastSnapshotAt = 0;
    this.sendSnapshots(now);
    this.broadcastInfo('Bitva začala! Ochraňte svůj Královský hrad.');
  }

  gameConfig(participant) {
    const sim = this.sim;
    const changes = sim.getMapChangesSince(0);
    return {
      seed: this.seed,
      mapType: this.mapKey,
      capital: this.capital,
      fog: this.fog,
      selfId: participant.playerId,
      players: sim.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        colorName: p.colorName,
        isBot: false,
        alive: p.alive,
        population: p.population,
        capacity: p.capacity,
        stats: { ...p.stats }
      })),
      mapChanges: changes.changes,
      mapChangeSeq: changes.seq
    };
  }

  sendWelcome(participant, resumed) {
    const ws = participant.ws;
    if (!ws) return;
    const welcome = {
      type: 'welcome',
      token: participant.token,
      selfId: participant.playerId,
      serverName: this.name,
      resumed: !!resumed
    };
    if (this.state === 'playing' || this.state === 'ended') {
      welcome.game = this.gameConfig(participant);
    } else {
      welcome.lobby = this.lobbyMessage();
    }
    ws.sendJson(welcome);
  }

  // ------------------------------------------------------------------
  //  Hra
  // ------------------------------------------------------------------

  update(now = Date.now()) {
    if (this.destroyed) return;

    if (this.state === 'lobby' || this.state === 'countdown') {
      this.updateLobbyState(now);
      return;
    }

    if (this.state === 'ended') {
      if (now >= this.returnAt) this.resetToLobby(now);
      return;
    }

    if (this.state !== 'playing' || !this.sim) return;

    if (this.lastUpdate) {
      const elapsed = Math.min(250, now - this.lastUpdate);
      this.acc += elapsed;
      while (this.acc >= TICK_MS && !this.sim.ended) {
        this.sim.tick(TICK_MS / 1000);
        this.acc -= TICK_MS;
      }
    }
    this.lastUpdate = now;

    this.checkReconnectGrace(now);
    if (this.sim.ended) {
      this.finishGame(now);
      return;
    }

    this.broadcastEvents();

    if (now - this.lastSnapshotAt >= SNAPSHOT_MS) {
      this.sendSnapshots(now);
    }
  }

  checkReconnectGrace(now) {
    if (!this.sim || this.sim.ended) return;
    for (const p of this.participants) {
      if (p.connected || p.left || !p.disconnectedAt) continue;
      if (now - p.disconnectedAt < RECONNECT_SECONDS * 1000) continue;
      p.left = true;
      this.sim.eliminatePlayer(p.playerId);
      this.broadcastInfo(`Hráč ${p.nick} byl po ${RECONNECT_SECONDS} s vyřazen ze hry.`);
      if (this.sim.ended) {
        this.finishGame(now);
        return;
      }
    }
  }

  sendSnapshots(now = Date.now()) {
    this.lastSnapshotAt = now;
    for (const p of this.connected()) {
      this.sendSnapshot(p);
    }
  }

  sendSnapshot(participant) {
    if (!this.sim || !participant.ws || !participant.playerId) return;
    const snap = this.sim.serialize(participant.playerId);
    const changes = this.sim.getMapChangesSince(participant.mapCursor || 0);
    snap.mapChanges = changes.changes;
    snap.mapChangesSince = changes.seq;
    participant.mapCursor = changes.seq;
    participant.ws.sendJson({ type: 'snapshot', ...snap });
  }

  broadcastEvents() {
    if (!this.sim) return;
    const fresh = this.sim.events.filter(e => e.seq > this.eventCursor);
    if (!fresh.length) return;
    this.eventCursor = fresh[fresh.length - 1].seq;
    const msg = { type: 'events', events: fresh };
    for (const p of this.connected()) {
      if (p.ws) p.ws.sendJson(msg);
    }
    // Historie událostí nesmí růst bez omezení.
    if (this.sim.events.length > 6000) {
      this.sim.events.splice(0, this.sim.events.length - 1500);
    }
  }

  broadcastInfo(text) {
    const msg = { type: 'info', text, kind: 'info' };
    for (const p of this.connected()) {
      if (p.ws) p.ws.sendJson(msg);
    }
  }

  finishGame(now = Date.now()) {
    if (this.gameOverSent || !this.sim) return;
    this.gameOverSent = true;
    this.state = 'ended';
    this.returnAt = now + RETURN_SECONDS * 1000;

    const msg = {
      type: 'gameover',
      winnerId: this.sim.winnerId,
      time: this.sim.endTime || this.sim.time,
      returnIn: RETURN_SECONDS,
      players: this.sim.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        colorName: p.colorName,
        alive: p.alive,
        stats: { ...p.stats }
      }))
    };
    for (const p of this.connected()) {
      if (p.ws) p.ws.sendJson(msg);
    }
  }

  sendGameOver(participant) {
    if (!participant.ws || !this.sim || !this.sim.ended) return;
    participant.ws.sendJson({
      type: 'gameover',
      winnerId: this.sim.winnerId,
      time: this.sim.endTime || this.sim.time,
      returnIn: Math.max(0, Math.ceil((this.returnAt - Date.now()) / 1000)),
      players: this.sim.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        colorName: p.colorName,
        alive: p.alive,
        stats: { ...p.stats }
      }))
    });
  }

  resetToLobby(now = Date.now()) {
    this.sim = null;
    this.gameOverSent = false;
    this.eventCursor = 0;
    this.acc = 0;
    this.lastUpdate = 0;
    this.lastSnapshotAt = 0;
    this.state = 'lobby';
    this.countdownEnd = 0;
    this.lastCountdown = -1;
    this.mapKey = randomMapKey();

    this.participants = this.participants.filter(p => p.connected && !p.left);
    for (const p of this.participants) {
      p.left = false;
      p.mapCursor = 0;
      p.commands = [];
      p.disconnectedAt = 0;
    }
    this.participants.forEach((p, i) => { p.playerId = i + 1; });

    this.broadcastLobby();
    this.updateLobbyState(now);
    this.manager.cleanupRoom(this);
  }

  handleClientMessage(participant, msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'leave') {
      this.leave(participant);
      return;
    }

    if (msg.type !== 'command') return;
    if (this.state !== 'playing' || !this.sim) {
      participant.ws && participant.ws.sendJson({
        type: 'cmdResult',
        result: { ok: false, reason: 'Hra ještě nezačala.' }
      });
      return;
    }
    if (!participant.connected || participant.left) return;

    const now = Date.now();
    participant.commands = participant.commands.filter(t => now - t < 1000);
    if (participant.commands.length >= MAX_COMMANDS_PER_SECOND) {
      participant.ws && participant.ws.sendJson({
        type: 'info',
        text: 'Příliš mnoho příkazů, sire. Zpomalte prosím.',
        kind: 'error'
      });
      return;
    }
    participant.commands.push(now);

    const cmd = msg.cmd;
    if (!cmd || typeof cmd !== 'object' || typeof cmd.op !== 'string') {
      participant.ws && participant.ws.sendJson({
        type: 'cmdResult',
        result: { ok: false, reason: 'Neplatný příkaz.' }
      });
      return;
    }

    let result;
    try {
      result = this.sim.command(participant.playerId, cmd);
    } catch (err) {
      console.error('[room] Chyba příkazu:', err);
      result = { ok: false, reason: 'Server příkaz nezpracoval.' };
    }
    if (participant.ws) participant.ws.sendJson({ type: 'cmdResult', result });

    if (this.sim.ended) this.finishGame(now);
  }

  destroy() {
    this.destroyed = true;
    for (const p of this.participants) {
      if (p.ws) {
        try { p.ws.close(1001, 'Server se zavírá.'); } catch (err) { /* ignore */ }
      }
    }
    this.participants = [];
    this.sim = null;
  }
}

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

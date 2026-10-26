import crypto from 'node:crypto';
import { MAP_PRESETS, PLAYER_COLORS, PLAYER_COLOR_NAMES, MAX_PLAYERS } from '../../client/js/sim/constants.js';
import { COUNTDOWN_SECONDS, RECONNECT_SECONDS, MAX_COMMANDS_PER_SECOND, randomMapKey, publicPlayer } from './room-config.js';
import { RoomMatch } from './room-match.js';

/**
 * Místnost = jeden herní server. Hráči se automaticky přiřazují do volné
 * lobby; rozehraná místnost nové hráče nepřijímá.
 */
export class Room extends RoomMatch {
  constructor(manager, id) {
    super();
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
      this.broadcastInfo(notice('{0} se odpojil. Má {1} s na návrat.', { 0: participant.nick, 1: RECONNECT_SECONDS }));
    }
  }

  leave(participant) {
    if (!participant || participant.left) return;
    participant.left = true;
    participant.connected = false;
    const now = Date.now();

    if (this.state === 'playing' && this.sim) {
      this.sim.eliminatePlayer(participant.playerId);
      this.broadcastInfo(notice('{0} opustil hru a prohrává.', { 0: participant.nick }));
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
      serverNameMessage: { key: 'Království #{0}', params: { 0: this.id } },
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

import { notice } from '../../client/js/sim/messages.js';

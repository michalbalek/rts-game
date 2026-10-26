import { GameSim } from '../../client/js/sim/sim.js';
import { TICK_MS, SNAPSHOT_MS, RETURN_SECONDS, RECONNECT_SECONDS, randomSeed, randomMapKey } from './room-config.js';

export class RoomMatch {
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

}

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Room, RoomManager } from '../server/src/rooms.js';
import { RECONNECT_SECONDS, RETURN_SECONDS, MAX_COMMANDS_PER_SECOND } from '../server/src/room-config.js';

class TestSocket extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
    this.closed = null;
  }

  sendJson(message) {
    this.messages.push(message);
  }

  close(code, reason) {
    this.closed = { code, reason };
  }

  latest(type) {
    return this.messages.filter(message => message.type === type).at(-1);
  }
}

function join(manager, nick) {
  const ws = new TestSocket();
  manager.attach(ws);
  ws.emit('message', JSON.stringify({ type: 'join', nick }));
  return ws;
}

console.log('--- Server: připojení, lobby a obnovení spojení ---');
{
  const manager = new RoomManager();
  try {
    const invalid = join(manager, 'x');
    assert.equal(invalid.latest('error').code, 'BAD_NICK');
    assert.equal(invalid.closed.code, 1008);
    assert.equal(manager.roomCount, 0);

    const first = join(manager, 'Player One');
    const room = first.room;
    assert.ok(room instanceof Room);
    assert.equal(room.state, 'lobby');
    assert.equal(first.latest('welcome').resumed, false);
    assert.equal(first.latest('welcome').lobby.players.length, 1);
    assert.deepEqual(first.latest('welcome').lobby.serverNameMessage,
      { key: 'Království #{0}', params: { 0: room.id } });
    assert.equal(manager.onlinePlayers, 1);
    assert.equal(manager.findByToken(first.participant.token).room, room);

    const duplicate = join(manager, 'player one');
    assert.equal(duplicate.latest('error').code, 'NICK_TAKEN');
    assert.equal(manager.roomCount, 1);

    const second = join(manager, 'Player Two');
    assert.equal(second.room, room);
    assert.equal(room.state, 'countdown');
    assert.equal(room.connected().length, 2);

    second.emit('close');
    assert.equal(room.state, 'lobby');
    assert.equal(room.participants.length, 1);
    assert.equal(manager.onlinePlayers, 1);

    const token = first.participant.token;
    const replacement = new TestSocket();
    manager.attach(replacement);
    replacement.emit('message', JSON.stringify({ type: 'join', nick: 'Player One', token }));
    assert.equal(replacement.room, room);
    assert.equal(replacement.latest('welcome').resumed, true);
    assert.equal(first.closed.code, 1000);

    const badToken = new TestSocket();
    manager.attach(badToken);
    badToken.emit('message', JSON.stringify({ type: 'join', nick: 'Other Player', token }));
    assert.equal(badToken.latest('error').code, 'BAD_TOKEN');

    replacement.emit('message', JSON.stringify({ type: 'leave' }));
    assert.equal(manager.roomCount, 0);
    assert.equal(room.destroyed, true);
  } finally {
    manager.stop();
  }
}
console.log('ok  : připojení, odpojení, tokeny a úklid lobby');

console.log('--- Server: životní cyklus hry ---');
{
  const manager = new RoomManager();
  try {
    const first = join(manager, 'Player One');
    const second = join(manager, 'Player Two');
    const room = first.room;
    const startAt = room.countdownEnd;
    room.update(startAt);
    assert.equal(room.state, 'playing');
    assert.equal(room.sim.players.length, 2);
    assert.equal(first.latest('start').config.selfId, 1);
    assert.equal(second.latest('start').config.selfId, 2);
    assert.ok(first.latest('snapshot'));
    assert.equal(first.latest('start').config.seed, room.seed);

    const previousTime = room.sim.time;
    room.update(startAt + 200);
    assert.ok(room.sim.time > previousTime);
    assert.equal(room.lastSnapshotAt, startAt + 200);

    const participant = first.participant;
    room.handleClientMessage(participant, { type: 'command', cmd: {} });
    assert.equal(first.latest('cmdResult').result.ok, false);
    participant.commands = Array(MAX_COMMANDS_PER_SECOND).fill(Date.now());
    room.handleClientMessage(participant, { type: 'command', cmd: { op: 'move' } });
    assert.equal(first.latest('info').kind, 'error');
    participant.commands = [];

    room.handleDisconnect(participant);
    assert.equal(room.connected().length, 1);
    assert.equal(room.state, 'playing');
    const disconnect = second.latest('info');
    assert.deepEqual(disconnect.localized, {
      key: '{0} se odpojil. Má {1} s na návrat.',
      params: { 0: 'Player One', 1: RECONNECT_SECONDS }
    });
    assert.equal(disconnect.text, `Player One se odpojil. Má ${RECONNECT_SECONDS} s na návrat.`);
    const resumed = new TestSocket();
    room.reconnect(participant, resumed);
    assert.equal(resumed.latest('welcome').resumed, true);
    assert.equal(resumed.latest('welcome').game.selfId, participant.playerId);
    assert.ok(resumed.latest('snapshot'));

    room.handleDisconnect(participant);
    const expiredAt = participant.disconnectedAt + RECONNECT_SECONDS * 1000;
    room.checkReconnectGrace(expiredAt);
    assert.equal(participant.left, true);
    assert.equal(room.state, 'ended');
    assert.equal(second.latest('gameover').winnerId, second.participant.playerId);
    assert.equal(room.returnAt, expiredAt + RETURN_SECONDS * 1000);

    const reconnectedWinner = new TestSocket();
    room.reconnect(second.participant, reconnectedWinner);
    assert.ok(reconnectedWinner.latest('gameover'));
    room.update(room.returnAt);
    assert.equal(room.state, 'lobby');
    assert.equal(room.sim, null);
    assert.equal(room.participants.length, 1);
    assert.equal(room.participants[0].playerId, 1);
    assert.equal(reconnectedWinner.latest('lobby').players.length, 1);
  } finally {
    manager.stop();
  }
  assert.equal(manager.roomCount, 0);
}
console.log('ok  : start, tiky, snímky, příkazy, návrat hráče a konec hry');

console.log('--- Server: časovač správce ---');
{
  const manager = new RoomManager();
  manager.start();
  const timer = manager.timer;
  manager.start();
  assert.equal(manager.timer, timer);
  manager.stop();
  assert.equal(manager.timer, null);
}
console.log('ok  : správce spouští a ukončuje jediný časovač');

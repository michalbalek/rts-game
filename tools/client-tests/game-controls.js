import { LocalSession, RemoteSession } from '../../client/js/game/session.js';
import { Camera } from '../../client/js/engine/camera.js';
import { Renderer } from '../../client/js/engine/renderer.js';
import { tileToScreen } from '../../client/js/engine/isometric.js';
import { selectAt, selectSameType } from '../../client/js/game/input-selection.js';
import { focusLastAlert, changeGameSpeed } from '../../client/js/game/input-navigation.js';
import { GAME_SPEEDS, nextSpeed, stepSimulation } from '../../client/js/game/game-speed.js';

function makeInput() {
  const session = new LocalSession({
    seed: 1234, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Test', isBot: false }]
  });
  const toasts = [];
  const ui = {
    speed: 1,
    renderSelection() {},
    toast(text) { toasts.push(text); },
    setSpeed(speed) { this.speed = speed; }
  };
  const camera = new Camera({ clientWidth: 1600, clientHeight: 900 });
  const castle = session.castle;
  camera.centerOnTile(castle.centerX, castle.centerY);
  return { session, camera, ui, toasts, lastClick: null, selectSameType };
}

function click(input, unit, sameType = false) {
  const p = tileToScreen(unit.x, unit.y);
  const s = input.camera.worldToScreen(p.x, p.y - 10);
  selectAt.call(input, s.x, s.y, false, sameType);
}

export function testGameControls(assert) {
  console.log('\n--- Rychlost hry ---');
  const steps = [];
  stepSimulation({ ended: false, tick(dt) { steps.push(dt); } }, 0.1, 3);
  const total = steps.reduce((sum, dt) => sum + dt, 0);
  assert(steps.length === 6 && steps.every(dt => dt <= 0.05 + 1e-9) && Math.abs(total - 0.3) < 1e-9,
    'zrychlený snímek se rozdělí na kroky simulace nejvýše po 50 ms');
  assert(nextSpeed(1, 1) === 1.5 && nextSpeed(GAME_SPEEDS.at(-1), 1) === GAME_SPEEDS.at(-1) &&
    nextSpeed(GAME_SPEEDS[0], -1) === GAME_SPEEDS[0], 'rychlost se mění po stupních a drží se v mezích');

  const input = makeInput();
  const before = input.session.sim.time;
  input.session.speed = 2;
  input.session.tick(0.1);
  assert(Math.abs(input.session.sim.time - before - 0.2) < 1e-9, 'lokální hra při 2× uběhne dvojnásobný čas');
  input.session.speed = 1;
  changeGameSpeed.call(input, 1);
  assert(input.session.speed === 1.5 && input.ui.speed === 1.5, 'klávesa + zrychlí hru a aktualizuje ukazatel');
  const remote = new RemoteSession({ seed: 1234, mapType: 'desert', selfId: 1, players: [] }, null);
  const toastsBefore = input.toasts.length;
  changeGameSpeed.call({ ...input, session: remote }, 1);
  assert(remote.speed === undefined && input.toasts.length === toastsBefore + 1,
    'v multiplayeru se rychlost nemění a hráč dostane vysvětlení');

  console.log('\n--- Výběr jednotek stejného typu ---');
  const { session } = input;
  const castle = session.castle;
  const swords = [0, 1, 2].map(i => session.sim.addUnit('swordsman', session.selfId,
    castle.tileX + 8 + i * 2, castle.tileY - 4));
  const far = session.sim.addUnit('swordsman', session.selfId, castle.tileX + 70, castle.tileY + 70);
  click(input, swords[0]);
  assert(session.selection.length === 1 && session.selection[0].id === swords[0].id, 'první klik vybere jednu jednotku');
  click(input, swords[0]);
  const ids = session.selection.map(u => u.id);
  assert(swords.every(u => ids.includes(u.id)) && !ids.includes(far.id) &&
    session.selection.every(u => u.type === 'swordsman'),
  'dvojklik vybere všechny vlastní pěšáky na obrazovce, ne jednotky mimo ni');
  const villager = session.state.units.find(u => u.type === 'villager');
  click(input, villager, true);
  assert(session.selection.length > 1 && session.selection.every(u => u.type === 'villager'),
    'Ctrl + klik vybere všechny poddané na obrazovce');

  console.log('\n--- Upozornění na útok ---');
  const camX = input.camera.x;
  focusLastAlert.call(input);
  assert(input.camera.x === camX && input.toasts.length === toastsBefore + 2,
    'bez hlášeného útoku zůstane kamera na místě');
  session.lastAlert = { x: 100, y: 100 };
  focusLastAlert.call(input);
  const target = tileToScreen(100, 100);
  assert(input.camera.x === target.x && input.camera.y === target.y, 'Backspace přesune kameru na místo útoku');

  const renderer = Object.create(Renderer.prototype);
  renderer.session = session;
  renderer.effects = [];
  renderer.texts = [];
  renderer.handleEvents([
    { type: 'underAttack', playerId: session.selfId, x: 40, y: 40 },
    { type: 'underAttack', playerId: session.selfId + 1, x: 60, y: 60 }
  ]);
  assert(renderer.minimapPings.length === 1 && renderer.minimapPings[0].x === 40,
    'minimapa označí jen útoky na vlastní panství');
}

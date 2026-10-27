import { GameSim } from '../../client/js/sim/sim.js';
import { RESOURCE_TYPES, TILE_TYPES } from '../../client/js/sim/constants.js';
import { wallLine } from '../../client/js/sim/wall-line.js';
import { RemoteSession } from '../../client/js/game/session.js';
import { assert } from './helpers.js';

export function testFortifications() {
  console.log('\n--- Hradby, brány a věže ---');
  const sim = new GameSim({
    seed: 777, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Hráč' }, { name: 'Soupeř' }]
  });
  for (let y = 64; y < 90; y++) {
    for (let x = 64; x < 90; x++) {
      sim.map.tiles[sim.map.idx(x, y)] = TILE_TYPES.SAND;
      sim.map.setResource(x, y, RESOURCE_TYPES.NONE);
    }
  }
  Object.assign(sim.getPlayer(1).resources, { money: 10000, wood: 10000, stone: 10000 });

  assert(wallLine(70, 70, 72, 71).map(p => `${p.x},${p.y}`).join('|') === '70,70|71,70|72,70',
    'tažení vytvoří souvislý rovný úsek v hlavním směru');
  assert(wallLine(70, 70, 70, 120) === null && wallLine(70.5, 70, 71, 70) === null,
    'neplatný nebo dlouhý úsek je odmítnut');
  const before = sim.buildings.length;
  const money = sim.getPlayer(1).resources.money;
  const failed = sim.command(1, { op: 'build-wall', x1: 70, y1: 70, x2: 70, y2: 121 });
  assert(!failed.ok && sim.buildings.length === before && sim.getPlayer(1).resources.money === money,
    'odmítnutý úsek nic nepostaví ani nezaplatí');
  sim.map.setResource(72, 70, RESOURCE_TYPES.STONE);
  const blocked = sim.command(1, { op: 'build-wall', x1: 70, y1: 70, x2: 72, y2: 70 });
  assert(!blocked.ok && sim.buildings.length === before && sim.getPlayer(1).resources.money === money,
    'překážka uprostřed nebo na konci úseku nezaloží žádné staveniště');
  sim.map.setResource(72, 70, RESOURCE_TYPES.NONE);
  sim.getPlayer(1).resources.stone = 40;
  const poor = sim.command(1, { op: 'build-wall', x1: 70, y1: 70, x2: 72, y2: 70 });
  assert(!poor.ok && sim.buildings.length === before && sim.getPlayer(1).resources.money === money,
    'nedostatek surovin pro celý úsek nezaloží žádné staveniště');
  sim.getPlayer(1).resources.stone = 10000;
  const line = sim.command(1, { op: 'build-wall', x1: 70, y1: 70, x2: 72, y2: 70 });
  assert(line.ok && line.count === 3 && sim.buildings.length === before + 3,
    'příkaz vytvoří všechna navazující staveniště');
  assert(sim.events.filter(event => event.type === 'toast' && event.message?.key === 'Stavba hradeb zahájena: {0} dílů').length === 1,
    'úsek vyvolá jednu souhrnnou hlášku místo hlášky za každý díl');
  const gateResult = sim.command(1, { op: 'build', buildingType: 'gate', x: 73, y: 70 });
  const towerResult = sim.command(1, { op: 'build', buildingType: 'tower', x: 74, y: 70 });
  assert(gateResult.ok && towerResult.ok, 'bránu i věž lze připojit k hradbě');
  const gate = sim.buildings.find(b => b.id === gateResult.buildingId);
  const tower = sim.buildings.find(b => b.id === towerResult.buildingId);
  if (!gate || !tower) return;
  for (const b of [gate, tower]) {
    b.complete = true;
    b.progress = 1;
    b.hp = b.maxHp;
  }
  sim.updateGate(gate);
  sim.rebuildBlockGrid();
  assert(gate.gateOpen && sim.isWalkableTile(73, 70), 'otevřená brána je průchozí');
  const walker = sim.addUnit('swordsman', 1, 73, 69);
  walker.x = 73.5;
  walker.y = 69.5;
  walker.setPath([{ x: 73, y: 70 }, { x: 73, y: 71 }]);
  walker.moveTarget = { x: 73.5, y: 71.5 };
  sim.moveUnit(walker, 0.6);
  assert(Math.floor(walker.y) === 70, 'jednotka může vstoupit do otevřené brány');
  sim.map.treeTimers.push({ x: 73, y: 70, timer: 0 });
  sim.map.update(1, sim.blockGrid, (x, y) => sim.buildings.some(b => b.type === 'gate' && b.containsTile(x, y)));
  assert(sim.map.getResource(73, 70) === RESOURCE_TYPES.NONE, 'v otevřené bráně nemůže znovu vyrůst strom');
  assert(sim.command(1, { op: 'gate', buildingId: gate.id, open: false }).ok &&
    !sim.isWalkableTile(73, 70), 'vlastník může bránu zavřít');
  assert(walker.y < 70, 'zavření vrátí jednotku na stranu, ze které do brány vstoupila');
  assert(!sim.command(2, { op: 'gate', buildingId: gate.id, open: true }).ok,
    'cizí hráč nemůže bránu ovládat');
  sim.command(1, { op: 'gate', buildingId: gate.id, open: true });
  const enemy = sim.addUnit('swordsman', 2, 73, 69);
  enemy.x = 73.5;
  enemy.y = 69.5;
  enemy.autoAttack = false;
  sim.updateGate(gate);
  assert(!gate.gateOpen && !sim.isWalkableTile(73, 70), 'blízký nepřítel automaticky zavře bránu');
  enemy.setPath([{ x: 73, y: 70 }, { x: 73, y: 71 }]);
  enemy.moveTarget = { x: 73.5, y: 71.5 };
  sim.moveUnit(enemy, 2);
  assert(enemy.y < 70, 'jednotka s původní trasou nepřejde přes zavřenou bránu');
  enemy.x = 85.5;
  enemy.y = 85.5;
  sim.updateGate(gate);
  assert(gate.gateOpen && sim.isWalkableTile(73, 70), 'po odchodu nepřítele se odemčená brána otevře');
  sim.removeUnit(enemy, { silent: true });

  const archers = Array.from({ length: 5 }, (_, i) => sim.addUnit('archer', 1, 73, 73 + i));
  const garrison = sim.command(1, { op: 'garrison', buildingId: tower.id, unitIds: archers.map(u => u.id) });
  assert(garrison.ok && garrison.assigned === 4, 'věž přijme nejvýše čtyři lučištníky');
  for (let i = 0; i < 250; i++) sim.updateUnits(0.1);
  const stationed = archers.filter(u => u.garrison?.entered);
  assert(stationed.length === 4 && stationed.every(u => tower.containsTile(Math.floor(u.x), Math.floor(u.y))),
    'lučištníci dojdou k věži a zůstanou na ní');
  const snapshot = sim.serialize(1);
  assert(snapshot.units.filter(u => u.garrison?.entered).length === 4 &&
    snapshot.buildings.find(b => b.id === gate.id).gateOpen,
  'síťový snímek obsahuje obsádku i stav brány');
  const remote = new RemoteSession({
    seed: sim.seed, mapType: sim.mapType, selfId: 1, players: sim.players
  }, null);
  remote.applySnapshot(snapshot);
  assert(remote.state.units.filter(u => u.garrison?.entered).length === 4 &&
    remote.state.buildings.find(b => b.id === gate.id).gateOpen,
  'síťový klient stav brány i obsádku správně převezme');
  const restored = GameSim.fromSaveState(JSON.parse(JSON.stringify(sim.toSaveState())));
  assert(restored.units.filter(u => u.garrison?.entered).length === 4 &&
    restored.buildings.find(b => b.id === gate.id).gateOpen,
  'uložení a načtení zachová obsádku i stav brány');

  if (stationed.length) {
    const defender = stationed[0];
    const foe = sim.addUnit('swordsman', 2, defender.x + 7.5, defender.y);
    foe.autoAttack = false;
    defender.cooldown = 0;
    sim.updateGarrison(defender);
    assert(sim.projectiles.some(p => p.ownerId === 1 && p.targetId === foe.id && p.startHeight === 60),
      'lučištník z věže střílí i za běžný dostřel a šíp vyletí z výšky');
  }
  const unloaded = sim.command(1, { op: 'ungarrison', buildingId: tower.id });
  assert(unloaded.ok && unloaded.released === 4 && stationed.every(u => !u.garrison),
    'obsádku lze z věže vysadit');
  assert(stationed.every(u => sim.isWalkableTile(Math.floor(u.x), Math.floor(u.y))),
    'vysazení lučištníci stojí na průchozím místě');
  sim.command(1, { op: 'garrison', buildingId: tower.id, unitIds: [stationed[0].id] });
  for (let i = 0; i < 100 && !stationed[0].garrison?.entered; i++) sim.updateUnits(0.1);
  sim.removeBuilding(tower, { destroyed: true, byPlayerId: 2 });
  assert(!stationed[0].garrison && sim.units.includes(stationed[0]) &&
    sim.isWalkableTile(Math.floor(stationed[0].x), Math.floor(stationed[0].y)),
  'po zničení věže se obsádka uvolní na průchozí místo');
}

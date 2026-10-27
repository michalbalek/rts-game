import { GameSim } from '../../client/js/sim/sim.js';
import { Building } from '../../client/js/sim/entities.js';
import { BUILDING_DEFS, RESOURCE_TYPES, TILE_TYPES } from '../../client/js/sim/constants.js';
import { rotateBuildingPoint, rotatedBuildingSize } from '../../client/js/sim/building-orientation.js';
import { RemoteSession } from '../../client/js/game/session.js';
import { assert } from './helpers.js';

export function testBuildingRotation() {
  console.log('\n--- Otáčení budov a velká brána ---');
  const sim = new GameSim({
    seed: 777, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Hráč' }]
  });
  for (let y = 60; y < 100; y++) {
    for (let x = 60; x < 100; x++) {
      sim.map.tiles[sim.map.idx(x, y)] = TILE_TYPES.SAND;
      sim.map.setResource(x, y, RESOURCE_TYPES.NONE);
    }
  }
  const player = sim.getPlayer(1);
  Object.assign(player.resources, { money: 10000, wood: 10000, stone: 10000 });
  const def = BUILDING_DEFS.gate_large;
  assert(def.w === 4 && def.h === 1 && def.gate, 'velká brána má půdorys čtyři krát jedna');
  for (let rotation = 0; rotation < 4; rotation++) {
    const size = rotatedBuildingSize(def, rotation);
    const point = rotateBuildingPoint(0.5, 0.25, 4, 1, rotation);
    assert(size.width === (rotation % 2 ? 1 : 4) && size.height === (rotation % 2 ? 4 : 1) &&
      point.u >= 0 && point.u <= size.width && point.v >= 0 && point.v <= size.height,
    `otočení ${rotation} zachovává bod uvnitř správného půdorysu`);
  }
  for (const rotation of [-1, 4, 1.5, null, '1']) {
    const before = player.resources.money;
    const result = sim.command(1, { op: 'build', buildingType: 'gate_large', x: 70, y: 70, rotation });
    assert(!result.ok && player.resources.money === before, `neplatná rotace ${rotation} je odmítnuta bez platby`);
  }
  assert(!sim.canPlaceBuilding(1, 'gate_large', sim.map.size - 3, 70, 0).valid &&
    sim.canPlaceBuilding(1, 'gate_large', sim.map.size - 3, 70, 1).valid,
  'hranice mapy se ověřuje podle otočeného půdorysu');
  sim.map.tiles[sim.map.idx(76, 73)] = TILE_TYPES.WATER_DEEP;
  assert(!sim.canPlaceBuilding(1, 'gate_large', 76, 70, 1).valid,
    'voda na vzdáleném konci otočené brány zamezí stavbě');
  sim.map.tiles[sim.map.idx(76, 73)] = TILE_TYPES.SAND;
  sim.map.setResource(76, 73, RESOURCE_TYPES.TREE);
  const distantEnemy = sim.addUnit('swordsman', 2, 76.5, 93.5);
  distantEnemy.x = 76.5; distantEnemy.y = 93.5;
  assert(sim.canPlaceBuilding(1, 'gate_large', 76, 70, 0).valid &&
    !sim.canPlaceBuilding(1, 'gate_large', 76, 70, 1).valid,
  'odstup od nepřítele se počítá od celého otočeného půdorysu');
  sim.removeUnit(distantEnemy, { silent: true });
  player.resources.stone = 0;
  assert(!sim.command(1, { op: 'build', buildingType: 'gate_large', x: 76, y: 70, rotation: 1 }).ok &&
    sim.map.getResource(76, 73) === RESOURCE_TYPES.TREE, 'neuhrazená stavba nemaže stromy');
  player.resources.stone = 10000;
  const locations = [[70, 70], [76, 70], [70, 78], [82, 70]];
  const gates = locations.map(([x, y], rotation) => {
    const result = sim.command(1, { op: 'build', buildingType: 'gate_large', x, y, rotation });
    assert(result.ok, `velkou bránu lze postavit s otočením ${rotation}`);
    return sim.buildings.find(b => b.id === result.buildingId);
  });
  if (gates.some(g => !g)) return;
  assert(sim.map.getResource(76, 73) === RESOURCE_TYPES.NONE, 'strom na konci otočeného půdorysu se odstraní');
  assert(!sim.canPlaceBuilding(1, 'gate_large', 75, 73, 0).valid, 'kolize platí i na konci otočené brány');
  for (const gate of gates) {
    const cells = [];
    for (let y = gate.tileY; y < gate.tileY + gate.height; y++) {
      for (let x = gate.tileX; x < gate.tileX + gate.width; x++) cells.push([x, y]);
    }
    assert(cells.every(([x, y]) => !sim.isWalkableTile(x, y)), 'rozestavěná brána blokuje celý půdorys');
    gate.complete = true;
    gate.progress = 1;
    gate.hp = gate.maxHp;
    sim.updateGate(gate);
    assert(cells.every(([x, y]) => sim.isWalkableTile(x, y) &&
      sim.openGateTiles.get(sim.map.idx(x, y)) === gate.id), 'otevřená brána zpřístupní všechny čtyři dlaždice');
    assert(sim.command(1, { op: 'gate', buildingId: gate.id, open: false }).ok &&
      cells.every(([x, y]) => !sim.isWalkableTile(x, y)), 'zamčená brána blokuje všechny čtyři dlaždice');
    sim.command(1, { op: 'gate', buildingId: gate.id, open: true });
  }
  const gate = gates[1];
  const walker = sim.addUnit('swordsman', 1, 75.5, 73.5);
  walker.x = 75.5; walker.y = 73.5;
  walker.setPath([{ x: 76, y: 73 }, { x: 77, y: 73 }]);
  walker.moveTarget = { x: 77.5, y: 73.5 };
  sim.moveUnit(walker, 0.6);
  assert(Math.floor(walker.x) === 76 && walker.gateEntry?.gateId === gate.id,
    'jednotka vstoupí do krajní dlaždice velké brány');
  sim.command(1, { op: 'gate', buildingId: gate.id, open: false });
  assert(walker.x < 76, 'při zavření velké brány se jednotka vrátí na vstupní stranu');
  sim.command(1, { op: 'gate', buildingId: gate.id, open: true });
  const horizontal = gates[0];
  const crossing = sim.addUnit('swordsman', 1, 73.5, 69.5);
  crossing.x = 73.5; crossing.y = 69.5;
  crossing.setPath([{ x: 73, y: 70 }, { x: 73, y: 71 }]);
  crossing.moveTarget = { x: 73.5, y: 71.5 };
  sim.moveUnit(crossing, 0.6);
  sim.command(1, { op: 'gate', buildingId: horizontal.id, open: false });
  assert(crossing.y < 70, 'vodorovná brána při zavření vrací jednotku z krajní dlaždice');
  sim.command(1, { op: 'gate', buildingId: horizontal.id, open: true });
  const enemy = sim.addUnit('swordsman', 2, 77, 73);
  sim.updateGate(gate);
  assert(!gate.gateOpen && !sim.isWalkableTile(76, 73), 'nepřítel zavře také velkou bránu');
  sim.removeUnit(enemy, { silent: true });
  sim.updateGate(gate);
  assert(gate.gateOpen, 'velká brána se po odchodu nepřítele znovu otevře');
  sim.map.treeTimers.push({ x: 73, y: 70, timer: 0 }, { x: 76, y: 73, timer: 0 });
  sim.tick(0.1);
  assert(sim.map.getResource(73, 70) === RESOURCE_TYPES.NONE &&
    sim.map.getResource(76, 73) === RESOURCE_TYPES.NONE,
  'v otevřené velké bráně nemohou vyrůst stromy ani na krajních dlaždicích');

  const snapshot = sim.serialize(1);
  const remote = new RemoteSession({ seed: sim.seed, mapType: sim.mapType, selfId: 1, players: sim.players }, null);
  remote.applySnapshot(snapshot);
  const remoteGate = remote.state.buildings.find(b => b.id === gate.id);
  assert(remoteGate.rotation === 1 && remoteGate.width === 1 && remoteGate.height === 4 &&
    remoteGate.containsTile(76, 73), 'síťový snímek zachová otočení i celý půdorys');
  remote.map = sim.map;
  assert(remote.canPlace('gate_large', 75, 73, 0).valid === sim.canPlaceBuilding(1, 'gate_large', 75, 73, 0).valid &&
    remote.canPlace('gate_large', 85, 84, 1).valid === sim.canPlaceBuilding(1, 'gate_large', 85, 84, 1).valid,
  'síťový náhled a autoritativní simulace se shodují na platném i kolizním místě');
  const saved = JSON.parse(JSON.stringify(sim.toSaveState()));
  const restored = GameSim.fromSaveState(saved);
  const savedGate = restored.buildings.find(b => b.id === gate.id);
  assert(savedGate.rotation === 1 && savedGate.width === 1 && savedGate.height === 4 &&
    savedGate.gateOpen && restored.isWalkableTile(76, 73), 'uložení zachová otočení, půdorys i průchodnost');

  const oldGate = new Building(sim.nextId++, 'gate', 1, 90, 80);
  const oldWall = new Building(sim.nextId++, 'wall', 1, 90, 79);
  sim.buildings.push(oldGate, oldWall);
  const legacy = JSON.parse(JSON.stringify(sim.toSaveState()));
  delete legacy.sim.buildings.find(b => b.id === oldGate.id).rotation;
  delete legacy.sim.buildings.find(b => b.id === oldWall.id).rotation;
  const oldRestored = GameSim.fromSaveState(legacy);
  assert(oldRestored.buildings.find(b => b.id === oldGate.id).rotation === 1,
    'stará uložená brána převezme orientaci podle sousedních hradeb');
  gate.hp -= 100;
  assert(sim.command(1, { op: 'repair', buildingId: gate.id }).ok && gate.repair,
    'otočenou velkou bránu lze opravit');
  assert(sim.command(1, { op: 'demolish', buildingId: gate.id }).ok &&
    !sim.buildings.some(b => b.id === gate.id) && sim.isWalkableTile(76, 73),
  'velkou bránu lze zbourat a uvolnit její půdorys');
}

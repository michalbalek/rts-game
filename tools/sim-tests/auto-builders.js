import { GameSim } from '../../client/js/sim/sim.js';
import { Building } from '../../client/js/sim/entities.js';
import { BUILD, RESOURCE_TYPES, TILE_TYPES } from '../../client/js/sim/constants.js';
import { assert } from './helpers.js';

function makeSim() {
  const sim = new GameSim({
    seed: 777, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Hráč' }]
  });
  for (let y = 55; y <= 105; y++) {
    for (let x = 55; x <= 105; x++) {
      sim.map.tiles[sim.map.idx(x, y)] = TILE_TYPES.SAND;
      sim.map.setResource(x, y, RESOURCE_TYPES.NONE);
    }
  }
  return sim;
}

function addSite(sim, x, y, ownerId = 1, complete = false) {
  const site = new Building(sim.nextId++, 'wall', ownerId, x, y, complete);
  sim.buildings.push(site);
  sim.rebuildBlockGrid();
  return site;
}

function prepareBuilder(sim, site, x, y) {
  const unit = sim.addUnit('villager', site.ownerId, x, y);
  const result = sim.command(site.ownerId, { op: 'construct', buildingId: site.id, unitIds: [unit.id] });
  if (!result.ok) throw new Error(`Test builder could not reach site: ${result.reason}`);
  return unit;
}

export function testAutoBuilders() {
  console.log('\n--- Automatické pokračování ve stavbě ---');
  assert(BUILD.autoSearchRadius === 10, 'stavitelé hledají další staveniště do 10 dlaždic');
  const sim = makeSim();
  const first = addSite(sim, 70, 70);
  const next = addSite(sim, 72, 70);
  const farther = addSite(sim, 76, 70);
  const enemy = addSite(sim, 69, 69, 2);
  addSite(sim, 70, 68, 1, true);
  const builders = [prepareBuilder(sim, first, 70, 69), prepareBuilder(sim, first, 70, 69)];
  const traveler = prepareBuilder(sim, first, 65, 65);
  const fleeing = prepareBuilder(sim, first, 68, 70);
  const released = prepareBuilder(sim, first, 68, 71);
  for (const unit of builders) {
    unit.x = 70.5;
    unit.y = 69.5;
    unit.build.arrived = true;
  }
  traveler.x = 67.5;
  traveler.y = 69.5;
  fleeing.fleeing = true;
  fleeing.workPaused = true;
  sim.command(1, { op: 'release', unitIds: [released.id] });
  first.progress = 0.999;
  sim.updateBuildings(1);
  assert(first.complete && builders.every(u => u.build?.buildingId === next.id && !u.build.arrived),
    'po dokončení se všichni aktivní stavitelé vydají na nejbližší vlastní staveniště');
  assert(next.progress === 0, 'stavitelé na cestě nezapočnou práci před příchodem');
  assert(traveler.build?.buildingId === next.id,
    'stavitel, který byl ještě na cestě, může pokračovat k dostupnému staveništi v okolí');
  assert(!fleeing.build && fleeing.fleeing && !released.build,
    'prchající a ručně uvolněný poddaný nedostanou nový stavební rozkaz');
  assert(builders.every(u => u.build.buildingId !== enemy.id),
    'cizí a dokončené stavby se nepřidělují');
  const save = JSON.parse(JSON.stringify(sim.toSaveState()));
  const restored = GameSim.fromSaveState(save);
  assert(builders.every(u => restored.units.find(other => other.id === u.id)?.build?.buildingId === next.id),
    'automaticky přidělené staveniště se zachová při uložení a načtení');
  let ticks = 0;
  while (!farther.complete && ticks++ < 1200) sim.tick(0.1);
  assert(next.complete && farther.complete, 'poddaní skutečně postaví další staveniště a pokračují v řetězci');
  assert(builders.every(u => !u.build), 'po dokončení poslední stavby se stavitelé uvolní');

  const blockedSim = makeSim();
  const origin = addSite(blockedSim, 70, 70);
  const enclosed = addSite(blockedSim, 73, 70);
  for (let y = 69; y <= 71; y++) {
    for (let x = 72; x <= 74; x++) {
      if (x !== 73 || y !== 70) addSite(blockedSim, x, y, 1, true);
    }
  }
  const accessible = addSite(blockedSim, 70, 75);
  const worker = prepareBuilder(blockedSim, origin, 70, 69);
  worker.x = 70.5; worker.y = 69.5; worker.build.arrived = true;
  origin.progress = 0.999;
  blockedSim.updateBuildings(1);
  assert(worker.build?.buildingId === accessible.id && worker.build.buildingId !== enclosed.id,
    'nedostupné bližší staveniště se přeskočí ve prospěch dostupného');

  const boundarySim = makeSim();
  const start = addSite(boundarySim, 60, 61);
  const boundary = addSite(boundarySim, 60 + BUILD.autoSearchRadius, 60);
  const boundaryWorker = prepareBuilder(boundarySim, start, 60, 60);
  boundaryWorker.x = 60; boundaryWorker.y = 60.5; boundaryWorker.build.arrived = true;
  start.progress = 0.999;
  boundarySim.updateBuildings(1);
  assert(boundaryWorker.build?.buildingId === boundary.id, 'staveniště přesně na hranici 10 polí je dostupné');

  const farSim = makeSim();
  const farStart = addSite(farSim, 60, 61);
  addSite(farSim, 61 + BUILD.autoSearchRadius, 60);
  const farWorker = prepareBuilder(farSim, farStart, 60, 60);
  farWorker.x = 60; farWorker.y = 60.5; farWorker.build.arrived = true;
  farStart.progress = 0.999;
  const home = farSim.idleSpot(1, farWorker.id, 1.8);
  farSim.updateBuildings(1);
  assert(!farWorker.build && farWorker.pathGoal?.x === home.x && farWorker.pathGoal?.y === home.y,
    'staveniště mimo dosah se nepřidělí a poddaný se vrací k ohništi');

  const destroyedSim = makeSim();
  const destroyed = addSite(destroyedSim, 70, 70);
  addSite(destroyedSim, 72, 70);
  const displaced = prepareBuilder(destroyedSim, destroyed, 70, 69);
  destroyedSim.removeBuilding(destroyed, { destroyed: true, byPlayerId: 2 });
  assert(!displaced.build, 'zničení staveniště samo nespustí pokračování v jiné stavbě');

  const ejectSim = makeSim();
  const enclosing = addSite(ejectSim, 70, 70);
  const afterEject = addSite(ejectSim, 72, 70);
  const trapped = prepareBuilder(ejectSim, enclosing, 70, 69);
  trapped.x = 70.5; trapped.y = 70.5; trapped.build.arrived = true;
  enclosing.progress = 0.999;
  ejectSim.updateBuildings(1);
  assert(ejectSim.isWalkableTile(Math.floor(trapped.x), Math.floor(trapped.y)) &&
    trapped.build?.buildingId === afterEject.id && trapped.path.length > 0,
  'stavitel uvnitř dokončené stavby je odsunut a dostane platnou cestu k další');
}

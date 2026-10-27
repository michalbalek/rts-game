import { GameSim } from '../../client/js/sim/sim.js';
import { RESOURCE_TYPES, WORK } from '../../client/js/sim/constants.js';
import { Building } from '../../client/js/sim/entities.js';
import { assert } from './helpers.js';

function makeSim() {
  const sim = new GameSim({
    seed: 1234, mapType: 'desert', mode: 'sandbox', capital: 'rich', fog: false,
    players: [{ name: 'Hráč', isBot: false }]
  });
  sim.getPlayer(1).resources.stone = 0;
  return sim;
}

function tickUntil(sim, condition, seconds = 180) {
  for (let i = 0; i < seconds * 20 && !condition(); i++) sim.tick(1 / 20);
}

export function testDirectGathering() {
  console.log('\n--- Přímá těžba poddaných ---');
  {
    let sim = makeSim();
    let unit = sim.units.find(u => u.ownerId === 1 && u.isVillager);
    const castle = sim.getCastle(1);
    const tree = sim.findTreeSource(unit, castle);
    assert(!!tree, 'existuje dostupný strom');
    if (!tree) return;
    const result = sim.command(1, { op: 'gather', unitIds: [unit.id], x: tree.sx, y: tree.sy });
    assert(result.ok && unit.work.direct && unit.work.buildingId === null, 'poddaný těží bez budovy');
    tickUntil(sim, () => unit.work && unit.work.phase === 'gather');
    assert(unit.work && unit.work.phase === 'gather', 'poddaný dojde ke zvolenému stromu');
    const initialWood = sim.getPlayer(1).resources.wood;
    let choppingAtTree = true;
    for (let i = 0; i < (WORK.gatherTime - 1) * 20; i++) {
      sim.tick(1 / 20);
      const source = unit.work && unit.work.source;
      const dx = source ? source.sx + 0.5 - unit.x : 0;
      const dy = source ? source.sy + 0.5 - unit.y : 0;
      choppingAtTree = choppingAtTree && unit.work && unit.work.phase === 'gather' && unit.path.length === 0 &&
        Math.hypot(dx, dy) <= 2.2 && Math.cos(unit.angle) * dx + Math.sin(unit.angle) * dy > 0;
    }
    assert(choppingAtTree, 'přímý těžař během sekání zůstává u stromu a je otočený k němu');
    assert(unit.work.carry === 0 && sim.getPlayer(1).resources.wood === initialWood,
      'před uplynutím 20 sekund není náklad vytěžen');
    tickUntil(sim, () => unit.work && unit.work.carry === 1, 10);
    assert(unit.work.carry === 1 && sim.map.getResource(tree.sx, tree.sy) === RESOURCE_TYPES.TREE,
      'po sběru nese jeden kus a strom zůstává');
    const idx = sim.map.idx(tree.sx, tree.sy);
    assert(sim.map.treeHarvested.get(idx) === 1, 'uložená zásoba stromu se sníží o jeden kus');
    const saved = sim.toSaveState();
    sim = GameSim.fromSaveState(saved);
    unit = sim.units.find(u => u.id === unit.id);
    assert(unit.work && unit.work.direct && unit.work.carry === 1 && sim.map.treeHarvested.get(idx) === 1,
      'uložení a načtení zachová příkaz, náklad i stav stromu');
    tickUntil(sim, () => sim.getPlayer(1).resources.wood > initialWood);
    assert(sim.getPlayer(1).resources.wood === initialWood + 1, 'do skladu se doručí přesně jeden kus');
    tickUntil(sim, () => sim.map.getResource(tree.sx, tree.sy) !== RESOURCE_TYPES.TREE, 600);
    assert(sim.map.getResource(tree.sx, tree.sy) === RESOURCE_TYPES.NONE &&
      !sim.map.treeHarvested.has(idx), 'strom zmizí až po deseti kusech');
  }
  {
    const sim = makeSim();
    const unit = sim.units.find(u => u.isVillager);
    const tree = sim.findTreeSource(unit, sim.getCastle(1));
    if (!tree) return;
    sim.command(1, { op: 'gather', unitIds: [unit.id], x: tree.sx, y: tree.sy });
    const direct = [sim.harvest(unit, null), sim.harvest(unit, null), sim.harvest(unit, null)];
    unit.work.direct = false;
    const fromBuilding = sim.harvest(unit, { config: { produce: 'wood' } });
    assert(direct.every(amount => amount === 1) && fromBuilding === WORK.carry - 3 &&
      sim.map.getResource(tree.sx, tree.sy) === RESOURCE_TYPES.NONE,
    'dělník budovy vytěží jen zbytek částečně vytěženého stromu');
    const legacy = sim.toSaveState();
    delete legacy.sim.map.treeHarvested;
    const restored = GameSim.fromSaveState(legacy);
    assert(restored.map.treeHarvested.size === 0, 'staré uložení bez stavu stromů zůstává načitatelné');
  }
  {
    const sim = makeSim();
    const unit = sim.units.find(u => u.isVillager);
    const tree = sim.findTreeSource(unit, sim.getCastle(1));
    if (!tree) return;
    sim.command(1, { op: 'gather', unitIds: [unit.id], x: tree.sx, y: tree.sy });
    tickUntil(sim, () => unit.work && unit.work.phase === 'gather');
    assert(unit.work && unit.work.phase === 'gather', 'dělník začal sekat vybraný strom');
    sim.map.chopTree(tree.sx, tree.sy);
    sim.tick(1 / 20);
    assert(unit.work && unit.work.phase === 'toSource' && !unit.work.source,
      'po pokácení stromu jiným dělníkem nehledá náklad u neexistujícího stromu');
  }
  for (const type of ['stone', 'iron']) {
    const sim = makeSim();
    const [unit, waiting, carrying] = sim.units.filter(u => u.ownerId === 1 && u.isVillager);
    const tree = sim.findTreeSource(unit, sim.getCastle(1));
    if (!tree) {
      assert(false, `${type}: existuje dostupné místo`);
      continue;
    }
    sim.map.setResource(tree.sx, tree.sy, RESOURCE_TYPES.NONE);
    const dep = sim.map.createDeposit(type, [{ x: tree.sx, y: tree.sy }], 1);
    const start = sim.getPlayer(1).resources[type];
    const result = sim.command(1, { op: 'gather', unitIds: [unit.id, waiting.id, carrying.id], x: tree.sx, y: tree.sy });
    assert(result.ok && unit.work.produce === type, `${type}: přímý příkaz je přijat`);
    waiting.work.phase = 'wait';
    waiting.work.waitTimer = 1000;
    carrying.work.carry = 1;
    carrying.work.phase = 'waitStorage';
    carrying.work.waitTimer = 1000;
    const building = new Building(100000, type === 'stone' ? 'quarry' : 'ironmine', 1, 60, 60);
    building.depositId = dep.id;
    sim.buildings.push(building);
    const assigned = sim.assignWorkers(1, building.id, 1);
    const buildingWorker = sim.units.find(u => u.work && u.work.buildingId === building.id);
    assert(assigned.ok && !!buildingWorker, `${type}: ložisko využívá také dělník budovy`);
    if (buildingWorker) {
      buildingWorker.work.phase = 'wait';
      buildingWorker.work.waitTimer = 1000;
    }
    tickUntil(sim, () => !dep.active);
    assert(!dep.active && unit.work && unit.work.carry === 1 && sim.pendingDeposits.length === 1,
      `${type}: vyčerpání ponechá poslední kus a naplánuje nové ložisko`);
    assert(!waiting.work && carrying.work && carrying.work.depleted && carrying.work.carry === 1 &&
      buildingWorker && !buildingWorker.work, `${type}: ostatní pracovníci se uvolní nebo doručí náklad`);
    sim.releaseWorker(carrying, false);
    tickUntil(sim, () => !unit.work);
    assert(!unit.work && sim.getPlayer(1).resources[type] === start + 1,
      `${type}: poslední kus se doručí a poddaný skončí`);
  }
  {
    const sim = makeSim();
    const unit = sim.units.find(u => u.isVillager);
    const tree = sim.findTreeSource(unit, sim.getCastle(1));
    if (!tree) return;
    assert(!sim.command(1, { op: 'gather', unitIds: [unit.id], x: -1, y: 0 }).ok,
      'neplatný zdroj se odmítne');
    sim.command(1, { op: 'gather', unitIds: [unit.id], x: tree.sx, y: tree.sy });
    unit.work.carry = 1;
    const oldWork = unit.work;
    assert(!sim.command(1, { op: 'gather', unitIds: [unit.id], x: tree.sx, y: tree.sy }).ok &&
      unit.work === oldWork && unit.work.carry === 1, 'přeřazení nosiče nezahodí náklad');
  }
  {
    const sim = makeSim();
    const unit = sim.units.find(u => u.isVillager);
    const tree = sim.findTreeSource(unit, sim.getCastle(1));
    if (!tree) return;
    sim.getPlayer(1).resources.stone = 200;
    sim.command(1, { op: 'gather', unitIds: [unit.id], x: tree.sx, y: tree.sy });
    tickUntil(sim, () => unit.work && unit.work.phase === 'waitStorage');
    assert(unit.work && unit.work.phase === 'waitStorage' && unit.work.carry === 1,
      'při plném skladu dělník čeká s nákladem');
    sim.getPlayer(1).resources.stone--;
    const wood = sim.getPlayer(1).resources.wood;
    tickUntil(sim, () => sim.getPlayer(1).resources.wood > wood, 20);
    assert(sim.getPlayer(1).resources.wood === wood + 1, 'po uvolnění místa doručí jeden kus');
    sim.getPlayer(1).resources.food = 0;
    sim.tick(1 / 20);
    sim.tick(1 / 20);
    assert(unit.work && unit.workPaused, 'nedostatek jídla pozastaví i přímou těžbu');
    sim.getPlayer(1).resources.food = 20;
    sim.tick(1 / 20);
    sim.tick(1 / 20);
    assert(unit.work && !unit.workPaused, 'po doplnění jídla přímá těžba pokračuje');
  }
}

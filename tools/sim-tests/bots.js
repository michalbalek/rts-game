import { GameSim } from '../../client/js/sim/sim.js';
import { RESOURCE_TYPES } from '../../client/js/sim/constants.js';
import { assert, findLumberSpotNearTree } from './helpers.js';

export function testBots() {
  console.log('\n--- Simulace s botem ---');
  const sim = new GameSim({
    seed: 777,
    mapType: 'oasis',
    mode: 'bots',
    capital: 'medium',
    fog: true,
    players: [
      { name: 'Hráč', isBot: false },
      { name: 'Bot', isBot: true, difficulty: 'medium' }
    ]
  });
  let botLumberTrees = null;
  const command = sim.command.bind(sim);
  sim.command = (playerId, cmd) => {
    if (playerId === 2 && cmd.op === 'build' && cmd.buildingType === 'lumberjack') {
      botLumberTrees = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (sim.map.getResource(cmd.x + dx, cmd.y + dy) === RESOURCE_TYPES.TREE) {
            botLumberTrees.push({ x: cmd.x + dx, y: cmd.y + dy });
          }
        }
      }
    }
    return command(playerId, cmd);
  };
  assert(sim.buildings.length === 2, 'dva hrady');
  assert(sim.units.length === 40, 'dvě sídla po 20 poddaných');
  assert(sim.players[0].resources.wood === 200, 'startovní kapitál dřeva');

  console.log('\n--- Ekonomika bez daní a spokojenosti ---');
  const startingMoney = sim.players.map(p => p.resources.money);
  for (const dt of [1 / 20, 1, 60]) sim.updateEconomy(dt);
  assert(sim.players.every((p, i) => p.resources.money === startingMoney[i]),
    'hráči ani botovi nepřibývají peníze automaticky');
  assert(sim.players.every(p => !('tax' in p) && !('popularity' in p)),
    'stav hráčů neobsahuje daně ani spokojenost');
  for (const player of sim.players) {
    const taxCommand = sim.command(player.id, { op: 'tax', level: 'high' });
    assert(!taxCommand.ok && taxCommand.reason === 'Neznámý příkaz.',
      `hráč ${player.id}: zrušený příkaz pro změnu daně se odmítne`);
    const snapshot = sim.serialize(player.id);
    assert(!('tax' in snapshot.self) && !('popularity' in snapshot.self) &&
      snapshot.players.every(p => !('tax' in p) && !('popularity' in p)),
    `hráč ${player.id}: síťový snímek neobsahuje daně ani spokojenost`);
  }

  // Lidský hráč zadá dřevorubce u stromu, čtyři poddaní ho postaví a přiřadí se dělníci.
  const humanCastle = sim.getCastle(1);
  let lumberSpot = null;
  for (let y = 0; y < sim.map.size && !lumberSpot; y++) {
    for (let x = 0; x < sim.map.size; x++) {
      if (Math.hypot(x - humanCastle.centerX, y - humanCastle.centerY) > 30) continue;
      if (sim.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
      lumberSpot = findLumberSpotNearTree(sim, 1, x, y);
      if (lumberSpot) {
        break;
      }
    }
  }
  assert(!!lumberSpot, 'lze najít místo pro dřevorubce');
  const buildRes = sim.command(1, { op: 'build', buildingType: 'lumberjack', x: lumberSpot.x, y: lumberSpot.y });
  assert(buildRes.ok, 'lidský hráč postavil dřevorubce');
  const lumber = sim.buildings.find(b => b.id === buildRes.buildingId);
  assert(lumber && !lumber.complete, 'nově zadaná budova je staveniště bez dokončení');
  const humanWoodBefore = sim.players[0].resources.wood;
  const lumberBuilders = sim.units.filter(u => u.ownerId === 1 && u.isVillager).slice(0, 4);
  assert(sim.command(1, { op: 'construct', buildingId: lumber.id, unitIds: lumberBuilders.map(u => u.id) }).ok,
    'čtyři poddaní byli přiřazeni ke stavbě dřevorubce');
  let lumberBuildTicks = 0;
  while (!lumber.complete && lumberBuildTicks < 20 * 60) {
    sim.tick(1 / 20);
    lumberBuildTicks++;
  }
  assert(lumber.complete, 'dřevorubec dokončen čtyřmi staviteli');
  const assignRes = sim.command(1, { op: 'assign', buildingId: lumber.id, count: 4 });
  assert(assignRes.ok, 'přiřazeni dělníci');
  const lumberWorkers = () => sim.units.filter(u => u.work && u.work.buildingId === lumber.id);
  assert(lumberWorkers().length === 4, 'čtyři poddaní mají přiřazenou práci');
  assert(lumber.workers === 0, 'přiřazení samo o sobě nezvýší počet dělníků v budově');
  assert(lumberWorkers().every(u => u.work.phase === 'toBuilding'),
    'přiřazený poddaný nejprve odchází k budově');
  const castleDestination = sim.getCastle(1);
  assert(sim.findStorage(1, 'wood', lumberWorkers()[0]).id === castleDestination.id,
    'bez skladu se dřevo nosí do Královského hradu');
  let arrivalTicks = 0;
  while (lumber.workers === 0 && arrivalTicks < 20 * 40) {
    sim.tick(1 / 20);
    arrivalTicks++;
  }
  assert(lumber.workers > 0, 'poddaný se po příchodu do budovy započítá jako dělník');
  assert(lumberWorkers().some(u => u.work.arrived), 'stav práce označí dělníka, který dorazil');
  const releasedWorker = lumberWorkers().find(u => u.work.arrived);
  const workersBeforeRelease = lumber.workers;
  const releaseWorkerRes = sim.command(1, { op: 'release', unitIds: [releasedWorker.id] });
  assert(releaseWorkerRes.ok && !releasedWorker.work && lumber.workers === workersBeforeRelease - 1,
    'uvolnění pracujícího poddaného ho odebere z budovy');
  assert(sim.command(1, { op: 'assign', buildingId: lumber.id, count: 1 }).ok,
    'uvolněný poddaný se dá znovu přiřadit');
  const t0 = Date.now();
  for (let tick = 0; tick < 20 * 150; tick++) sim.tick(1 / 20);
  console.log(`  simulace 160 s: ${Date.now() - t0} ms, tick ${sim.tickCount}`);
  console.log('  budovy:', sim.buildings.map(b => `${b.type}(${b.ownerId})${b.complete ? '' : '*'}`).join(', '));
  for (const p of sim.players) {
    console.log(`  hráč ${p.name}: peníze ${Math.floor(p.resources.money)}, dřevo ${Math.floor(p.resources.wood)}, kámen ${Math.floor(p.resources.stone)}, jídlo ${Math.floor(p.resources.food)}, železo ${Math.floor(p.resources.iron)}; lid ${p.population}/${p.capacity}; zabito ${p.stats.lost}, zničeno ${p.stats.destroyed}, sehráno ${p.stats.gathered}`);
  }
  assert(sim.buildings.some(b => b.ownerId === 2 && b.complete), 'bot postavil alespoň jednu budovu');
  const botLumber = sim.buildings.find(b => b.ownerId === 2 && b.type === 'lumberjack');
  assert(botLumber && sim.map.getResource(botLumber.tileX, botLumber.tileY) === RESOURCE_TYPES.NONE,
    'bot postaví dřevorubce na místě bez stromu');
  assert(botLumberTrees && botLumberTrees.length > 0,
    'bot vybírá pro dřevorubce místo poblíž stromů');
  assert(sim.players[0].resources.wood > humanWoodBefore, 'lidský dělník přinesl dřevo');
  assert(sim.time > 159, 'simulace běžela přes 160 s');

  return { sim, lumber };
}

export function testNavigation(sim) {
  console.log('\n--- Pathfinding ---');
  const villager = sim.units.find(u => u.ownerId === 1 && u.isVillager);
  const startX = villager.x, startY = villager.y;
  const okPath = sim.navigateTo(villager, 70, 55);
  for (let i = 0; i < 20 * 40; i++) sim.tick(1 / 20);
  console.log(`  cesta nalezena: ${okPath}, pozice ${startX.toFixed(1)},${startY.toFixed(1)} -> ${villager.x.toFixed(1)},${villager.y.toFixed(1)}`);
  assert(okPath, 'A* našla cestu do středu mapy');

}

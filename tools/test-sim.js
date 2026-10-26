import { GameSim } from '../client/js/sim/sim.js';
import { GameMap } from '../client/js/sim/mapgen.js';
import { START_POSITIONS, RESOURCE_TYPES, TILE_TYPES, buildSpeedFactor } from '../client/js/sim/constants.js';
import { formatSaveLabel } from '../client/js/game/save.js';
import { unitActivity } from '../client/js/sim/entities.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

console.log('--- Mapy ---');
for (const type of ['desert', 'oasis', 'canyon']) {
  const t0 = Date.now();
  const map = new GameMap(12345, type);
  const ms = Date.now() - t0;
  let trees = 0, stone = 0, iron = 0, deep = 0, shallow = 0;
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] === TILE_TYPES.WATER_DEEP) deep++;
    if (map.tiles[i] === TILE_TYPES.WATER_SHALLOW) shallow++;
    if (map.resources[i] === RESOURCE_TYPES.TREE) trees++;
    if (map.resources[i] === RESOURCE_TYPES.STONE) stone++;
    if (map.resources[i] === RESOURCE_TYPES.IRON) iron++;
  }
  console.log(`  ${type}: ${ms} ms, stromy ${trees}, kámen ${stone}, železo ${iron}, hluboká voda ${deep}, brody ${shallow}, ložiska ${map.deposits.length}`);
  assert(map.deposits.filter(d => d.type === 'iron').length >= 2, `${type}: alespoň 2 ložiska železa`);
  assert(stone >= 25, `${type}: dostatek kamene`);

  for (let i = 0; i < START_POSITIONS.length; i++) {
    const p = START_POSITIONS[i];
    const cx = p.x + 1.5, cy = p.y + 1.5;
    let nearTrees = 0, nearStone = 0, nearIron = 0;
    for (let y = 0; y < map.size; y++) {
      for (let x = 0; x < map.size; x++) {
        if (Math.hypot(x - cx, y - cy) > 30) continue;
        const r = map.resources[y * map.size + x];
        if (r === RESOURCE_TYPES.TREE) nearTrees++;
        if (r === RESOURCE_TYPES.STONE) nearStone++;
        if (r === RESOURCE_TYPES.IRON) nearIron++;
      }
    }
    assert(nearTrees > 0 && nearStone > 0 && nearIron > 0,
      `${type} pozice ${i}: stromy ${nearTrees}, kámen ${nearStone}, železo ${nearIron} do 30 dlaždic`);
  }
}

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

// Lidský hráč zadá dřevorubce na stromě, čtyři poddaní ho postaví a přiřadí se dělníci.
const humanCastle = sim.getCastle(1);
let lumberSpot = null;
for (let y = 0; y < sim.map.size && !lumberSpot; y++) {
  for (let x = 0; x < sim.map.size; x++) {
    if (Math.hypot(x - humanCastle.centerX, y - humanCastle.centerY) > 30) continue;
    if (sim.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
    if (sim.canPlaceBuilding(1, 'lumberjack', x, y).valid) {
      lumberSpot = { x, y };
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
assert(sim.players[0].resources.wood > humanWoodBefore, 'lidský dělník přinesl dřevo');
assert(sim.time > 159, 'simulace běžela přes 160 s');

console.log('\n--- Boj a vítězství ---');
const sim2 = new GameSim({
  seed: 42,
  mapType: 'desert',
  mode: 'bots',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Bot', isBot: true, difficulty: 'hard' }
  ]
});
// Rychlý test: zničíme hrad bota.
const botCastle = sim2.getCastle(2);
assert(!!botCastle, 'bot má hrad');
sim2.dealDamage(botCastle, 99999, 1);
assert(!sim2.getCastle(2), 'hrad bota padl');
assert(sim2.ended && sim2.winnerId === 1, 'hráč vyhrál');

console.log('\n--- Pathfinding ---');
const villager = sim.units.find(u => u.ownerId === 1 && u.isVillager);
const startX = villager.x, startY = villager.y;
const okPath = sim.navigateTo(villager, 70, 55);
for (let i = 0; i < 20 * 40; i++) sim.tick(1 / 20);
console.log(`  cesta nalezena: ${okPath}, pozice ${startX.toFixed(1)},${startY.toFixed(1)} -> ${villager.x.toFixed(1)},${villager.y.toFixed(1)}`);
assert(okPath, 'A* našla cestu do středu mapy');

console.log('\n--- Ekonomika, obchod, výcvik, opravy ---');
function findSpot(targetSim, playerId, type, maxDistance = 24) {
  const castle = targetSim.getCastle(playerId);
  for (let yy = castle.tileY - maxDistance; yy <= castle.tileY + maxDistance; yy++) {
    for (let xx = castle.tileX - maxDistance; xx <= castle.tileX + maxDistance; xx++) {
      if (xx < 0 || yy < 0 || xx >= targetSim.map.size || yy >= targetSim.map.size) continue;
      if (targetSim.canPlaceBuilding(playerId, type, xx, yy).valid) return { x: xx, y: yy };
    }
  }
  return null;
}

const sim3 = new GameSim({
  seed: 2026,
  mapType: 'desert',
  mode: 'sandbox',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const marketSpot = findSpot(sim3, 1, 'market');
assert(!!marketSpot, 'lze najít místo pro Obchod');
const marketBuild = sim3.command(1, { op: 'build', buildingType: 'market', x: marketSpot.x, y: marketSpot.y });
assert(marketBuild.ok, 'Obchod zadán ke stavbě');
const market = sim3.buildings.find(b => b.id === marketBuild.buildingId);
const marketBuilders = sim3.units.filter(u => u.ownerId === 1 && u.isVillager).slice(0, 3);
assert(sim3.command(1, { op: 'construct', buildingId: market.id, unitIds: marketBuilders.map(u => u.id) }).ok,
  'tři poddaní byli přiřazeni ke stavbě obchodu');
let marketBuildTicks = 0;
while (!market.complete && marketBuildTicks < 20 * 90) {
  sim3.tick(1 / 20);
  marketBuildTicks++;
}
assert(market.complete, 'Obchod dokončen třemi staviteli');

const trader = sim3.players[0];
trader.resources.money = 100000;
const woodBefore = trader.resources.wood;
const moneyBefore = trader.resources.money;
const buy = sim3.command(1, { op: 'buy', resource: 'wood', amount: 10 });
assert(buy.ok && trader.resources.wood === woodBefore + 10 && trader.resources.money === moneyBefore - 100,
  'nákup 10 dřeva odečte 100 peněz');
const sell = sim3.command(1, { op: 'sell', resource: 'wood', amount: 10 });
assert(sell.ok && trader.resources.wood === woodBefore && trader.resources.money === moneyBefore - 40,
  'prodej 10 dřeva vrátí 60 peněz');
const tooMuch = sim3.command(1, { op: 'buy', resource: 'wood', amount: 500 });
assert(!tooMuch.ok && /místa/.test(tooMuch.reason || ''), 'nákup nad kapacitu skladu je odmítnut');

const swordCost = sim3.players[0].resources.money;
const train = sim3.command(1, { op: 'train', buildingId: sim3.getCastle(1).id, unitType: 'swordsman' });
assert(train.ok, 'výcvik pěšáka zadán');
for (let i = 0; i < 20 * 41; i++) sim3.tick(1 / 20);
const swordsman = sim3.units.find(u => u.ownerId === 1 && u.type === 'swordsman');
assert(!!swordsman, 'pěšák vycvičen');
assert(sim3.players[0].stats.trained === 1, 'statistika výcviku se zvýšila');
assert(sim3.players[0].resources.money < swordCost, 'výcvik odečetl peníze');

const castle = sim3.getCastle(1);
sim3.dealDamage(castle, 200, 2);
const hpDamaged = castle.hp;
assert(hpDamaged < castle.maxHp, 'hrad poškozen');
const repair = sim3.command(1, { op: 'repair', buildingId: castle.id });
assert(repair.ok, 'oprava hradu zadána');
for (let i = 0; i < 20 * 8; i++) sim3.tick(1 / 20);
assert(castle.hp > hpDamaged, 'oprava obnovuje zdraví budovy');

const reserveBefore = sim3.players[0].resources.wood;
const demolish = sim3.command(1, { op: 'demolish', buildingId: market.id });
assert(demolish.ok, 'Obchod zbořen');
assert(!sim3.buildings.some(b => b.id === market.id), 'zbořená budova zmizela z mapy');
assert(sim3.players[0].resources.wood > reserveBefore, 'zboření vrátilo část surovin');
assert(!sim3.command(1, { op: 'demolish', buildingId: castle.id }).ok, 'hrad nelze zbourat');

console.log('\n--- Mlha války a kapacity ---');
const sim4 = new GameSim({
  seed: 999,
  mapType: 'oasis',
  mode: 'multiplayer',
  capital: 'medium',
  fog: true,
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const ownCastle = sim4.getCastle(1);
const enemyCastle = sim4.getCastle(2);
assert(sim4.isVisible(1, ownCastle.centerX, ownCastle.centerY), 'vlastní hrad je viditelný');
assert(!sim4.isVisible(1, enemyCastle.centerX, enemyCastle.centerY), 'nepřátelský hrad je skrytý mlhou');
const snapshot = sim4.serialize(1);
assert(snapshot.buildings.some(b => b.type === 'castle' && b.ownerId === 1), 'snímek obsahuje vlastní hrad');
assert(!snapshot.buildings.some(b => b.type === 'castle' && b.ownerId === 2), 'snímek neobsahuje skrytý hrad');
assert(snapshot.fog === true, 'snímek nese příznak mlhy');
assert(snapshot.units.every(raw => {
  const unit = sim4.units.find(u => u.id === raw.id);
  return raw.angle === unit.angle && raw.activity === unitActivity(unit) &&
    raw.cooldown === Math.round(unit.cooldown * 100) / 100 &&
    raw.workPaused === unit.workPaused;
}), 'síťový snímek nese směr, činnost a časování animací viditelných jednotek');
const visualWorker = sim.units.find(u => u.work && u.work.buildingId === lumber.id);
const oldPhase = visualWorker.work.phase;
const oldCarry = visualWorker.work.carry;
visualWorker.work.phase = 'toStorage';
visualWorker.work.carry = 10;
const carryingSnapshot = sim.serialize(1).units.find(u => u.id === visualWorker.id);
assert(carryingSnapshot.carry === 10 && carryingSnapshot.carryResource === 'wood' &&
  carryingSnapshot.activity === 'idle', 'síťový nosič má správný druh nákladu a netěží cestou');
visualWorker.work.phase = oldPhase;
visualWorker.work.carry = oldCarry;

const caps = sim4.getStorageCaps(1);
assert(caps.resources === 500 && caps.food === 300, 'hrad poskytuje sklad 500 a sýpku 300');
const freeSpace = caps.resources - sim4.getStoredResources(1);
const accepted = sim4.addResource(1, 'wood', 9999);
assert(accepted === freeSpace, `sklad přijme jen volné místo (${accepted})`);
assert(sim4.getStoredResources(1) === caps.resources, 'sklad je na kapacitě');
assert(sim4.addResource(1, 'wood', 10) === 0, 'plný sklad odmítne další suroviny');

console.log('\n--- Boj jednotek ---');
const sim5 = new GameSim({
  seed: 555,
  mapType: 'desert',
  mode: 'sandbox',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const enemyCastle5 = sim5.getCastle(2);
const attacker = sim5.addUnit('swordsman', 1, enemyCastle5.centerX - 5, enemyCastle5.centerY);
const defender = sim5.addUnit('archer', 2, enemyCastle5.centerX - 4, enemyCastle5.centerY);
const attackOrder = sim5.command(1, { op: 'attack', unitIds: [attacker.id], targetId: defender.id });
assert(attackOrder.ok, 'povel k útoku přijat');
for (let i = 0; i < 20 * 12; i++) sim5.tick(1 / 20);
assert(defender.hp < defender.maxHp || !sim5.units.includes(defender), 'cíl utrpěl poškození');
assert(sim5.players[0].stats.damage > 0, 'statistika poškození se zvýšila');

console.log('\n--- Přesun má přednost před automatickým útokem ---');
const sim6 = new GameSim({
  seed: 8123,
  mapType: 'desert',
  mode: 'sandbox',
  capital: 'rich',
  fog: false,
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const castle6 = sim6.getCastle(1);
const own6 = sim6.addUnit('swordsman', 1, castle6.centerX + 3, castle6.centerY + 1);
const foe6 = sim6.addUnit('swordsman', 2, castle6.centerX + 6, castle6.centerY + 1);
foe6.autoAttack = false;
assert(Math.hypot(foe6.x - own6.x, foe6.y - own6.y) <= own6.config.aggro,
  'nepřítel je v dosahu automatického útoku');

const moveStartX = own6.x;
const moveOrder = sim6.command(1, {
  op: 'move', unitIds: [own6.id], x: own6.x - 10, y: own6.y + 1
});
assert(moveOrder.ok && !!own6.moveTarget, 'povel k přesunu je přijat i s nepřítelem na dohledu');
for (let i = 0; i < 4; i++) sim6.tick(1 / 20);
assert(own6.attackTargetId === null && !!own6.moveTarget,
  'blízký nepřítel během přesunu nezruší povel');
for (let i = 0; i < 20 * 2; i++) sim6.tick(1 / 20);
assert(own6.x < moveStartX - 0.8, 'jednotka se po povelu skutečně vzdálila od nepřítele');

console.log('\n--- Ukládání a načtení rozehrané hry ---');
const startedAt = '2026-10-25T14:32:00';
const saved = sim.toSaveState({
  startedAt,
  options: { mode: 'bots', mapType: 'desert', bots: 1, difficulty: 'easy', capital: 'medium', fog: false }
});
const serialized = JSON.stringify(saved);
console.log(`  velikost uložení: ${(serialized.length / 1024).toFixed(1)} kB`);
assert(saved.meta.startedAt === startedAt, 'uložení nese čas zahájení hry');
assert(formatSaveLabel(saved.meta).includes('25. 10. 2026 14:32'), 'popisek uložení obsahuje datum a čas zahájení');
assert(saved.sim.players.every(p => !('tax' in p) && !('popularity' in p)),
  'nové uložení neobsahuje daně ani spokojenost');

const legacySaved = JSON.parse(serialized);
for (const p of legacySaved.sim.players) {
  p.tax = 'high';
  p.popularity = 35;
}
const restored = GameSim.fromSaveState(legacySaved);
assert(restored.players.every(p => !('tax' in p) && !('popularity' in p)),
  'starší uložení se načte bez zrušených polí daní a spokojenosti');
const restoredMoney = restored.players.map(p => p.resources.money);
restored.updateEconomy(60);
assert(restored.players.every((p, i) => p.resources.money === restoredMoney[i]),
  'ani po načtení starší hry se neobnoví daňový příjem');
assert(restored.toSaveState().sim.players.every(p => !('tax' in p) && !('popularity' in p)),
  'opětovné uložení starší hry nevrací zrušená pole');
assert(restored.time === sim.time && restored.tickCount === sim.tickCount, 'načtený čas simulace odpovídá uložení');
assert(restored.buildings.length === sim.buildings.length, 'načtený počet budov odpovídá uložení');
assert(restored.units.length === sim.units.length, 'načtený počet jednotek odpovídá uložení');
assert(restored.players.length === sim.players.length, 'načtený počet hráčů odpovídá uložení');
assert(restored.players[0].resources.wood === sim.players[0].resources.wood,
  'načtené suroviny odpovídají uložení');
assert(restored.players[0].resources.money === sim.players[0].resources.money,
  'načtené peníze odpovídají uložení');

const savedLumber = restored.buildings.find(b => b.type === 'lumberjack' && b.ownerId === 1);
const originalLumber = sim.buildings.find(b => b.type === 'lumberjack' && b.ownerId === 1);
assert(originalLumber.workers > 0, 'před uložením pracují u dřevorubce dělníci');
assert(savedLumber && savedLumber.workers === originalLumber.workers, 'načtený stav dělníků budovy odpovídá uložení');
assert(savedLumber && originalLumber.assignedWorkerIds.length > 0 &&
  savedLumber.assignedWorkerIds.length === originalLumber.assignedWorkerIds.length,
  'načtené přiřazené dělníky odpovídají uložení');
const originalWorker = sim.units.find(u => u.work && u.work.buildingId === originalLumber.id);
assert(!!originalWorker, 'před uložením existuje rozdělaná práce dělníka');
const restoredWorker = originalWorker && restored.units.find(u => u.id === originalWorker.id);
assert(restoredWorker && restoredWorker.work && restoredWorker.work.phase === originalWorker.work.phase,
  'rozdělaná práce dělníka se obnoví');

let mapDiff = 0;
for (let i = 0; i < sim.map.tiles.length; i++) {
  if (sim.map.tiles[i] !== restored.map.tiles[i] ||
      sim.map.resources[i] !== restored.map.resources[i] ||
      sim.map.depositAt[i] !== restored.map.depositAt[i]) {
    mapDiff++;
  }
}
assert(mapDiff === 0, 'terén, zdroje i ložiska se obnoví beze změny');
assert(restored.map.deposits.length === sim.map.deposits.length, 'načtená ložiska odpovídají uložení');
assert(restored.map.treeTimers.length === sim.map.treeTimers.length, 'načtené čekající stromy odpovídají uložení');

const restoredTime = restored.time;
for (let i = 0; i < 20 * 5; i++) restored.tick(1 / 20);
assert(restored.time > restoredTime, 'načtená hra dál běží');

const fogSaved = JSON.parse(JSON.stringify(sim4.toSaveState({ startedAt })));
const fogRestored = GameSim.fromSaveState(fogSaved);
assert(fogRestored.isVisible(1, ownCastle.centerX, ownCastle.centerY), 'po načtení zůstává vlastní hrad viditelný');
assert(!fogRestored.isVisible(1, enemyCastle.centerX, enemyCastle.centerY), 'po načtení zůstává nepřátelský hrad skrytý');

console.log('\n--- Stavba staveništěm ---');
assert(buildSpeedFactor(0) === 0, 'bez stavitelů se stavba nehýbe');
assert(buildSpeedFactor(1) === 1, 'jeden stavitel staví základní rychlostí');
assert(buildSpeedFactor(2) === 1.5, 'druhý stavitel přidá 50 %');
assert(buildSpeedFactor(3) === 2, 'třetí stavitel přidá dalších 50 %, ne stejně jako první');
assert(buildSpeedFactor(16) === 8.5, 'šestnáct stavitelů dává 850 % rychlosti');

const sim7 = new GameSim({
  seed: 4242,
  mapType: 'desert',
  mode: 'sandbox',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const siteSpot = findSpot(sim7, 1, 'dwelling');
assert(!!siteSpot, 'lze najít místo pro obydlí');
const siteRes = sim7.command(1, { op: 'build', buildingType: 'dwelling', x: siteSpot.x, y: siteSpot.y });
assert(siteRes.ok, 'obydlí zakoupeno a na místě vzniklo staveniště');
const site = sim7.buildings.find(b => b.id === siteRes.buildingId);
assert(site.progress === 0 && !site.complete, 'staveniště začíná bez postupu');
const crew = sim7.units.filter(u => u.ownerId === 1 && u.isVillager);
for (let i = 0; i < 20 * 20; i++) sim7.tick(1 / 20);
assert(site.progress === 0 && !site.complete, 'bez stavitelů staveniště 20 s stojí');

const siteCrew = crew.slice(0, 2);
assert(sim7.command(1, { op: 'construct', buildingId: site.id, unitIds: siteCrew.map(u => u.id) }).assigned === 2,
  'dva poddaní přijali povel ke stavbě');
let siteTicks = 0;
while (!site.complete && siteTicks < 20 * 120) {
  sim7.tick(1 / 20);
  siteTicks++;
}
assert(site.complete && site.hp === site.maxHp, 'dva stavitelé obydlí dokončí a má plné zdraví');
assert(!siteCrew.some(u => u.build), 'po dokončení stavitelé stavbu opustí');
assert(!sim7.command(1, { op: 'construct', buildingId: site.id, unitIds: [crew[2].id] }).ok,
  'hotovou budovu už nelze stavět');

const site2Spot = findSpot(sim7, 1, 'dwelling');
assert(!!site2Spot, 'lze najít místo pro druhé staveniště');
const site2Res = sim7.command(1, { op: 'build', buildingType: 'dwelling', x: site2Spot.x, y: site2Spot.y });
assert(site2Res.ok, 'druhé staveniště zadáno');
const site2 = sim7.buildings.find(b => b.id === site2Res.buildingId);
const walker = crew[2];
assert(sim7.command(1, { op: 'construct', buildingId: site2.id, unitIds: [walker.id] }).ok,
  'jeden poddaný se přihlásil ke druhému staveništi');
assert(walker.build && walker.build.buildingId === site2.id, 'poddaný je stavitelem druhého staveniště');
sim7.command(1, { op: 'move', unitIds: [walker.id], x: walker.x + 2, y: walker.y + 2 });
assert(!walker.build, 'příkaz k přesunu stavitele z práce odvolá');

const site2Crew = [crew[3], crew[4]];
assert(sim7.command(1, { op: 'construct', buildingId: site2.id, unitIds: site2Crew.map(u => u.id) }).ok,
  'dva poddaní jsou přiřazeni k druhému staveništi');
let progressTicks = 0;
while (site2.progress === 0 && progressTicks < 20 * 60) {
  sim7.tick(1 / 20);
  progressTicks++;
}
assert(site2.progress > 0 && !site2.complete, 'stavba postupuje, jakmile stavitelé dorazí');

const savedBuilders = sim7.units.filter(u => u.build && u.build.buildingId === site2.id);
assert(savedBuilders.length === 2, 'na staveništi jsou dva stavitelé');
const saved7 = JSON.parse(JSON.stringify(sim7.toSaveState({ startedAt })));
const restored7 = GameSim.fromSaveState(saved7);
const restoredSite2 = restored7.buildings.find(b => b.id === site2.id);
const restoredBuilders = restored7.units.filter(u => u.build && u.build.buildingId === site2.id);
assert(restoredSite2 && !restoredSite2.complete && restoredSite2.progress === site2.progress,
  'po načtení stavba pokračuje od uloženého postupu');
assert(restoredBuilders.length === 2 && restoredBuilders.every(u => savedBuilders.some(s =>
  s.id === u.id && s.build.arrived === u.build.arrived)),
  'po načtení zůstanou stejní stavitelé ve stejném stavu');
let restoredTicks = 0;
while (restoredSite2 && !restoredSite2.complete && restoredTicks < 20 * 120) {
  restored7.tick(1 / 20);
  restoredTicks++;
}
assert(restoredSite2 && restoredSite2.complete, 'načtené staveniště dokončí stavitelé po načtení');

const releaseIds = savedBuilders.map(u => u.id);
const releasedRes = sim7.command(1, { op: 'release', unitIds: releaseIds });
assert(releasedRes.ok && releasedRes.released === 2, 'uvolnění vrátí oba stavitele k volným úkolům');
assert(!sim7.units.some(u => u.build && u.build.buildingId === site2.id), 'uvolnění odebere stavitele ze staveniště');
assert(!sim7.command(1, { op: 'release', unitIds: releaseIds }).ok, 'opakované uvolnění nemá co uvolnit');

console.log('\n--- Nosič s nákladem nejde přeřadit ---');
const sim8 = new GameSim({
  seed: 777,
  mapType: 'oasis',
  mode: 'sandbox',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const carryCastle = sim8.getCastle(1);
let carrySpot = null;
for (let y = 0; y < sim8.map.size && !carrySpot; y++) {
  for (let x = 0; x < sim8.map.size; x++) {
    if (Math.hypot(x - carryCastle.centerX, y - carryCastle.centerY) > 30) continue;
    if (sim8.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
    if (sim8.canPlaceBuilding(1, 'lumberjack', x, y).valid) {
      carrySpot = { x, y };
      break;
    }
  }
}
assert(!!carrySpot, 'lze najít místo pro dřevorubce u nosiče');
const carryLumberRes = sim8.command(1, { op: 'build', buildingType: 'lumberjack', x: carrySpot.x, y: carrySpot.y });
assert(carryLumberRes.ok, 'dřevorubec zadán');
const carryLumber = sim8.buildings.find(b => b.id === carryLumberRes.buildingId);
const carryBuilders = sim8.units.filter(u => u.ownerId === 1 && u.isVillager).slice(0, 2);
assert(sim8.command(1, { op: 'construct', buildingId: carryLumber.id, unitIds: carryBuilders.map(u => u.id) }).assigned === 2,
  'dva poddaní staví dřevorubce');
let carryBuildTicks = 0;
while (!carryLumber.complete && carryBuildTicks < 20 * 90) {
  sim8.tick(1 / 20);
  carryBuildTicks++;
}
assert(carryLumber.complete, 'dřevorubec je hotový');
assert(sim8.command(1, { op: 'assign', buildingId: carryLumber.id, count: 1 }).ok, 'jeden poddaný jde do práce');
const carrier = sim8.units.find(u => u.work && u.work.buildingId === carryLumber.id);
assert(!!carrier, 'poddaný má přidělenou práci');
let carryTicks = 0;
while (!(carrier.work && carrier.work.carry > 0) && carryTicks < 20 * 240) {
  sim8.tick(1 / 20);
  carryTicks++;
}
assert(carrier.work && carrier.work.carry > 0, 'poddaný nese náklad dřeva');

const carryWarehouseSpot = findSpot(sim8, 1, 'warehouse');
assert(!!carryWarehouseSpot, 'lze najít místo pro sklad');
const carryWarehouseRes = sim8.command(1, { op: 'build', buildingType: 'warehouse', x: carryWarehouseSpot.x, y: carryWarehouseSpot.y });
assert(carryWarehouseRes.ok, 'sklad zadán jako staveniště');
const carryWarehouse = sim8.buildings.find(b => b.id === carryWarehouseRes.buildingId);
const carriedAmount = carrier.work.carry;
const refusedBuild = sim8.command(1, { op: 'construct', buildingId: carryWarehouse.id, unitIds: [carrier.id] });
assert(!refusedBuild.ok && refusedBuild.reason === 'Vybraní poddaní nejdřív odevzdají náklad do skladu.',
  'nosič s nákladem nejde přeřadit ke stavbě');
assert(carrier.work && carrier.work.carry === carriedAmount, 'po odmítnutí povelu nosič náklad i práci ponechá');
const refusedRelease = sim8.command(1, { op: 'release', unitIds: [carrier.id] });
assert(!refusedRelease.ok && carrier.work && carrier.work.carry === carriedAmount,
  'nosič s nákladem nejde uvolnit z práce');
const carryHelper = sim8.units.find(u => u.ownerId === 1 && u.isVillager && !u.work && !u.build);
assert(!!carryHelper, 'je k dispozici volný poddaný');
const mixedRes = sim8.command(1, { op: 'construct', buildingId: carryWarehouse.id, unitIds: [carryHelper.id, carrier.id] });
assert(mixedRes.ok && mixedRes.assigned === 1, 'ke stavbě jde jen volný poddaný z vybraných');
assert(carryHelper.build && carryHelper.build.buildingId === carryWarehouse.id, 'volný poddaný staví sklad');
assert(carrier.work && carrier.work.carry === carriedAmount, 'nosič si při smíšeném povelu náklad ponechá');
assert(sim8.events.some(ev => ev.type === 'toast' && /nesou náklad/.test(ev.text || '')),
  'smíšený povel oznámí, že někteří vybraní nesou náklad');

const woodBeforeDelivery = sim8.players[0].resources.wood;
let deliverTicks = 0;
while (carrier.work && carrier.work.carry > 0 && deliverTicks < 20 * 120) {
  sim8.tick(1 / 20);
  deliverTicks++;
}
assert(carrier.work && carrier.work.carry === 0, 'nosič odevzdal náklad do skladu');
assert(sim8.players[0].resources.wood - woodBeforeDelivery === carriedAmount,
  'do skladu přibylo přesně tolik dřeva, kolik nosič nesl');
const carrierBuild = sim8.command(1, { op: 'construct', buildingId: carryWarehouse.id, unitIds: [carrier.id] });
assert(carrierBuild.ok && carrierBuild.assigned === 1, 'po odevzdání lze nosiče přidat ke stavbě');
assert(!carrier.work && carrier.build && carrier.build.buildingId === carryWarehouse.id,
  'po odevzdání nosič opustí práci a začne stavět');
assert(!carryWarehouse.complete, 'sklad zatím není hotový');

console.log('\n--- Jablka z sadu jdou do sýpky ---');
const sim9 = new GameSim({
  seed: 777,
  mapType: 'oasis',
  mode: 'sandbox',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Soupeř', isBot: false }
  ]
});
const appleVillagers = sim9.units.filter(u => u.ownerId === 1 && u.isVillager);
assert(appleVillagers.length >= 6, 'bohaté hlavní město má dost poddaných na dvě stavby');
const appleOrchardSpot = findSpot(sim9, 1, 'orchard');
assert(!!appleOrchardSpot, 'lze najít místo pro jabloňový sad');
const appleOrchardRes = sim9.command(1, { op: 'build', buildingType: 'orchard', x: appleOrchardSpot.x, y: appleOrchardSpot.y });
assert(appleOrchardRes.ok, 'sad zadán ke stavbě');
const appleOrchard = sim9.buildings.find(b => b.id === appleOrchardRes.buildingId);
const appleGranarySpot = findSpot(sim9, 1, 'granary');
assert(!!appleGranarySpot, 'lze najít místo pro sýpku');
const appleGranaryRes = sim9.command(1, { op: 'build', buildingType: 'granary', x: appleGranarySpot.x, y: appleGranarySpot.y });
assert(appleGranaryRes.ok, 'sýpka zadána ke stavbě');
const appleGranary = sim9.buildings.find(b => b.id === appleGranaryRes.buildingId);
assert(sim9.command(1, { op: 'construct', buildingId: appleOrchard.id, unitIds: appleVillagers.slice(0, 3).map(u => u.id) }).assigned === 3,
  'tři poddaní staví sad');
assert(sim9.command(1, { op: 'construct', buildingId: appleGranary.id, unitIds: appleVillagers.slice(3, 6).map(u => u.id) }).assigned === 3,
  'tři další poddaní staví sýpku');
let appleBuildTicks = 0;
while (!(appleOrchard.complete && appleGranary.complete) && appleBuildTicks < 20 * 240) {
  sim9.tick(1 / 20);
  appleBuildTicks++;
}
assert(appleOrchard.complete && appleGranary.complete, 'sad i sýpka jsou dokončeny');
assert(sim9.command(1, { op: 'assign', buildingId: appleOrchard.id, count: 1 }).ok, 'jeden poddaný jde do sadu');
const appleWorker = sim9.units.find(u => u.work && u.work.buildingId === appleOrchard.id);
assert(!!appleWorker, 'poddaný má práci v sadu');
let appleGatherTicks = 0;
while (!(appleWorker.work && appleWorker.work.phase === 'toStorage') && appleGatherTicks < 20 * 300) {
  sim9.tick(1 / 20);
  appleGatherTicks++;
}
assert(appleWorker.work && appleWorker.work.phase === 'toStorage', 'poddaný nasbíral jablka a jde je odnést');
const appleCarried = appleWorker.work.carry;
assert(appleCarried > 0, `nosič drží jablka: ${appleCarried}`);
assert(appleWorker.work.storageId === appleGranary.id, 'jablka jdou do sýpky, ne do hradu');
const appleGatheredBefore = sim9.players[0].stats.gathered;
let appleDeliverTicks = 0;
while (appleWorker.work && appleWorker.work.carry > 0 && appleDeliverTicks < 20 * 120) {
  sim9.tick(1 / 20);
  appleDeliverTicks++;
}
assert(appleWorker.work && appleWorker.work.carry === 0, 'poddaný odevzdal jablka');
assert(sim9.players[0].stats.gathered - appleGatheredBefore === appleCarried, 'sýpka přijala celý náklad jablek');
assert(sim9.events.some(ev => ev.type === 'gather' && ev.resource === 'food' && ev.amount === appleCarried
  && ev.x === appleGranary.centerX && ev.y === appleGranary.centerY), 'událost příjmu jablek ukazuje na sýpku');

console.log('\n--- Sad obnoví jídlo i při nedostatku ---');
{
  const orchardPlayer = sim9.getPlayer(1);
  orchardPlayer.resources.food = 0;
  sim9.tick(1 / 20);
  assert(orchardPlayer.foodShortage === true, 'sýpka je prázdná: nastal nedostatek jídla');
  assert(appleWorker.work && appleWorker.work.buildingId === appleOrchard.id, 'dělník u sadu zůstává přiřazený');
  let recoverTicks = 0;
  let orchardPaused = false;
  while (orchardPlayer.foodShortage && recoverTicks < 20 * 120) {
    sim9.tick(1 / 20);
    recoverTicks++;
    if (appleWorker.workPaused) orchardPaused = true;
  }
  assert(!orchardPaused, 'dělník u sadu při nedostatku dál pracuje');
  assert(!orchardPlayer.foodShortage && orchardPlayer.resources.food >= 1,
    `sad obnovil zásoby jídla a nedostatek se zrušil (za ${(recoverTicks / 20).toFixed(0)} s)`);
}

console.log('\n--- Stavební okruh a odstup od nepřítele ---');
const placementSim = new GameSim({
  seed: 99,
  mapType: 'desert',
  mode: 'bots',
  capital: 'rich',
  players: [
    { name: 'Hráč', isBot: false },
    { name: 'Bot', isBot: true, difficulty: 'medium' }
  ]
});
const ownCastle8 = placementSim.getCastle(1);
const enemyCastle8 = placementSim.getCastle(2);
let farSpot = null;
for (let y = 2; y < placementSim.map.size - 4 && !farSpot; y++) {
  for (let x = 2; x < placementSim.map.size - 4 && !farSpot; x++) {
    if (Math.hypot(x - ownCastle8.centerX, y - ownCastle8.centerY) <= 100) continue;
    if (Math.hypot(x - enemyCastle8.centerX, y - enemyCastle8.centerY) <= 40) continue;
    if (placementSim.canPlaceBuilding(1, 'dwelling', x, y).valid) farSpot = { x, y };
  }
}
assert(!!farSpot, 'lze stavět dál než 100 bloků od vlastního hradu');

const ownUnit8 = placementSim.addUnit('swordsman', 1, farSpot.x + 3, farSpot.y + 1);
assert(placementSim.canPlaceBuilding(1, 'dwelling', farSpot.x, farSpot.y).valid,
  'vlastní jednotka u místa stavby ji neblokuje');
placementSim.units.splice(placementSim.units.indexOf(ownUnit8), 1);

const enemyUnit8 = placementSim.addUnit('swordsman', 2, farSpot.x + 3, farSpot.y + 1);
const blockedByUnit = placementSim.canPlaceBuilding(1, 'dwelling', farSpot.x, farSpot.y);
assert(!blockedByUnit.valid && blockedByUnit.reason.includes('nepřátel'),
  'nepřátelská jednotka do 20 bloků stavbu zakáže');
placementSim.units.splice(placementSim.units.indexOf(enemyUnit8), 1);
assert(placementSim.canPlaceBuilding(1, 'dwelling', farSpot.x, farSpot.y).valid,
  'po odchodu nepřátelské jednotky je místo opět volné');

const blockedByCastle = placementSim.canPlaceBuilding(1, 'dwelling', enemyCastle8.tileX - 4, enemyCastle8.tileY);
assert(!blockedByCastle.valid && blockedByCastle.reason.includes('nepřátel'),
  'nepřátelský hrad do 20 bloků stavbu zakáže');
const beyondEnemyRange = placementSim.canPlaceBuilding(1, 'dwelling', enemyCastle8.tileX - 27, enemyCastle8.tileY);
assert(!beyondEnemyRange.reason || !beyondEnemyRange.reason.includes('nepřátel'),
  've vzdálenosti přes 20 bloků od nepřítele pravidlo neplatí');

console.log('\n--- Dřevorubec: nejbližší strom, doprava do hradu a celé náklady ---');
{
  const ecoSim = () => new GameSim({
    seed: 1234, mapType: 'desert', mode: 'sandbox', capital: 'rich', fog: false,
    players: [{ name: 'Hráč', isBot: false }, { name: 'Soupeř', isBot: false }]
  });
  const res = (s) => s.getPlayer(1).resources;
  const isInt = (r) => [r.wood, r.stone, r.iron, r.food].every(Number.isInteger);
  const treesNear = (s, x, y, r) => {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (s.map.getResource(x + dx, y + dy) === RESOURCE_TYPES.TREE) n++;
      }
    }
    return n;
  };
  // Čtyři stavitelé postaví dřevorubce a po dokončení se mu přiřadí čtyři dělníci.
  const startLumberjack = (s, x, y) => {
    const placed = s.command(1, { op: 'build', buildingType: 'lumberjack', x, y });
    if (!placed.ok) return null;
    const b = s.buildings.find(q => q.id === placed.buildingId);
    const builders = s.units.filter(u => u.ownerId === 1 && u.isVillager).slice(0, 4);
    s.command(1, { op: 'construct', buildingId: b.id, unitIds: builders.map(u => u.id) });
    for (let t = 0; t < 20 * 240 && !b.complete; t++) s.tick(1 / 20);
    if (!b.complete) return null;
    return s.command(1, { op: 'assign', buildingId: b.id, count: 4 }).ok ? b : null;
  };

  // Izolovaný strom a les: dělníci musí dovézt dřevo do hradu.
  for (const site of [
    { label: 'izolovaný strom', x: 36, y: 47, isolated: true },
    { label: 'les', x: 65, y: 45, isolated: false }
  ]) {
    const s = ecoSim();
    const trees = treesNear(s, site.x, site.y, 9);
    assert(site.isolated ? trees === 1 : trees >= 10,
      `${site.label}: místo odpovídá scénáři (stromů do 9 bloků: ${trees})`);
    // Bohatý start má 300 dřeva a 200 kamene, sklad (500) je plný. Kámen uvolníme, aby se dřevo mohlo složit.
    res(s).stone = 0;
    const b = startLumberjack(s, site.x, site.y);
    assert(!!b, `${site.label}: dřevorubec postaven a dělníci přiřazeni`);
    if (!b) continue;
    const start = res(s).wood;
    let ints = true;
    for (let t = 0; t < 20 * 120 && res(s).wood < start + 10; t++) {
      s.tick(1 / 20);
      ints = ints && isInt(res(s));
    }
    assert(res(s).wood >= start + 10, `${site.label}: dřevo se doveze do hradu (${start} → ${res(s).wood})`);
    assert(ints, `${site.label}: suroviny jsou během dovozu celá čísla`);
  }

  // Plný sklad: dělník drží celý náklad a čeká. Složí se jen celý náklad, a jen když se vejde.
  {
    const s = ecoSim();
    const b = startLumberjack(s, 36, 47);
    assert(!!b, 'plný sklad: dřevorubec postaven a dělníci přiřazeni');
    if (b) {
      const workers = () => s.units.filter(u => u.work && u.work.buildingId === b.id);
      let ints = true;
      const watchWood = (seconds) => {
        const changes = [];
        let last = res(s).wood;
        for (let k = 0; k < Math.round(seconds * 20); k++) {
          s.tick(1 / 20);
          ints = ints && isInt(res(s));
          if (res(s).wood !== last) {
            changes.push(res(s).wood - last);
            last = res(s).wood;
          }
        }
        return changes;
      };
      for (let t = 0; t < 20 * 400 && !workers().some(u => u.work.phase === 'waitStorage'); t++) s.tick(1 / 20);
      assert(workers().some(u => u.work.phase === 'waitStorage'), 'plný sklad: dělník čeká s celým nákladem');
      const fullChanges = watchWood(30);
      assert(s.freeStorage(1, 'wood') === 0 && fullChanges.length === 0, 'plný sklad: nic se nesloží');

      res(s).stone = 195;
      const partialChanges = watchWood(30);
      assert(s.freeStorage(1, 'wood') === 5 && partialChanges.length === 0,
        'volno 5 nestačí na náklad 10: nic se nesloží ani částečně');
      assert(workers().some(u => u.work.carry === 10), 'dělník dál drží celý náklad 10');

      res(s).stone = 190;
      const first = watchWood(10);
      assert(first.length === 1 && first[0] === 10,
        `volno 10: složí se přesně 10 kusů v jednom kroku (změny: ${JSON.stringify(first)})`);
      const afterChanges = watchWood(20);
      assert(s.freeStorage(1, 'wood') === 0 && afterChanges.length === 0,
        'po složení je sklad plný a ostatní dělníci čekají');

      res(s).stone = 0;
      const more = watchWood(60);
      assert(more.length > 0 && more.every(d => d > 0 && d % 10 === 0),
        `volné místo: skládá se po celých nákladech (změny: ${JSON.stringify(more)})`);
      assert(ints, 'dřevo, kámen, železo a jídlo jsou po celou dobu celá čísla');
    }
  }

  // Jídlo: spotřeba v celých jednotkách, nedostatek bez kmitání a obnova po doplnění.
  {
    const s = ecoSim();
    const b = startLumberjack(s, 36, 47);
    assert(!!b, 'jídlo: dřevorubec postaven a dělníci přiřazeni');
    if (b) {
      const p = () => s.getPlayer(1);
      const workers = () => s.units.filter(u => u.work && u.work.buildingId === b.id);
      let flips = 0;
      let lastFlag = p().foodShortage;
      let ints = true;
      const tick = () => {
        s.tick(1 / 20);
        if (p().foodShortage !== lastFlag) flips++;
        lastFlag = p().foodShortage;
        ints = ints && Number.isInteger(p().resources.food);
      };
      const run = (seconds) => {
        for (let k = 0; k < Math.round(seconds * 20); k++) tick();
      };

      const food0 = p().resources.food;
      run(60);
      const used = food0 - p().resources.food;
      assert(used >= 7 && used <= 9, `čtyři dělníci spotřebují za minutu ~8 jídla (spotřebováno ${used})`);

      p().resources.food = 0;
      tick();
      assert(p().foodShortage === true, 'bez jídla je nedostatek hned v prvním tiku');
      flips = 0;
      run(60);
      assert(flips === 0, `nedostatek se nekmitá (změn stavu: ${flips})`);
      assert(workers().every(u => u.workPaused), 'dělníci jsou při nedostatku pozastaveni');
      assert(p().resources.food === 0, 'jídlo zůstává na nule');

      p().resources.food = 50;
      tick();
      assert(p().foodShortage === false, 'po doplnění jídla se nedostatek hned zruší');
      run(2);
      assert(!workers().some(u => u.workPaused), 'dělníci se po doplnění vrátí k práci');
      const food1 = p().resources.food;
      run(60);
      assert(p().resources.food < food1, 'spotřeba jídla zase běží');

      for (const u of workers()) u.work = null;
      const castle = s.getCastle(1);
      s.addUnit('swordsman', 1, castle.centerX + 4, castle.centerY + 4);
      p().resources.food = 0;
      tick();
      assert(p().foodShortage === true, 'jeden voják bez jídla: nedostatek je hned v prvním tiku');
      p().resources.food = 50;
      tick();
      assert(p().foodShortage === false, 'jeden voják: po doplnění jídla se nedostatek hned zruší');
      assert(ints, 'jídlo je po celou dobu celé číslo');
    }
  }

  {
    const legacy = JSON.parse(serialized);
    for (const pl of legacy.sim.players) delete pl.foodDebt;
    const legacySim = GameSim.fromSaveState(legacy);
    assert(legacySim.players[0].foodDebt === 0, 'uložení bez zůstatku jídla se načte s nulou');
    for (let t = 0; t < 20 * 30; t++) legacySim.tick(1 / 20);
    assert(Number.isFinite(legacySim.players[0].foodDebt) && Number.isFinite(legacySim.players[0].resources.food),
      'po načtení starého uložení zůstává zůstatek i jídlo konečné');
  }

  // Sklad blíž než hrad: suroviny jdou do nejbližšího skladu nebo hradu, jídlo zůstává v hradu.
  {
    const s = ecoSim();
    const castle = s.getCastle(1);
    // Střed skladu je aspoň 4 bloky od stromu, aby nezavřel přístup k němu.
    const warehouseNear = (x, y) => {
      for (let yy = y - 8; yy <= y + 8; yy++) {
        for (let xx = x - 8; xx <= x + 8; xx++) {
          const gap = Math.max(Math.abs(xx + 1 - x), Math.abs(yy + 1 - y));
          if (gap >= 4 && s.canPlaceBuilding(1, 'warehouse', xx, yy).valid) return { x: xx, y: yy };
        }
      }
      return null;
    };
    const spot = warehouseNear(36, 47);
    const placedWh = spot ? s.command(1, { op: 'build', buildingType: 'warehouse', x: spot.x, y: spot.y }) : { ok: false };
    assert(placedWh.ok, 'sklad lze postavit blízko dřevorubce');
    if (placedWh.ok) {
      const wh = s.buildings.find(q => q.id === placedWh.buildingId);
      const builders = s.units.filter(u => u.ownerId === 1 && u.isVillager).slice(0, 4);
      s.command(1, { op: 'construct', buildingId: wh.id, unitIds: builders.map(u => u.id) });
      for (let t = 0; t < 20 * 240 && !wh.complete; t++) s.tick(1 / 20);
      assert(wh.complete, 'sklad dokončen čtyřmi staviteli');
      const b = startLumberjack(s, 36, 47);
      assert(!!b, 'dřevorubec u stromu postaven a dělníci přiřazeni');
      if (b) {
        const workers = () => s.units.filter(u => u.work && u.work.buildingId === b.id);
        const nearestStorage = (u) => {
          const toWarehouse = Math.hypot(u.x - wh.centerX, u.y - wh.centerY);
          const toCastle = Math.hypot(u.x - castle.centerX, u.y - castle.centerY);
          return toWarehouse < toCastle ? wh : castle;
        };
        // Cíl se zapisuje hned při rozhodnutí, protože se dělník po tiku může pohnout.
        const decisions = [];
        const beginDelivery = s.beginDelivery.bind(s);
        s.beginDelivery = (unit, work) => {
          const expected = nearestStorage(unit);
          beginDelivery(unit, work);
          if (work.buildingId === b.id && work.phase === 'toStorage') {
            decisions.push({ target: work.storageId, nearest: expected.id });
          }
        };
        const woodStart = res(s).wood;
        const sawBoth = () => decisions.some(d => d.target === wh.id) && decisions.some(d => d.target === castle.id);
        for (let t = 0; t < 20 * 600 && !(sawBoth() && res(s).wood > woodStart); t++) s.tick(1 / 20);
        assert(sawBoth(), 'dělníci nosí náklady do skladu i do hradu, podle toho, který je blíž');
        assert(decisions.every(d => d.target === d.nearest),
          `každý náklad jde do nejbližšího ze skladu a hradu (${decisions.length} rozhodnutí)`);
        assert(res(s).wood > woodStart, `dřevo se skutečně doveze (${woodStart} → ${res(s).wood})`);
        assert(workers().every(u => s.findStorage(1, 'stone', u).id === nearestStorage(u).id
          && s.findStorage(1, 'iron', u).id === nearestStorage(u).id), 'kámen a železo se řídí stejným pravidlem');
        assert(workers().every(u => s.findStorage(1, 'food', u).id === castle.id), 'jídlo bez sýpky jde do hradu');
      }
    }
  }
}

console.log('\n--- Uzavřené vs. otevřené budovy a kolize ---');
{
  const simB = new GameSim({
    mapSeed: 10,
    capital: 'rich',
    players: [{ name: 'Lord', isBot: false }]
  });
  const spot = findSpot(simB, 1, 'dwelling');
  assert(!!spot, 'nalezeno místo pro obydlí');
  // Přesuneme poddaného přímo na místo budoucího obydlí
  const testVillager = simB.units.find(u => u.ownerId === 1 && u.isVillager);
  testVillager.x = spot.x + 0.5;
  testVillager.y = spot.y + 0.5;
  testVillager.setPath([]);

  // Postavíme uzavřené obydlí na tomto místě
  const buildRes = simB.command(1, { op: 'build', buildingType: 'dwelling', x: spot.x, y: spot.y });
  assert(buildRes.ok, 'obydlí zadáno ke stavbě');
  const dwelling = simB.buildings.find(b => b.id === buildRes.buildingId);

  // Poddaný musel být okamžitě vysunut mimo půdorys budovy
  assert(!dwelling.containsTile(Math.floor(testVillager.x), Math.floor(testVillager.y)),
    'poddaný byl při zahájení stavby uzavřené budovy odsunut mimo její půdorys');
  assert(simB.isWalkableTile(Math.floor(testVillager.x), Math.floor(testVillager.y)),
    'poddaný stojí na průchozí dlaždici');

  // Dlaždice uzavřené budovy jsou neprůchozí
  for (let dy = 0; dy < dwelling.height; dy++) {
    for (let dx = 0; dx < dwelling.width; dx++) {
      assert(!simB.isWalkableTile(dwelling.tileX + dx, dwelling.tileY + dy),
        `dlaždice uzavřené budovy [${dwelling.tileX + dx}, ${dwelling.tileY + dy}] je neprůchodná`);
    }
  }

  // Otevřená budova: jabloňový sad po dokončení je průchozí
  const orchardSpot = findSpot(simB, 1, 'orchard');
  const orchardRes = simB.command(1, { op: 'build', buildingType: 'orchard', x: orchardSpot.x, y: orchardSpot.y });
  assert(orchardRes.ok, 'sad zadán ke stavbě');
  const orchard = simB.buildings.find(b => b.id === orchardRes.buildingId);
  orchard.complete = true;
  orchard.progress = 1;
  simB.rebuildBlockGrid();
  assert(orchard.config.passable === true, 'jabloňový sad je definován jako passable');
  for (let dy = 0; dy < orchard.height; dy++) {
    for (let dx = 0; dx < orchard.width; dx++) {
      assert(simB.isWalkableTile(orchard.tileX + dx, orchard.tileY + dy),
        `dlaždice dokončeného sadu [${orchard.tileX + dx}, ${orchard.tileY + dy}] je plně průchozí`);
    }
  }
}

console.log(failures ? `\n${failures} CHYB` : '\nVšechny testy prošly.');
process.exit(failures ? 1 : 0);

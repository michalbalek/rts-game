import { GameSim } from '../client/js/sim/sim.js';
import { GameMap } from '../client/js/sim/mapgen.js';
import { START_POSITIONS, RESOURCE_TYPES, TILE_TYPES } from '../client/js/sim/constants.js';

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

// Lidský hráč postaví dřevorubce na stromě a přiřadí dělníky.
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
const humanWoodBefore = sim.players[0].resources.wood;
for (let tick = 0; tick < 20 * 35; tick++) sim.tick(1 / 20);
const lumber = sim.buildings.find(b => b.ownerId === 1 && b.type === 'lumberjack');
assert(lumber && lumber.complete, 'dřevorubec dokončen');
const assignRes = sim.command(1, { op: 'assign', buildingId: lumber.id, count: 4 });
assert(assignRes.ok, 'přiřazeni dělníci');
const t0 = Date.now();
for (let tick = 0; tick < 20 * 150; tick++) sim.tick(1 / 20);
console.log(`  simulace 160 s: ${Date.now() - t0} ms, tick ${sim.tickCount}`);
console.log('  budovy:', sim.buildings.map(b => `${b.type}(${b.ownerId})${b.complete ? '' : '*'}`).join(', '));
for (const p of sim.players) {
  console.log(`  hráč ${p.name}: peníze ${Math.floor(p.resources.money)}, dřevo ${Math.floor(p.resources.wood)}, kámen ${Math.floor(p.resources.stone)}, jídlo ${Math.floor(p.resources.food)}, železo ${Math.floor(p.resources.iron)}; lid ${p.population}/${p.capacity}; spokojenost ${Math.round(p.popularity)}; zabito ${p.stats.lost}, zničeno ${p.stats.destroyed}, sehráno ${p.stats.gathered}`);
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
for (let i = 0; i < 20 * 61; i++) sim3.tick(1 / 20);
const market = sim3.buildings.find(b => b.ownerId === 1 && b.type === 'market');
assert(market && market.complete, 'Obchod dokončen');

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

console.log(failures ? `\n${failures} CHYB` : '\nVšechny testy prošly.');
process.exit(failures ? 1 : 0);

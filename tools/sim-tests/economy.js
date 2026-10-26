import { GameSim } from '../../client/js/sim/sim.js';
import { assert, findSpot } from './helpers.js';

export function testEconomy() {
  console.log('\n--- Ekonomika, obchod, výcvik, opravy ---');
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

}

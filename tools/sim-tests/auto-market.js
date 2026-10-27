import { GameSim } from '../../client/js/sim/sim.js';
import { Building } from '../../client/js/sim/entities.js';
import { assert } from './helpers.js';

export function testAutoMarket() {
  console.log('\n--- Automatický obchod ---');
  const sim = new GameSim({
    seed: 777, mode: 'sandbox', capital: 'medium',
    players: [{ name: 'Hráč' }, { name: 'Soupeř' }]
  });
  const player = sim.getPlayer(1);
  const other = sim.getPlayer(2);
  player.capacity = 0;
  other.capacity = 0;
  const set = (resource, buyTo, sellTo, owner = 1) =>
    sim.command(owner, { op: 'market-rule', resource, buyTo, sellTo });
  assert(!set('stone', 50, null).ok, 'pravidlo nelze nastavit bez dokončeného obchodu');
  const market = new Building(sim.nextId++, 'market', 1, 50, 50, false);
  sim.buildings.push(market);
  assert(!set('stone', 50, null).ok, 'rozestavěný obchod nestačí');
  market.complete = true;
  assert(set('stone', 50, 100).ok, 'lze nastavit nákupní i prodejní hranici');
  assert(!set('stone', 101, 100).ok && player.marketRules.stone.buyTo === 50,
    'překrývající se hranice jsou odmítnuty beze změny');
  for (const bad of [-1, 1.5, 1000001, NaN, Infinity, '50', undefined]) {
    assert(!set('stone', bad, null).ok, `neplatná hranice ${String(bad)} se odmítne`);
  }
  assert(!set('__proto__', 50, null).ok && !set('toString', 50, null).ok,
    'nelze obchodovat s vlastnostmi prototypu');
  assert(!set('stone', 50, null, 2).ok && !other.marketRules.stone,
    'jiný hráč nemůže použít cizí obchod ani měnit cizí pravidla');

  player.resources = { money: 1000, wood: 0, stone: 20, food: 0, iron: 0 };
  sim.updateEconomy(9.9);
  assert(player.resources.stone === 20, 'před uplynutím deseti sekund obchod neproběhne');
  sim.updateEconomy(0.1);
  assert(player.resources.stone === 50 && player.resources.money === 640,
    'po deseti sekundách se kámen dokoupí do 50 za běžnou cenu');
  player.resources.stone = 120;
  sim.updateEconomy(10);
  assert(player.resources.stone === 100 && player.resources.money === 800,
    'přebytek nad 100 se prodá a zůstane právě 100');
  player.resources.stone = 50;
  sim.updateEconomy(10);
  assert(player.resources.stone === 50 && player.resources.money === 800,
    'rovnost s hranicí nespustí nákup ani prodej');

  player.resources = { money: 25, wood: 0, stone: 0, food: 0, iron: 0 };
  sim.updateEconomy(10);
  assert(player.resources.stone === 2 && player.resources.money === 1,
    'při nedostatku peněz se koupí dostupná část');
  player.resources = { money: 1000, wood: 498, stone: 0, food: 299, iron: 0 };
  set('food', 50, null);
  sim.updateEconomy(10);
  assert(player.resources.stone === 2 && player.resources.food === 299,
    'suroviny respektují společnou kapacitu a zásoby nad cílem se nenakupují');
  player.resources = { money: 1000, wood: 0, stone: 0, food: 299, iron: 0 };
  set('food', 300, null);
  sim.updateEconomy(10);
  assert(player.resources.food === 300, 'nákup jídla používá kapacitu sýpky');
  player.resources = { money: 0, wood: 10, stone: 0, food: 300, iron: 0 };
  set('wood', null, 0);
  sim.updateEconomy(10);
  assert(player.resources.wood === 0 && player.resources.stone === 5 && player.resources.money === 0,
    'prodej předchází nákupu a získané peníze jsou ihned dostupné');

  market.complete = false;
  player.resources = { money: 1000, wood: 0, stone: 0, food: 300, iron: 0 };
  sim.updateEconomy(10);
  assert(player.resources.stone === 0 && player.marketRules.stone.buyTo === 50,
    'bez hotového obchodu se pravidla pozastaví, ale zůstanou uložená');
  const secondMarket = new Building(sim.nextId++, 'market', 1, 55, 55, true);
  sim.buildings.push(secondMarket);
  sim.updateEconomy(10);
  assert(player.resources.stone === 50, 'pravidla fungují i při dokončení jiného obchodu téhož hráče');
  sim.buildings.splice(sim.buildings.indexOf(secondMarket), 1);
  player.resources.stone = 0;
  sim.updateEconomy(10);
  assert(player.resources.stone === 0, 'po odstranění posledního dokončeného obchodu se obchod pozastaví');
  market.complete = true;
  player.resources.money = 1000;
  sim.updateEconomy(4);
  const saved = sim.toSaveState();
  player.marketRules.stone.buyTo = 40;
  assert(saved.sim.players[0].marketRules.stone.buyTo === 50, 'uložená pravidla nejsou sdílena se simulací');
  const restored = GameSim.fromSaveState(saved);
  const restoredPlayer = restored.getPlayer(1);
  restoredPlayer.capacity = 0;
  restored.updateEconomy(5.9);
  assert(restoredPlayer.resources.stone === 0, 'po načtení se zachová čas do dalšího obchodu');
  restored.updateEconomy(0.1);
  assert(restoredPlayer.resources.stone === 50, 'po načtení se pravidlo vykoná ve správný čas');
  const snapshot = restored.serialize(1);
  const enemySnapshot = restored.serialize(2);
  assert(snapshot.self.marketRules.stone.buyTo === 50 &&
    !Object.hasOwn(enemySnapshot.players[0], 'marketRules') &&
    !enemySnapshot.self.marketRules.stone, 'síťový snímek poskytuje pravidla jen jejich vlastníkovi');
  snapshot.self.marketRules.stone.buyTo = 5;
  assert(restoredPlayer.marketRules.stone.buyTo === 50, 'síťový snímek neodkazuje na pravidla simulace');
  const oldSave = sim.toSaveState();
  delete oldSave.sim.marketTimer;
  for (const p of oldSave.sim.players) delete p.marketRules;
  const oldRestored = GameSim.fromSaveState(oldSave);
  assert(Object.keys(oldRestored.getPlayer(1).marketRules).length === 0 && oldRestored.marketTimer === 10,
    'starší uložené hry nemají zapnutá pravidla');
  assert(restored.command(1, { op: 'market-rule', resource: 'stone', buyTo: null, sellTo: null }).ok &&
    !restoredPlayer.marketRules.stone, 'vyprázdnění obou polí pravidlo odstraní');
}

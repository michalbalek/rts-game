import { GameSim } from '../../client/js/sim/sim.js';
import { RESOURCE_TYPES } from '../../client/js/sim/constants.js';
import { assert, findSpot, findLumberSpotNearTree } from './helpers.js';

export function testCarriers() {
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
      carrySpot = findLumberSpotNearTree(sim8, 1, x, y);
      if (carrySpot) {
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

}

export function testOrchards() {
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

}

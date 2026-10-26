import { GameSim } from '../../client/js/sim/sim.js';
import { buildSpeedFactor } from '../../client/js/sim/constants.js';
import { assert, findSpot } from './helpers.js';

export function testConstruction(startedAt) {
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

}

export function testPlacement() {
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

}

export function testCollisions() {
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
}

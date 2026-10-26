import { GameSim } from '../../client/js/sim/sim.js';
import { formatSaveLabel } from '../../client/js/game/save.js';
import { assert } from './helpers.js';

export function testSaving({ sim }, { sim4, ownCastle, enemyCastle }) {
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

  return { startedAt, serialized };
}

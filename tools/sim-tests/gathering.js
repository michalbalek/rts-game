import { GameSim } from '../../client/js/sim/sim.js';
import { RESOURCE_TYPES } from '../../client/js/sim/constants.js';
import { assert, findLumberSpotNearTree } from './helpers.js';

export function testGathering(serialized) {
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
      const spot = findLumberSpotNearTree(s, 1, x, y, 8);
      if (!spot) return null;
      const placed = s.command(1, { op: 'build', buildingType: 'lumberjack', ...spot });
      if (!placed.ok) return null;
      assert(s.map.getResource(x, y) === RESOURCE_TYPES.TREE,
        'stavba dřevorubce zachová nedaleký strom pro těžbu');
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

    {
      const s = ecoSim();
      res(s).stone = 0;
      const b = startLumberjack(s, 36, 47);
      assert(!!b, 'sekání: dřevorubec byl postaven');
      if (b) {
        const workers = s.units.filter(u => u.work && u.work.buildingId === b.id);
        const worker = workers[0];
        for (const other of workers.slice(1)) {
          s.releaseWorker(other, false);
          other.clearOrders();
        }
        for (let t = 0; t < 20 * 180 && worker.work && worker.work.phase !== 'gather'; t++) s.tick(1 / 20);
        assert(worker.work && worker.work.phase === 'gather', 'dělník dřevorubce dorazil ke stromu');
        if (worker.work && worker.work.phase === 'gather') {
          let choppingAtTree = true;
          for (let t = 0; t < 20 * 19; t++) {
            s.tick(1 / 20);
            const source = worker.work && worker.work.source;
            const dx = source ? source.sx + 0.5 - worker.x : 0;
            const dy = source ? source.sy + 0.5 - worker.y : 0;
            choppingAtTree = choppingAtTree && worker.work && worker.work.phase === 'gather' &&
              worker.path.length === 0 && Math.hypot(dx, dy) <= 2.2 &&
              Math.cos(worker.angle) * dx + Math.sin(worker.angle) * dy > 0;
          }
          assert(choppingAtTree, 'dělník celou dobu seká u stromu místo obcházení');
          const wood = res(s).wood;
          for (let t = 0; t < 20 * 180 && res(s).wood === wood; t++) s.tick(1 / 20);
          assert(res(s).wood >= wood + 10, 'po sekání odnese náklad do skladu');
        }
      }
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

}

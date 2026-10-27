import { WORK } from './constants.js';

export class SimulationWorkCycle {
  // Dělník s nákladem vyrazí do skladu. Když žádný není, náklad si drží a zkusí to později.
  beginDelivery(unit, work) {
    const storage = this.findStorage(unit.ownerId, work.produce, unit);
    const approach = storage ? this.findBuildingApproach(unit, storage) : null;
    if (!storage || !approach) {
      work.storageId = null;
      work.phase = 'waitStorage';
      work.waitTimer = 3;
      return;
    }
    work.storageId = storage.id;
    work.phase = 'toStorage';
    this.navigateTo(unit, approach.x, approach.y);
  }

  // Při sběru dělník obchází okolí zdroje a mezi kroky chvíli postojí.
  roam(unit, work) {
    const cx = work.source.px + 0.5;
    const cy = work.source.py + 0.5;
    for (let i = 0; i < 12; i++) {
      const angle = this.rng() * Math.PI * 2;
      const d = Math.sqrt(this.rng()) * WORK.roamRadius;
      const tx = Math.floor(cx + Math.cos(angle) * d);
      const ty = Math.floor(cy + Math.sin(angle) * d);
      if (!this.isWalkableTile(tx, ty)) continue;
      this.navigateTo(unit, tx + 0.5, ty + 0.5, 400);
      break;
    }
    const [minPause, maxPause] = WORK.roamPause;
    work.roamWait = minPause + (maxPause - minPause) * this.rng();
  }

  updateVillagerWork(unit, dt) {
    const player = this.getPlayer(unit.ownerId);
    if (!player || !unit.work) return;
    const work = unit.work;
    const b = this.buildings.find(x => x.id === work.buildingId);
    if (!work.direct && (!b || !b.complete || b.ownerId !== unit.ownerId)) {
      // Zdrojová budova zanikla: dělník s nákladem ho ještě doručí, ostatní odejdou.
      if (work.carry <= 0) {
        this.releaseWorker(unit, true);
        return;
      }
      work.depleted = true;
      if (work.phase !== 'toStorage' && work.phase !== 'waitStorage') work.phase = 'toSource';
    }
    // Sad pracuje i při nedostatku jídla, jinak by se zásoba z nuly nikdy neobnovila.
    if (player.foodShortage && work.produce !== 'food') {
      unit.workPaused = true;
      unit.setPath([]);
      return;
    }
    unit.workPaused = false;

    switch (work.phase) {
      case 'toBuilding': {
        // Dělník nejprve dojde k přiřazené hospodářské budově. Teprve tam
        // se započítá mezi její pracovníky a začne hledat zdroj surovin.
        const approach = this.findBuildingApproach(unit, b);
        if (!approach) {
          work.phase = 'wait';
          work.waitTimer = 2;
          return;
        }
        if (this.unitAt(unit, approach.x, approach.y, 1.2)) {
          unit.setPath([]);
          if (!work.arrived) {
            work.arrived = true;
            b.workers = Math.min(b.config.workers, b.workers + 1);
          }
          work.phase = 'toSource';
          return;
        }
        if (unit.path.length === 0 && !this.navigateTo(unit, approach.x, approach.y)) {
          work.phase = 'wait';
          work.waitTimer = 2;
        }
        break;
      }
      case 'toSource': {
        // Dělník s nákladem ho nejdřív doručí, sbírat smí až s prázdnými rukama.
        if (work.carry > 0) {
          this.beginDelivery(unit, work);
          break;
        }
        if (work.depleted) {
          this.releaseWorker(unit, true);
          break;
        }
        if (!work.source) {
          work.source = this.findSource(unit, b);
          if (!work.source) {
            work.phase = 'wait';
            work.waitTimer = 3;
            return;
          }
          this.navigateTo(unit, work.source.px + 0.5, work.source.py + 0.5);
        }
        if (this.unitAt(unit, work.source.px + 0.5, work.source.py + 0.5, 1.0) || unit.path.length === 0) {
          if (this.unitAt(unit, work.source.px + 0.5, work.source.py + 0.5, 2.2)) {
            work.phase = 'gather';
            work.timer = WORK.gatherTime;
            work.roamWait = 0;
            unit.setPath([]);
          } else {
            // Cesta selhala – zkusit jiné místo.
            work.source = null;
            work.phase = 'wait';
            work.waitTimer = 2;
          }
        }
        break;
      }
      case 'gather': {
        work.timer -= dt;
        if (work.timer <= 0) {
          unit.setPath([]);
          work.phase = 'pick';
          break;
        }
        if (unit.path.length > 0) break;
        if (work.roamWait > 0) {
          work.roamWait -= dt;
          break;
        }
        this.roam(unit, work);
        break;
      }
      case 'pick': {
        if (!work.source) {
          work.phase = 'toSource';
          break;
        }
        const ax = work.source.px + 0.5;
        const ay = work.source.py + 0.5;
        if (!this.unitAt(unit, ax, ay, 2.2)) {
          if (unit.path.length === 0 && !this.navigateTo(unit, ax, ay)) {
            work.source = null;
            work.phase = 'wait';
            work.waitTimer = 2;
          }
          break;
        }
        unit.setPath([]);
        const got = this.harvest(unit, b);
        if (unit.work !== work) break;
        if (got <= 0) {
          work.source = null;
          work.phase = 'toSource';
          break;
        }
        work.carry += got;
        this.beginDelivery(unit, work);
        break;
      }
      case 'toStorage': {
        const storage = this.buildings.find(x => x.id === work.storageId && x.ownerId === unit.ownerId && x.complete);
        if (!storage) {
          this.beginDelivery(unit, work);
          break;
        }
        const approach = this.findBuildingApproach(unit, storage);
        if (!approach) {
          work.phase = 'waitStorage';
          work.waitTimer = 3;
          break;
        }
        if (this.unitAt(unit, approach.x, approach.y, 0.9)) {
          // Náklad se složí celý, nebo vůbec. Když se celý nevejde, dělník ho drží a čeká.
          if (this.freeStorage(unit.ownerId, work.produce) >= work.carry) {
            this.addResource(unit.ownerId, work.produce, work.carry);
            player.stats.gathered += work.carry;
            this.emit('gather', {
              playerId: unit.ownerId,
              resource: work.produce,
              amount: work.carry,
              x: storage.centerX,
              y: storage.centerY
            });
            work.carry = 0;
            work.source = null;
            work.fullStorage = false;
            work.phase = 'toSource';
          } else {
            // Sklad je plný, dělník drží celý náklad a zkusí to za chvíli znovu.
            work.phase = 'waitStorage';
            work.waitTimer = 3;
            if (!work.fullStorage && this.slowTimer <= 0) {
              work.fullStorage = true;
              const text = work.produce === 'food'
                ? 'Sýpky jsou plné, dělníci čekají.'
                : 'Sklady jsou plné, dělníci čekají.';
              this.emit('toast', { playerId: unit.ownerId, text, kind: 'error' });
            }
          }
        } else if (unit.path.length === 0 && !this.unitAt(unit, approach.x, approach.y, 2.0)) {
          if (!this.navigateTo(unit, approach.x, approach.y)) {
            work.phase = 'waitStorage';
            work.waitTimer = 3;
          }
        }
        break;
      }
      case 'waitStorage': {
        work.waitTimer -= dt;
        if (work.waitTimer <= 0) this.beginDelivery(unit, work);
        break;
      }
      case 'wait': {
        work.waitTimer -= dt;
        if (work.waitTimer <= 0) {
          work.source = null;
          work.phase = work.arrived ? 'toSource' : 'toBuilding';
        }
        break;
      }
      default:
        work.phase = work.arrived ? 'toSource' : 'toBuilding';
    }
  }
}

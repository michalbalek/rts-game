import { findPath, findNearestWalkable, isTileWalkable } from './pathfinding.js';
import { clamp, dist } from './sim-geometry.js';

// Mezizastávku stačí zasáhnout v tomto okolí. Přesný střed by se při tlačení davu netrefil
// a jednotky by u něj natrvalo uvízly (tlačení je zase odsouvalo zpět).
const WAYPOINT_REACH = 0.45;
const SIDE_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const NAV_MAX_NODES = 12000;

export class SimulationNavigation {
  rebuildBlockGrid() {
    this.blockGrid.fill(0);
    this.openGateTiles = new Map();
    this.regionsDirty = true;
    for (const b of this.buildings) {
      // Průchozí budova po dokončení neblokuje chůzi.
      if (b.complete && b.config.gate && b.gateOpen) {
        for (let dy = 0; dy < b.height; dy++) {
          for (let dx = 0; dx < b.width; dx++) {
            this.openGateTiles.set(this.map.idx(b.tileX + dx, b.tileY + dy), b.id);
          }
        }
        continue;
      }
      if (b.complete && b.config.passable) continue;
      for (let dy = 0; dy < b.height; dy++) {
        for (let dx = 0; dx < b.width; dx++) {
          const i = this.map.idx(b.tileX + dx, b.tileY + dy);
          if (i !== -1) this.blockGrid[i] = 1;
        }
      }
    }
  }

  isWalkableTile(x, y) {
    return isTileWalkable(this.map, x, y) && !this.blockGrid[y * this.map.size + x];
  }

  // Oblasti souvislé průchozí plochy počítané čtyřsměrně. A* s diagonálami dosáhne
  // stejných dlaždic, protože šikmý krok vyžaduje obě sousední dlaždice průchozí.
  ensureRegions() {
    if (!this.regionsDirty) return;
    const size = this.map.size;
    const labels = this.regionGrid;
    labels.fill(0);
    let label = 0;
    const stack = [];
    for (let start = 0; start < size * size; start++) {
      if (labels[start] !== 0) continue;
      const sx = start % size;
      if (!this.isWalkableTile(sx, (start - sx) / size)) continue;
      label++;
      labels[start] = label;
      stack.push(start);
      while (stack.length > 0) {
        const cur = stack.pop();
        const cx = cur % size;
        const cy = (cur - cx) / size;
        for (const [dx, dy] of SIDE_STEPS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = ny * size + nx;
          if (labels[ni] !== 0 || !this.isWalkableTile(nx, ny)) continue;
          labels[ni] = label;
          stack.push(ni);
        }
      }
    }
    this.regionsDirty = false;
  }

  // Oblasti, do kterých jednotka dojde. Stojí-li na neprůchozí dlaždici,
  // může odejít jen přes sousední průchozí dlaždice.
  unitRegions(unit) {
    this.ensureRegions();
    const size = this.map.size;
    const x = clamp(Math.floor(unit.x), 0, size - 1);
    const y = clamp(Math.floor(unit.y), 0, size - 1);
    const own = this.regionGrid[y * size + x];
    if (own) return [own];
    const found = [];
    for (const [dx, dy] of SIDE_STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const label = this.regionGrid[ny * size + nx];
      if (label && !found.includes(label)) found.push(label);
    }
    return found;
  }

  findBuildingApproach(unit, b) {
    const regions = this.unitRegions(unit);
    if (regions.length === 0) return null;
    const size = this.map.size;
    let best = null;
    let bestD = Infinity;
    for (let x = b.tileX - 1; x <= b.tileX + b.width; x++) {
      for (let y = b.tileY - 1; y <= b.tileY + b.height; y++) {
        if (b.containsTile(x, y)) continue;
        if (!this.isWalkableTile(x, y)) continue;
        if (!regions.includes(this.regionGrid[y * size + x])) continue;
        const d = dist(unit.x, unit.y, x + 0.5, y + 0.5);
        if (d < bestD) {
          bestD = d;
          best = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    return best;
  }

  navigateTo(unit, tx, ty, maxNodes = NAV_MAX_NODES) {
    const path = findPath(this.map, this.blockGrid, unit.x, unit.y, tx, ty, maxNodes);
    if (!path) {
      unit.setPath([]);
      unit.pathGoal = null;
      return false;
    }
    unit.setPath(path);
    unit.pathGoal = { x: tx, y: ty };
    return true;
  }

  unitAt(unit, x, y, radius = 0.9) {
    return dist(unit.x, unit.y, x, y) <= radius;
  }

  // Jednotka překrytá budovou nebo stromem (nebo vytlačená davem) se přesune
  // na nejbližší volné místo. Voják s rozkazem k přesunu pokračuje dál.
  ejectFromBlockedTile(unit) {
    const size = this.map.size;
    const tx = clamp(Math.floor(unit.x), 0, size - 1);
    const ty = clamp(Math.floor(unit.y), 0, size - 1);
    if (this.isWalkableTile(tx, ty)) return;
    const spot = findNearestWalkable(this.map, this.blockGrid, tx, ty, 6);
    if (!spot) return;
    unit.x = spot.x + 0.5;
    unit.y = spot.y + 0.5;
    if (unit.moveTarget) this.navigateTo(unit, unit.moveTarget.x, unit.moveTarget.y);
    else unit.setPath([]);
  }

  moveUnit(unit, dt) {
    if (!unit.path.length) return;
    let remaining = unit.speed * dt;
    let guard = 0;
    while (remaining > 0 && unit.pathIndex < unit.path.length && guard++ < 20) {
      const wp = unit.path[unit.pathIndex];
      if (!this.isWalkableTile(wp.x, wp.y)) {
        const goal = unit.pathGoal || unit.moveTarget;
        if (goal) this.navigateTo(unit, goal.x, goal.y);
        else unit.setPath([]);
        return;
      }
      const tx = wp.x + 0.5;
      const ty = wp.y + 0.5;
      const dx = tx - unit.x;
      const dy = ty - unit.y;
      const d = Math.hypot(dx, dy);
      const reach = unit.pathIndex < unit.path.length - 1 ? WAYPOINT_REACH : 0.08;
      if (d < reach) {
        unit.pathIndex++;
        continue;
      }
      const step = Math.min(remaining, d);
      const oldX = unit.x;
      const oldY = unit.y;
      unit.x += (dx / d) * step;
      unit.y += (dy / d) * step;
      this.trackGateEntry(unit, oldX, oldY);
      unit.angle = Math.atan2(dy, dx);
      remaining -= step;
      if (step >= d - 0.001) unit.pathIndex++;
    }
    if (unit.pathIndex >= unit.path.length) {
      unit.setPath([]);
      unit.stuckTimer = 0;
    }
  }

  trackGateEntry(unit, oldX, oldY) {
    const gateId = this.openGateTiles.get(this.map.idx(Math.floor(unit.x), Math.floor(unit.y)));
    if (!gateId) {
      unit.gateEntry = null;
    } else if (!unit.gateEntry || unit.gateEntry.gateId !== gateId) {
      unit.gateEntry = { gateId, x: oldX, y: oldY };
    }
  }

  // Párové porovnání všech jednotek bylo O(n²) a zabíralo přes polovinu času
  // simulace. Jednotky se proto roztřídí do buněk o velikosti jedné dlaždice
  // a každá se porovná jen s jednotkami se stejným nebo vyšším indexem
  // v sousedních buňkách (každá dvojice se tak zpracuje právě jednou).
  separateUnits() {
    const list = this.units;
    const count = list.length;
    if (count < 2) return;
    const size = this.map.size;
    if (!this.separationHead || this.separationHead.length !== size * size) {
      this.separationHead = new Int32Array(size * size);
    }
    if (!this.separationNext || this.separationNext.length < count) {
      this.separationNext = new Int32Array(Math.max(64, count * 2));
    }
    const head = this.separationHead;
    const next = this.separationNext;
    head.fill(-1);
    for (let i = 0; i < count; i++) {
      const u = list[i];
      if (u.garrison?.entered) continue;
      const key = clamp(Math.floor(u.y), 0, size - 1) * size + clamp(Math.floor(u.x), 0, size - 1);
      next[i] = head[key];
      head[key] = i;
    }
    for (let i = 0; i < count; i++) {
      const a = list[i];
      if (a.garrison?.entered) continue;
      const cx = clamp(Math.floor(a.x), 0, size - 1);
      const cy = clamp(Math.floor(a.y), 0, size - 1);
      for (let oy = -1; oy <= 1; oy++) {
        const ny = cy + oy;
        if (ny < 0 || ny >= size) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const nx = cx + ox;
          if (nx < 0 || nx >= size) continue;
          for (let j = head[ny * size + nx]; j !== -1; j = next[j]) {
            if (j > i) this.separatePair(a, list[j]);
          }
        }
      }
    }
  }

  separatePair(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx >= 0.55 || dx <= -0.55 || dy >= 0.55 || dy <= -0.55) return;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 0.000001 || d2 >= 0.3025) return;
    const d = Math.sqrt(d2);

    const overlap = 0.55 - d;
    const nx = dx / d;
    const ny = dy / d;

    // Jednotka, která dostala povel k přesunu, má přednost. Necháme ji
    // projít davem a uhnout spíš tomu, kdo stojí na místě – jinak se
    // vojáci u hradu navzájem vytlačovali a sotva se hnuli z místa.
    const aMoving = a.path.length > 0 || !!a.moveTarget;
    const bMoving = b.path.length > 0 || !!b.moveTarget;
    let aShare = 0.5;
    if (aMoving !== bMoving) aShare = aMoving ? 0.15 : 0.85;

    // Tlačení nesmí vystrčit jednotku na neprůchozí dlaždici (budova, strom).
    const aX = a.x - nx * overlap * aShare;
    const aY = a.y - ny * overlap * aShare;
    if (this.isWalkableTile(Math.floor(aX), Math.floor(aY))) {
      const oldX = a.x, oldY = a.y;
      a.x = aX;
      a.y = aY;
      this.trackGateEntry(a, oldX, oldY);
    }
    const bX = b.x + nx * overlap * (1 - aShare);
    const bY = b.y + ny * overlap * (1 - aShare);
    if (this.isWalkableTile(Math.floor(bX), Math.floor(bY))) {
      const oldX = b.x, oldY = b.y;
      b.x = bX;
      b.y = bY;
      this.trackGateEntry(b, oldX, oldY);
    }
  }
}

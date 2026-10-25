import { TILE_TYPES, RESOURCE_TYPES } from './constants.js';

/**
 * A* hledání cesty po dlaždicích.
 * Hluboká voda, stromy a budovy jsou neprůchodné. Mělká voda (brody) průchodná.
 */
export function isTileWalkable(map, x, y) {
  if (x < 0 || y < 0 || x >= map.size || y >= map.size) return false;
  const tile = map.tiles[y * map.size + x];
  if (tile === TILE_TYPES.WATER_DEEP) return false;
  const res = map.resources[y * map.size + x];
  if (res === RESOURCE_TYPES.TREE) return false;
  // Kamenité/železné ložisko je pevná skála.
  if (res === RESOURCE_TYPES.STONE || res === RESOURCE_TYPES.IRON) return false;
  return true;
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]
];

/**
 * Vrátí pole dlaždic [{x,y}, ...] nebo null.
 * blockGrid: Uint8Array velikosti mapy (budovy).
 */
export function findPath(map, blockGrid, startX, startY, targetX, targetY, maxNodes = 6000) {
  const size = map.size;
  const sx = clampInt(startX, 0, size - 1);
  const sy = clampInt(startY, 0, size - 1);
  let tx = clampInt(targetX, 0, size - 1);
  let ty = clampInt(targetY, 0, size - 1);

  if (!isTileWalkable(map, tx, ty) || blockGrid[ty * size + tx]) {
    const near = findNearestWalkable(map, blockGrid, tx, ty, 6);
    if (!near) return null;
    tx = near.x;
    ty = near.y;
  }

  if (sx === tx && sy === ty) return [{ x: tx, y: ty }];

  const total = size * size;
  const open = new MinHeap();
  const gScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);

  const startIdx = sy * size + sx;
  const goalIdx = ty * size + tx;
  gScore[startIdx] = 0;
  open.push({ idx: startIdx, f: heuristic(sx, sy, tx, ty) });

  let visited = 0;
  while (open.size > 0 && visited < maxNodes) {
    const current = open.pop();
    if (current.idx === goalIdx) {
      return reconstruct(cameFrom, current.idx, size);
    }
    if (closed[current.idx]) continue;
    closed[current.idx] = 1;
    visited++;

    const cx = current.idx % size;
    const cy = (current.idx - cx) / size;

    for (const [dx, dy, weight] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nIdx = ny * size + nx;
      if (closed[nIdx] || blockGrid[nIdx]) continue;
      if (!isTileWalkable(map, nx, ny)) continue;
      // Zamezíme prořezávání rohů mezi dvěma překážkami.
      if (dx !== 0 && dy !== 0) {
        if (!isTileWalkable(map, cx + dx, cy) || !isTileWalkable(map, cx, cy + dy)) continue;
        if (blockGrid[cy * size + (cx + dx)] || blockGrid[(cy + dy) * size + cx]) continue;
      }

      const tentative = gScore[current.idx] + weight;
      if (tentative < gScore[nIdx]) {
        gScore[nIdx] = tentative;
        cameFrom[nIdx] = current.idx;
        open.push({ idx: nIdx, f: tentative + heuristic(nx, ny, tx, ty) });
      }
    }
  }
  return null;
}

function heuristic(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy);
}

function reconstruct(cameFrom, idx, size) {
  const path = [];
  let cur = idx;
  while (cur !== -1) {
    const x = cur % size;
    const y = (cur - x) / size;
    path.push({ x, y });
    cur = cameFrom[cur];
  }
  path.reverse();
  return path;
}

export function findNearestWalkable(map, blockGrid, x, y, maxRadius = 6) {
  if (isTileWalkable(map, x, y) && !blockGrid[y * map.size + x]) return { x, y };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.size || ny >= map.size) continue;
        if (isTileWalkable(map, nx, ny) && !blockGrid[ny * map.size + nx]) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

/** Jednoduchá binární halda pro A*. */
class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < a.length && a[l].f < a[smallest].f) smallest = l;
        if (r < a.length && a[r].f < a[smallest].f) smallest = r;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return top;
  }
}

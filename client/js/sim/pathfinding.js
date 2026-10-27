import { TILE_TYPES, RESOURCE_TYPES } from './constants.js';

/**
 * A* hledání cesty po dlaždicích.
 * Hluboká voda, stromy a budovy jsou neprůchodné. Mělká voda (brody) průchodná.
 */
export function isTileWalkable(map, x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
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
 *
 * Pracovní pole se nealokují při každém hledání (dříve ~360 kB na cestu),
 * ale sdílí se a jejich platnost určuje číslo běhu `stamp`.
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

  const ws = workspace(size * size);
  const stamp = nextStamp(ws);
  const { gScore, cameFrom, seen, closed, heap } = ws;
  const tiles = map.tiles;
  const resources = map.resources;
  const passable = (i) => {
    if (tiles[i] === TILE_TYPES.WATER_DEEP || blockGrid[i]) return false;
    const res = resources[i];
    return res !== RESOURCE_TYPES.TREE && res !== RESOURCE_TYPES.STONE && res !== RESOURCE_TYPES.IRON;
  };

  const startIdx = sy * size + sx;
  const goalIdx = ty * size + tx;
  seen[startIdx] = stamp;
  gScore[startIdx] = 0;
  cameFrom[startIdx] = -1;
  heap.clear();
  heap.push(startIdx, heuristic(sx, sy, tx, ty));

  let visited = 0;
  while (heap.size > 0 && visited < maxNodes) {
    const currentIdx = heap.pop();
    if (currentIdx === goalIdx) {
      return reconstruct(cameFrom, currentIdx, size);
    }
    if (closed[currentIdx] === stamp) continue;
    closed[currentIdx] = stamp;
    visited++;

    const cx = currentIdx % size;
    const cy = (currentIdx - cx) / size;
    const currentG = gScore[currentIdx];

    for (let d = 0; d < 8; d++) {
      const dx = DIR_X[d];
      const dy = DIR_Y[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nIdx = ny * size + nx;
      if (closed[nIdx] === stamp || !passable(nIdx)) continue;
      // Zamezíme prořezávání rohů mezi dvěma překážkami.
      if (dx !== 0 && dy !== 0) {
        if (!passable(cy * size + nx) || !passable(ny * size + cx)) continue;
      }

      const tentative = currentG + DIR_W[d];
      if (seen[nIdx] !== stamp || tentative < gScore[nIdx]) {
        seen[nIdx] = stamp;
        gScore[nIdx] = tentative;
        cameFrom[nIdx] = currentIdx;
        heap.push(nIdx, tentative + heuristic(nx, ny, tx, ty));
      }
    }
  }
  return null;
}

const DIR_X = Int8Array.from(DIRS, d => d[0]);
const DIR_Y = Int8Array.from(DIRS, d => d[1]);
const DIR_W = Float64Array.from(DIRS, d => d[2]);

let shared = null;

function workspace(total) {
  if (!shared || shared.total !== total) {
    shared = {
      total,
      stamp: 0,
      gScore: new Float32Array(total),
      cameFrom: new Int32Array(total),
      seen: new Uint32Array(total),
      closed: new Uint32Array(total),
      heap: new MinHeap()
    };
  }
  return shared;
}

function nextStamp(ws) {
  ws.stamp++;
  if (ws.stamp >= 0xffffffff) {
    ws.seen.fill(0);
    ws.closed.fill(0);
    ws.stamp = 1;
  }
  return ws.stamp;
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
  x = Math.floor(x);
  y = Math.floor(y);
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

/** Binární halda pro A* nad typovanými poli (index dlaždice + odhad f). */
class MinHeap {
  constructor(capacity = 1024) {
    this.idx = new Int32Array(capacity);
    this.f = new Float64Array(capacity);
    this.size = 0;
  }
  clear() {
    this.size = 0;
  }
  grow() {
    const idx = new Int32Array(this.idx.length * 2);
    const f = new Float64Array(this.f.length * 2);
    idx.set(this.idx);
    f.set(this.f);
    this.idx = idx;
    this.f = f;
  }
  push(item, score) {
    if (this.size === this.idx.length) this.grow();
    const idx = this.idx;
    const f = this.f;
    let i = this.size++;
    idx[i] = item;
    f[i] = score;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[p] <= f[i]) break;
      swap(idx, f, p, i);
      i = p;
    }
  }
  pop() {
    const idx = this.idx;
    const f = this.f;
    const top = idx[0];
    const last = --this.size;
    if (last > 0) {
      idx[0] = idx[last];
      f[0] = f[last];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < last && f[l] < f[smallest]) smallest = l;
        if (r < last && f[r] < f[smallest]) smallest = r;
        if (smallest === i) break;
        swap(idx, f, i, smallest);
        i = smallest;
      }
    }
    return top;
  }
}

function swap(idx, f, a, b) {
  const ti = idx[a];
  idx[a] = idx[b];
  idx[b] = ti;
  const tf = f[a];
  f[a] = f[b];
  f[b] = tf;
}

import { HALF_TILE_WIDTH, TILE_HEIGHT } from './isometric.js';
import { visibleTileRows } from './viewport.js';
import { paintTerrainChunk } from './terrain-chunk.js';

export { hash } from './terrain-textures.js';

/**
 * Terén se nemění (mění se jen přírodní zdroje), proto se kreslí po blocích
 * do mezipaměti a každý snímek je jen několik drawImage. Blok je obdélník
 * ve světových pixelech; rozlišení odpovídá zoomu a hustotě pixelů displeje.
 */
const CHUNK = 512;
const PAD = 2;
const PIXEL_BUDGET = 24 * 1024 * 1024;
const BUILD_BUDGET_MS = 8;

export class RendererTerrain {
  resetTerrainCache() {
    this.terrainChunks = new Map();
    this.terrainPixels = 0;
    this.terrainFrame = 0;
    this.terrainCacheMap = this.map;
    this.terrainCacheQuality = this.quality;
  }

  terrainScale() {
    const density = this.zoom * (this.dpr || 1);
    if (this.quality === 'low') return density > 0.8 ? 1 : 0.5;
    if (density > 1.45) return 2;
    return density > 0.72 ? 1 : 0.5;
  }

  drawTerrain(ctx, rows, camera) {
    if (!this.terrainChunks || this.terrainCacheMap !== this.map || this.terrainCacheQuality !== this.quality) {
      this.resetTerrainCache();
    }
    if (typeof document === 'undefined' || !camera) return;
    this.terrainFrame++;
    const scale = this.terrainScale();
    const size = this.map.size;
    const a = camera.screenToWorld(0, 0);
    const b = camera.screenToWorld(this.viewWidth, this.viewHeight);
    const minX = Math.max(a.x, -size * HALF_TILE_WIDTH);
    const maxX = Math.min(b.x, size * HALF_TILE_WIDTH);
    const minY = Math.max(a.y, 0);
    const maxY = Math.min(b.y, size * TILE_HEIGHT);
    if (minX >= maxX || minY >= maxY) return;

    const deadline = performance.now() + BUILD_BUDGET_MS;
    const visible = [];
    for (let cy = Math.floor(minY / CHUNK); cy <= Math.floor(maxY / CHUNK); cy++) {
      for (let cx = Math.floor(minX / CHUNK); cx <= Math.floor(maxX / CHUNK); cx++) {
        let chunk = this.terrainChunks.get(chunkKey(cx, cy, scale));
        if (!chunk) {
          // Po změně zoomu se bloky v novém rozlišení dokreslují postupně;
          // do té doby poslouží blok v jiném rozlišení.
          const fallback = this.anyTerrainChunk(cx, cy, scale);
          chunk = fallback && performance.now() > deadline ? fallback : this.buildTerrainChunk(cx, cy, scale);
        }
        chunk.used = this.terrainFrame;
        visible.push(chunk);
        if (chunk.empty) continue;
        ctx.drawImage(chunk.canvas, cx * CHUNK - PAD, cy * CHUNK - PAD, CHUNK + PAD * 2, CHUNK + PAD * 2);
      }
    }
    this.drawWaterSurface(ctx, visible);
    this.evictTerrainChunks();
  }

  anyTerrainChunk(cx, cy, wanted) {
    for (const scale of [1, 2, 0.5]) {
      if (scale === wanted) continue;
      const chunk = this.terrainChunks.get(chunkKey(cx, cy, scale));
      if (chunk) return chunk;
    }
    return null;
  }

  buildTerrainChunk(cx, cy, scale) {
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const rows = visibleTileRows(x0 - PAD, y0 - PAD, x0 + CHUNK + PAD, y0 + CHUNK + PAD, this.map.size, 1);
    const chunk = { key: chunkKey(cx, cy, scale), canvas: null, pixels: 0, water: [], empty: !rows.length, used: 0 };
    if (!chunk.empty) {
      const px = Math.ceil((CHUNK + PAD * 2) * scale);
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const g = canvas.getContext('2d');
      g.setTransform(scale, 0, 0, scale, (PAD - x0) * scale, (PAD - y0) * scale);
      const core = { x0, y0, x1: x0 + CHUNK, y1: y0 + CHUNK };
      chunk.water = paintTerrainChunk(g, this.map, rows, core, this.quality !== 'low', scale);
      chunk.canvas = canvas;
      chunk.pixels = px * px;
      this.terrainPixels += chunk.pixels;
    }
    this.terrainChunks.set(chunk.key, chunk);
    return chunk;
  }

  /** Uvolní nejdéle nepoužité bloky, nikdy však bloky z aktuálního snímku. */
  evictTerrainChunks() {
    if (this.terrainPixels <= PIXEL_BUDGET) return;
    const old = [...this.terrainChunks.values()]
      .filter(chunk => chunk.used !== this.terrainFrame)
      .sort((p, q) => p.used - q.used);
    for (const chunk of old) {
      if (this.terrainPixels <= PIXEL_BUDGET) break;
      this.terrainChunks.delete(chunk.key);
      this.terrainPixels -= chunk.pixels;
    }
  }

  /** Animované odlesky a vlnky na hladině; jen pro vodu ve viditelných blocích. */
  drawWaterSurface(ctx, chunks) {
    if (this.quality === 'low' || this.zoom < 0.6) return;
    const t = this.time;
    const glints = new Path2D();
    const waves = new Path2D();
    for (const chunk of chunks) {
      const water = chunk.water;
      for (let i = 0; i < water.length; i += 4) {
        const cx = water[i];
        const cy = water[i + 1];
        const h = water[i + 2];
        if (h < 0.22) {
          const drift = Math.sin(t * 0.9 + h * 40) * 4;
          glints.moveTo(cx - 8 + drift, cy);
          glints.quadraticCurveTo(cx - 2 + drift, cy - 3, cx + 6 + drift, cy);
        }
        if (water[i + 3] && h > 0.55 && h < 0.85) {
          const off = Math.sin(t * 2 + cx * 0.2) * 3;
          waves.moveTo(cx - 12, cy + off);
          waves.quadraticCurveTo(cx, cy - 2 + off, cx + 12, cy + off);
        }
      }
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(210, 245, 255, ${0.16 + Math.sin(t * 1.8) * 0.07})`;
    ctx.stroke(glints);
    ctx.strokeStyle = `rgba(220, 250, 255, ${0.11 + Math.sin(t * 1.4) * 0.04})`;
    ctx.stroke(waves);
  }
}

function chunkKey(cx, cy, scale) {
  return `${scale}:${cx}:${cy}`;
}

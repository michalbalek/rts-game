import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_HEIGHT } from './isometric.js';
import { TILE_TYPES } from '../sim/constants.js';

const TILE_COLORS = {
  [TILE_TYPES.SAND]: '#d8b171',
  [TILE_TYPES.DUNE]: '#cba05f',
  [TILE_TYPES.CLAY]: '#b88c53',
  [TILE_TYPES.GRASS]: '#4f7d38',
  [TILE_TYPES.WATER_DEEP]: '#1d6276',
  [TILE_TYPES.WATER_SHALLOW]: '#3d929e',
  [TILE_TYPES.ROCK]: '#a1815a'
};

export const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export class RendererTerrain {
  drawTerrain(ctx, rows) {
    const map = this.map;
    const paths = new Map();
    const water = [];
    // Při oddálení nejsou jemné textury vidět – jejich kreslení jen zdržuje.
    const detail = this.quality !== 'low' && this.zoom >= 0.8;

    const sandDots = new Path2D();
    const duneLines = new Path2D();
    const clayCracks = new Path2D();
    const grassTufts = new Path2D();
    const rockStrata = new Path2D();
    const glints = new Path2D();

    for (const row of rows) {
      const y = row.y;
      for (let x = row.x0; x <= row.x1; x++) {
        const i = y * map.size + x;
        const type = map.tiles[i];
        let p = paths.get(type);
        if (!p) { p = new Path2D(); paths.set(type, p); }
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        p.moveTo(sx, sy);
        p.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        p.lineTo(sx, sy + TILE_HEIGHT);
        p.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        p.closePath();

        if (!detail) continue;
        const cx = sx;
        const cy = sy + HALF_TILE_HEIGHT;
        const h = hash(x, y);

        switch (type) {
          case TILE_TYPES.SAND:
            if (h < 0.12) {
              sandDots.moveTo(cx + (h - 0.5) * 30, cy + (hash(y, x) - 0.5) * 12);
              sandDots.arc(cx + (h - 0.5) * 30, cy + (hash(y, x) - 0.5) * 12, 1.1, 0, Math.PI * 2);
            }
            break;
          case TILE_TYPES.DUNE:
            if (h < 0.36) {
              duneLines.moveTo(cx - 20, cy + 3);
              duneLines.quadraticCurveTo(cx, cy - 5, cx + 20, cy + 3);
            }
            break;
          case TILE_TYPES.CLAY:
            if (h < 0.28) {
              const ox = (h - 0.5) * 20;
              clayCracks.moveTo(cx - 12 + ox, cy - 2);
              clayCracks.lineTo(cx - 2 + ox, cy + 3);
              clayCracks.lineTo(cx + 8 + ox, cy - 4);
              clayCracks.lineTo(cx + 14 + ox, cy + 2);
            }
            break;
          case TILE_TYPES.GRASS:
            if (h < 0.42) {
              const ox = (h - 0.5) * 34;
              const oy = (hash(y, x) - 0.5) * 12;
              grassTufts.moveTo(cx + ox, cy + oy + 3);
              grassTufts.lineTo(cx + ox - 2, cy + oy - 4);
              grassTufts.moveTo(cx + ox + 2, cy + oy + 3);
              grassTufts.lineTo(cx + ox + 4, cy + oy - 5);
              grassTufts.moveTo(cx + ox, cy + oy + 3);
              grassTufts.lineTo(cx + ox, cy + oy - 6);
            }
            break;
          case TILE_TYPES.ROCK:
            if (h < 0.5) {
              rockStrata.moveTo(cx - 19, cy - 3 + h * 8);
              rockStrata.quadraticCurveTo(cx, cy + 2 + h * 8, cx + 19, cy - 3 + h * 8);
            }
            break;
          case TILE_TYPES.WATER_DEEP:
          case TILE_TYPES.WATER_SHALLOW:
            if (h < 0.18) {
              glints.moveTo(cx - 8, cy);
              glints.quadraticCurveTo(cx - 2, cy - 3, cx + 6, cy);
            }
            if (type === TILE_TYPES.WATER_SHALLOW) water.push({ cx, cy, h });
            break;
        }
      }
    }

    for (const [type, path] of paths) {
      ctx.fillStyle = TILE_COLORS[type] || '#c9a05f';
      ctx.fill(path);
    }

    if (detail) {
      ctx.fillStyle = 'rgba(120, 83, 37, 0.22)';
      ctx.fill(sandDots);
      ctx.strokeStyle = 'rgba(150, 105, 52, 0.23)';
      ctx.lineWidth = 1.2;
      ctx.stroke(duneLines);
      ctx.strokeStyle = 'rgba(92, 61, 28, 0.23)';
      ctx.stroke(clayCracks);
      ctx.strokeStyle = 'rgba(43, 88, 31, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke(grassTufts);
      ctx.strokeStyle = 'rgba(96, 72, 44, 0.32)';
      ctx.stroke(rockStrata);

      ctx.strokeStyle = `rgba(210, 245, 255, ${0.14 + Math.sin(this.time * 1.8) * 0.07})`;
      ctx.lineWidth = 1.2;
      ctx.stroke(glints);

      // Vlnky na hladině – jen část dlaždic.
      ctx.strokeStyle = `rgba(220, 250, 255, ${0.1 + Math.sin(this.time * 1.4) * 0.04})`;
      const waves = new Path2D();
      for (const w of water) {
        if (w.h > 0.3) continue;
        const off = Math.sin(this.time * 2 + w.cx * 0.2) * 3;
        waves.moveTo(w.cx - 12, w.cy + off);
        waves.quadraticCurveTo(w.cx, w.cy - 2 + off, w.cx + 12, w.cy + off);
      }
      ctx.stroke(waves);
    }
  }
}

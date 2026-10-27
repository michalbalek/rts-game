import { HALF_TILE_WIDTH as HW, HALF_TILE_HEIGHT as HH, TILE_HEIGHT as TH } from './isometric.js';
import { TILE_TYPES } from '../sim/constants.js';
import { hash, sample, sampleTerrain, grainPattern, isWater } from './terrain-textures.js';

/**
 * Jednorázové vykreslení bloku terénu do mezipaměti. Kontext je už posunutý
 * do světových souřadnic bloku. Vrací vodní dlaždice, jejichž střed leží
 * v bloku – ty se animují v každém snímku.
 */

// Texelů na dlaždici v podkladové textuře podle rozlišení bloku. Více znamená
// ostřejší hranice terénu, ale pomalejší tvorbu bloku.
const texelsFor = scale => scale >= 2 ? 10 : scale >= 1 ? 7 : 5;
const MARGIN = 16;

export function paintTerrainChunk(ctx, map, rows, core, detailed, scale = 1) {
  paintGround(ctx, map, rows, core, texelsFor(scale));

  const size = map.size;
  const tiles = map.tiles;
  const grain = new Path2D();
  const water = [];
  for (const row of rows) {
    const y = row.y;
    for (let x = row.x0; x <= row.x1; x++) {
      const type = tiles[y * size + x];
      const cx = (x - y) * HW;
      const cy = (x + y) * HH + HH;
      if (isWater(type)) {
        if (cx >= core.x0 && cx < core.x1 && cy >= core.y0 && cy < core.y1) {
          water.push(cx, cy, hash(x, y), type === TILE_TYPES.WATER_SHALLOW ? 1 : 0);
        }
        // Zrno sahá i do mělčiny u břehu jako usazený písek; volná voda zůstává čistá.
        if (!touchesLand(map, x, y)) continue;
      }
      grain.addPath(diamond(x, y));
    }
  }
  const pattern = grainPattern(ctx);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fill(grain);
  }
  if (detailed) paintDetails(ctx, map, rows);
  return water;
}

/** Podklad: textura s několika texely na dlaždici promítnutá do izometrie. */
function paintGround(ctx, map, rows, core, texels) {
  let minX = Infinity;
  let maxX = -Infinity;
  const minY = rows[0].y;
  const maxY = rows[rows.length - 1].y;
  for (const row of rows) {
    if (row.x0 < minX) minX = row.x0;
    if (row.x1 > maxX) maxX = row.x1;
  }
  const w = (maxX - minX + 1) * texels;
  const h = (maxY - minY + 1) * texels;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const data = img.data;
  const left = core.x0 - MARGIN;
  const right = core.x1 + MARGIN;
  const top = core.y0 - MARGIN;
  const bottom = core.y1 + MARGIN;
  for (let ty = 0; ty < h; ty++) {
    const v = minY + (ty + 0.5) / texels;
    for (let tx = 0; tx < w; tx++) {
      const u = minX + (tx + 0.5) / texels;
      const wx = (u - v) * HW;
      const wy = (u + v) * HH;
      if (wx < left || wx > right || wy < top || wy > bottom) continue;
      sampleTerrain(map, u, v);
      const o = (ty * w + tx) * 4;
      data[o] = sample.r;
      data[o + 1] = sample.g;
      data[o + 2] = sample.b;
      data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  ctx.save();
  // Mapa tile→svět: x = (u − v)·HW, y = (u + v)·HH; texel má velikost 1/texels dlaždice.
  const k = 1 / texels;
  ctx.transform(HW * k, HH * k, -HW * k, HH * k, (minX - minY) * HW, (minX + minY) * HH);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

function touchesLand(map, x, y) {
  const size = map.size;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
    if (!isWater(map.tiles[ny * size + nx])) return true;
  }
  return false;
}

function diamond(x, y) {
  const sx = (x - y) * HW;
  const sy = (x + y) * HH;
  const p = new Path2D();
  p.moveTo(sx, sy);
  p.lineTo(sx + HW, sy + HH);
  p.lineTo(sx, sy + TH);
  p.lineTo(sx - HW, sy + HH);
  p.closePath();
  return p;
}

/** Je bod (posun od středu dlaždice ve světových px) na terénu daného typu? */
function onType(map, x, y, ox, oy, type) {
  const u = x + 0.5 + ox / (2 * HW) + oy / (2 * HH);
  const v = y + 0.5 - ox / (2 * HW) + oy / (2 * HH);
  return sampleTerrain(map, u, v, false).type === type;
}

/** Drobné detaily (zrnka, vlnky dun, praskliny, trsy trávy, vrstvy skal). */
function paintDetails(ctx, map, rows) {
  const size = map.size;
  const sandDots = new Path2D();
  const pebbles = new Path2D();
  const ripples = new Path2D();
  const cracks = new Path2D();
  const tuftsDark = new Path2D();
  const tuftsLight = new Path2D();
  const strata = new Path2D();

  for (const row of rows) {
    const y = row.y;
    for (let x = row.x0; x <= row.x1; x++) {
      const type = map.tiles[y * size + x];
      const cx = (x - y) * HW;
      const cy = (x + y) * HH + HH;
      const h = hash(x, y);
      const h2 = hash(y + 11, x + 3);
      switch (type) {
        case TILE_TYPES.SAND:
          for (let i = 0; i < 3; i++) {
            if (hash(x * 7 + i, y * 13 - i) > 0.5) continue;
            const ox = (hash(x + i, y - i) - 0.5) * 32;
            const oy = (hash(y + i * 5, x) - 0.5) * 14;
            if (!onType(map, x, y, ox, oy, type)) continue;
            sandDots.moveTo(cx + ox + 0.9, cy + oy);
            sandDots.arc(cx + ox, cy + oy, 0.9, 0, Math.PI * 2);
          }
          if (h < 0.08 && onType(map, x, y, 6, 2, type)) {
            pebbles.moveTo(cx + 6 + 2.2, cy + 2);
            pebbles.ellipse(cx + 6, cy + 2, 2.2, 1.3, 0, 0, Math.PI * 2);
          }
          break;
        case TILE_TYPES.DUNE:
          if (!onType(map, x, y, 0, 0, type)) break;
          for (let i = 0; i < 2; i++) {
            if (i === 1 && h > 0.6) continue;
            const oy = (i - 0.5) * 8 + (h - 0.5) * 3;
            ripples.moveTo(cx - 16, cy + oy + 2);
            ripples.quadraticCurveTo(cx - 4, cy + oy - 4, cx + 16, cy + oy + 1);
          }
          break;
        case TILE_TYPES.CLAY:
          if (h < 0.45 && onType(map, x, y, 0, 0, type)) {
            const ox = (h - 0.25) * 24;
            cracks.moveTo(cx - 11 + ox, cy - 2);
            cracks.lineTo(cx - 3 + ox, cy + 2);
            cracks.lineTo(cx + 5 + ox, cy - 3);
            cracks.moveTo(cx - 3 + ox, cy + 2);
            cracks.lineTo(cx - 1 + ox, cy + 6);
          }
          break;
        case TILE_TYPES.GRASS:
          for (let i = 0; i < 4; i++) {
            const k = hash(x * 5 + i * 17, y * 3 + i);
            if (k > 0.7) continue;
            const ox = (hash(x - i * 3, y + i) - 0.5) * 34;
            const oy = (hash(y + i * 7, x - i) - 0.5) * 13;
            if (!onType(map, x, y, ox, oy, type)) continue;
            const path = k < 0.35 ? tuftsDark : tuftsLight;
            const bx = cx + ox;
            const by = cy + oy + 3;
            path.moveTo(bx, by); path.lineTo(bx - 2.2, by - 5);
            path.moveTo(bx + 1, by); path.lineTo(bx + 1.5, by - 6.5);
            path.moveTo(bx + 2, by); path.lineTo(bx + 4.2, by - 4.5);
          }
          break;
        case TILE_TYPES.ROCK:
          if (!onType(map, x, y, 0, 0, type)) break;
          strata.moveTo(cx - 17, cy - 3 + h * 6);
          strata.quadraticCurveTo(cx, cy + 2 + h * 6, cx + 17, cy - 3 + h * 6);
          if (h2 < 0.5) {
            strata.moveTo(cx - 10, cy + 5 + h2 * 3);
            strata.lineTo(cx + 8, cy + 3 + h2 * 3);
          }
          if (h2 > 0.6) {
            pebbles.moveTo(cx - 6 + 2.6, cy - 1);
            pebbles.ellipse(cx - 6, cy - 1, 2.6, 1.5, 0, 0, Math.PI * 2);
          }
          break;
        default:
          break;
      }
    }
  }

  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(112, 76, 34, 0.32)';
  ctx.fill(sandDots);
  ctx.fillStyle = 'rgba(120, 96, 70, 0.55)';
  ctx.fill(pebbles);
  ctx.strokeStyle = 'rgba(255, 232, 186, 0.24)';
  ctx.lineWidth = 1.1;
  ctx.stroke(ripples);
  ctx.translate(0, 1.2);
  ctx.strokeStyle = 'rgba(132, 88, 40, 0.2)';
  ctx.stroke(ripples);
  ctx.translate(0, -1.2);
  ctx.strokeStyle = 'rgba(86, 54, 24, 0.34)';
  ctx.lineWidth = 0.9;
  ctx.stroke(cracks);
  ctx.strokeStyle = 'rgba(34, 72, 26, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke(tuftsDark);
  ctx.strokeStyle = 'rgba(160, 196, 92, 0.5)';
  ctx.stroke(tuftsLight);
  ctx.strokeStyle = 'rgba(88, 66, 40, 0.38)';
  ctx.lineWidth = 1.1;
  ctx.stroke(strata);
}

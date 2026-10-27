import { TILE_TYPES } from '../sim/constants.js';

/**
 * Procedurální vzhled terénu: paleta, plynulý šum a vzorkování typu terénu
 * v libovolném bodě mapy. Hranice typů se počítají z vah čtyř nejbližších
 * dlaždic a šumu, takže pobřeží i okraje trávy jsou organické, ne zubaté.
 * Modul nepoužívá DOM při importu, takže jde načíst i v Node testech.
 */

export const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Plynulý šum (bilineárně interpolovaná mřížka náhodných hodnot), 0..1. */
export function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Dvě oktávy šumu pro velké skvrny a jemnější přechody. */
export function terrainNoise(x, y) {
  return valueNoise(x / 9, y / 9) * 0.65 + valueNoise(x / 3.5 + 31, y / 3.5 + 17) * 0.35;
}

/** Základní barva, priorita (vyšší typ se při šumu rozlévá dál) a síla variace odstínu. */
export const TERRAIN_STYLE = {
  [TILE_TYPES.WATER_DEEP]: { rgb: [28, 88, 112], priority: 0, vary: 0.08 },
  [TILE_TYPES.WATER_SHALLOW]: { rgb: [56, 140, 150], priority: 1, vary: 0.06 },
  [TILE_TYPES.SAND]: { rgb: [216, 178, 114], priority: 2, vary: 0.07 },
  [TILE_TYPES.DUNE]: { rgb: [206, 162, 96], priority: 3, vary: 0.08 },
  [TILE_TYPES.CLAY]: { rgb: [184, 138, 84], priority: 4, vary: 0.08 },
  [TILE_TYPES.ROCK]: { rgb: [158, 128, 92], priority: 5, vary: 0.1 },
  [TILE_TYPES.GRASS]: { rgb: [84, 126, 56], priority: 6, vary: 0.12 }
};

const FALLBACK_STYLE = TERRAIN_STYLE[TILE_TYPES.SAND];
const FOAM = [236, 246, 238];

export function styleOf(type) {
  return TERRAIN_STYLE[type] || FALLBACK_STYLE;
}

export function isWater(type) {
  return type === TILE_TYPES.WATER_DEEP || type === TILE_TYPES.WATER_SHALLOW;
}

// Výsledek posledního vzorkování; sdílený, aby se v horké smyčce nealokovaly objekty.
export const sample = { type: 0, second: 0, margin: 1, r: 0, g: 0, b: 0 };
const types = [0, 0, 0, 0];
const weights = [0, 0, 0, 0];

/**
 * Určí typ terénu a barvu v bodě (u, v) dlaždicových souřadnic.
 * Dlaždice (x, y) pokrývá čtverec [x, x+1) × [y, y+1).
 */
export function sampleTerrain(map, u, v, withColor = true) {
  const size = map.size;
  const gx = u - 0.5;
  const gy = v - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const cx0 = x0 < 0 ? 0 : x0 >= size ? size - 1 : x0;
  const cy0 = y0 < 0 ? 0 : y0 >= size ? size - 1 : y0;
  const cx1 = x0 + 1 >= size ? size - 1 : x0 + 1 < 0 ? 0 : x0 + 1;
  const cy1 = y0 + 1 >= size ? size - 1 : y0 + 1 < 0 ? 0 : y0 + 1;
  const tiles = map.tiles;
  const t00 = tiles[cy0 * size + cx0];
  const t10 = tiles[cy0 * size + cx1];
  const t01 = tiles[cy1 * size + cx0];
  const t11 = tiles[cy1 * size + cx1];

  if (t00 === t10 && t00 === t01 && t00 === t11) {
    sample.type = t00;
    sample.second = t00;
    sample.margin = 1;
  } else {
    let count = 0;
    const add = (type, w) => {
      for (let i = 0; i < count; i++) {
        if (types[i] === type) { weights[i] += w; return; }
      }
      types[count] = type;
      weights[count] = w;
      count++;
    };
    add(t00, (1 - fx) * (1 - fy));
    add(t10, fx * (1 - fy));
    add(t01, (1 - fx) * fy);
    add(t11, fx * fy);
    let pMin = Infinity;
    let pMax = -Infinity;
    for (let i = 0; i < count; i++) {
      const p = styleOf(types[i]).priority;
      if (p < pMin) pMin = p;
      if (p > pMax) pMax = p;
    }
    // Šum posouvá hranici: výše postavený typ se střídavě rozlévá a ustupuje.
    const jitter = (valueNoise(u * 1.6 + 71, v * 1.6 - 29) - 0.5) * 0.62 +
      (valueNoise(u * 4.1 - 13, v * 4.1 + 5) - 0.5) * 0.22;
    const span = pMax - pMin || 1;
    let best = -1;
    let second = -1;
    for (let i = 0; i < count; i++) {
      weights[i] += jitter * (styleOf(types[i]).priority - pMin) / span;
      if (best === -1 || weights[i] > weights[best]) {
        second = best;
        best = i;
      } else if (second === -1 || weights[i] > weights[second]) {
        second = i;
      }
    }
    sample.type = types[best];
    sample.second = types[second];
    sample.margin = weights[best] - weights[second];
  }
  if (withColor) colorSample(u, v);
  return sample;
}

function colorSample(u, v) {
  const n = terrainNoise(u, v) - 0.5;
  const micro = hash(Math.floor(u * 6) + 977, Math.floor(v * 6) - 331) - 0.5;
  const a = styleOf(sample.type);
  const ka = 1 + n * a.vary * 2 + micro * a.vary * 0.5;
  let r = a.rgb[0] * ka;
  let g = a.rgb[1] * ka;
  let b = a.rgb[2] * ka;
  if (sample.margin < 0.16) {
    // Úzký měkký přechod přímo na hranici, aby okraj nebyl ostře pixelový.
    const s = styleOf(sample.second);
    const ks = 1 + n * s.vary * 2 + micro * s.vary * 0.5;
    const t = 0.5 + 0.5 * smooth(sample.margin / 0.16);
    r = s.rgb[0] * ks + (r - s.rgb[0] * ks) * t;
    g = s.rgb[1] * ks + (g - s.rgb[1] * ks) * t;
    b = s.rgb[2] * ks + (b - s.rgb[2] * ks) * t;
  }
  const wet = isWater(sample.type);
  const otherWet = isWater(sample.second);
  if (wet && !otherWet && sample.margin < 0.13) {
    const f = (1 - sample.margin / 0.13) * 0.6;
    r += (FOAM[0] - r) * f;
    g += (FOAM[1] - g) * f;
    b += (FOAM[2] - b) * f;
  } else if (!wet && otherWet && sample.margin < 0.24) {
    const f = 1 - 0.2 * (1 - sample.margin / 0.24);
    r *= f;
    g *= f;
    b *= f;
  }
  sample.r = r;
  sample.g = g;
  sample.b = b;
}

function smooth(t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

const PATTERN_SIZE = 128;
let grainCanvas = null;

/**
 * Neutrální zrno (tmavá a světlá zrnka) přes souš. Vzor leží ve světových
 * souřadnicích, takže navazuje přes hranice dlaždic i bloků mezipaměti.
 */
export function grainPattern(ctx) {
  if (typeof document === 'undefined') return null;
  if (!grainCanvas) grainCanvas = createGrainCanvas();
  return ctx.createPattern(grainCanvas, 'repeat');
}

function createGrainCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = PATTERN_SIZE;
  canvas.height = PATTERN_SIZE;
  const g = canvas.getContext('2d');
  const img = g.createImageData(PATTERN_SIZE, PATTERN_SIZE);
  const data = img.data;
  const cell = 8;
  const period = PATTERN_SIZE / cell;
  for (let y = 0; y < PATTERN_SIZE; y++) {
    for (let x = 0; x < PATTERN_SIZE; x++) {
      const n = hash(x + 1013, y + 7919);
      // Shluky zrn kopírují periodický šum, aby vzor navazoval i na hranách opakování.
      const cluster = periodicNoise(x / cell, y / cell, period);
      if (n >= 0.24 * (0.5 + cluster)) continue;
      const dark = n < 0.13 * (0.5 + cluster);
      const o = (y * PATTERN_SIZE + x) * 4;
      const c = dark ? 40 : 255;
      data[o] = c;
      data[o + 1] = dark ? 28 : 246;
      data[o + 2] = dark ? 12 : 214;
      data[o + 3] = Math.round(255 * (dark ? 0.2 : 0.14) * (0.5 + hash(y, x) * 0.5));
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

function periodicNoise(x, y, period) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (ix, iy) => hash((ix % period) + 97, (iy % period) - 53);
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

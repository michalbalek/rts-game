import { hash } from './terrain-textures.js';

/**
 * Předkreslené sprity stromů. Strom se kreslí jednou pro každou variantu
 * a rozlišení; ve hře se jen vykreslí a zkosí podle větru.
 */

export const TREE_VARIANTS = 4;
const BOX = { left: 30, right: 32, top: 54, bottom: 10 };
const cache = new Map();

export function treeVariant(tx, ty) {
  const h = hash(tx, ty);
  return {
    variant: Math.min(TREE_VARIANTS - 1, Math.floor(h * TREE_VARIANTS)),
    flip: hash(ty + 5, tx - 9) > 0.5
  };
}

export function treeSprite(style, variant, flip, resolution) {
  const key = `${style}:${variant}:${flip ? 1 : 0}:${resolution}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = createSprite(style, variant, flip, resolution);
    cache.set(key, sprite);
  }
  return sprite;
}

function createSprite(style, variant, flip, resolution) {
  const w = BOX.left + BOX.right;
  const h = BOX.top + BOX.bottom;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * resolution);
  canvas.height = Math.ceil(h * resolution);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(resolution, 0, 0, resolution, BOX.left * resolution, BOX.top * resolution);
  if (flip) ctx.scale(-1, 1);
  const scale = 0.86 + (variant + 0.5) / TREE_VARIANTS * 0.3;
  if (style === 'acacia') paintAcacia(ctx, scale, variant);
  else paintPalm(ctx, scale, variant, style === 'oasis');
  return { canvas, x: -BOX.left, y: -BOX.top, w, h };
}

function shadow(ctx, scale) {
  const g = ctx.createRadialGradient(4, 1, 0, 4, 1, 14 * scale);
  g.addColorStop(0, 'rgba(40, 26, 10, 0.34)');
  g.addColorStop(1, 'rgba(40, 26, 10, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(4, 1, 14 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintPalm(ctx, scale, variant, lush) {
  shadow(ctx, scale);
  const lean = (variant - 1.5) * 1.2;
  const topX = 1 * scale + lean;
  const topY = -32 * scale;

  // Kmen s prstenci.
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6e3f1b';
  ctx.lineWidth = 3.8 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(3 * scale, -18 * scale, topX, topY);
  ctx.stroke();
  ctx.strokeStyle = '#9a6332';
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  ctx.moveTo(-0.6 * scale, -1);
  ctx.quadraticCurveTo(2.2 * scale, -18 * scale, topX - 0.8, topY + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60, 32, 12, 0.55)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const px = 2 * (1 - t) * t * 3 * scale + t * t * topX;
    const py = 2 * (1 - t) * t * -18 * scale + t * t * topY;
    ctx.beginPath();
    ctx.moveTo(px - 1.8 * scale, py + 0.6);
    ctx.lineTo(px + 1.8 * scale, py - 0.2);
    ctx.stroke();
  }

  // Listy: tmavší spodní vrstva, světlejší horní a kokosy uprostřed.
  const dark = lush ? '#24661f' : '#2e5e22';
  const light = lush ? '#3f9a32' : '#4c8a35';
  const fronds = 7 + (variant % 2);
  for (const [color, width, lift] of [[dark, 2.8, 2], [light, 1.9, 0]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 - Math.PI / 2 + variant * 0.3;
      const lx = Math.cos(a) * 16 * scale;
      const ly = Math.sin(a) * 9 * scale;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + lx * 0.6, topY + ly - 4 + lift, topX + lx, topY + ly + 3 + lift);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#5d2f10';
  for (const [ox, oy] of [[1.5, 2], [-1.2, 2.6], [0.4, 3.6]]) {
    ctx.beginPath();
    ctx.arc(topX + ox * scale, topY + oy * scale, 1.7 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintAcacia(ctx, scale, variant) {
  shadow(ctx, scale);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5f3b1c';
  ctx.lineWidth = 2.8 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -16 * scale);
  ctx.lineTo(-5 * scale, -24 * scale);
  ctx.moveTo(0, -16 * scale);
  ctx.lineTo(6 * scale, -23 * scale);
  ctx.stroke();

  const layers = [
    ['#46602a', 0, -26, 17, 8],
    ['#55702f', -2, -28.5, 14, 6.5],
    ['#6a8a3a', -6, -30.5, 8, 4],
    ['#7c9a45', 5 - variant, -30, 5, 2.6]
  ];
  for (const [color, x, y, rx, ry] of layers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x * scale, y * scale, rx * scale, ry * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(30, 44, 16, 0.35)';
  ctx.beginPath();
  ctx.ellipse(1 * scale, -23.5 * scale, 15 * scale, 3.2 * scale, 0, 0, Math.PI);
  ctx.fill();
}

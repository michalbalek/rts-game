import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT } from './isometric.js';
import { RESOURCE_TYPES } from '../sim/constants.js';
import { hash } from './renderer-terrain.js';
import { treeSprite, treeVariant } from './tree-sprites.js';

export class RendererResources {
  drawResources(ctx, rows) {
    const map = this.map;
    // Při oddálení kreslíme ložiska jen drobnými značkami a stromy bez pohupování.
    const simple = this.zoom < 0.7;
    const sprites = typeof document !== 'undefined';
    const base = sprites ? ctx.getTransform() : null;
    const resolution = this.terrainScale ? this.terrainScale() : 1;
    const style = map.type === 'canyon' ? 'acacia' : map.type === 'oasis' ? 'oasis' : 'palm';
    let shifted = false;
    for (const row of rows) {
      const y = row.y;
      for (let x = row.x0; x <= row.x1; x++) {
        const i = y * map.size + x;
        const res = map.resources[i];
        if (!res) continue;
        if (!this.isExplored(x, y)) continue;
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        if (res === RESOURCE_TYPES.TREE && sprites) {
          this.drawTreeSprite(ctx, base, sx, sy, x, y, style, resolution, !simple && this.quality !== 'low');
          shifted = true;
          continue;
        }
        if (shifted) {
          ctx.setTransform(base);
          shifted = false;
        }
        if (simple) {
          this.drawResourceMarker(ctx, sx, sy, res, x, y);
        } else if (res === RESOURCE_TYPES.TREE) {
          this.drawTree(ctx, sx, sy, x, y);
        } else if (res === RESOURCE_TYPES.STONE) {
          this.drawOre(ctx, sx, sy, x, y, false);
        } else if (res === RESOURCE_TYPES.IRON) {
          this.drawOre(ctx, sx, sy, x, y, true);
        }
      }
    }
    if (shifted) ctx.setTransform(base);
  }

  /**
   * Strom ze spritu. Vítr strom zkosí kolem paty kmene, takže koruna se
   * pohupuje a kmen zůstává pevně na zemi.
   */
  drawTreeSprite(ctx, base, sx, sy, tx, ty, style, resolution, animate) {
    const { variant, flip } = treeVariant(tx, ty);
    const sprite = treeSprite(style, variant, flip, resolution);
    const by = sy + HALF_TILE_HEIGHT;
    const skew = animate ? -Math.sin(this.time * 1.7 + tx * 0.7 + ty * 0.3) * 0.05 : 0;
    const { a, b, c, d, e, f } = base;
    ctx.setTransform(a, b, a * skew + c, b * skew + d, a * sx + c * by + e, b * sx + d * by + f);
    ctx.drawImage(sprite.canvas, sprite.x, sprite.y, sprite.w, sprite.h);
  }

  drawResourceMarker(ctx, sx, sy, res, tx, ty) {
    const h = hash(tx, ty);
    const ox = (h - 0.5) * 8;
    const oy = (hash(ty, tx) - 0.5) * 4;
    const x = sx + ox;
    const y = sy + HALF_TILE_HEIGHT + oy;
    if (res === RESOURCE_TYPES.TREE) {
      ctx.fillStyle = this.map.type === 'canyon' ? '#4f6f2a' : '#3f7a2d';
      ctx.beginPath();
      ctx.arc(x, y - 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const iron = res === RESOURCE_TYPES.IRON;
      ctx.fillStyle = iron ? '#6b6b72' : '#b58a53';
      ctx.beginPath();
      ctx.moveTo(x - 3.4, y);
      ctx.lineTo(x, y - 5.2);
      ctx.lineTo(x + 3.4, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTree(ctx, sx, sy, tx, ty) {
    const h = hash(tx, ty);
    const scale = 0.85 + h * 0.32;
    const sway = Math.sin(this.time * 1.7 + tx * 0.7 + ty * 0.3) * 1.6;
    const baseY = sy + HALF_TILE_HEIGHT;
    const palm = this.map.type !== 'canyon';

    ctx.save();
    ctx.translate(sx, baseY);

    // Stín
    ctx.fillStyle = 'rgba(48, 32, 14, 0.28)';
    ctx.beginPath();
    ctx.ellipse(4, 1, 13 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (palm) {
      ctx.strokeStyle = '#7c4a20';
      ctx.lineWidth = 3.4 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(3 * scale, -18 * scale, 1 * scale + sway, -32 * scale);
      ctx.stroke();

      const crownX = 1 * scale + sway;
      const crownY = -32 * scale;
      ctx.strokeStyle = this.map.type === 'oasis' ? '#2f7a28' : '#39702a';
      ctx.lineWidth = 2.3 * scale;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const lx = Math.cos(a) * 16 * scale;
        const ly = Math.sin(a) * 9 * scale;
        ctx.beginPath();
        ctx.moveTo(crownX, crownY);
        ctx.quadraticCurveTo(crownX + lx * 0.6, crownY + ly - 4, crownX + lx, crownY + ly + 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#6b3612';
      ctx.beginPath();
      ctx.arc(crownX + 2, crownY + 2, 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Akácie – plošší koruna.
      ctx.strokeStyle = '#6d4521';
      ctx.lineWidth = 2.6 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sway * 0.5, -22 * scale);
      ctx.stroke();
      ctx.fillStyle = '#55702f';
      ctx.beginPath();
      ctx.ellipse(sway, -27 * scale, 16 * scale, 8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#648037';
      ctx.beginPath();
      ctx.ellipse(sway - 7 * scale, -30 * scale, 9 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawOre(ctx, sx, sy, tx, ty, iron) {
    const h = hash(ty, tx);
    const baseY = sy + HALF_TILE_HEIGHT;
    const scale = 0.85 + h * 0.35;
    const ox = (h - 0.5) * 12;
    const oy = (hash(tx + 3, ty + 7) - 0.5) * 5;

    ctx.save();
    ctx.translate(sx, baseY);
    ctx.fillStyle = 'rgba(40, 28, 12, 0.3)';
    ctx.beginPath();
    ctx.ellipse(ox + 2, oy, 11 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = iron ? '#5b5b60' : '#b58a53';
    ctx.beginPath();
    ctx.moveTo(ox - 9 * scale, oy);
    ctx.lineTo(ox - 5 * scale, oy - 11 * scale);
    ctx.lineTo(ox + 4 * scale, oy - 13 * scale);
    ctx.lineTo(ox + 10 * scale, oy - 4 * scale);
    ctx.lineTo(ox + 4 * scale, oy + 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = iron ? '#7c7c86' : '#d7ac70';
    ctx.beginPath();
    ctx.moveTo(ox - 5 * scale, oy - 11 * scale);
    ctx.lineTo(ox + 4 * scale, oy - 13 * scale);
    ctx.lineTo(ox + 1 * scale, oy - 6 * scale);
    ctx.lineTo(ox - 5 * scale, oy - 5 * scale);
    ctx.closePath();
    ctx.fill();

    if (iron) {
      ctx.fillStyle = `rgba(196, 120, 60, ${0.5 + Math.sin(this.time * 2 + tx) * 0.2})`;
      ctx.beginPath();
      ctx.arc(ox + 1 * scale, oy - 8 * scale, 2.2, 0, Math.PI * 2);
      ctx.arc(ox - 4 * scale, oy - 4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(120, 80, 40, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox - 7, oy - 3);
      ctx.lineTo(ox + 6, oy - 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_HEIGHT, tileToScreen } from './isometric.js';
import { BUILDING_DEFS } from '../sim/constants.js';

export class RendererInteraction {
  drawBuildGhost(ctx, ui) {
    if (!ui.buildMode || !ui.hoverTile) return;
    const def = BUILDING_DEFS[ui.buildMode];
    if (!def) return;
    const hover = ui.hoverTile;
    const check = this.session.canPlace(ui.buildMode, hover.x, hover.y);
    const valid = check.valid;

    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        const x = hover.x + dx;
        const y = hover.y + dy;
        if (x < 0 || y < 0 || x >= this.map.size || y >= this.map.size) continue;
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        ctx.fillStyle = valid ? 'rgba(74, 222, 128, 0.26)' : 'rgba(239, 68, 68, 0.3)';
        ctx.strokeStyle = valid ? 'rgba(74, 222, 128, 0.65)' : 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        ctx.lineTo(sx, sy + TILE_HEIGHT);
        ctx.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    const pos = tileToScreen(hover.x, hover.y);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    this.isoBox(ctx, 0, 0, def.w, def.h, 0, 20,
      valid
        ? { top: 'rgba(160, 246, 190, 0.38)', left: 'rgba(60, 150, 90, 0.3)', right: 'rgba(100, 200, 130, 0.3)' }
        : { top: 'rgba(254, 160, 160, 0.35)', left: 'rgba(150, 50, 50, 0.3)', right: 'rgba(200, 90, 90, 0.3)' },
      valid ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.85)');
    const center = this.isoPoint(def.w / 2, def.h / 2, 22);
    ctx.font = '18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(def.icon, center.x, center.y);
    ctx.restore();
  }

  drawHover(ctx, ui) {
    if (ui.buildMode || !ui.hoverTile) return;
    const t = ui.hoverTile;
    if (t.x < 0 || t.y < 0 || t.x >= this.map.size || t.y >= this.map.size) return;
    const sx = (t.x - t.y) * HALF_TILE_WIDTH;
    const sy = (t.x + t.y) * HALF_TILE_HEIGHT;
    ctx.strokeStyle = 'rgba(255, 235, 170, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
    ctx.lineTo(sx, sy + TILE_HEIGHT);
    ctx.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
    ctx.closePath();
    ctx.stroke();
  }

  drawSelectionRect(ctx, rect) {
    if (!rect) return;
    const x = Math.min(rect.x1, rect.x2);
    const y = Math.min(rect.y1, rect.y2);
    const w = Math.abs(rect.x2 - rect.x1);
    const h = Math.abs(rect.y2 - rect.y1);
    if (w < 3 && h < 3) return;
    ctx.fillStyle = 'rgba(253, 224, 71, 0.09)';
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

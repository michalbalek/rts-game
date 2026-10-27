import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_HEIGHT, tileToScreen } from './isometric.js';
import { BUILDING_DEFS } from '../sim/constants.js';
import { wallLine } from '../sim/wall-line.js';
import { rotatedBuildingSize } from '../sim/building-orientation.js';

export class RendererInteraction {
  drawBuildGhost(ctx, ui) {
    if (!ui.buildMode || !ui.hoverTile) return;
    if (ui.buildMode === 'wall' && ui.wallDrag) {
      const { start, end } = ui.wallDrag;
      const tiles = wallLine(start.x, start.y, end.x, end.y) || [start, end];
      const valid = this.session.canPlaceWall(start.x, start.y, end.x, end.y).valid;
      for (const tile of tiles) {
        const pos = tileToScreen(tile.x, tile.y);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        this.drawFootprint(ctx, 1, 1, valid ? 'rgba(74, 222, 128, 0.26)' : 'rgba(239, 68, 68, 0.3)',
          valid ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.85)', 1.5);
        ctx.restore();
      }
      return;
    }
    const def = BUILDING_DEFS[ui.buildMode];
    if (!def) return;
    const rotation = ui.buildRotation || 0;
    const { width, height } = rotatedBuildingSize(def, rotation);
    const hover = ui.hoverTile;
    const check = this.session.canPlace(ui.buildMode, hover.x, hover.y, rotation);
    const valid = check.valid;

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
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
    ctx.globalAlpha = valid ? 0.65 : 0.38;
    this.drawBuildingStructure(ctx, {
      id: 0, type: ui.buildMode, tileX: hover.x, tileY: hover.y,
      width, height, rotation, complete: true, gateOpen: false, workers: 0
    }, def);
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

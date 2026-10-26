import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_HEIGHT } from './isometric.js';

export class RendererFog {
  drawFog(ctx, rows) {
    if (!this.session || !this.session.state.fogEnabled) return;

    // Při oddálení je dlaždicová mlha drahá. Místo tisíce kosočtverců
    // promítneme malou masku (1 texel = 1 dlaždice) jediným drawImage.
    if (this.zoom < 0.85) {
      if (this.fogMaskTimer <= 0) {
        this.renderFogMask();
        this.fogMaskTimer = 0.25;
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.transform(HALF_TILE_WIDTH, HALF_TILE_HEIGHT, -HALF_TILE_WIDTH, HALF_TILE_HEIGHT, 0, 0);
      ctx.drawImage(this.fogMask, 0, 0);
      ctx.restore();
      return;
    }

    const unknown = new Path2D();
    const explored = new Path2D();
    let hasUnknown = false;
    let hasExplored = false;
    for (const row of rows) {
      const y = row.y;
      for (let x = row.x0; x <= row.x1; x++) {
        const exploredTile = this.isExplored(x, y);
        if (exploredTile && this.isVisible(x, y)) continue;
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        const path = exploredTile ? explored : unknown;
        if (exploredTile) hasExplored = true; else hasUnknown = true;
        path.moveTo(sx, sy);
        path.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        path.lineTo(sx, sy + TILE_HEIGHT);
        path.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        path.closePath();
      }
    }
    if (hasExplored) {
      ctx.fillStyle = 'rgba(22, 18, 14, 0.52)';
      ctx.fill(explored);
    }
    if (hasUnknown) {
      ctx.fillStyle = 'rgba(7, 5, 3, 0.94)';
      ctx.fill(unknown);
    }
  }

  renderFogMask() {
    const size = this.map.size;
    if (this.fogMask.width !== size) {
      this.fogMask.width = size;
      this.fogMask.height = size;
    }
    const img = this.fogMaskCtx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const explored = this.isExplored(x, y);
        if (explored && this.isVisible(x, y)) continue;
        const o = (y * size + x) * 4;
        if (explored) {
          data[o] = 22; data[o + 1] = 18; data[o + 2] = 14; data[o + 3] = 133;
        } else {
          data[o] = 7; data[o + 1] = 5; data[o + 2] = 3; data[o + 3] = 240;
        }
      }
    }
    this.fogMaskCtx.putImageData(img, 0, 0);
  }
}

import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT } from './isometric.js';

const FOG_REFRESH = 0.12;
const EXPLORED = [22, 18, 14, 133];
const UNKNOWN = [7, 5, 3, 240];

/**
 * Mlha války jako malá maska (1 texel = 1 dlaždice) promítnutá jediným
 * drawImage do izometrie. Bilineární vyhlazení dává měkký okraj dohledu;
 * při nízké kvalitě zůstávají okraje ostré po dlaždicích.
 */
export class RendererFog {
  drawFog(ctx) {
    if (!this.session || !this.session.state.fogEnabled) return;
    if (this.fogMaskTimer <= 0) {
      this.renderFogMask();
      this.fogMaskTimer = FOG_REFRESH;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = this.quality !== 'low';
    ctx.transform(HALF_TILE_WIDTH, HALF_TILE_HEIGHT, -HALF_TILE_WIDTH, HALF_TILE_HEIGHT, 0, 0);
    ctx.drawImage(this.fogMask, 0, 0);
    ctx.restore();
  }

  renderFogMask() {
    const size = this.map.size;
    if (this.fogMask.width !== size) {
      this.fogMask.width = size;
      this.fogMask.height = size;
    }
    if (!this.fogImage || this.fogImage.width !== size) {
      this.fogImage = this.fogMaskCtx.createImageData(size, size);
    }
    const data = this.fogImage.data;
    const fog = this.session.getFog ? this.session.getFog() : null;
    const total = size * size;
    for (let i = 0; i < total; i++) {
      const explored = fog ? fog.explored[i] === 1 : this.isExplored(i % size, Math.floor(i / size));
      const visible = fog ? fog.visible[i] === 1 : this.isVisible(i % size, Math.floor(i / size));
      const color = !explored ? UNKNOWN : visible ? null : EXPLORED;
      const o = i * 4;
      if (!color) {
        data[o + 3] = 0;
        continue;
      }
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = color[3];
    }
    this.fogMaskCtx.putImageData(this.fogImage, 0, 0);
  }
}

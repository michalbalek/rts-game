import { tileToScreen, clamp } from './isometric.js';

/**
 * Nejméně smysluplné oddálení. Při menším zoomu se na obrazovku vejde
 * obrovské množství dlaždic a kreslení se začne zadrhávat, aniž by hráč
 * získal užitečný přehled. 0.55 nabízí dobrý nadhled a zůstává plynulé.
 */
export const MIN_ZOOM = 0.55;
export const MAX_ZOOM = 2.4;

/**
 * Kamera pracuje v CSS pixelech (nezávisle na devicePixelRatio).
 * Světové souřadnice jsou izometrické pixely (tileToScreen).
 */
export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.minZoom = MIN_ZOOM;
    this.maxZoom = MAX_ZOOM;
  }

  get viewWidth() {
    return this.canvas.clientWidth || this.canvas.width || window.innerWidth;
  }

  get viewHeight() {
    return this.canvas.clientHeight || this.canvas.height || window.innerHeight;
  }

  centerOnTile(tileX, tileY) {
    const p = tileToScreen(tileX, tileY);
    this.x = p.x;
    this.y = p.y;
  }

  pan(dx, dy) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /** Posun ve světových pixelech nezávislý na zoomu. */
  panWorld(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  zoomAt(delta, mouseX, mouseY) {
    const factor = delta < 0 ? 1.14 : 1 / 1.14;
    this.setZoomAt(this.zoom * factor, mouseX, mouseY);
  }

  setZoomAt(newZoom, mouseX, mouseY) {
    const zoom = clamp(newZoom, this.minZoom, this.maxZoom);
    if (zoom === this.zoom) return;
    const before = this.screenToWorld(mouseX, mouseY);
    this.zoom = zoom;
    const after = this.screenToWorld(mouseX, mouseY);
    this.x -= after.x - before.x;
    this.y -= after.y - before.y;
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.viewWidth / 2) / this.zoom + this.x,
      y: (screenY - this.viewHeight / 2) / this.zoom + this.y
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.zoom + this.viewWidth / 2,
      y: (worldY - this.y) * this.zoom + this.viewHeight / 2
    };
  }

  applyTransform(ctx) {
    ctx.translate(this.viewWidth / 2, this.viewHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** Omezí kameru na mapu (s rozumným okrajem). */
  clampToMap(mapSize) {
    const minWorldX = -(mapSize - 1) * 32 - 240;
    const maxWorldX = (mapSize - 1) * 32 + 240;
    const minWorldY = -240;
    const maxWorldY = (mapSize - 1) * 32 + 240;
    this.x = clamp(this.x, minWorldX, maxWorldX);
    this.y = clamp(this.y, minWorldY, maxWorldY);
  }

  /** Kolik dlaždic se vejde na obrazovku (přibližně). */
  visibleTileSpan() {
    return {
      x: this.viewWidth / this.zoom / 64,
      y: this.viewHeight / this.zoom / 32
    };
  }
}

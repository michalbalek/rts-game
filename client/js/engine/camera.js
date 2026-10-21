import { tileToScreen } from './isometric.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.minZoom = 0.4;
    this.maxZoom = 2.5;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
  }

  /**
   * Vycentruje kameru na zadanou dlaždici
   */
  centerOnTile(tileX, tileY) {
    const screenPos = tileToScreen(tileX, tileY);
    this.x = screenPos.x;
    this.y = screenPos.y;
  }

  /**
   * Posun kamery o delta hodnoty
   */
  pan(dx, dy) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /**
   * Zoom se zachováním středu kurzoru myši
   */
  zoomAt(delta, mouseX, mouseY) {
    const factor = delta < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(this.zoom * factor, this.minZoom), this.maxZoom);

    if (newZoom !== this.zoom) {
      // Posuneme střed tak, aby bod pod myší zůstal na stejném místě
      const worldBefore = this.screenToWorld(mouseX, mouseY);
      this.zoom = newZoom;
      const worldAfter = this.screenToWorld(mouseX, mouseY);

      this.x -= (worldAfter.x - worldBefore.x);
      this.y -= (worldAfter.y - worldBefore.y);
    }
  }

  /**
   * Převod souřadnic z okna/canvasu do virtuálního herního světa
   */
  screenToWorld(screenX, screenY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const worldX = (screenX - centerX) / this.zoom + this.x;
    const worldY = (screenY - centerY) / this.zoom + this.y;

    return { x: worldX, y: worldY };
  }

  /**
   * Převod z herního světa na pixelové souřadnice canvasu
   */
  worldToScreen(worldX, worldY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const screenX = (worldX - this.x) * this.zoom + centerX;
    const screenY = (worldY - this.y) * this.zoom + centerY;

    return { x: screenX, y: screenY };
  }

  /**
   * Aplikuje transformaci kamery na 2D kontext plátna
   */
  applyTransform(ctx) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    ctx.translate(centerX, centerY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
}

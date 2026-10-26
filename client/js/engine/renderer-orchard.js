import { tileToScreen, clamp } from './isometric.js';

export class RendererOrchard {
  drawOrchardGround(ctx, b) {
    const w = b.width;
    const h = b.height;
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    this.isoGround(ctx, 0, 0, w, h, 0, '#355f25');
    this.isoGround(ctx, 0.15, 0.15, w - 0.15, h - 0.15, 0, '#3f7330');

    // Nízká zídka (obrubník sadu).
    const wall = { top: '#d8b071', left: '#966e3a', right: '#bd9154' };
    this.isoBox(ctx, 0, 0, 0.1, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, 0, w, 0.1, 0, 4, wall, null);
    this.isoBox(ctx, w - 0.1, 0, w, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, h - 0.1, w, h, 0, 4, wall, null);

    // Zavlažovací strouha.
    this.isoGround(ctx, w / 2 - 0.06, 0.15, w / 2 + 0.06, h - 0.15, 0, '#2a7d8c');
    ctx.restore();
  }

  drawOrchardTree(ctx, b, gx, gy, u, v) {
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    if (!b.complete && b.progress < 0.7) {
      const p = this.isoPoint(u, v);
      ctx.strokeStyle = '#7c623d'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 5);
      ctx.lineTo(p.x + 3, p.y - 7); ctx.stroke();
    } else {
      this.drawAppleTree(ctx, u, v, gx + gy * 3);
    }
    ctx.restore();
  }

  drawAppleTree(ctx, u, v, seed) {
    const base = this.isoPoint(u, v, 0);
    const top = this.isoPoint(u, v, 18);
    ctx.fillStyle = 'rgba(16, 36, 10, 0.3)';
    ctx.beginPath(); ctx.ellipse(base.x + 2, base.y + 1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    const sway = Math.sin(this.time * 1.4 + seed * 1.7) * 0.65;
    ctx.strokeStyle = '#86653d'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(top.x, top.y + 6); ctx.lineTo(top.x - 5, top.y - 3);
    ctx.moveTo(top.x, top.y + 4); ctx.lineTo(top.x + 5, top.y - 2); ctx.stroke();
    for (const [x, y, r, color] of [
      [3, -2, 8, '#3c5930'], [-4, -3, 7, '#466a35'],
      [0, -8, 8, '#527b3d'], [-5, -9, 5, '#6e914c'], [5, -6, 5, '#638646']
    ]) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(top.x + x + sway, top.y + y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (const [x, y] of [[5, -3], [-5, -6], [1, -10], [-1, 1]]) {
      ctx.fillStyle = '#ab4534';
      ctx.beginPath(); ctx.arc(top.x + x + sway, top.y + y, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e69964';
      ctx.beginPath(); ctx.arc(top.x + x - 0.4 + sway, top.y + y - 0.5, 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawOrchardBasket(ctx, b) {
    if (!b.complete && b.progress < 0.85) return;
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    const basket = this.isoPoint(0.4, b.height - 0.55, 0);
    ctx.fillStyle = '#9a6b2f';
    ctx.beginPath(); ctx.ellipse(basket.x, basket.y, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(basket.x - 1.6, basket.y - 1.5, 1.5, 0, Math.PI * 2);
    ctx.arc(basket.x + 1.6, basket.y - 1.8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawOrchard(ctx, w, h) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#355f25');
    this.isoGround(ctx, 0.15, 0.15, w - 0.15, h - 0.15, 0, '#3f7330');

    // Nízká zídka.
    const wall = { top: '#d8b071', left: '#966e3a', right: '#bd9154' };
    this.isoBox(ctx, 0, 0, 0.1, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, 0, w, 0.1, 0, 4, wall, null);
    this.isoBox(ctx, w - 0.1, 0, w, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, h - 0.1, w, h, 0, 4, wall, null);

    // Zavlažovací strouha.
    this.isoGround(ctx, w / 2 - 0.06, 0.15, w / 2 + 0.06, h - 0.15, 0, '#2a7d8c');

    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const u = 0.62 + gx * 1.16;
        const v = 0.62 + gy * 1.16;
        this.drawAppleTree(ctx, u, v, gx + gy * 3);
      }
    }

    // Košík s jablky.
    const basket = this.isoPoint(0.4, h - 0.55, 0);
    ctx.fillStyle = '#9a6b2f';
    ctx.beginPath(); ctx.ellipse(basket.x, basket.y, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(basket.x - 1.6, basket.y - 1.5, 1.5, 0, Math.PI * 2);
    ctx.arc(basket.x + 1.6, basket.y - 1.8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

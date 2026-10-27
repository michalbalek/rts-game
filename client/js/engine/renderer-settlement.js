export class RendererSettlement {
  drawMarket(ctx, w, h) {
    this.isoBox(ctx, 0, 0, w, h, 0, 2, { top: '#c9a063', left: '#956d39', right: '#d3a96b' });

    const stall = (u1, v1, u2, v2, color) => {
      this.isoBox(ctx, u1, v1, u2, v2, 2, 12, { top: '#a9783a', left: '#6f4a20', right: '#8c6029' });
      // Pult.
      this.isoBox(ctx, u1 - 0.05, v2 - 0.08, u2 + 0.05, v2 + 0.05, 2, 14, { top: '#d9b06f', left: '#8a6030', right: '#b98d4e' });
      // Plachta.
      const p0 = this.isoPoint(u1 - 0.1, v1 - 0.1, 28);
      const p1 = this.isoPoint(u2 + 0.1, v1 - 0.1, 28);
      const p2 = this.isoPoint(u2 + 0.1, v2 + 0.12, 20);
      const p3 = this.isoPoint(u1 - 0.1, v2 + 0.12, 20);
      this.isoPoly(ctx, [p0, p1, p2, p3], color);
      // Pruhy.
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const a = this.isoPoint(u1 - 0.1 + (u2 - u1 + 0.2) * t, v1 - 0.1, 28);
        const b = this.isoPoint(u1 - 0.1 + (u2 - u1 + 0.2) * t, v2 + 0.12, 20);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // Sloupky.
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 1.6;
      const posts = [[u1 - 0.05, v2 + 0.08], [u2 + 0.05, v2 + 0.08]];
      for (const [u, v] of posts) {
        const a = this.isoPoint(u, v, 2);
        const b = this.isoPoint(u, v, 20);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    };

    stall(0.12, 0.18, 0.85, 0.85, '#a35743');
    stall(1.05, 0.55, 1.85, 1.15, '#507a7c');

    // Bedny a sudy.
    this.isoBox(ctx, 0.25, 1.35, 0.55, 1.65, 2, 10, { top: '#9a6b2f', left: '#6d461c', right: '#865a26' }, null);
    this.isoBox(ctx, 1.45, 1.55, 1.8, 1.88, 2, 8, { top: '#c9a063', left: '#8a6235', right: '#b98c53' }, null);
    const barrel = this.isoPoint(0.65, 1.65, 2);
    ctx.fillStyle = '#8a5b2b';
    ctx.beginPath(); ctx.ellipse(barrel.x, barrel.y - 5, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c2a06a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(barrel.x - 4.5, barrel.y - 5); ctx.lineTo(barrel.x + 4.5, barrel.y - 5); ctx.stroke();
  }

  drawDwelling(ctx, w, h, b) {
    this.isoBox(ctx, 0, 0, w, h, 0, 2, { top: '#bd9155', left: '#8f6634', right: '#c99e61' });
    this.isoGround(ctx, 0.12, 0.14, 1.86, 1.6, 2, '#a97f47');
    const rotation = b?.rotation || 0;
    const drawWell = () => {
      const well = this.isoPoint(1.45, 1.7, 2);
      ctx.fillStyle = '#8a8272';
      ctx.beginPath(); ctx.ellipse(well.x, well.y, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f6f80';
      ctx.beginPath(); ctx.ellipse(well.x, well.y - 1, 4.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(well.x - 6, well.y); ctx.lineTo(well.x - 6, well.y - 12);
      ctx.lineTo(well.x + 6, well.y - 12); ctx.lineTo(well.x + 6, well.y);
      ctx.stroke();
    };
    if (rotation === 1 || rotation === 2) drawWell();

    // Dům.
    this.isoMasonry(ctx, 0.18, 0.16, 1.55, 1.42, 2, 24,
      { top: '#eed8aa', left: '#ae8d60', right: '#ddc393' });
    // Valbová hliněná střecha.
    this.isoRoof(ctx, 0.1, 0.08, 1.63, 1.5, 25, 13);
    // Komín.
    const chim = this.isoPoint(1.28, 0.4, 24);
    ctx.fillStyle = '#7c5a3a';
    ctx.fillRect(chim.x - 3, chim.y - 12, 6, 12);
    if (b && b.complete) {
      this.drawSmoke(ctx, chim.x, chim.y - 12, b.id);
    }
    // Dveře a okno.
    if (rotation === 0 || rotation === 1) {
      const d0 = this.isoPoint(1.55, 0.68, 2);
      const d1 = this.isoPoint(1.55, 1.02, 2);
      this.isoPoly(ctx, [d0, d1, this.isoPoint(1.55, 1.02, 13), this.isoPoint(1.55, 0.68, 13)], '#4a2a10');
    }
    if (rotation === 0 || rotation === 3) {
      const p = this.isoPoint(0.75, 1.42, 12);
      ctx.fillStyle = '#3a2816';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    if (rotation === 0 || rotation === 3) drawWell();

    // Plot.
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 1.4;
    const f0 = this.isoPoint(0.05, 1.88, 2);
    const f1 = this.isoPoint(0.62, 1.88, 2);
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y);
    ctx.moveTo(f0.x, f0.y + 2); ctx.lineTo(f1.x, f1.y + 2);
    ctx.stroke();
  }

  drawGranary(ctx, w, h) {
    this.isoBox(ctx, 0, 0, w, h, 0, 3, { top: '#c49a5e', left: '#916836', right: '#cda366' });
    this.isoGround(ctx, 0.15, 0.15, w - 0.15, h - 0.15, 3, '#b88b51');

    // Kruhová sýpka.
    const c = this.isoPoint(w / 2, h / 2, 3);
    const rx = 34;
    const ry = 17;
    ctx.fillStyle = '#b8894d';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    const wallLight = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
    wallLight.addColorStop(0, '#9b7f56');
    wallLight.addColorStop(0.6, '#ddc596');
    wallLight.addColorStop(1, '#baa078');
    ctx.fillStyle = wallLight;
    ctx.beginPath();
    ctx.moveTo(c.x - rx, c.y);
    ctx.lineTo(c.x - rx, c.y - 42);
    ctx.ellipse(c.x, c.y - 42, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(c.x + rx, c.y);
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Dřevěné obruče.
    ctx.strokeStyle = '#7a5226';
    ctx.lineWidth = 2;
    for (const z of [12, 26]) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - z, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
    }
    // Kuželová došková střecha.
    const roofY = c.y - 42;
    ctx.fillStyle = '#ac8850';
    ctx.beginPath();
    ctx.moveTo(c.x, roofY - 30);
    ctx.lineTo(c.x + rx + 4, roofY);
    ctx.ellipse(c.x, roofY, rx + 4, 12, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#705435'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let a = 0.12; a < Math.PI; a += 0.2) {
      ctx.moveTo(c.x, roofY - 30);
      ctx.lineTo(c.x + Math.cos(a) * (rx + 4), roofY + Math.sin(a) * 12);
    }
    ctx.stroke();
    ctx.strokeStyle = '#d4b474'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(c.x, roofY, rx + 4, 12, 0, 0, Math.PI); ctx.stroke();

    // Dveře.
    ctx.fillStyle = '#4a2a10';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 8, 6, 9, 0, Math.PI, 0);
    ctx.fill();

    // Pytle mouky/jablek.
    for (let i = 0; i < 3; i++) {
      const p = this.isoPoint(w - 0.55 + i * 0.12, h - 0.4 - i * 0.1, 3);
      ctx.fillStyle = '#d8c49a';
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 3, 3.5, 4.5, -0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawWarehouse(ctx, w, h) {
    this.isoBox(ctx, 0, 0, w, h, 0, 2, { top: '#c69b5f', left: '#916735', right: '#d0a668' });

    this.isoMasonry(ctx, 0.16, 0.28, w - 0.16, 1.88, 2, 26,
      { top: '#e5c898', left: '#9c7b52', right: '#d0b181' });
    // Plochá střecha s hranou.
    this.isoBox(ctx, 0.08, 0.2, w - 0.08, 1.96, 26, 30,
      { top: '#b78b4e', left: '#7d5729', right: '#a97f45' });
    for (let v = 0.3; v < 1.9; v += 0.3) {
      this.isoGround(ctx, 0.16, v, w - 0.16, v + 0.035, 30, '#907449');
    }
    // Otevřená vrata.
    const gate0 = this.isoPoint(1.05, 1.88, 2);
    const gate1 = this.isoPoint(1.95, 1.88, 2);
    this.isoPoly(ctx, [gate0, gate1, this.isoPoint(1.95, 1.88, 20), this.isoPoint(1.05, 1.88, 20)], '#38220e');
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    const g0 = this.isoPoint(1.05, 1.88, 20);
    const g1 = this.isoPoint(1.95, 1.88, 20);
    ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke();

    // Soudek a bedny před skladem.
    const barrel = this.isoPoint(0.5, 2.25, 2);
    ctx.fillStyle = '#7c4d22';
    ctx.beginPath(); ctx.ellipse(barrel.x, barrel.y - 6, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c2a06a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(barrel.x - 5, barrel.y - 6); ctx.lineTo(barrel.x + 5, barrel.y - 6); ctx.stroke();

    this.isoBox(ctx, 2.25, 2.15, 2.68, 2.55, 2, 11, { top: '#a9783a', left: '#74501f', right: '#916528' }, null);
    this.isoBox(ctx, 1.9, 2.3, 2.18, 2.56, 2, 8, { top: '#bb8b48', left: '#7d5627', right: '#a37536' }, null);

    // Regály viditelné v otevřených vratech.
    for (let i = 0; i < 2; i++) {
      const p = this.isoPoint(1.2 + i * 0.45, 1.88, 10);
      ctx.fillStyle = '#a9783a';
      ctx.fillRect(p.x - 7, p.y - 10, 14, 2);
    }
  }
}

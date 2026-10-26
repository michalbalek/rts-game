export class RendererProduction {
  drawLumberjack(ctx, w, h, b) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#8a5b2f', 'rgba(60,36,12,0.35)');

    // Srub.
    this.isoBox(ctx, 0.08, 0.08, 0.7, 0.62, 0, 18,
      { top: '#a9712f', left: '#6f4318', right: '#8a5724' });
    for (let z = 3; z < 18; z += 4) {
      const a = this.isoPoint(0.08, 0.62, z), b2 = this.isoPoint(0.7, 0.62, z);
      const c = this.isoPoint(0.7, 0.08, z);
      ctx.strokeStyle = '#503920'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    // Markýza.
    this.isoPoly(ctx, [
      this.isoPoint(0.02, 0.68, 18), this.isoPoint(0.76, 0.68, 18),
      this.isoPoint(0.76, 0.9, 13), this.isoPoint(0.02, 0.9, 13)
    ], '#b45309');
    // Komín a kouř.
    const chim = this.isoPoint(0.22, 0.22, 20);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(chim.x - 2.5, chim.y - 9, 5, 9);
    if (b && b.workers > 0) {
      this.drawSmoke(ctx, chim.x, chim.y - 10, b.id);
    }
    // Špalek a sekera.
    const stump = this.isoPoint(0.78, 0.35, 0);
    ctx.fillStyle = '#6f4318';
    ctx.beginPath(); ctx.ellipse(stump.x, stump.y, 4.6, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(stump.x, stump.y - 2); ctx.lineTo(stump.x + 5, stump.y - 10); ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(stump.x + 5, stump.y - 10);
    ctx.lineTo(stump.x + 10, stump.y - 7);
    ctx.lineTo(stump.x + 5, stump.y - 3);
    ctx.closePath();
    ctx.fill();

    // Naskládané dřevo.
    const log = this.isoPoint(0.35, 0.82, 0);
    ctx.fillStyle = '#7c4a1e';
    ctx.fillRect(log.x - 8, log.y - 4, 16, 3);
    ctx.fillRect(log.x - 6, log.y - 7, 12, 3);
    ctx.fillRect(log.x - 4, log.y - 10, 8, 3);
    this.isoBox(ctx, 0.9, 0.65, 1.02, 1.02, 0, 4, { top: '#c99f62', left: '#946c38', right: '#b98e50' }, null);
  }

  drawQuarry(ctx, w, h) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#b48952', 'rgba(70,46,18,0.3)');

    // Vykopaná jáma.
    const p0 = this.isoPoint(0.28, 0.28, 0);
    const p1 = this.isoPoint(w - 0.28, 0.28, 0);
    const p2 = this.isoPoint(w - 0.28, h - 0.28, 0);
    const p3 = this.isoPoint(0.28, h - 0.28, 0);
    this.isoPoly(ctx, [p0, p1, p2, p3], '#75624b');

    const f0 = this.isoPoint(0.48, 0.48, -13);
    const f1 = this.isoPoint(w - 0.48, 0.48, -13);
    const f2 = this.isoPoint(w - 0.48, h - 0.48, -13);
    const f3 = this.isoPoint(0.48, h - 0.48, -13);
    this.isoPoly(ctx, [f0, f1, f2, f3], '#8d7b5d');
    this.isoPoly(ctx, [p0, p1, f1, f0], '#bca17b');
    this.isoPoly(ctx, [p1, p2, f2, f1], '#9c8461');
    for (let i = 0; i < 5; i++) {
      const u = 0.65 + (i % 3) * 0.45;
      const v = 0.8 + Math.floor(i / 3) * 0.65;
      this.isoBox(ctx, u, v, u + 0.33, v + 0.32, -13, -7 + i % 2 * 2,
        { top: '#cbb797', left: '#998568', right: '#b5a181' }, null);
    }
    for (let z = -3; z > -13; z -= 4) {
      const a = this.isoPoint(0.32, 0.32, z), b2 = this.isoPoint(w - 0.32, 0.32, z);
      ctx.strokeStyle = 'rgba(75,59,39,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }

    // Těžební jeřáb.
    const base = this.isoPoint(w - 0.45, 0.4, 0);
    const top = this.isoPoint(w - 0.45, 0.4, 40);
    const boom = this.isoPoint(1.25, 1.25, 34);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.lineTo(boom.x, boom.y);
    ctx.moveTo(base.x - 9, base.y + 3); ctx.lineTo(top.x, top.y - 1);
    ctx.moveTo(base.x + 7, base.y + 4); ctx.lineTo(top.x, top.y);
    ctx.moveTo(base.x, base.y - 23); ctx.lineTo(boom.x, boom.y);
    ctx.stroke();
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boom.x, boom.y); ctx.lineTo(boom.x, boom.y + 18);
    ctx.stroke();
    ctx.fillStyle = '#deb370';
    ctx.fillRect(boom.x - 4, boom.y + 17, 8, 8);
    const wheel = this.isoPoint(w - 0.45, 0.4, 15);
    ctx.strokeStyle = '#604c35'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wheel.x + 5, wheel.y, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wheel.x, wheel.y); ctx.lineTo(wheel.x + 10, wheel.y);
    ctx.moveTo(wheel.x + 5, wheel.y - 5); ctx.lineTo(wheel.x + 5, wheel.y + 5); ctx.stroke();

    // Otesané kvádry.
    for (let i = 0; i < 3; i++) {
      this.isoBox(ctx, w - 0.75 + i * 0.12, 1.85 + i * 0.1, w - 0.35 + i * 0.12, 2.2 + i * 0.1, 0, 6 + i * 3,
        { top: '#dcb271', left: '#b8894d', right: '#caa05e' }, null);
    }
    const barrow = this.isoPoint(0.55, 1.05, -13);
    ctx.fillStyle = '#c89e63';
    ctx.beginPath(); ctx.ellipse(barrow.x, barrow.y, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawIronMine(ctx, w, h) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#7b6a52', 'rgba(40,30,20,0.4)');
    // Skalní stěna.
    const rock0 = this.isoPoint(0.15, 0.25, 18), rock1 = this.isoPoint(w - 0.25, 0.25, 23);
    const rock2 = this.isoPoint(w - 0.05, 1.65, 0), rock3 = this.isoPoint(0.05, 1.7, 0);
    const peak = this.isoPoint(0.95, 0.65, 37);
    const ridge = this.isoPoint(1.95, 0.65, 32);
    const edge = this.isoPoint(w - 0.4, 1.5, 19);
    const shoulder = this.isoPoint(0.5, 1.5, 22);
    this.isoPoly(ctx, [rock0, peak, ridge, rock1], '#b3a18a', '#766b59');
    this.isoPoly(ctx, [rock0, peak, shoulder, rock3], '#887a66', '#665b4d');
    this.isoPoly(ctx, [peak, ridge, edge, shoulder], '#a39379', '#766b59');
    this.isoPoly(ctx, [ridge, rock1, rock2, edge], '#8b7f6d', '#766b59');
    this.isoPoly(ctx, [rock3, shoulder, edge, rock2], '#786b59', '#665b4d');
    for (let i = 0; i < 5; i++) {
      const p = this.isoPoint(0.35 + i * 0.5, 1.45, 11 + (i % 3) * 4);
      ctx.strokeStyle = i % 2 ? '#b7b2a2' : '#534f47'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 1, p.y - 4); ctx.lineTo(p.x + 5, p.y - 3); ctx.stroke();
    }
    // Vstup do šachty.
    const e0 = this.isoPoint(1.05, 1.7, 0);
    const e1 = this.isoPoint(1.95, 1.7, 0);
    this.isoPoly(ctx, [e0, e1, this.isoPoint(1.95, 1.7, 20), this.isoPoint(1.05, 1.7, 20)], '#211912');
    // Dřevěná výztuž.
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3;
    const b0 = this.isoPoint(0.98, 1.7, 0);
    const b1 = this.isoPoint(2.02, 1.7, 0);
    const t0 = this.isoPoint(0.98, 1.7, 22);
    const t1 = this.isoPoint(2.02, 1.7, 22);
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y); ctx.lineTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(b1.x, b1.y);
    ctx.stroke();

    // Koleje.
    ctx.strokeStyle = '#5d6470';
    ctx.lineWidth = 1.4;
    const r0 = this.isoPoint(1.28, 1.72, 0);
    const r1 = this.isoPoint(1.28, 2.55, 0);
    const r2 = this.isoPoint(1.72, 1.72, 0);
    const r3 = this.isoPoint(1.72, 2.55, 0);
    ctx.beginPath();
    ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y);
    ctx.moveTo(r2.x, r2.y); ctx.lineTo(r3.x, r3.y);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const v = 1.72 + i * 0.18;
      const a = this.isoPoint(1.28, v, 0);
      const b = this.isoPoint(1.72, v, 0);
      ctx.strokeStyle = '#7a5a34';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Vozík.
    const cart = this.isoPoint(1.5, 2.28, 3);
    ctx.fillStyle = '#6d4a25';
    ctx.fillRect(cart.x - 7, cart.y - 8, 14, 8);
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(cart.x - 5, cart.y, 2.5, 0, Math.PI * 2);
    ctx.arc(cart.x + 5, cart.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c7c86';
    ctx.beginPath(); ctx.ellipse(cart.x, cart.y - 9, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Hromada rudy.
    for (let i = 0; i < 4; i++) {
      const p = this.isoPoint(2.15 + (i % 2) * 0.14, 2.2 + Math.floor(i / 2) * 0.14, 0);
      ctx.fillStyle = i % 2 ? '#6e6a63' : '#8b7a63';
      ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    // Výstražná lucerna.
    const lamp = this.isoPoint(0.62, 2.0, 0);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lamp.x, lamp.y); ctx.lineTo(lamp.x, lamp.y - 14); ctx.stroke();
    ctx.fillStyle = `rgba(250, 190, 70, ${0.6 + Math.sin(this.time * 4) * 0.2})`;
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y - 16, 3.5, 0, Math.PI * 2); ctx.fill();
  }
}

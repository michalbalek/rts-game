const STONE = { top: '#d8c8a9', left: '#786f60', right: '#aa9a80' };
const LIGHT_STONE = { top: '#eee1c5', left: '#8e8170', right: '#c4b397' };
const DARK_STONE = { top: '#ad9f89', left: '#60594e', right: '#887d6d' };

export class RendererFortifications {
  drawWall(ctx) {
    this.isoMasonry(ctx, 0, 0, 1, 1, 0, 31, STONE);
    this.isoBox(ctx, 0, 0, 1, 1, 31, 34, LIGHT_STONE);
    this.isoGround(ctx, 0.14, 0.14, 0.86, 0.86, 34, '#918471');
    for (const [u, v] of [[0, 0], [0.68, 0], [0, 0.68], [0.68, 0.68]]) {
      this.isoMasonry(ctx, u, v, u + 0.32, v + 0.32, 34, 43, LIGHT_STONE);
    }
  }

  drawGate(ctx, b) {
    const large = b.type === 'gate_large';
    const w = large ? 4 : 1;
    const pier = large ? 0.6 : 0.22;
    const arch = large ? 34 : 24;
    const top = large ? 45 : 34;
    const face = (b.rotation === 1 || b.rotation === 2) ? 0 : 1;
    const point = (u, z) => this.isoPoint(u, face, z);
    this.isoGround(ctx, pier, 0, w - pier, 1, 0, '#827a69');

    if (!b.gateOpen) {
      const left = pier, right = w - pier, middle = w / 2;
      this.isoPoly(ctx, [point(left, 0), point(right, 0), point(right, arch - 5),
        point(middle, arch), point(left, arch - 5)], '#62432b', '#30261d');
      ctx.strokeStyle = '#3a291d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const boards = large ? 12 : 4;
      for (let i = 1; i < boards; i++) {
        const u = left + (right - left) * i / boards;
        const a = point(u, 1), z = point(u, arch - 6);
        ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#282d2d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const z of [7, arch - 10]) {
        const a = point(left, z), end = point(right, z);
        ctx.moveTo(a.x, a.y); ctx.lineTo(end.x, end.y);
      }
      ctx.stroke();
      ctx.fillStyle = '#c9b998';
      for (const z of [7, arch - 10]) {
        for (let i = 1; i < boards; i += 2) {
          const p = point(left + (right - left) * i / boards, z);
          ctx.beginPath(); ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    this.isoMasonry(ctx, 0, 0, pier, 1, 0, top, STONE);
    this.isoMasonry(ctx, w - pier, 0, w, 1, 0, top, STONE);
    this.isoMasonry(ctx, pier, 0, w - pier, 1, arch, top, STONE);
    this.isoPoly(ctx, [point(pier, arch - 5), point(pier + (w - 2 * pier) * 0.2, arch),
      point(pier, arch)], LIGHT_STONE.right, '#796e5e');
    this.isoPoly(ctx, [point(w - pier, arch - 5), point(w - pier - (w - 2 * pier) * 0.2, arch),
      point(w - pier, arch)], LIGHT_STONE.right, '#796e5e');
    this.isoBox(ctx, 0, 0, w, 1, top, top + 3, LIGHT_STONE);
    this.isoGround(ctx, 0.12, 0.22, w - 0.12, 0.78, top + 3, '#9a8d77');
    const blocks = large ? 8 : 3;
    for (let i = 0; i < blocks; i++) {
      const u = i * w / blocks;
      this.isoMasonry(ctx, u, 0, u + w / blocks * 0.55, 0.28, top + 3, top + 9, LIGHT_STONE);
      this.isoMasonry(ctx, u, 0.72, u + w / blocks * 0.55, 1, top + 3, top + 9, LIGHT_STONE);
    }
  }

  drawDefenseTower(ctx, w, h) {
    this.isoMasonry(ctx, 0, 0, w, h, 0, 6, DARK_STONE);
    this.isoMasonry(ctx, 0.08, 0.08, w - 0.08, h - 0.08, 6, 52, STONE);
    this.isoBox(ctx, 0, 0, w, h, 52, 57, LIGHT_STONE);
    this.isoGround(ctx, 0.18, 0.18, w - 0.18, h - 0.18, 57, '#8d806c');
    for (const [u, v] of [[0, 0], [0.8, 0], [1.6, 0], [0, 0.8], [1.6, 0.8],
      [0, 1.6], [0.8, 1.6], [1.6, 1.6]]) {
      this.isoMasonry(ctx, u, v, u + 0.4, v + 0.4, 57, 68, LIGHT_STONE);
    }
    const box = this.rotatedBox(0.08, 0.08, w - 0.08, h - 0.08);
    for (const [u, v] of [[(box.u1 + box.u2) / 2, box.v2], [box.u2, (box.v1 + box.v2) / 2]]) {
      const p = this.projectIsoPoint(u, v, 30);
      ctx.fillStyle = '#302e2a';
      ctx.fillRect(p.x - 1.5, p.y - 7, 3, 14);
      ctx.fillRect(p.x - 3, p.y - 3, 6, 2);
    }
  }

  drawCastle(ctx, w, h) {
    this.isoBox(ctx, 0, 0, w, h, 0, 4, { top: '#c99f62', left: '#98703c', right: '#d6ad70' });
    this.isoGround(ctx, 0.12, 1.75, w - 0.12, h - 0.08, 4, '#c49a5c');
    // Dlažba nádvoří.
    for (let i = 0; i < 3; i++) {
      this.isoGround(ctx, 0.35 + i * 0.8, 2.05, 1.05 + i * 0.8, 2.75, 4, i % 2 ? '#bd9051' : '#c99d5d');
    }

    this.isoMasonry(ctx, 0.32, 0.3, w - 0.32, 1.72, 4, 42,
      { top: '#ecd3a0', left: '#a28156', right: '#d4b480' });
    // Cimbuří na hradbách.
    for (let i = 0; i < 7; i++) {
      const u = 0.42 + i * 0.32;
      this.isoBox(ctx, u, 0.3, u + 0.17, 0.52, 42, 47, { top: '#dfb877', left: '#8c6434', right: '#c59a5a' }, null);
      this.isoBox(ctx, u, 1.5, u + 0.17, 1.72, 42, 47, { top: '#dfb877', left: '#8c6434', right: '#c59a5a' }, null);
    }
    for (let i = 0; i < 5; i++) {
      const v = 0.5 + i * 0.28;
      this.isoBox(ctx, 0.32, v, 0.52, v + 0.15, 42, 47, { top: '#dfb877', left: '#8c6434', right: '#c59a5a' }, null);
      this.isoBox(ctx, w - 0.52, v, w - 0.32, v + 0.15, 42, 47, { top: '#dfb877', left: '#8c6434', right: '#c59a5a' }, null);
    }

    // Vstupní brána.
    const gate0 = this.isoPoint(1.1, 1.72, 4);
    const gate1 = this.isoPoint(1.9, 1.72, 4);
    const gate2 = this.isoPoint(1.9, 1.72, 21);
    const gate3 = this.isoPoint(1.1, 1.72, 21);
    this.isoPoly(ctx, [gate0, gate1, gate2, gate3], '#3a220e');
    ctx.strokeStyle = '#2a1708';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gate0.x, gate0.y); ctx.lineTo(gate3.x, gate3.y);
    ctx.moveTo(gate1.x, gate1.y); ctx.lineTo(gate2.x, gate2.y);
    ctx.stroke();

    // Rohové věže.
    const towers = [
      [0.08, 0.08], [w - 0.92, 0.08], [0.08, 1.34], [w - 0.92, 1.34]
    ];
    for (const [u, v] of towers) {
      this.isoMasonry(ctx, u, v, u + 0.84, v + 0.84, 4, 58,
        { top: '#e3c897', left: '#98764e', right: '#cdb080' });
      this.isoBox(ctx, u - 0.05, v - 0.05, u + 0.89, v + 0.89, 58, 63,
        { top: '#cba162', left: '#795224', right: '#b98e50' });
      this.isoGround(ctx, u + 0.08, v + 0.08, u + 0.76, v + 0.76, 63, '#816342');
      for (const [du, dv] of [[0, 0], [0.6, 0], [0, 0.6], [0.6, 0.6]]) {
        this.isoBox(ctx, u + du - 0.04, v + dv - 0.04, u + du + 0.28, v + dv + 0.28, 63, 69,
          { top: '#ecd3a0', left: '#9c7a51', right: '#d0ae79' }, null);
      }
      // Střílny.
      const slit = this.isoPoint(u + 0.42, v + 0.84, 40);
      ctx.fillStyle = '#3a220e';
      ctx.fillRect(slit.x - 1.5, slit.y - 4, 3, 8);
    }

    // Schody k bráně.
    this.isoBox(ctx, 1.05, 1.85, 1.95, 2.25, 0, 4, { top: '#b98c50', left: '#8f6432', right: '#caa061' }, null);
  }

  drawBarracks(ctx, w, h) {
    this.isoBox(ctx, 0, 0, w, h, 0, 2, { top: '#c89b5e', left: '#9a703a', right: '#d2a668' });

    // Hlavní síň.
    this.isoMasonry(ctx, 0.12, 0.16, 1.2, 1.84, 2, 24,
      { top: '#e6c997', left: '#a08055', right: '#d4b580' });
    // Sedlová střecha.
    this.isoRoof(ctx, 0.06, 0.1, 1.26, 1.9, 25, 13);
    // Dveře.
    const d0 = this.isoPoint(1.2, 0.78, 2);
    const d1 = this.isoPoint(1.2, 1.32, 2);
    this.isoPoly(ctx, [d0, d1, this.isoPoint(1.2, 1.32, 16), this.isoPoint(1.2, 0.78, 16)], '#3f2510');

    // Cvičný terč.
    const target = this.isoPoint(1.55, 0.5, 2);
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(target.x - 5, target.y); ctx.lineTo(target.x - 5, target.y - 13);
    ctx.moveTo(target.x + 5, target.y); ctx.lineTo(target.x + 5, target.y - 13);
    ctx.stroke();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath(); ctx.arc(target.x, target.y - 12, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath(); ctx.arc(target.x, target.y - 12, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(target.x, target.y - 12, 1.2, 0, Math.PI * 2); ctx.fill();

    // Stojan na zbraně.
    const rack = this.isoPoint(1.55, 1.45, 2);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rack.x - 7, rack.y); ctx.lineTo(rack.x + 7, rack.y);
    ctx.moveTo(rack.x - 7, rack.y); ctx.lineTo(rack.x - 7, rack.y - 12);
    ctx.moveTo(rack.x + 7, rack.y); ctx.lineTo(rack.x + 7, rack.y - 12);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rack.x - 5 + i * 5, rack.y - 11);
      ctx.lineTo(rack.x - 5 + i * 5, rack.y - 2);
      ctx.stroke();
    }

    // Vlajka na střeše.
    const pole = this.isoPoint(0.62, 0.5, 38);
    ctx.strokeStyle = '#5b3a18';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pole.x, pole.y); ctx.lineTo(pole.x, pole.y - 14); ctx.stroke();
  }
}

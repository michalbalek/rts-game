import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT } from './isometric.js';

export class RendererGeometry {
  isoPoint(u, v, z = 0) {
    return {
      x: (u - v) * HALF_TILE_WIDTH,
      y: (u + v) * HALF_TILE_HEIGHT - z
    };
  }

  isoBox(ctx, u1, v1, u2, v2, z1, z2, colors = {}, stroke = 'rgba(45,28,10,0.32)') {
    const t0 = this.isoPoint(u1, v1, z2);
    const t1 = this.isoPoint(u2, v1, z2);
    const t2 = this.isoPoint(u2, v2, z2);
    const t3 = this.isoPoint(u1, v2, z2);
    const b1 = this.isoPoint(u2, v1, z1);
    const b2 = this.isoPoint(u2, v2, z1);
    const b3 = this.isoPoint(u1, v2, z1);

    ctx.fillStyle = colors.left || '#9d723d';
    ctx.beginPath();
    ctx.moveTo(b3.x, b3.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = colors.right || '#c79a5d';
    ctx.beginPath();
    ctx.moveTo(b2.x, b2.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = colors.top || '#e0bb7b';
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
    ctx.closePath(); ctx.fill();

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.closePath();
      ctx.moveTo(b1.x, b1.y); ctx.lineTo(t1.x, t1.y);
      ctx.moveTo(b2.x, b2.y); ctx.lineTo(t2.x, t2.y);
      ctx.moveTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y);
      ctx.stroke();
    }
  }

  isoGround(ctx, u1, v1, u2, v2, z, color, stroke = null) {
    const pts = [
      this.isoPoint(u1, v1, z), this.isoPoint(u2, v1, z),
      this.isoPoint(u2, v2, z), this.isoPoint(u1, v2, z)
    ];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  isoMasonry(ctx, u1, v1, u2, v2, z1, z2, colors) {
    this.isoBox(ctx, u1, v1, u2, v2, z1, z2, colors);
    ctx.save();
    ctx.strokeStyle = 'rgba(65, 43, 24, 0.24)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    const line = (a, b) => { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); };
    let row = 0;
    for (let z = z1 + 6; z < z2; z += 7, row++) {
      line(this.isoPoint(u1, v2, z), this.isoPoint(u2, v2, z));
      line(this.isoPoint(u2, v1, z), this.isoPoint(u2, v2, z));
      if (this.quality === 'low') continue;
      for (let u = u1 + 0.18 + (row % 2) * 0.25; u < u2; u += 0.5) {
        line(this.isoPoint(u, v2, z), this.isoPoint(u, v2, Math.min(z + 7, z2)));
      }
      for (let v = v1 + 0.18 + (row % 2) * 0.25; v < v2; v += 0.5) {
        line(this.isoPoint(u2, v, z), this.isoPoint(u2, v, Math.min(z + 7, z2)));
      }
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 232, 184, 0.35)';
    ctx.beginPath();
    line(this.isoPoint(u1, v2, z2), this.isoPoint(u2, v2, z2));
    line(this.isoPoint(u2, v2, z2), this.isoPoint(u2, v1, z2));
    ctx.stroke();
    ctx.restore();
  }

  isoRoof(ctx, u1, v1, u2, v2, z, rise) {
    const mid = (u1 + u2) / 2;
    const a = this.isoPoint(u1, v1, z);
    const b = this.isoPoint(u2, v1, z);
    const c = this.isoPoint(u2, v2, z);
    const d = this.isoPoint(u1, v2, z);
    const back = this.isoPoint(mid, v1 + 0.18, z + rise);
    const front = this.isoPoint(mid, v2 - 0.18, z + rise);
    this.isoPoly(ctx, [a, b, back], '#b16c47', '#73482f');
    this.isoPoly(ctx, [a, d, front, back], '#885038', '#633b2a');
    this.isoPoly(ctx, [b, c, front, back], '#b5754f', '#73482f');
    this.isoPoly(ctx, [d, c, front], '#975a3b', '#633b2a');
    const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    ctx.strokeStyle = 'rgba(65, 34, 22, 0.3)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    for (let t = 0.2; t < 1; t += 0.2) {
      const left = mix(b, back, t), right = mix(c, front, t);
      ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y);
      const end = mix(d, front, t);
      ctx.lineTo(end.x, end.y);
    }
    for (let t = 0.12; t < 1; t += 0.14) {
      const eave = mix(b, c, t), ridge = mix(back, front, t);
      ctx.moveTo(eave.x, eave.y); ctx.lineTo(ridge.x, ridge.y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#d29b6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(front.x, front.y); ctx.stroke();
  }

  drawSmoke(ctx, x, y, seed) {
    if (this.quality === 'low') return;
    for (let i = 0; i < 4; i++) {
      const age = (this.time * 0.28 + seed * 0.17 + i / 4) % 1;
      const drift = Math.sin(age * 3 + seed) * 3 + age * 8;
      ctx.fillStyle = `rgba(231, 220, 200, ${0.2 * Math.sin(age * Math.PI)})`;
      ctx.beginPath();
      ctx.ellipse(x + drift, y - age * 28, 2 + age * 5, 1.5 + age * 3, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  isoPoly(ctx, pts, fill, stroke = null) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

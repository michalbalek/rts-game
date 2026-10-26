import { clamp } from './isometric.js';

export const BUILDING_TOP = {
  castle: 72, barracks: 38, lumberjack: 30, quarry: 42, orchard: 16,
  market: 30, dwelling: 40, granary: 76, warehouse: 38, ironmine: 34
};

export class RendererBuildingStatus {
  drawScaffolding(ctx, b) {
    const w = b.width;
    const h = b.height;
    const z = Math.max(12, b.progress * (BUILDING_TOP[b.type] || 34) + 10);
    ctx.strokeStyle = 'rgba(120, 84, 40, 0.85)';
    ctx.lineWidth = 1.8;
    const corners = [[0.05, 0.05], [w - 0.05, 0.05], [w - 0.05, h - 0.05], [0.05, h - 0.05]];
    for (const [u, v] of corners) {
      const a = this.isoPoint(u, v, 0);
      const c = this.isoPoint(u, v, z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    for (let level = 0; level < 3; level++) {
      const zz = 3 + level * (z - 3) / 3;
      for (let i = 0; i < corners.length; i++) {
        const a = this.isoPoint(corners[i][0], corners[i][1], zz);
        const b2 = this.isoPoint(corners[(i + 1) % corners.length][0], corners[(i + 1) % corners.length][1], zz);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
        if (i === 1 || i === 2) {
          const brace = this.isoPoint(corners[i][0], corners[i][1], Math.min(z, zz + 10));
          ctx.beginPath(); ctx.moveTo(brace.x, brace.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
        }
      }
    }
    // Žebřík.
    const l0 = this.isoPoint(w - 0.2, h - 0.1, 0);
    const l1 = this.isoPoint(w - 0.2, h - 0.1, z - 4);
    ctx.beginPath();
    ctx.moveTo(l0.x - 3, l0.y); ctx.lineTo(l1.x - 3, l1.y);
    ctx.moveTo(l0.x + 3, l0.y); ctx.lineTo(l1.x + 3, l1.y);
    for (let y = l0.y - 3; y > l1.y; y -= 4) {
      ctx.moveTo(l0.x - 3, y); ctx.lineTo(l0.x + 3, y);
    }
    ctx.stroke();
  }

  drawConstructionBar(ctx, b, def) {
    const top = BUILDING_TOP[b.type] || 34;
    const p = this.isoPoint(b.width / 2, b.height / 2, top);
    const w = Math.max(34, b.width * 26);
    ctx.fillStyle = 'rgba(20, 12, 6, 0.85)';
    ctx.fillRect(p.x - w / 2, p.y - 5, w, 6);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(p.x - w / 2 + 1, p.y - 4, (w - 2) * b.progress, 4);
    ctx.fillStyle = '#f8e7bd';
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(b.progress * 100)} %`, p.x, p.y - 8);
  }

  drawOwnerFlag(ctx, b, def) {
    if (!b.ownerId) return;
    const top = BUILDING_TOP[b.type] || 34;
    const p = this.isoPoint(b.width / 2, b.height / 2, top);
    const color = this.ownerColor(b.ownerId);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 17);
    ctx.stroke();
    const wave = Math.sin(this.time * 3 + b.id) * 1.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p.x + 1, p.y - 17);
    ctx.bezierCurveTo(p.x + 6, p.y - 19 + wave, p.x + 9, p.y - 14 - wave, p.x + 15, p.y - 16 + wave);
    ctx.lineTo(p.x + 14, p.y - 8 + wave);
    ctx.bezierCurveTo(p.x + 8, p.y - 6 - wave, p.x + 6, p.y - 12 + wave, p.x + 1, p.y - 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 4, p.y - 14);
    ctx.lineTo(p.x + 4, p.y - 10);
    ctx.stroke();
  }

  drawBuildingStatus(ctx, b, def, selected) {
    const top = BUILDING_TOP[b.type] || 34;
    const p = this.isoPoint(b.width / 2, b.height / 2, top);
    const barW = Math.max(30, b.width * 24);
    const dmg = b.hp < b.maxHp - 0.5;

    if (def.workers > 0 && b.workers > 0) {
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20, 12, 6, 0.7)';
      ctx.fillRect(p.x - 17, p.y + 5, 34, 13);
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`👤 ${b.workers}/${def.workers}`, p.x, p.y + 15);
    }

    if (b.queue && b.queue.length > 0) {
      const item = b.queue[0];
      const ratio = 1 - item.remaining / item.total;
      ctx.fillStyle = 'rgba(20, 12, 6, 0.85)';
      ctx.fillRect(p.x - barW / 2, p.y + 20, barW, 4);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(p.x - barW / 2 + 1, p.y + 21, (barW - 2) * clamp(ratio, 0, 1), 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.queue.length}× ⚔`, p.x, p.y + 34);
    }

    if (dmg || selected) {
      const y = p.y - 6;
      const ratio = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(15, 10, 5, 0.85)';
      ctx.fillRect(p.x - barW / 2 - 1, y - 1, barW + 2, 6);
      ctx.fillStyle = ratio > 0.55 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(p.x - barW / 2, y, barW * ratio, 4);
    }

    if (b.repair) {
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🔨', p.x + 20, p.y - 2 + Math.sin(this.time * 6) * 2);
    }

    if (dmg && b.hp / b.maxHp < 0.4 && b.complete) {
      const smoke = (this.time * 9 + b.id) % 22;
      ctx.fillStyle = `rgba(60, 52, 46, ${0.24 * (1 - smoke / 22)})`;
      ctx.beginPath();
      ctx.arc(p.x + 5 + Math.sin(this.time * 2) * 3, p.y - 10 - smoke, 4 + smoke * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

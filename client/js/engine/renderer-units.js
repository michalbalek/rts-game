import { tileToScreen, clamp } from './isometric.js';
import { unitAnimation } from './unit-animation.js';

export class RendererUnits {
  drawUnit(ctx, u, ui, camera) {
    const pos = tileToScreen(u.x, u.y);
    const selected = ui.selectedIds && ui.selectedIds.has(u.id);
    const hovered = ui.hoverEntity && ui.hoverEntity.entity && ui.hoverEntity.entity.id === u.id;
    const color = this.ownerColor(u.ownerId);
    const pose = unitAnimation(u, this.time, this.unitAnimations.get(u));
    this.unitAnimations.set(u, pose);
    const carry = u.work && typeof u.work === 'object' ? u.work.carry : (u.carry || 0);
    const resource = u.work && typeof u.work === 'object' ? u.work.produce : u.carryResource;
    const soldier = u.type === 'swordsman';
    const archer = u.type === 'archer';
    const skin = ['#e0b58a', '#c99368', '#b47e56'][u.id % 3];
    const cloth = soldier ? '#b7bdba' : archer ? '#66765a' : ['#c3aa7e', '#a99570', '#c6b494'][u.id % 3];
    const working = ['work', 'build', 'harvest'].includes(pose.activity);
    const swing = pose.stride * 2.8;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Stín.
    ctx.fillStyle = 'rgba(35, 22, 8, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0.7, 0.5, 6.5, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Výběrový kroužek.
    if (selected) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10.5, 5.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(253, 224, 71, 0.12)';
      ctx.fill();
    } else if (hovered) {
      ctx.strokeStyle = 'rgba(255, 245, 210, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.scale(pose.facing, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const limb = (points, fill, width) => {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = '#47392b';
      ctx.lineWidth = width + 1.2;
      ctx.stroke();
      ctx.strokeStyle = fill;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    limb([[-1.8, -7], [-2.2 - swing * 0.4, -3.5], [-2 + swing, -0.5 - Math.max(0, pose.stride) * 1.4]], '#655441', 2);
    limb([[1.6, -7], [2.2 + swing * 0.4, -3.5], [2 - swing, -0.5 - Math.max(0, -pose.stride) * 1.4]], '#8a7458', 2);
    ctx.translate(0, -pose.lift + pose.breathe);
    limb([[-2.6, -14], [-4.7, -11], [-4.5 - swing * 0.55, -8.5]], skin, 1.8);

    ctx.fillStyle = cloth;
    ctx.strokeStyle = '#53432e';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-3.2, -15.6);
    ctx.quadraticCurveTo(0, -17, 3.1, -15);
    ctx.lineTo(3.9, -6);
    ctx.quadraticCurveTo(0, -4.7, -3.8, -6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,244,215,0.22)';
    ctx.beginPath(); ctx.moveTo(0, -15.4); ctx.lineTo(2.3, -14); ctx.lineTo(2.9, -7); ctx.lineTo(0, -7); ctx.fill();
    ctx.fillStyle = color;
    if (soldier) ctx.fillRect(-1.3, -15, 2.6, 8);
    else ctx.fillRect(-3.3, -10, 6.6, 1.6);
    ctx.fillStyle = '#55402c';
    ctx.fillRect(-3.5, -7.5, 7, 1.3);
    ctx.fillStyle = '#d4b375';
    ctx.fillRect(0.3, -7.7, 1.5, 1.6);

    if (archer) {
      limb([[-3.2, -8], [-4.5, -18]], '#725335', 2.6);
      limb([[-4.5, -18], [-5.7, -21]], '#d0c1a0', 0.8);
    }
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(0.4, -19, 2.9, 3.5, -0.12, 0, Math.PI * 2); ctx.fill();
    if (!pose.back) {
      ctx.fillRect(2.6, -19.5, 1.5, 1.5);
      ctx.fillStyle = '#3b3025';
      ctx.fillRect(1.7, -20, 0.8, 0.8);
    }
    ctx.fillStyle = soldier ? '#8e9fa5' : archer ? '#52644a' : '#e1cfa7';
    ctx.strokeStyle = soldier ? '#495a60' : '#8b7858';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-3.3, -18.8);
    ctx.quadraticCurveTo(-4, -24.5, 0.2, -24);
    ctx.quadraticCurveTo(4.2, -23.5, 3.5, -19.5);
    ctx.lineTo(pose.back ? 3 : -0.8, -18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (soldier) {
      limb([[0.2, -23], [0.8, -19]], '#d5dfe0', 1);
      ctx.fillStyle = color; ctx.fillRect(-0.6, -25, 1.7, 3);
    } else if (!archer) {
      limb([[-3.1, -21], [3.2, -21]], '#f2e1b9', 1.3);
      limb([[-2.6, -18.5], [-3.2, -15.5]], '#c9b38c', 1.5);
    }

    const handX = carry > 0 ? 5 : working ? 5 + pose.effort * 1.6 : soldier ? 4 + pose.attack * 3 : 4.5 - swing * 0.5;
    const handY = carry > 0 ? -10 : working ? -13 + pose.effort * 3 : soldier ? -10 - pose.attack * 3 : -9;
    limb([[2.7, -14], [4.2, -11.5], [handX, handY]], soldier ? '#9babad' : skin, 2);
    if (soldier) {
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(-0.3 + pose.attack * 1.7);
      limb([[0, 1], [0, -11]], '#ccd9dc', 1.7);
      limb([[-2, -1], [2, -1]], '#d8b571', 1.2);
      ctx.restore();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#cfbe93';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-7, -15); ctx.lineTo(-2.5, -14);
      ctx.lineTo(-2, -8); ctx.quadraticCurveTo(-3, -5, -4.5, -4.5);
      ctx.quadraticCurveTo(-7.5, -7, -7, -15);
      ctx.fill(); ctx.stroke();
      limb([[-4.5, -13], [-4.5, -7]], '#e4d4b3', 0.8);
    } else if (archer) {
      const pull = pose.activity === 'attack' ? 2.5 * (1 - pose.attack) : 0;
      ctx.strokeStyle = '#c59c60'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(5, -20); ctx.quadraticCurveTo(12, -13, 5, -5); ctx.stroke();
      ctx.strokeStyle = '#e5d8b6'; ctx.lineWidth = 0.65;
      ctx.beginPath(); ctx.moveTo(5, -20); ctx.lineTo(5 - pull, -12); ctx.lineTo(5, -5); ctx.stroke();
      if (pose.activity === 'attack') limb([[5 - pull, -12], [11, -12]], '#d4c1a0', 0.8);
    } else if (working && carry <= 0 && pose.activity !== 'harvest') {
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(-0.6 + pose.effort * 0.75);
      limb([[0, 2], [0, -8]], '#946b3d', 1.2);
      if (pose.activity === 'work' && resource === 'wood') {
        ctx.fillStyle = '#b3bdbb'; ctx.strokeStyle = '#65716c'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(-0.5, -9); ctx.lineTo(4, -10);
        ctx.quadraticCurveTo(6, -7, 3.5, -4.5); ctx.lineTo(-0.5, -6); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        limb([[-3, -7.5], [3.5, -7.5]], '#b3bdbb', pose.activity === 'build' ? 2.5 : 1.7);
      }
      ctx.restore();
    } else if (pose.activity === 'harvest') {
      limb([[2.7, -14], [4, -18 - pose.effort * 2]], skin, 1.8);
    }
    if (carry > 0) {
      ctx.fillStyle = '#967044'; ctx.strokeStyle = '#59412b'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(2.5, -12); ctx.lineTo(10, -12); ctx.lineTo(9, -7); ctx.lineTo(3, -7); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = { wood: '#bb9365', stone: '#c4b8a0', food: '#b94f3b', iron: '#8a9394' }[resource] || '#cfb88b';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(4 + i * 2, -12.5 - (i % 2), 1.8, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      limb([[3, -9], [9, -9]], '#c6a26b', 0.6);
    }
    ctx.restore();

    if (u.fleeing) {
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('!', 0, -32);
    }

    // Zdravotní pruh.
    if (u.hp < u.maxHp - 0.5 || selected) {
      const ratio = clamp(u.hp / u.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(15, 10, 5, 0.8)';
      ctx.fillRect(-9, -31, 18, 4);
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(-9, -30.5, 18 * ratio, 3);
    }

    ctx.restore();
  }

  drawWorkLinks(ctx, ui, camera) {
    if (!this.session || this.session.local !== true) return;
    if (camera.zoom < 0.55) return;
    for (const u of this.session.state.units) {
      if (u.ownerId !== this.session.selfId) continue;
      if (!u.work || !u.work.source) continue;
      if (!this.isVisible(u.x, u.y)) continue;
      const src = u.work.source;
      const a = tileToScreen(u.x, u.y);
      const b = tileToScreen(src.sx + 0.5, src.sy + 0.5);
      const selected = ui.selectedIds && ui.selectedIds.has(u.id);
      ctx.strokeStyle = selected ? 'rgba(253, 230, 138, 0.45)' : 'rgba(253, 230, 138, 0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 6);
      ctx.lineTo(b.x, b.y - 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(253, 230, 138, 0.5)';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

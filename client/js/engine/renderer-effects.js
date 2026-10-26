import { HALF_TILE_WIDTH, HALF_TILE_HEIGHT, tileToScreen } from './isometric.js';

const RESOURCE_ICONS = { wood: '🪵', stone: '🪨', food: '🍎', iron: '⛓️', money: '🪙' };
const RESOURCE_TEXT_COLORS = {
  wood: '#facc15', stone: '#f1d3a0', food: '#fda4af', iron: '#cbd5e1', money: '#fde047'
};

export class RendererEffects {
  campfirePos(castle) {
    return { x: castle.tileX + 1.5, y: castle.tileY + 3.75 };
  }

  drawCampfire(ctx, tx, ty) {
    const sx = (tx - ty) * HALF_TILE_WIDTH;
    const sy = (tx + ty) * HALF_TILE_HEIGHT;
    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = 'rgba(40, 20, 6, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kameny kolem ohně.
    ctx.fillStyle = '#7c6649';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 11, Math.sin(a) * 5.5, 3.2, 2.2, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Polena.
    ctx.strokeStyle = '#58351a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 2); ctx.lineTo(7, -2);
    ctx.moveTo(-6, -2); ctx.lineTo(7, 2);
    ctx.stroke();

    // Plamen.
    const flick = Math.sin(this.time * 11) * 0.15 + 1;
    const glow = ctx.createRadialGradient(0, -8, 2, 0, -6, 28);
    glow.addColorStop(0, 'rgba(255, 190, 70, 0.35)');
    glow.addColorStop(1, 'rgba(255, 130, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -7, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-5, -1);
    ctx.quadraticCurveTo(-4, -14 * flick, 0, -19 * flick);
    ctx.quadraticCurveTo(5, -12 * flick, 4, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(-2.4, -1);
    ctx.quadraticCurveTo(-1.5, -8 * flick, 0.5, -11 * flick);
    ctx.quadraticCurveTo(2.5, -7 * flick, 2, -1);
    ctx.closePath();
    ctx.fill();

    // Jiskry.
    const spark = (this.time * 13) % 11;
    ctx.fillStyle = 'rgba(255, 210, 120, 0.8)';
    ctx.beginPath();
    ctx.arc(Math.sin(this.time * 3) * 5, -12 - spark, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawProjectiles(ctx) {
    for (const a of this.session.state.projectiles) {
      if (!this.isVisible(a.x, a.y)) continue;
      const pos = tileToScreen(a.x, a.y);
      const arc = a.arc || 0;
      const target = tileToScreen(a.tx, a.ty);
      const angle = Math.atan2(target.y - pos.y, target.x - pos.x);
      ctx.save();
      ctx.translate(pos.x, pos.y - arc);
      ctx.rotate(angle);
      ctx.strokeStyle = '#d6b17a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(4, -2.6);
      ctx.lineTo(4, 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(-5, -3);
      ctx.moveTo(-8, 0); ctx.lineTo(-5, 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  addEffect(type, x, y, opts = {}) {
    this.effects.push({
      type, x, y, life: opts.life || 0.45, maxLife: opts.life || 0.45,
      color: opts.color || '#fde047', size: opts.size || 1
    });
    if (this.effects.length > 80) this.effects.splice(0, 20);
  }

  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color, life: 1.5, maxLife: 1.5 });
    if (this.texts.length > 40) this.texts.shift();
  }

  handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'gather':
          this.addText(ev.x, ev.y - 1.5, `+${ev.amount} ${RESOURCE_ICONS[ev.resource] || ''}`,
            RESOURCE_TEXT_COLORS[ev.resource] || '#fde047');
          break;
        case 'trained':
          this.addEffect('ring', ev.x, ev.y, { color: '#93c5fd', life: 0.6, size: 1.2 });
          break;
        case 'hit':
          this.addEffect('hit', ev.x, ev.y, { color: ev.ranged ? '#fde68a' : '#fca5a5', life: 0.35 });
          break;
        case 'miss':
          this.addEffect('miss', ev.x, ev.y, { color: '#d6c3a1', life: 0.4 });
          break;
        case 'buildingComplete':
          this.addEffect('ring', ev.x, ev.y, { color: '#86efac', life: 0.9, size: 1.6 });
          break;
        case 'buildingDestroyed':
          this.addEffect('rubble', ev.x, ev.y, { color: '#b9a086', life: 1.1, size: 1.8 });
          break;
        case 'unitDied':
          this.addEffect('miss', ev.x, ev.y, { color: '#c98c7d', life: 0.5 });
          break;
        case 'depositFound':
          this.addEffect('ring', ev.x, ev.y, { color: '#fbbf24', life: 1.3, size: 2.4 });
          this.addText(ev.x, ev.y - 2, 'Nové ložisko!', '#fde047');
          break;
        case 'depositDepleted':
          this.addEffect('ring', ev.x, ev.y, { color: '#a8a29e', life: 0.8, size: 1.4 });
          break;
        case 'citizen':
          this.addEffect('ring', ev.x || 0, ev.y || 0, { color: '#fdba74', life: 0.4 });
          break;
      }
    }
  }

  updateEffects(dt) {
    dt = Math.max(0, Math.min(dt, 0.1));
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].life -= dt;
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
    }
  }

  drawEffects(ctx) {
    for (const e of this.effects) {
      const t = 1 - e.life / e.maxLife;
      const pos = tileToScreen(e.x, e.y);
      const alpha = Math.max(0, 1 - t);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (e.type === 'hit') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + e.x;
          const r = 4 + t * 10;
          ctx.beginPath();
          ctx.moveTo(pos.x + Math.cos(a) * 2, pos.y - 8 + Math.sin(a) * 2);
          ctx.lineTo(pos.x + Math.cos(a) * r, pos.y - 8 + Math.sin(a) * r);
          ctx.stroke();
        }
      } else if (e.type === 'miss') {
        ctx.fillStyle = e.color;
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + e.y;
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(a) * t * 9, pos.y - 4 + Math.sin(a) * t * 5, 2.4 * (1 - t) + 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'ring') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 8 + t * 26 * e.size, (8 + t * 26 * e.size) * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'rubble') {
        ctx.fillStyle = e.color;
        for (let i = 0; i < 7; i++) {
          const a = i * 1.7;
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(a) * t * 20, pos.y - 4 + Math.sin(a) * t * 10 - t * 6, 2.6 * (1 - t) + 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  drawTexts(ctx) {
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const pos = tileToScreen(t.x, t.y);
      const age = 1 - t.life / t.maxLife;
      const alpha = Math.min(1, t.life / 0.4);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(20, 12, 5, 0.75)';
      ctx.fillText(t.text, pos.x + 1, pos.y - 10 - age * 22 + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, pos.x, pos.y - 10 - age * 22);
    }
    ctx.globalAlpha = 1;
  }
}

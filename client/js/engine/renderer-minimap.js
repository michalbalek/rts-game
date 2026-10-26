import { worldToTile } from './isometric.js';
import { TILE_TYPES, RESOURCE_TYPES, ENEMY_BUILD_DISTANCE } from '../sim/constants.js';

/**
 * Jemné rozostření minimapy. Samostatné pixely stromů a kamení by jinak
 * vypadaly jako šum a terénní skvrny by měly ostré hrany.
 */
function softenMinimap(data, size) {
  const src = new Uint8ClampedArray(data);
  const row = size * 4;
  for (let y = 0; y < size; y++) {
    const y0 = y > 0 ? y - 1 : y;
    const y1 = y < size - 1 ? y + 1 : y;
    for (let x = 0; x < size; x++) {
      const x0 = x > 0 ? x - 1 : x;
      const x1 = x < size - 1 ? x + 1 : x;
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy <= y1; yy++) {
        const base = yy * row;
        for (let xx = x0; xx <= x1; xx++) {
          const o = base + xx * 4;
          r += src[o]; g += src[o + 1]; b += src[o + 2];
          n++;
        }
      }
      const o = y * row + x * 4;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
    }
  }
}

export class RendererMinimap {
  renderMinimap(dt, camera, ui) {
    if (!this.minimapCtx || !this.map) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const size = this.map.size;
    const scale = w / size;

    this.minimapFogTimer -= dt;
    const mapSeq = this.session.sim ? this.session.sim.mapChangeSeq : (this.session.mapCursor || 0);
    if (mapSeq !== this.cachedMapSeq || this.minimapBase.width !== size) {
      this.cachedMapSeq = mapSeq;
      this.renderMinimapBase();
    }

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.minimapBase, 0, 0, w, h);

    // Jemné ztmavení okrajů, aby mapa nepůsobila jako surový výřez.
    if (!this.minimapGrad || this.minimapGradSize !== w) {
      const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.32, w / 2, h / 2, w * 0.72);
      grad.addColorStop(0, 'rgba(30, 18, 8, 0)');
      grad.addColorStop(1, 'rgba(30, 18, 8, 0.26)');
      this.minimapGrad = grad;
      this.minimapGradSize = w;
    }
    ctx.fillStyle = this.minimapGrad;
    ctx.fillRect(0, 0, w, h);

    if (this.session.state.fogEnabled) {
      if (this.minimapFogTimer <= 0) {
        this.minimapFogTimer = 0.25;
        this.renderMinimapFog();
      }
      ctx.drawImage(this.minimapFog, 0, 0, w, h);
    }

    if (ui && ui.buildMode) this.drawMinimapBuildZone(ctx, scale);

    // Budovy – hrad jako barevný kosočtverec se světlým středem, ostatní
    // jako drobné pevnosti.
    for (const b of this.session.state.buildings) {
      if (b.ownerId !== 0 && b.ownerId !== this.session.selfId && !this.isVisible(b.centerX, b.centerY)) continue;
      const color = b.ownerId === 0 ? '#8f8f86' : this.ownerColor(b.ownerId);
      const cx = (b.tileX + (b.width || 1) / 2) * scale;
      const cy = (b.tileY + (b.height || 1) / 2) * scale;
      if (b.type === 'castle') {
        const r = Math.max(3.8, Math.min(b.width || 4, b.height || 4) * scale * 0.62);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(24, 15, 6, 0.9)';
        ctx.lineWidth = 1.1;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.restore();
        ctx.fillStyle = '#fff6df';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const s = Math.max(3, Math.min(b.width || 1, b.height || 1) * scale);
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(24, 15, 6, 0.8)';
        ctx.lineWidth = 1;
        ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
        ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      }
    }

    // Jednotky – malé barevné tečky, vybrané dostanou světlý kroužek.
    for (const u of this.session.state.units) {
      if (u.ownerId !== this.session.selfId && !this.isVisible(u.x, u.y)) continue;
      const x = u.x * scale;
      const y = u.y * scale;
      const selected = !!(ui && ui.selectedIds && ui.selectedIds.has(u.id));
      ctx.beginPath();
      ctx.arc(x, y, selected ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = this.ownerColor(u.ownerId);
      ctx.fill();
      ctx.strokeStyle = selected ? 'rgba(255, 250, 235, 0.95)' : 'rgba(20, 12, 5, 0.7)';
      ctx.lineWidth = selected ? 1.2 : 0.7;
      ctx.stroke();
    }

    // Výřez kamery – jemný zlatý kosočtverec s tmavým podkresem.
    const corners = [
      camera.screenToWorld(0, 0),
      camera.screenToWorld(this.viewWidth, 0),
      camera.screenToWorld(this.viewWidth, this.viewHeight),
      camera.screenToWorld(0, this.viewHeight)
    ].map(p => {
      const t = worldToTile(p.x, p.y);
      return { x: t.x * scale, y: t.y * scale };
    });
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 240, 205, 0.07)';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(24, 15, 6, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.95)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Rámeček.
    ctx.strokeStyle = 'rgba(240, 192, 90, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  drawMinimapBuildZone(ctx, scale) {
    const r = ENEMY_BUILD_DISTANCE * scale;
    const isEnemy = ownerId => ownerId !== 0 && ownerId !== this.session.selfId;
    ctx.beginPath();
    for (const b of this.session.state.buildings) {
      if (!isEnemy(b.ownerId) || !this.isVisible(b.centerX, b.centerY)) continue;
      const x = b.tileX * scale;
      const y = b.tileY * scale;
      const w = (b.width || 1) * scale;
      const h = (b.height || 1) * scale;
      ctx.rect(x - r, y, w + 2 * r, h);
      ctx.rect(x, y - r, w, h + 2 * r);
      for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    for (const u of this.session.state.units) {
      if (!isEnemy(u.ownerId) || !this.isVisible(u.x, u.y)) continue;
      ctx.moveTo((u.x * scale) + r, u.y * scale);
      ctx.arc(u.x * scale, u.y * scale, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(226, 72, 58, 0.26)';
    ctx.fill();
  }

  renderMinimapBase() {
    const ctx = this.minimapBaseCtx;
    const size = this.map.size;
    if (this.minimapBase.width !== size) {
      this.minimapBase.width = size;
      this.minimapBase.height = size;
    }
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let i = 0; i < size * size; i++) {
      const tile = this.map.tiles[i];
      let r, g, b;
      // Paleta vychází z barev terénu ve světě, jen o pár stupňů ztlumená –
      // minimapa tak ladí s okolní krajinou a přitom zůstává čitelná.
      switch (tile) {
        case TILE_TYPES.WATER_DEEP: r = 34; g = 101; b = 118; break;
        case TILE_TYPES.WATER_SHALLOW: r = 66; g = 142; b = 150; break;
        case TILE_TYPES.GRASS: r = 92; g = 124; b = 70; break;
        case TILE_TYPES.DUNE: r = 201; g = 165; b = 107; break;
        case TILE_TYPES.CLAY: r = 194; g = 156; b = 102; break;
        case TILE_TYPES.ROCK: r = 186; g = 150; b = 103; break;
        default: r = 206; g = 172; b = 116;
      }

      // Suroviny jen jemně tónují podklad; plná barva pro každou dlaždici
      // vytvářela na minimapě nepříjemný šum.
      const res = this.map.resources[i];
      if (res === RESOURCE_TYPES.TREE) {
        r = r * 0.58 + 52 * 0.42;
        g = g * 0.58 + 92 * 0.42;
        b = b * 0.58 + 48 * 0.42;
      } else if (res === RESOURCE_TYPES.STONE) {
        r = r * 0.7 + 178 * 0.3;
        g = g * 0.7 + 158 * 0.3;
        b = b * 0.7 + 128 * 0.3;
      } else if (res === RESOURCE_TYPES.IRON) {
        r = r * 0.7 + 124 * 0.3;
        g = g * 0.7 + 116 * 0.3;
        b = b * 0.7 + 112 * 0.3;
      }

      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    softenMinimap(data, size);
    ctx.putImageData(img, 0, 0);
  }

  renderMinimapFog() {
    const fog = this.session.getFog && this.session.getFog();
    if (!fog || !fog.visible) return;
    const size = this.map.size;
    if (this.minimapFog.width !== size) {
      this.minimapFog.width = size;
      this.minimapFog.height = size;
    }
    const ctx = this.minimapFogCtx;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let i = 0; i < size * size; i++) {
      const o = i * 4;
      data[o] = 8;
      data[o + 1] = 6;
      data[o + 2] = 3;
      data[o + 3] = fog.visible[i] ? 0 : (fog.explored[i] ? 150 : 255);
    }
    ctx.putImageData(img, 0, 0);
  }
}

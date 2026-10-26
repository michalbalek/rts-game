import { tileToScreen, buildingShadow } from './isometric.js';
import { BUILDING_DEFS } from '../sim/constants.js';
import { BUILDING_TOP } from './renderer-building-status.js';

export class RendererBuildings {
  drawBuildingsGround(ctx, bounds, ui) {
    if (!this.session || !this.session.state || !this.session.state.buildings) return;
    for (const b of this.session.state.buildings) {
      if (!this.entityVisible(b)) continue;
      if (!this.inBounds(b.centerX, b.centerY, bounds, 8)) continue;

      const pos = tileToScreen(b.tileX, b.tileY);
      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Kontaktní stín pod budovou – sedí přímo na terénu pod jednotkami.
      const shadow = buildingShadow(b.width, b.height);
      ctx.save();
      ctx.translate(shadow.cx, shadow.cy);
      ctx.scale(shadow.rx, shadow.ry);
      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      shadowGrad.addColorStop(0, 'rgba(44, 28, 11, 0.24)');
      shadowGrad.addColorStop(0.68, 'rgba(44, 28, 11, 0.2)');
      shadowGrad.addColorStop(0.9, 'rgba(44, 28, 11, 0.07)');
      shadowGrad.addColorStop(1, 'rgba(44, 28, 11, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const selected = ui.selectedBuilding && ui.selectedBuilding.id === b.id;
      const hovered = ui.hoverEntity && ui.hoverEntity.entity && ui.hoverEntity.entity.id === b.id;
      if (selected) {
        this.drawFootprint(ctx, b.width, b.height, 'rgba(240, 192, 90, 0.2)', '#f0c05a', 2.4);
      } else if (hovered) {
        this.drawFootprint(ctx, b.width, b.height, 'rgba(255, 235, 180, 0.07)', 'rgba(255, 235, 180, 0.5)', 1.4);
      }
      ctx.restore();

      // Pokud je to otevřená plocha (jablečný sad), vykreslí se travnatý podklad na úrovni terénu.
      if (b.type === 'orchard') {
        this.drawOrchardGround(ctx, b);
      }
    }
  }

  drawBuildingOverlay(ctx, b, ui) {
    const def = b.config || BUILDING_DEFS[b.type];
    if (!def) return;
    const selected = ui.selectedBuilding && ui.selectedBuilding.id === b.id;
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      this.drawScaffolding(ctx, b);
      this.drawConstructionBar(ctx, b, def);
    } else {
      this.drawOwnerFlag(ctx, b, def);
      this.drawBuildingStatus(ctx, b, def, selected);
    }
    ctx.restore();
  }

  drawBuilding(ctx, b, ui, camera, includeGround = false) {
    const def = b.config || BUILDING_DEFS[b.type];
    if (!def) return;
    const selected = ui.selectedBuilding && ui.selectedBuilding.id === b.id;
    const hovered = ui.hoverEntity && ui.hoverEntity.entity && ui.hoverEntity.entity.id === b.id;

    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);

    if (includeGround) {
      const shadow = buildingShadow(b.width, b.height);
      ctx.save();
      ctx.translate(shadow.cx, shadow.cy);
      ctx.scale(shadow.rx, shadow.ry);
      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      shadowGrad.addColorStop(0, 'rgba(44, 28, 11, 0.24)');
      shadowGrad.addColorStop(0.68, 'rgba(44, 28, 11, 0.2)');
      shadowGrad.addColorStop(0.9, 'rgba(44, 28, 11, 0.07)');
      shadowGrad.addColorStop(1, 'rgba(44, 28, 11, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (selected) {
        this.drawFootprint(ctx, b.width, b.height, 'rgba(240, 192, 90, 0.2)', '#f0c05a', 2.4);
      } else if (hovered) {
        this.drawFootprint(ctx, b.width, b.height, 'rgba(255, 235, 180, 0.07)', 'rgba(255, 235, 180, 0.5)', 1.4);
      }
    }

    ctx.save();
    if (!b.complete) {
      const level = Math.max(2, b.progress * ((BUILDING_TOP[b.type] || 34) + 16));
      const points = [
        this.isoPoint(0, 0, level), this.isoPoint(b.width, 0, level),
        this.isoPoint(b.width, 0, -16), this.isoPoint(b.width, b.height, -16),
        this.isoPoint(0, b.height, -16), this.isoPoint(0, b.height, level)
      ];
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.clip();
    }
    this.drawBuildingStructure(ctx, b, def);
    ctx.restore();

    if (!b.complete) {
      this.drawScaffolding(ctx, b);
      this.drawConstructionBar(ctx, b, def);
    } else {
      this.drawOwnerFlag(ctx, b, def);
      this.drawBuildingStatus(ctx, b, def, selected);
    }

    ctx.restore();
  }

  drawFootprint(ctx, w, h, fill, stroke, lw) {
    const pts = [
      this.isoPoint(0, 0), this.isoPoint(w, 0), this.isoPoint(w, h), this.isoPoint(0, h)
    ];
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawBuildingStructure(ctx, b, def) {
    const w = b.width;
    const h = b.height;
    switch (b.type) {
      case 'castle': this.drawCastle(ctx, w, h); break;
      case 'barracks': this.drawBarracks(ctx, w, h); break;
      case 'lumberjack': this.drawLumberjack(ctx, w, h, b); break;
      case 'quarry': this.drawQuarry(ctx, w, h); break;
      case 'orchard': this.drawOrchard(ctx, w, h); break;
      case 'market': this.drawMarket(ctx, w, h); break;
      case 'dwelling': this.drawDwelling(ctx, w, h, b); break;
      case 'granary': this.drawGranary(ctx, w, h); break;
      case 'warehouse': this.drawWarehouse(ctx, w, h); break;
      case 'ironmine': this.drawIronMine(ctx, w, h); break;
      default:
        this.isoBox(ctx, 0, 0, w, h, 0, 18, {}, null);
    }
  }
}

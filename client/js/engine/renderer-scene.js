import { worldToTile, clamp } from './isometric.js';
import { visibleTileRows } from './viewport.js';
import { rotateBuildingPoint } from '../sim/building-orientation.js';

export class RendererScene {
  render(dt, camera, ui = {}) {
    if (!this.session || !this.map) return;
    this.time += Math.min(dt, 0.1);
    this.zoom = camera.zoom;
    this.fogMaskTimer -= dt;
    this.updateEffects(dt);

    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    // Atmosférické pozadí mimo mapu.
    if (!this.background || this.backgroundHeight !== this.viewHeight) {
      const bg = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
      bg.addColorStop(0, '#8a6636');
      bg.addColorStop(0.55, '#b48950');
      bg.addColorStop(1, '#75512a');
      this.background = bg;
      this.backgroundHeight = this.viewHeight;
    }
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    ctx.save();
    camera.applyTransform(ctx);

    const bounds = this.getVisibleBounds(camera);
    const rows = this.getVisibleRows(camera);
    this.drawTerrain(ctx, rows, camera);
    this.drawResources(ctx, rows);
    this.drawBuildingsGround(ctx, bounds, ui);

    const renderList = [];
    const towers = new Map();
    for (const b of this.session.state.buildings) {
      if (b.type === 'tower') towers.set(b.id, b);
      if (!this.entityVisible(b)) continue;
      if (!this.inBounds(b.centerX, b.centerY, bounds, 8)) continue;

      if (b.type === 'orchard') {
        // Otevřená budova: jabloně a košík se řadí samostatně podle izometrické hloubky.
        // Travnatý podklad se kreslí na úrovni terénu (drawBuildingsGround), takže dělníci
        // chodí po trávě a nikdy pod texturou sadu.
        for (let gy = 0; gy < 3; gy++) {
          for (let gx = 0; gx < 3; gx++) {
            const u = 0.62 + gx * 1.16;
            const v = 0.62 + gy * 1.16;
            const point = rotateBuildingPoint(u, v, 4, 4, b.rotation || 0);
            renderList.push({
              kind: 'orchard_tree',
              entity: b,
              gx, gy, u, v,
              depth: b.tileX + b.tileY + point.u + point.v
            });
          }
        }
        const basket = rotateBuildingPoint(0.4, 4 - 0.55, 4, 4, b.rotation || 0);
        renderList.push({
          kind: 'orchard_basket',
          entity: b,
          depth: b.tileX + b.tileY + basket.u + basket.v
        });
        renderList.push({
          kind: 'building_overlay',
          entity: b,
          depth: b.tileX + b.tileY + b.width + b.height + 0.5
        });
      } else {
        // Uzavřená budova: hloubka přední stěny. Postavy procházející před budovou (jižně/východně)
        // se kreslí před budovou, postavy za budovou jsou přirozeně cloněny jejími stěnami.
        renderList.push({
          kind: b.type === 'castle' ? 'castle' : 'building',
          entity: b,
          depth: b.tileX + b.tileY + Math.max(b.width, b.height)
        });
      }

      if (b.type === 'castle') {
        const fire = this.campfirePos(b);
        renderList.push({ kind: 'campfire', x: fire.x, y: fire.y, depth: fire.x + fire.y - 0.2 });
      }
    }
    for (const u of this.session.state.units) {
      if (!this.entityVisible(u)) continue;
      if (!this.inBounds(u.x, u.y, bounds, 3)) continue;
      const tower = u.garrison?.entered && towers.get(u.garrison.towerId);
      renderList.push({ kind: 'unit', entity: u, depth: tower
        ? tower.tileX + tower.tileY + Math.max(tower.width, tower.height) + 0.1
        : u.x + u.y + 0.35 });
    }
    renderList.sort((a, b) => a.depth - b.depth);

    for (const item of renderList) {
      if (item.kind === 'building' || item.kind === 'castle') {
        this.drawBuilding(ctx, item.entity, ui, camera);
      } else if (item.kind === 'unit') {
        ctx.save();
        if (item.entity.garrison?.entered) ctx.translate(0, -60);
        this.drawUnit(ctx, item.entity, ui, camera);
        ctx.restore();
      } else if (item.kind === 'campfire') {
        this.drawCampfire(ctx, item.x, item.y);
      } else if (item.kind === 'orchard_tree') {
        this.withBuildingRotation(item.entity, () => this.drawOrchardTree(ctx, item.entity, item.gx, item.gy, item.u, item.v));
      } else if (item.kind === 'orchard_basket') {
        this.withBuildingRotation(item.entity, () => this.drawOrchardBasket(ctx, item.entity));
      } else if (item.kind === 'building_overlay') {
        this.drawBuildingOverlay(ctx, item.entity, ui);
      }
    }

    this.drawProjectiles(ctx);
    this.drawEffects(ctx);
    this.drawTexts(ctx);
    this.drawFog(ctx, rows);
    this.drawBuildGhost(ctx, ui);
    this.drawHover(ctx, ui);
    this.drawWorkLinks(ctx, ui, camera);
    ctx.restore();

    this.drawSelectionRect(ctx, ui.dragRect);
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    this.renderMinimap(dt, camera, ui);
  }

  getVisibleBounds(camera) {
    const corners = [
      [0, 0], [this.viewWidth, 0], [0, this.viewHeight], [this.viewWidth, this.viewHeight]
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [sx, sy] of corners) {
      const w = camera.screenToWorld(sx, sy);
      const t = worldToTile(w.x, w.y);
      minX = Math.min(minX, t.x);
      maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y);
      maxY = Math.max(maxY, t.y);
    }
    const size = this.map.size;
    return {
      minX: clamp(Math.floor(minX) - 3, 0, size - 1),
      maxX: clamp(Math.ceil(maxX) + 3, 0, size),
      minY: clamp(Math.floor(minY) - 3, 0, size - 1),
      maxY: clamp(Math.ceil(maxY) + 3, 0, size)
    };
  }

  inBounds(x, y, bounds, pad = 0) {
    return x >= bounds.minX - pad && x <= bounds.maxX + pad &&
           y >= bounds.minY - pad && y <= bounds.maxY + pad;
  }

  /**
   * The isometric viewport covers a diamond in tile space. Row ranges avoid
   * drawing the extra tiles included by its rectangular bounding box.
   */
  getVisibleRows(camera, pad = 3) {
    const a = camera.screenToWorld(0, 0);
    const b = camera.screenToWorld(this.viewWidth, this.viewHeight);
    return visibleTileRows(a.x, a.y, b.x, b.y, this.map.size, pad);
  }
}

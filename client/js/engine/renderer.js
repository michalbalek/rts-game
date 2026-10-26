import {
  HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT,
  tileToScreen, worldToTile, clamp, buildingShadow
} from './isometric.js';
import { visibleTileRows } from './viewport.js';
import {
  TILE_TYPES, RESOURCE_TYPES, BUILDING_DEFS, PLAYER_COLORS,
  ENEMY_BUILD_DISTANCE
} from '../sim/constants.js';

const TILE_COLORS = {
  [TILE_TYPES.SAND]: '#d8b171',
  [TILE_TYPES.DUNE]: '#cba05f',
  [TILE_TYPES.CLAY]: '#b88c53',
  [TILE_TYPES.GRASS]: '#4f7d38',
  [TILE_TYPES.WATER_DEEP]: '#1d6276',
  [TILE_TYPES.WATER_SHALLOW]: '#3d929e',
  [TILE_TYPES.ROCK]: '#a1815a'
};

const BUILDING_TOP = {
  castle: 72, barracks: 38, lumberjack: 30, quarry: 42, orchard: 16,
  market: 30, dwelling: 34, granary: 58, warehouse: 38, ironmine: 34
};

const RESOURCE_ICONS = { wood: '🪵', stone: '🪨', food: '🍎', iron: '⛓️', money: '🪙' };
const RESOURCE_TEXT_COLORS = {
  wood: '#facc15', stone: '#f1d3a0', food: '#fda4af', iron: '#cbd5e1', money: '#fde047'
};

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

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

/**
 * Vykreslovač izometrického světa, mlhy války a minimapy.
 * Pracuje se stavem ze session (local i remote), takže je stejný pro
 * singleplayer i multiplayer.
 */
export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    this.session = null;
    this.map = null;
    this.time = 0;
    this.zoom = 1;
    this.quality = 'high';
    this.viewWidth = 0;
    this.viewHeight = 0;
    this.dpr = 1;

    this.effects = [];
    this.texts = [];

    this.minimapBase = document.createElement('canvas');
    this.minimapBaseCtx = this.minimapBase.getContext('2d');
    this.minimapFog = document.createElement('canvas');
    this.minimapFogCtx = this.minimapFog.getContext('2d');
    this.fogMask = document.createElement('canvas');
    this.fogMaskCtx = this.fogMask.getContext('2d');
    this.fogMaskTimer = 0;
    this.minimapFogTimer = 0;
    this.minimapGrad = null;
    this.minimapGradSize = 0;
    this.cachedMapSeq = -1;
    this.terrainDirty = true;

    this.vignette = null;
    this.resize();
  }

  setSession(session) {
    this.session = session;
    this.map = session.state.map || session.map;
    this.effects.length = 0;
    this.texts.length = 0;
    this.minimapFogTimer = 0;
    this.fogMaskTimer = 0;
    this.cachedMapSeq = -1;
    this.terrainDirty = true;
    const size = this.map ? this.map.size : 200;
    this.minimapBase.width = size;
    this.minimapBase.height = size;
    this.minimapFog.width = size;
    this.minimapFog.height = size;
    this.fogMask.width = size;
    this.fogMask.height = size;
  }

  setQuality(quality) {
    this.quality = quality || 'high';
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewWidth = w;
    this.viewHeight = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));

    const grad = this.ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.72
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(12,7,3,0.5)');
    this.vignette = grad;
  }

  getTileAt(camera, screenX, screenY) {
    const world = camera.screenToWorld(screenX, screenY);
    const t = worldToTile(world.x, world.y);
    return { x: Math.floor(t.x), y: Math.floor(t.y) };
  }

  ownerColor(ownerId) {
    if (!ownerId) return '#9a9a92';
    return PLAYER_COLORS[(ownerId - 1) % PLAYER_COLORS.length];
  }

  isVisible(x, y) {
    return !this.session || this.session.isVisibleAt(x, y);
  }

  isExplored(x, y) {
    return !this.session || this.session.isExploredAt(x, y);
  }

  entityVisible(entity) {
    if (!this.session) return false;
    if (entity.ownerId === 0 || entity.ownerId === this.session.selfId) return true;
    const x = entity.width !== undefined ? entity.centerX : entity.x;
    const y = entity.width !== undefined ? entity.centerY : entity.y;
    return this.isVisible(x, y);
  }

  // ------------------------------------------------------------------
  //  Hlavní vykreslení
  // ------------------------------------------------------------------

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
    const bg = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    bg.addColorStop(0, '#8a6636');
    bg.addColorStop(0.55, '#b48950');
    bg.addColorStop(1, '#75512a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    ctx.save();
    camera.applyTransform(ctx);

    const bounds = this.getVisibleBounds(camera);
    const rows = this.getVisibleRows(camera);
    this.drawTerrain(ctx, rows);
    this.drawResources(ctx, rows);
    this.drawBuildingsGround(ctx, bounds, ui);

    const renderList = [];
    for (const b of this.session.state.buildings) {
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
            renderList.push({
              kind: 'orchard_tree',
              entity: b,
              gx, gy, u, v,
              depth: b.tileX + b.tileY + u + v
            });
          }
        }
        renderList.push({
          kind: 'orchard_basket',
          entity: b,
          depth: b.tileX + b.tileY + 0.4 + b.height - 0.55
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
      renderList.push({ kind: 'unit', entity: u, depth: u.x + u.y + 0.35 });
    }
    renderList.sort((a, b) => a.depth - b.depth);

    for (const item of renderList) {
      if (item.kind === 'building' || item.kind === 'castle') {
        this.drawBuilding(ctx, item.entity, ui, camera);
      } else if (item.kind === 'unit') {
        this.drawUnit(ctx, item.entity, ui, camera);
      } else if (item.kind === 'campfire') {
        this.drawCampfire(ctx, item.x, item.y);
      } else if (item.kind === 'orchard_tree') {
        this.drawOrchardTree(ctx, item.entity, item.gx, item.gy, item.u, item.v);
      } else if (item.kind === 'orchard_basket') {
        this.drawOrchardBasket(ctx, item.entity);
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
   * Viditelná oblast v dlaždicových souřadnicích rozdělená na řádky.
   * Obrazovka se do izometrické mřížky promítá jako kosočtverec, takže
   * obdélník kolem něj obsahuje zhruba dvakrát víc dlaždic, než je vidět.
   * Kreslení po řádcích se vyhne této zbytečné práci.
   */
  getVisibleRows(camera, pad = 3) {
    const a = camera.screenToWorld(0, 0);
    const b = camera.screenToWorld(this.viewWidth, this.viewHeight);
    return visibleTileRows(a.x, a.y, b.x, b.y, this.map.size, pad);
  }

  // ------------------------------------------------------------------
  //  Terén
  // ------------------------------------------------------------------

  drawTerrain(ctx, rows) {
    const map = this.map;
    const paths = new Map();
    const water = [];
    // Při oddálení nejsou jemné textury vidět – jejich kreslení jen zdržuje.
    const detail = this.quality !== 'low' && this.zoom >= 0.8;

    const sandDots = new Path2D();
    const duneLines = new Path2D();
    const clayCracks = new Path2D();
    const grassTufts = new Path2D();
    const rockStrata = new Path2D();
    const glints = new Path2D();

    for (const row of rows) {
      const y = row.y;
      for (let x = row.x0; x <= row.x1; x++) {
        const i = y * map.size + x;
        const type = map.tiles[i];
        let p = paths.get(type);
        if (!p) { p = new Path2D(); paths.set(type, p); }
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        p.moveTo(sx, sy);
        p.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        p.lineTo(sx, sy + TILE_HEIGHT);
        p.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        p.closePath();

        if (!detail) continue;
        const cx = sx;
        const cy = sy + HALF_TILE_HEIGHT;
        const h = hash(x, y);

        switch (type) {
          case TILE_TYPES.SAND:
            if (h < 0.12) {
              sandDots.moveTo(cx + (h - 0.5) * 30, cy + (hash(y, x) - 0.5) * 12);
              sandDots.arc(cx + (h - 0.5) * 30, cy + (hash(y, x) - 0.5) * 12, 1.1, 0, Math.PI * 2);
            }
            break;
          case TILE_TYPES.DUNE:
            if (h < 0.36) {
              duneLines.moveTo(cx - 20, cy + 3);
              duneLines.quadraticCurveTo(cx, cy - 5, cx + 20, cy + 3);
            }
            break;
          case TILE_TYPES.CLAY:
            if (h < 0.28) {
              const ox = (h - 0.5) * 20;
              clayCracks.moveTo(cx - 12 + ox, cy - 2);
              clayCracks.lineTo(cx - 2 + ox, cy + 3);
              clayCracks.lineTo(cx + 8 + ox, cy - 4);
              clayCracks.lineTo(cx + 14 + ox, cy + 2);
            }
            break;
          case TILE_TYPES.GRASS:
            if (h < 0.42) {
              const ox = (h - 0.5) * 34;
              const oy = (hash(y, x) - 0.5) * 12;
              grassTufts.moveTo(cx + ox, cy + oy + 3);
              grassTufts.lineTo(cx + ox - 2, cy + oy - 4);
              grassTufts.moveTo(cx + ox + 2, cy + oy + 3);
              grassTufts.lineTo(cx + ox + 4, cy + oy - 5);
              grassTufts.moveTo(cx + ox, cy + oy + 3);
              grassTufts.lineTo(cx + ox, cy + oy - 6);
            }
            break;
          case TILE_TYPES.ROCK:
            if (h < 0.5) {
              rockStrata.moveTo(cx - 19, cy - 3 + h * 8);
              rockStrata.quadraticCurveTo(cx, cy + 2 + h * 8, cx + 19, cy - 3 + h * 8);
            }
            break;
          case TILE_TYPES.WATER_DEEP:
          case TILE_TYPES.WATER_SHALLOW:
            if (h < 0.18) {
              glints.moveTo(cx - 8, cy);
              glints.quadraticCurveTo(cx - 2, cy - 3, cx + 6, cy);
            }
            if (type === TILE_TYPES.WATER_SHALLOW) water.push({ cx, cy, h });
            break;
        }
      }
    }

    for (const [type, path] of paths) {
      ctx.fillStyle = TILE_COLORS[type] || '#c9a05f';
      ctx.fill(path);
    }

    if (detail) {
      ctx.fillStyle = 'rgba(120, 83, 37, 0.22)';
      ctx.fill(sandDots);
      ctx.strokeStyle = 'rgba(150, 105, 52, 0.23)';
      ctx.lineWidth = 1.2;
      ctx.stroke(duneLines);
      ctx.strokeStyle = 'rgba(92, 61, 28, 0.23)';
      ctx.stroke(clayCracks);
      ctx.strokeStyle = 'rgba(43, 88, 31, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke(grassTufts);
      ctx.strokeStyle = 'rgba(96, 72, 44, 0.32)';
      ctx.stroke(rockStrata);

      ctx.strokeStyle = `rgba(210, 245, 255, ${0.14 + Math.sin(this.time * 1.8) * 0.07})`;
      ctx.lineWidth = 1.2;
      ctx.stroke(glints);

      // Vlnky na hladině – jen část dlaždic.
      ctx.strokeStyle = `rgba(220, 250, 255, ${0.1 + Math.sin(this.time * 1.4) * 0.04})`;
      const waves = new Path2D();
      for (const w of water) {
        if (w.h > 0.3) continue;
        const off = Math.sin(this.time * 2 + w.cx * 0.2) * 3;
        waves.moveTo(w.cx - 12, w.cy + off);
        waves.quadraticCurveTo(w.cx, w.cy - 2 + off, w.cx + 12, w.cy + off);
      }
      ctx.stroke(waves);
    }
  }

  // ------------------------------------------------------------------
  //  Přírodní zdroje
  // ------------------------------------------------------------------

  drawResources(ctx, rows) {
    const map = this.map;
    // Při oddálení kreslíme jen drobné značky – tisíce detailních stromů
    // by jinak zbytečně brzdily vykreslování.
    const simple = this.zoom < 0.7;
    for (const row of rows) {
      const y = row.y;
      for (let x = row.x0; x <= row.x1; x++) {
        const i = y * map.size + x;
        const res = map.resources[i];
        if (!res) continue;
        if (!this.isExplored(x, y)) continue;
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        if (simple) {
          this.drawResourceMarker(ctx, sx, sy, res, x, y);
        } else if (res === RESOURCE_TYPES.TREE) {
          this.drawTree(ctx, sx, sy, x, y);
        } else if (res === RESOURCE_TYPES.STONE) {
          this.drawOre(ctx, sx, sy, x, y, false);
        } else if (res === RESOURCE_TYPES.IRON) {
          this.drawOre(ctx, sx, sy, x, y, true);
        }
      }
    }
  }

  drawResourceMarker(ctx, sx, sy, res, tx, ty) {
    const h = hash(tx, ty);
    const ox = (h - 0.5) * 8;
    const oy = (hash(ty, tx) - 0.5) * 4;
    const x = sx + ox;
    const y = sy + HALF_TILE_HEIGHT + oy;
    if (res === RESOURCE_TYPES.TREE) {
      ctx.fillStyle = this.map.type === 'canyon' ? '#4f6f2a' : '#3f7a2d';
      ctx.beginPath();
      ctx.arc(x, y - 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const iron = res === RESOURCE_TYPES.IRON;
      ctx.fillStyle = iron ? '#6b6b72' : '#b58a53';
      ctx.beginPath();
      ctx.moveTo(x - 3.4, y);
      ctx.lineTo(x, y - 5.2);
      ctx.lineTo(x + 3.4, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTree(ctx, sx, sy, tx, ty) {
    const h = hash(tx, ty);
    const scale = 0.85 + h * 0.32;
    const sway = Math.sin(this.time * 1.7 + tx * 0.7 + ty * 0.3) * 1.6;
    const baseY = sy + HALF_TILE_HEIGHT;
    const palm = this.map.type !== 'canyon';

    ctx.save();
    ctx.translate(sx, baseY);

    // Stín
    ctx.fillStyle = 'rgba(48, 32, 14, 0.28)';
    ctx.beginPath();
    ctx.ellipse(4, 1, 13 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (palm) {
      ctx.strokeStyle = '#7c4a20';
      ctx.lineWidth = 3.4 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(3 * scale, -18 * scale, 1 * scale + sway, -32 * scale);
      ctx.stroke();

      const crownX = 1 * scale + sway;
      const crownY = -32 * scale;
      ctx.strokeStyle = this.map.type === 'oasis' ? '#2f7a28' : '#39702a';
      ctx.lineWidth = 2.3 * scale;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const lx = Math.cos(a) * 16 * scale;
        const ly = Math.sin(a) * 9 * scale;
        ctx.beginPath();
        ctx.moveTo(crownX, crownY);
        ctx.quadraticCurveTo(crownX + lx * 0.6, crownY + ly - 4, crownX + lx, crownY + ly + 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#6b3612';
      ctx.beginPath();
      ctx.arc(crownX + 2, crownY + 2, 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Akácie – plošší koruna.
      ctx.strokeStyle = '#6d4521';
      ctx.lineWidth = 2.6 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sway * 0.5, -22 * scale);
      ctx.stroke();
      ctx.fillStyle = '#55702f';
      ctx.beginPath();
      ctx.ellipse(sway, -27 * scale, 16 * scale, 8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#648037';
      ctx.beginPath();
      ctx.ellipse(sway - 7 * scale, -30 * scale, 9 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawOre(ctx, sx, sy, tx, ty, iron) {
    const h = hash(ty, tx);
    const baseY = sy + HALF_TILE_HEIGHT;
    const scale = 0.85 + h * 0.35;
    const ox = (h - 0.5) * 12;
    const oy = (hash(tx + 3, ty + 7) - 0.5) * 5;

    ctx.save();
    ctx.translate(sx, baseY);
    ctx.fillStyle = 'rgba(40, 28, 12, 0.3)';
    ctx.beginPath();
    ctx.ellipse(ox + 2, oy, 11 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = iron ? '#5b5b60' : '#b58a53';
    ctx.beginPath();
    ctx.moveTo(ox - 9 * scale, oy);
    ctx.lineTo(ox - 5 * scale, oy - 11 * scale);
    ctx.lineTo(ox + 4 * scale, oy - 13 * scale);
    ctx.lineTo(ox + 10 * scale, oy - 4 * scale);
    ctx.lineTo(ox + 4 * scale, oy + 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = iron ? '#7c7c86' : '#d7ac70';
    ctx.beginPath();
    ctx.moveTo(ox - 5 * scale, oy - 11 * scale);
    ctx.lineTo(ox + 4 * scale, oy - 13 * scale);
    ctx.lineTo(ox + 1 * scale, oy - 6 * scale);
    ctx.lineTo(ox - 5 * scale, oy - 5 * scale);
    ctx.closePath();
    ctx.fill();

    if (iron) {
      ctx.fillStyle = `rgba(196, 120, 60, ${0.5 + Math.sin(this.time * 2 + tx) * 0.2})`;
      ctx.beginPath();
      ctx.arc(ox + 1 * scale, oy - 8 * scale, 2.2, 0, Math.PI * 2);
      ctx.arc(ox - 4 * scale, oy - 4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(120, 80, 40, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox - 7, oy - 3);
      ctx.lineTo(ox + 6, oy - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

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

  // ------------------------------------------------------------------
  //  Budovy
  // ------------------------------------------------------------------

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

  drawOrchardGround(ctx, b) {
    const w = b.width;
    const h = b.height;
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    this.isoGround(ctx, 0, 0, w, h, 0, '#355f25');
    this.isoGround(ctx, 0.15, 0.15, w - 0.15, h - 0.15, 0, '#3f7330');

    // Nízká zídka (obrubník sadu).
    const wall = { top: '#d8b071', left: '#966e3a', right: '#bd9154' };
    this.isoBox(ctx, 0, 0, 0.1, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, 0, w, 0.1, 0, 4, wall, null);
    this.isoBox(ctx, w - 0.1, 0, w, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, h - 0.1, w, h, 0, 4, wall, null);

    // Zavlažovací strouha.
    this.isoGround(ctx, w / 2 - 0.06, 0.15, w / 2 + 0.06, h - 0.15, 0, '#2a7d8c');
    ctx.restore();
  }

  drawOrchardTree(ctx, b, gx, gy, u, v) {
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    const base = this.isoPoint(u, v, 0);
    const top = this.isoPoint(u, v, 13);
    ctx.fillStyle = 'rgba(16, 36, 10, 0.3)';
    ctx.beginPath(); ctx.ellipse(base.x + 2, base.y + 1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    const sway = Math.sin(this.time * 1.5 + gx + gy) * 1.2;
    ctx.fillStyle = '#2d7a26';
    ctx.beginPath(); ctx.arc(top.x + sway, top.y - 4, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d8f31';
    ctx.beginPath(); ctx.arc(top.x + sway - 3, top.y - 7, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(top.x + sway + 3, top.y - 3, 1.7, 0, Math.PI * 2);
    ctx.arc(top.x + sway - 2, top.y - 8, 1.7, 0, Math.PI * 2);
    ctx.arc(top.x + sway + 1, top.y - 9, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawOrchardBasket(ctx, b) {
    const pos = tileToScreen(b.tileX, b.tileY);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    const basket = this.isoPoint(0.4, b.height - 0.55, 0);
    ctx.fillStyle = '#9a6b2f';
    ctx.beginPath(); ctx.ellipse(basket.x, basket.y, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(basket.x - 1.6, basket.y - 1.5, 1.5, 0, Math.PI * 2);
    ctx.arc(basket.x + 1.6, basket.y - 1.8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

    if (!b.complete) {
      ctx.globalAlpha = clamp(0.28 + b.progress * 0.6, 0.28, 0.9);
    }
    ctx.save();
    this.drawBuildingStructure(ctx, b, def);
    ctx.restore();
    ctx.globalAlpha = 1;

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

  drawCastle(ctx, w, h) {
    this.isoBox(ctx, 0, 0, w, h, 0, 4, { top: '#c99f62', left: '#98703c', right: '#d6ad70' });
    this.isoGround(ctx, 0.12, 1.75, w - 0.12, h - 0.08, 4, '#c49a5c');
    // Dlažba nádvoří.
    for (let i = 0; i < 3; i++) {
      this.isoGround(ctx, 0.35 + i * 0.8, 2.05, 1.05 + i * 0.8, 2.75, 4, i % 2 ? '#bd9051' : '#c99d5d');
    }

    this.isoBox(ctx, 0.32, 0.3, w - 0.32, 1.72, 4, 42,
      { top: '#dcb271', left: '#946b38', right: '#c99b5c' });
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
      this.isoBox(ctx, u, v, u + 0.84, v + 0.84, 4, 58,
        { top: '#d8ad6c', left: '#8a6132', right: '#c29657' });
      this.isoBox(ctx, u - 0.05, v - 0.05, u + 0.89, v + 0.89, 58, 63,
        { top: '#cba162', left: '#795224', right: '#b98e50' });
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
    this.isoBox(ctx, 0.12, 0.16, 1.2, 1.84, 2, 24,
      { top: '#deb370', left: '#8d6231', right: '#c69a5a' });
    // Sedlová střecha.
    const ridgeBack = this.isoPoint(0.66, 0.1, 38);
    const ridgeFront = this.isoPoint(0.66, 1.9, 38);
    this.isoPoly(ctx, [this.isoPoint(0.06, 0.1, 24), this.isoPoint(0.06, 1.9, 24), ridgeFront, ridgeBack], '#8f1d1d');
    this.isoPoly(ctx, [this.isoPoint(1.26, 0.1, 24), this.isoPoint(1.26, 1.9, 24), ridgeFront, ridgeBack], '#b32626');
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

  drawLumberjack(ctx, w, h, b) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#8a5b2f', 'rgba(60,36,12,0.35)');

    // Srub.
    this.isoBox(ctx, 0.08, 0.08, 0.7, 0.62, 0, 18,
      { top: '#a9712f', left: '#6f4318', right: '#8a5724' });
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
      const smoke = (this.time * 12) % 18;
      ctx.fillStyle = `rgba(215, 205, 190, ${0.35 * (1 - smoke / 18)})`;
      ctx.beginPath();
      ctx.arc(chim.x, chim.y - 12 - smoke, 2 + smoke * 0.15, 0, Math.PI * 2);
      ctx.fill();
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
    this.isoPoly(ctx, [p0, p1, p2, p3], '#5c4028');

    const f0 = this.isoPoint(0.48, 0.48, -13);
    const f1 = this.isoPoint(w - 0.48, 0.48, -13);
    const f2 = this.isoPoint(w - 0.48, h - 0.48, -13);
    const f3 = this.isoPoint(0.48, h - 0.48, -13);
    this.isoPoly(ctx, [f0, f1, f2, f3], '#352313');
    this.isoPoly(ctx, [p0, p1, f1, f0], '#8a5f31');
    this.isoPoly(ctx, [p1, p2, f2, f1], '#6d4a25');

    // Těžební jeřáb.
    const base = this.isoPoint(w - 0.45, 0.4, 0);
    const top = this.isoPoint(w - 0.45, 0.4, 40);
    const boom = this.isoPoint(1.25, 1.25, 34);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.lineTo(boom.x, boom.y);
    ctx.stroke();
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boom.x, boom.y); ctx.lineTo(boom.x, boom.y + 18);
    ctx.stroke();
    ctx.fillStyle = '#deb370';
    ctx.fillRect(boom.x - 4, boom.y + 17, 8, 8);

    // Otesané kvádry.
    for (let i = 0; i < 3; i++) {
      this.isoBox(ctx, w - 0.75 + i * 0.12, 1.85 + i * 0.1, w - 0.35 + i * 0.12, 2.2 + i * 0.1, 0, 6 + i * 3,
        { top: '#dcb271', left: '#b8894d', right: '#caa05e' }, null);
    }
    const barrow = this.isoPoint(0.55, 1.05, -13);
    ctx.fillStyle = '#c89e63';
    ctx.beginPath(); ctx.ellipse(barrow.x, barrow.y, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawOrchard(ctx, w, h) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#355f25');
    this.isoGround(ctx, 0.15, 0.15, w - 0.15, h - 0.15, 0, '#3f7330');

    // Nízká zídka.
    const wall = { top: '#d8b071', left: '#966e3a', right: '#bd9154' };
    this.isoBox(ctx, 0, 0, 0.1, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, 0, w, 0.1, 0, 4, wall, null);
    this.isoBox(ctx, w - 0.1, 0, w, h, 0, 4, wall, null);
    this.isoBox(ctx, 0, h - 0.1, w, h, 0, 4, wall, null);

    // Zavlažovací strouha.
    this.isoGround(ctx, w / 2 - 0.06, 0.15, w / 2 + 0.06, h - 0.15, 0, '#2a7d8c');

    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const u = 0.62 + gx * 1.16;
        const v = 0.62 + gy * 1.16;
        const base = this.isoPoint(u, v, 0);
        const top = this.isoPoint(u, v, 13);
        ctx.fillStyle = 'rgba(16, 36, 10, 0.3)';
        ctx.beginPath(); ctx.ellipse(base.x + 2, base.y + 1, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6b4423';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
        const sway = Math.sin(this.time * 1.5 + gx + gy) * 1.2;
        ctx.fillStyle = '#2d7a26';
        ctx.beginPath(); ctx.arc(top.x + sway, top.y - 4, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3d8f31';
        ctx.beginPath(); ctx.arc(top.x + sway - 3, top.y - 7, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(top.x + sway + 3, top.y - 3, 1.7, 0, Math.PI * 2);
        ctx.arc(top.x + sway - 2, top.y - 8, 1.7, 0, Math.PI * 2);
        ctx.arc(top.x + sway + 1, top.y - 9, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Košík s jablky.
    const basket = this.isoPoint(0.4, h - 0.55, 0);
    ctx.fillStyle = '#9a6b2f';
    ctx.beginPath(); ctx.ellipse(basket.x, basket.y, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(basket.x - 1.6, basket.y - 1.5, 1.5, 0, Math.PI * 2);
    ctx.arc(basket.x + 1.6, basket.y - 1.8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

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

    stall(0.12, 0.18, 0.85, 0.85, '#b91c1c');
    stall(1.05, 0.55, 1.85, 1.15, '#1d4ed8');

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

    // Dům.
    this.isoBox(ctx, 0.18, 0.16, 1.55, 1.42, 2, 24,
      { top: '#d6aa6a', left: '#8d6231', right: '#bb8d4e' });
    // Valbová hliněná střecha.
    const r0 = this.isoPoint(0.1, 0.08, 24);
    const r1 = this.isoPoint(1.63, 0.08, 24);
    const r2 = this.isoPoint(1.63, 1.5, 24);
    const r3 = this.isoPoint(0.1, 1.5, 24);
    const peak = this.isoPoint(0.865, 0.79, 38);
    this.isoPoly(ctx, [r0, r1, peak], '#8c3a1e');
    this.isoPoly(ctx, [r1, r2, peak], '#a84824');
    this.isoPoly(ctx, [r2, r3, peak], '#7c3018');
    this.isoPoly(ctx, [r3, r0, peak], '#a84824');
    // Komín.
    const chim = this.isoPoint(1.28, 0.4, 24);
    ctx.fillStyle = '#7c5a3a';
    ctx.fillRect(chim.x - 3, chim.y - 12, 6, 12);
    if (b && b.complete) {
      const smoke = (this.time * 10 + 3) % 16;
      ctx.fillStyle = `rgba(220, 210, 195, ${0.28 * (1 - smoke / 16)})`;
      ctx.beginPath(); ctx.arc(chim.x, chim.y - 16 - smoke, 2.4 + smoke * 0.14, 0, Math.PI * 2); ctx.fill();
    }
    // Dveře a okno.
    const d0 = this.isoPoint(1.55, 0.68, 2);
    const d1 = this.isoPoint(1.55, 1.02, 2);
    this.isoPoly(ctx, [d0, d1, this.isoPoint(1.55, 1.02, 13), this.isoPoint(1.55, 0.68, 13)], '#4a2a10');
    ctx.fillStyle = '#3a2816';
    ctx.fillRect(...(() => { const p = this.isoPoint(0.75, 1.42, 12); return [p.x - 3, p.y - 3, 6, 6]; })());

    // Studna.
    const well = this.isoPoint(1.45, 1.7, 2);
    ctx.fillStyle = '#8a8272';
    ctx.beginPath(); ctx.ellipse(well.x, well.y, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6f80';
    ctx.beginPath(); ctx.ellipse(well.x, well.y - 1, 4.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(well.x - 6, well.y); ctx.lineTo(well.x - 6, well.y - 12); ctx.lineTo(well.x + 6, well.y - 12); ctx.lineTo(well.x + 6, well.y);
    ctx.stroke();

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
    ctx.fillStyle = '#d3a765';
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
    this.isoPoly(ctx, [
      { x: c.x - rx - 4, y: roofY },
      { x: c.x + rx + 4, y: roofY },
      { x: c.x, y: roofY - 30 }
    ], '#8a5b26');
    this.isoPoly(ctx, [
      { x: c.x - rx - 4, y: roofY },
      { x: c.x, y: roofY - 30 },
      { x: c.x - 8, y: roofY - 6 }
    ], '#a06c2e');

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

    this.isoBox(ctx, 0.16, 0.28, w - 0.16, 1.88, 2, 26,
      { top: '#dcb271', left: '#8d6331', right: '#c69a5a' });
    // Plochá střecha s hranou.
    this.isoBox(ctx, 0.08, 0.2, w - 0.08, 1.96, 26, 30,
      { top: '#b78b4e', left: '#7d5729', right: '#a97f45' });
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

  drawIronMine(ctx, w, h) {
    this.isoGround(ctx, 0, 0, w, h, 0, '#7b6a52', 'rgba(40,30,20,0.4)');
    // Skalní stěna.
    this.isoBox(ctx, 0.1, 0.1, w - 0.1, 1.7, 0, 32,
      { top: '#8f7350', left: '#5f4a30', right: '#7d6542' });
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

  drawScaffolding(ctx, b) {
    const w = b.width;
    const h = b.height;
    const z = 26;
    ctx.strokeStyle = 'rgba(120, 84, 40, 0.85)';
    ctx.lineWidth = 1.8;
    const corners = [[0.05, 0.05], [w - 0.05, 0.05], [w - 0.05, h - 0.05], [0.05, h - 0.05]];
    for (const [u, v] of corners) {
      const a = this.isoPoint(u, v, 0);
      const c = this.isoPoint(u, v, z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    for (let level = 0; level < 3; level++) {
      const zz = 6 + level * 9;
      for (let i = 0; i < corners.length; i++) {
        const a = this.isoPoint(corners[i][0], corners[i][1], zz);
        const b2 = this.isoPoint(corners[(i + 1) % corners.length][0], corners[(i + 1) % corners.length][1], zz);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      }
    }
    // Žebřík.
    const l0 = this.isoPoint(w - 0.2, h - 0.1, 0);
    const l1 = this.isoPoint(w - 0.2, h - 0.1, z - 4);
    ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();
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
    const wave = Math.sin(this.time * 3 + b.id) * 2.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p.x + 1, p.y - 17);
    ctx.lineTo(p.x + 15 + wave, p.y - 13);
    ctx.lineTo(p.x + 1, p.y - 8);
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

  // ------------------------------------------------------------------
  //  Jednotky
  // ------------------------------------------------------------------

  drawUnit(ctx, u, ui, camera) {
    const def = u.config || {};
    const pos = tileToScreen(u.x, u.y);
    const selected = ui.selectedIds && ui.selectedIds.has(u.id);
    const hovered = ui.hoverEntity && ui.hoverEntity.entity && ui.hoverEntity.entity.id === u.id;
    const color = this.ownerColor(u.ownerId);
    const moving = u.path ? u.path.length > 0 : !!u.moving;
    const bob = moving ? Math.sin(this.time * 11 + u.id * 1.7) * 1.6 : Math.sin(this.time * 2 + u.id) * 0.5;
    const facing = Math.cos(u.angle || 0) < -0.1 ? -1 : 1;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Stín.
    ctx.fillStyle = 'rgba(35, 22, 8, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 2.9, 0, 0, Math.PI * 2);
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
    ctx.translate(0, bob);
    ctx.scale(facing, 1);

    if (u.type === 'villager') {
      // Poddaný.
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(-2.6, -11, 5.2, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5b3a18';
      ctx.fillRect(-3, -4, 2.2, 4);
      ctx.fillRect(0.8, -4, 2.2, 4);
      ctx.fillStyle = '#e6c39a';
      ctx.beginPath(); ctx.arc(0, -13.5, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b6a3e';
      ctx.beginPath();
      ctx.ellipse(0, -15.4, 3.6, 1.7, 0, Math.PI, 0);
      ctx.fill();
      if (u.work || u.repairBuildingId) {
        ctx.strokeStyle = '#8a5a2a';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(1.5, -8);
        ctx.lineTo(5.5, -13 - Math.abs(Math.sin(this.time * 5 + u.id)) * 3);
        ctx.stroke();
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(5.5, -13);
        ctx.lineTo(8, -12);
        ctx.stroke();
      }
    } else if (u.type === 'archer') {
      // Lučištník.
      ctx.fillStyle = '#5f7a34';
      ctx.fillRect(-2.8, -11, 5.6, 8.5);
      ctx.fillStyle = color;
      ctx.fillRect(-2.8, -8, 5.6, 2.1);
      ctx.fillStyle = '#4b2e14';
      ctx.fillRect(-3, -4, 2.2, 4);
      ctx.fillRect(0.8, -4, 2.2, 4);
      ctx.fillStyle = '#e6c39a';
      ctx.beginPath(); ctx.arc(0, -13.6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f5c26';
      ctx.beginPath(); ctx.arc(0, -14.2, 3.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      // Luk.
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-3.5, -10, 6.5, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
      ctx.strokeStyle = 'rgba(240, 230, 200, 0.9)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-3.5, -16.5); ctx.lineTo(-3.5, -3.5); ctx.stroke();
      // Toulec.
      ctx.strokeStyle = '#8a5a2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(2.6, -9); ctx.lineTo(5, -14); ctx.stroke();
    } else if (u.type === 'swordsman') {
      // Těžký pěšák.
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-3, -10, 6, 7);
      ctx.fillStyle = color;
      ctx.fillRect(-3, -8.5, 6, 2.2);
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(-3, -4, 2.2, 4);
      ctx.fillRect(0.8, -4, 2.2, 4);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath(); ctx.arc(0, -13, 3.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.beginPath(); ctx.arc(0, -13.5, 3.6, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-0.5, -16.5, 1, 3);
      // Štít.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-6.5, -13);
      ctx.lineTo(-2.5, -13);
      ctx.lineTo(-2.5, -5);
      ctx.lineTo(-4.5, -3);
      ctx.lineTo(-6.5, -5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Meč.
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(3, -7);
      ctx.lineTo(7.5, -15);
      ctx.stroke();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -6);
      ctx.lineTo(4, -8);
      ctx.stroke();
    }
    ctx.restore();

    // Náklad v košíku.
    const carry = u.work ? u.work.carry : (u.carry || 0);
    if (carry > 0) {
      const building = u.work && this.session && this.session.sim
        ? this.session.sim.buildings.find(x => x.id === u.work.buildingId)
        : null;
      const res = building ? building.config.produce : 'wood';
      const icon = RESOURCE_ICONS[res] || '📦';
      ctx.font = '9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,12,6,0.75)';
      ctx.beginPath();
      ctx.arc(8, -19, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(icon, 8, -16);
    }

    if (u.fleeing) {
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('!', 0, -24);
    }

    // Zdravotní pruh.
    if (u.hp < u.maxHp - 0.5 || selected) {
      const ratio = clamp(u.hp / u.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(15, 10, 5, 0.8)';
      ctx.fillRect(-9, -24, 18, 4);
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(-9, -23.5, 18 * ratio, 3);
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

  // ------------------------------------------------------------------
  //  Mlha války
  // ------------------------------------------------------------------

  drawFog(ctx, rows) {
    if (!this.session || !this.session.state.fogEnabled) return;

    // Při oddálení je dlaždicová mlha drahá. Místo tisíce kosočtverců
    // promítneme malou masku (1 texel = 1 dlaždice) jediným drawImage.
    if (this.zoom < 0.85) {
      if (this.fogMaskTimer <= 0) {
        this.renderFogMask();
        this.fogMaskTimer = 0.25;
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.transform(HALF_TILE_WIDTH, HALF_TILE_HEIGHT, -HALF_TILE_WIDTH, HALF_TILE_HEIGHT, 0, 0);
      ctx.drawImage(this.fogMask, 0, 0);
      ctx.restore();
      return;
    }

    const unknown = new Path2D();
    const explored = new Path2D();
    let hasUnknown = false;
    let hasExplored = false;
    for (const row of rows) {
      const y = row.y;
      for (let x = row.x0; x <= row.x1; x++) {
        const exploredTile = this.isExplored(x, y);
        if (exploredTile && this.isVisible(x, y)) continue;
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        const path = exploredTile ? explored : unknown;
        if (exploredTile) hasExplored = true; else hasUnknown = true;
        path.moveTo(sx, sy);
        path.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        path.lineTo(sx, sy + TILE_HEIGHT);
        path.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        path.closePath();
      }
    }
    if (hasExplored) {
      ctx.fillStyle = 'rgba(22, 18, 14, 0.52)';
      ctx.fill(explored);
    }
    if (hasUnknown) {
      ctx.fillStyle = 'rgba(7, 5, 3, 0.94)';
      ctx.fill(unknown);
    }
  }

  renderFogMask() {
    const size = this.map.size;
    if (this.fogMask.width !== size) {
      this.fogMask.width = size;
      this.fogMask.height = size;
    }
    const img = this.fogMaskCtx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const explored = this.isExplored(x, y);
        if (explored && this.isVisible(x, y)) continue;
        const o = (y * size + x) * 4;
        if (explored) {
          data[o] = 22; data[o + 1] = 18; data[o + 2] = 14; data[o + 3] = 133;
        } else {
          data[o] = 7; data[o + 1] = 5; data[o + 2] = 3; data[o + 3] = 240;
        }
      }
    }
    this.fogMaskCtx.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------------
  //  Náhled stavby, hover, výběr
  // ------------------------------------------------------------------

  drawBuildGhost(ctx, ui) {
    if (!ui.buildMode || !ui.hoverTile) return;
    const def = BUILDING_DEFS[ui.buildMode];
    if (!def) return;
    const hover = ui.hoverTile;
    const check = this.session.canPlace(ui.buildMode, hover.x, hover.y);
    const valid = check.valid;

    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        const x = hover.x + dx;
        const y = hover.y + dy;
        if (x < 0 || y < 0 || x >= this.map.size || y >= this.map.size) continue;
        const sx = (x - y) * HALF_TILE_WIDTH;
        const sy = (x + y) * HALF_TILE_HEIGHT;
        ctx.fillStyle = valid ? 'rgba(74, 222, 128, 0.26)' : 'rgba(239, 68, 68, 0.3)';
        ctx.strokeStyle = valid ? 'rgba(74, 222, 128, 0.65)' : 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        ctx.lineTo(sx, sy + TILE_HEIGHT);
        ctx.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    const pos = tileToScreen(hover.x, hover.y);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    this.isoBox(ctx, 0, 0, def.w, def.h, 0, 20,
      valid
        ? { top: 'rgba(160, 246, 190, 0.38)', left: 'rgba(60, 150, 90, 0.3)', right: 'rgba(100, 200, 130, 0.3)' }
        : { top: 'rgba(254, 160, 160, 0.35)', left: 'rgba(150, 50, 50, 0.3)', right: 'rgba(200, 90, 90, 0.3)' },
      valid ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.85)');
    const center = this.isoPoint(def.w / 2, def.h / 2, 22);
    ctx.font = '18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(def.icon, center.x, center.y);
    ctx.restore();
  }

  drawHover(ctx, ui) {
    if (ui.buildMode || !ui.hoverTile) return;
    const t = ui.hoverTile;
    if (t.x < 0 || t.y < 0 || t.x >= this.map.size || t.y >= this.map.size) return;
    const sx = (t.x - t.y) * HALF_TILE_WIDTH;
    const sy = (t.x + t.y) * HALF_TILE_HEIGHT;
    ctx.strokeStyle = 'rgba(255, 235, 170, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
    ctx.lineTo(sx, sy + TILE_HEIGHT);
    ctx.lineTo(sx - HALF_TILE_WIDTH, sy + HALF_TILE_HEIGHT);
    ctx.closePath();
    ctx.stroke();
  }

  drawSelectionRect(ctx, rect) {
    if (!rect) return;
    const x = Math.min(rect.x1, rect.x2);
    const y = Math.min(rect.y1, rect.y2);
    const w = Math.abs(rect.x2 - rect.x1);
    const h = Math.abs(rect.y2 - rect.y1);
    if (w < 3 && h < 3) return;
    ctx.fillStyle = 'rgba(253, 224, 71, 0.09)';
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  // ------------------------------------------------------------------
  //  Minimapa
  // ------------------------------------------------------------------

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

  // Zóna odstupu od nepřátel; kreslí se jen viditelní, aby mlha nic neprozradila.
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

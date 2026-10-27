import { worldToTile } from './isometric.js';
import { PLAYER_COLORS } from '../sim/constants.js';

import { installEngineMethods } from './engine-methods.js';
import { RendererScene } from './renderer-scene.js';
import { RendererTerrain } from './renderer-terrain.js';
import { RendererResources } from './renderer-resources.js';
import { RendererGeometry } from './renderer-geometry.js';
import { RendererBuildings } from './renderer-buildings.js';
import { RendererOrchard } from './renderer-orchard.js';
import { RendererFortifications } from './renderer-fortifications.js';
import { RendererProduction } from './renderer-production.js';
import { RendererSettlement } from './renderer-settlement.js';
import { RendererBuildingStatus } from './renderer-building-status.js';
import { RendererUnits } from './renderer-units.js';
import { RendererEffects } from './renderer-effects.js';
import { RendererFog } from './renderer-fog.js';
import { RendererInteraction } from './renderer-interaction.js';
import { RendererMinimap } from './renderer-minimap.js';

/** Owns world-rendering state; drawing capabilities share this instance. */
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
    this.unitAnimations = new WeakMap();

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
    this.minimapPings = [];
    this.unitAnimations = new WeakMap();
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
}

installEngineMethods(Renderer,
  RendererScene,
  RendererTerrain,
  RendererResources,
  RendererGeometry,
  RendererBuildings,
  RendererOrchard,
  RendererFortifications,
  RendererProduction,
  RendererSettlement,
  RendererBuildingStatus,
  RendererUnits,
  RendererEffects,
  RendererFog,
  RendererInteraction,
  RendererMinimap,
);

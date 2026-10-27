import { worldToTile } from '../engine/isometric.js';
import { BUILDING_DEFS } from '../sim/constants.js';
import { rotatedBuildingSize } from '../sim/building-orientation.js';
import { pickEntityAtWorld } from './picking.js';
import { onRightClick, selectAt, selectInRect, tryPlaceBuilding } from './input-selection.js';
import { onWheel, onKeyDown, onKeyUp, saveGroup, selectGroup, centerOnCastle, onMinimapDown, moveCameraFromMinimap, update } from './input-navigation.js';

const DRAG_THRESHOLD = 6;

export class Input {
  constructor({ canvas, minimapCanvas, camera, session, ui, settings, isBlocked, onOpenMenu }) {
    this.canvas = canvas;
    this.minimapCanvas = minimapCanvas;
    this.camera = camera;
    this.session = session;
    this.ui = ui;
    this.settings = settings || {};
    this.isBlocked = isBlocked || (() => false);
    this.onOpenMenu = onOpenMenu || (() => {});
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, inside: false, valid: false };
    this.drag = null;
    this.wallDrag = null;
    this.groups = new Map();
    this.minimapDragging = false;
    this.detached = false;

    this.handlers = {
      mousedown: (e) => this.onMouseDown(e),
      mousemove: (e) => this.onMouseMove(e),
      mouseup: (e) => this.onMouseUp(e),
      mouseleave: () => this.onMouseLeave(),
      contextmenu: (e) => e.preventDefault(),
      wheel: (e) => this.onWheel(e),
      keydown: (e) => this.onKeyDown(e),
      keyup: (e) => this.onKeyUp(e),
      blur: () => this.onBlur(),
      windowMove: (e) => this.onWindowMove(e),
      windowOut: (e) => this.onWindowOut(e),
      windowUp: (e) => this.onMouseUp(e),
      minimapDown: (e) => this.onMinimapDown(e)
    };

    canvas.addEventListener('mousedown', this.handlers.mousedown);
    canvas.addEventListener('mousemove', this.handlers.mousemove);
    canvas.addEventListener('mouseleave', this.handlers.mouseleave);
    canvas.addEventListener('contextmenu', this.handlers.contextmenu);
    canvas.addEventListener('wheel', this.handlers.wheel, { passive: false });
    window.addEventListener('mouseup', this.handlers.mouseup);
    window.addEventListener('mousemove', this.handlers.windowMove);
    window.addEventListener('mouseout', this.handlers.windowOut);
    window.addEventListener('keydown', this.handlers.keydown);
    window.addEventListener('keyup', this.handlers.keyup);
    window.addEventListener('blur', this.handlers.blur);
    if (minimapCanvas) minimapCanvas.addEventListener('mousedown', this.handlers.minimapDown);
  }

  detach() {
    this.detached = true;
    const c = this.canvas;
    c.removeEventListener('mousedown', this.handlers.mousedown);
    c.removeEventListener('mousemove', this.handlers.mousemove);
    c.removeEventListener('mouseleave', this.handlers.mouseleave);
    c.removeEventListener('contextmenu', this.handlers.contextmenu);
    c.removeEventListener('wheel', this.handlers.wheel);
    window.removeEventListener('mouseup', this.handlers.mouseup);
    window.removeEventListener('mousemove', this.handlers.windowMove);
    window.removeEventListener('mouseout', this.handlers.windowOut);
    window.removeEventListener('keydown', this.handlers.keydown);
    window.removeEventListener('keyup', this.handlers.keyup);
    window.removeEventListener('blur', this.handlers.blur);
    if (this.minimapCanvas) this.minimapCanvas.removeEventListener('mousedown', this.handlers.minimapDown);
    this.ui.dragRect = null;
    this.ui.hoverTile = null;
    this.ui.hoverEntity = null;
    this.ui.wallDrag = null;
  }

  setHover(clientX, clientY) {
    if (!this.session) return;
    const world = this.camera.screenToWorld(clientX, clientY);
    const raw = worldToTile(world.x, world.y);
    const tx = Math.floor(raw.x);
    const ty = Math.floor(raw.y);
    let hx = tx;
    let hy = ty;

    if (this.ui.buildMode && BUILDING_DEFS[this.ui.buildMode]) {
      const def = BUILDING_DEFS[this.ui.buildMode];
      const { width, height } = rotatedBuildingSize(def, this.ui.buildRotation || 0);
      hx -= Math.floor((width - 1) / 2);
      hy -= Math.floor((height - 1) / 2);
    }

    this.ui.hoverTile = { x: hx, y: hy };
    this.ui.hoverEntity = this.ui.buildMode
      ? null
      : pickEntityAtWorld(this.session, world.x, world.y);
  }

  onWindowMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.valid = true;
    if (this.wallDrag && !this.isBlocked()) {
      this.setHover(e.clientX, e.clientY);
      this.ui.wallDrag = { ...this.wallDrag, end: this.ui.hoverTile };
    }
    // Tažení aktualizujeme na úrovni okna, aby obdélník nezamrzl,
    // když kurzor přejede nad HUD nebo mimo plátno.
    if (this.drag) {
      this.drag.x2 = e.clientX;
      this.drag.y2 = e.clientY;
      const moved = Math.hypot(this.drag.x2 - this.drag.x1, this.drag.y2 - this.drag.y1) > DRAG_THRESHOLD;
      this.drag.moved = this.drag.moved || moved;
      if (this.drag.moved) {
        this.ui.dragRect = { x1: this.drag.x1, y1: this.drag.y1, x2: this.drag.x2, y2: this.drag.y2 };
      }
    }
    if (this.minimapDragging) this.moveCameraFromMinimap(e);
  }

  onMouseMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.inside = true;
    this.mouse.valid = true;
    if (!this.isBlocked()) this.setHover(e.clientX, e.clientY);
  }

  onWindowOut(e) {
    if (!e.relatedTarget) {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.valid = true;
    }
  }

  onMouseLeave() {
    this.mouse.inside = false;
    if (!this.drag) {
      this.ui.hoverTile = null;
      this.ui.hoverEntity = null;
    }
  }

  onBlur() {
    this.keys.clear();
    this.mouse.valid = false;
    this.minimapDragging = false;
    this.wallDrag = null;
    this.ui.wallDrag = null;
    if (!this.drag) return;
    this.drag = null;
    this.canvas.classList.remove('dragging');
    this.ui.dragRect = null;
  }

  onMouseDown(e) {
    if (this.isBlocked() || !this.session) return;
    if (e.button === 0) {
      this.setHover(e.clientX, e.clientY);
      if (this.ui.buildMode) {
        if (this.ui.buildMode === 'wall' && this.ui.hoverTile) {
          this.wallDrag = { start: { ...this.ui.hoverTile } };
          this.ui.wallDrag = { ...this.wallDrag, end: { ...this.ui.hoverTile } };
          return;
        }
        this.tryPlaceBuilding();
        return;
      }
      this.drag = {
        x1: e.clientX, y1: e.clientY,
        x2: e.clientX, y2: e.clientY,
        moved: false
      };
      this.canvas.classList.add('dragging');
    } else if (e.button === 2) {
      e.preventDefault();
      this.onRightClick(e);
    }
  }

  onMouseUp(e) {
    this.minimapDragging = false;
    if (this.wallDrag) {
      const start = this.wallDrag.start;
      this.wallDrag = null;
      this.ui.wallDrag = null;
      if (e.button !== 0 || this.isBlocked() || !this.session || this.ui.buildMode !== 'wall') return;
      this.setHover(e.clientX, e.clientY);
      const end = this.ui.hoverTile;
      const check = this.session.canPlaceWall(start.x, start.y, end.x, end.y);
      if (!check.valid) {
        this.ui.toast(check.message || check.reason, 'error');
        return;
      }
      const result = this.session.command({ op: 'build-wall', x1: start.x, y1: start.y, x2: end.x, y2: end.y });
      if (result && result.ok === false) {
        this.ui.toast(result.message || result.reason, 'error');
        return;
      }
      this.ui.setBuildMode(null);
      return;
    }
    if (this.drag && e.button !== 0) {
      this.drag = null;
      this.canvas.classList.remove('dragging');
      this.ui.dragRect = null;
      return;
    }
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.canvas.classList.remove('dragging');
    this.ui.dragRect = null;
    if (this.isBlocked() || !this.session) return;

    if (drag.moved) {
      this.selectInRect(drag, e.shiftKey);
      return;
    }

    this.selectAt(e.clientX, e.clientY, e.shiftKey);
  }

  onRightClick(...args) {
    return onRightClick.apply(this, args);
  }

  selectAt(...args) {
    return selectAt.apply(this, args);
  }

  selectInRect(...args) {
    return selectInRect.apply(this, args);
  }

  tryPlaceBuilding(...args) {
    return tryPlaceBuilding.apply(this, args);
  }

  onWheel(...args) {
    return onWheel.apply(this, args);
  }

  onKeyDown(...args) {
    return onKeyDown.apply(this, args);
  }

  onKeyUp(...args) {
    return onKeyUp.apply(this, args);
  }

  saveGroup(...args) {
    return saveGroup.apply(this, args);
  }

  selectGroup(...args) {
    return selectGroup.apply(this, args);
  }

  centerOnCastle(...args) {
    return centerOnCastle.apply(this, args);
  }

  onMinimapDown(...args) {
    return onMinimapDown.apply(this, args);
  }

  moveCameraFromMinimap(...args) {
    return moveCameraFromMinimap.apply(this, args);
  }

  update(...args) {
    return update.apply(this, args);
  }
}

export { EDGE_MARGIN } from './input-navigation.js';

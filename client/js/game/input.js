import { worldToTile } from '../engine/isometric.js';
import { BUILDING_DEFS } from '../sim/constants.js';
import { pickEntityAtWorld, unitsInWorldRect } from './picking.js';
import { CAMERA_SPEEDS } from './settings.js';
import { audio } from '../engine/audio.js';

const EDGE_MARGIN = 22;
const DRAG_THRESHOLD = 6;

/**
 * Ovládání hry: kamera, výběr, povely, stavění, skupiny a minimapa.
 */
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
    window.removeEventListener('keydown', this.handlers.keydown);
    window.removeEventListener('keyup', this.handlers.keyup);
    window.removeEventListener('blur', this.handlers.blur);
    if (this.minimapCanvas) this.minimapCanvas.removeEventListener('mousedown', this.handlers.minimapDown);
    this.ui.dragRect = null;
    this.ui.hoverTile = null;
    this.ui.hoverEntity = null;
  }

  // ------------------------------------------------------------------
  //  Myš
  // ------------------------------------------------------------------

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
      hx -= Math.floor((def.w - 1) / 2);
      hy -= Math.floor((def.h - 1) / 2);
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

  onMouseLeave() {
    this.mouse.inside = false;
    if (!this.drag) {
      this.ui.hoverTile = null;
      this.ui.hoverEntity = null;
    }
  }

  onBlur() {
    this.keys.clear();
    this.minimapDragging = false;
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

  onRightClick(e) {
    if (!this.session) return;
    if (this.ui.buildMode) {
      this.ui.setBuildMode(null);
      audio.play('click');
      return;
    }

    const units = this.session.selection.filter(u => u.ownerId === this.session.selfId);
    if (!units.length) {
      if (this.session.selectedBuilding) {
        this.session.clearSelection();
        this.ui.renderSelection(true);
      }
      return;
    }

    this.setHover(e.clientX, e.clientY);
    const t = this.ui.hoverTile;
    if (!t) return;
    const target = this.ui.hoverEntity;
    const military = units.filter(u => u.isMilitary);
    const unitIds = units.map(u => u.id);

    if (target && target.entity && target.entity.ownerId !== this.session.selfId && military.length) {
      const result = this.session.command({
        op: 'attack',
        unitIds: military.map(u => u.id),
        targetId: target.entity.id
      });
      if (result && result.ok === false) {
        this.ui.toast(result.reason, 'error');
        audio.play('error');
      } else {
        audio.play('ack');
        if (this.session.local) {
          this.session.selectUnits(military);
          this.ui.renderSelection(true);
        }
      }
      return;
    }

    const dest = { x: t.x + 0.5, y: t.y + 0.5 };
    const result = this.session.command({ op: 'move', unitIds, x: dest.x, y: dest.y });
    if (result && result.ok === false) {
      this.ui.toast(result.reason, 'error');
      audio.play('error');
    } else {
      audio.play('ack');
    }
  }

  selectAt(clientX, clientY, additive) {
    if (!this.session) return;
    const world = this.camera.screenToWorld(clientX, clientY);
    const found = pickEntityAtWorld(this.session, world.x, world.y);
    if (!found) {
      if (!additive) {
        this.session.clearSelection();
        this.ui.renderSelection(true);
      }
      return;
    }

    if (found.type === 'unit') {
      const unit = found.entity;
      let selection = this.session.selection.slice();
      if (unit.ownerId !== this.session.selfId) {
        // Nepřátelskou jednotku lze prohlédnout, ale nevelet jí.
        this.session.selectUnits([unit]);
        this.ui.renderSelection(true);
        audio.play('select', { volume: 0.6 });
        return;
      }
      if (additive) {
        const exists = selection.some(u => u.id === unit.id);
        selection = exists ? selection.filter(u => u.id !== unit.id) : [...selection, unit];
      } else {
        selection = [unit];
      }
      this.session.selectUnits(selection);
      this.ui.renderSelection(true);
      audio.play('select');
    } else {
      this.session.selectBuilding(found.entity);
      this.ui.renderSelection(true);
      audio.play('select', { volume: 0.6 });
    }
  }

  selectInRect(drag, additive) {
    const a = this.camera.screenToWorld(drag.x1, drag.y1);
    const b = this.camera.screenToWorld(drag.x2, drag.y2);
    // Obrazovka i svět jsou izometrické, proto se obdélník mapuje na obdélník.
    const found = unitsInWorldRect(
      this.session,
      Math.min(a.x, b.x), Math.min(a.y, b.y),
      Math.max(a.x, b.x), Math.max(a.y, b.y)
    );
    if (!found.length) {
      if (!additive) {
        this.session.clearSelection();
        this.ui.renderSelection(true);
      }
      return;
    }
    let selection = additive ? this.session.selection.slice() : [];
    for (const unit of found) {
      if (!selection.some(u => u.id === unit.id)) selection.push(unit);
    }
    this.session.selectUnits(selection);
    this.ui.renderSelection(true);
    audio.play('select');
  }

  tryPlaceBuilding() {
    if (!this.ui.buildMode || !this.ui.hoverTile) return;
    const type = this.ui.buildMode;
    const { x, y } = this.ui.hoverTile;
    const check = this.session.canPlace(type, x, y);
    if (!check.valid) {
      this.ui.toast(check.reason, 'error');
      audio.play('error');
      return;
    }
    const result = this.session.command({ op: 'build', buildingType: type, x, y });
    if (result && result.ok === false) {
      this.ui.toast(result.reason, 'error');
      audio.play('error');
      return;
    }
    audio.play('build');
    this.ui.setBuildMode(null);
  }

  onWheel(e) {
    if (this.isBlocked()) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.camera.zoomAt(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    this.setHover(e.clientX, e.clientY);
  }

  // ------------------------------------------------------------------
  //  Klávesnice
  // ------------------------------------------------------------------

  onKeyDown(e) {
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (typing) {
      if (e.key === 'Escape') {
        e.target.blur();
        if (this.isBlocked()) this.ui.modals.close();
      }
      return;
    }

    if (this.isBlocked()) {
      if (e.key === 'Escape') this.ui.modals.close();
      return;
    }
    if (!this.session) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.ui.buildMode) {
        this.ui.setBuildMode(null);
      } else if (this.session.selection.length || this.session.selectedBuilding) {
        this.session.clearSelection();
        this.ui.renderSelection(true);
      } else {
        this.onOpenMenu();
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      this.centerOnCastle();
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      const b = this.session.selectedBuilding;
      if (b && b.ownerId === this.session.selfId && b.type !== 'castle') {
        this.ui.confirmDemolish(b);
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && /^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      this.saveGroup(Number(e.code.slice(5)));
      return;
    }
    if (!e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      this.selectGroup(Number(e.code.slice(5)));
      return;
    }

    this.keys.add(e.key.toLowerCase());
    this.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
    this.keys.delete(e.code);
  }

  saveGroup(index) {
    const ids = this.session.selection
      .filter(u => u.ownerId === this.session.selfId)
      .map(u => u.id);
    if (!ids.length) {
      this.ui.toast('Nemáte vybrané jednotky pro uložení skupiny.', 'info');
      return;
    }
    this.groups.set(index, ids);
    this.ui.toast(`Skupina ${index} uložena (${ids.length} jednotek).`, 'success');
    audio.play('click');
  }

  selectGroup(index) {
    const ids = this.groups.get(index);
    if (!ids || !ids.length) return;
    const units = this.session.state.units.filter(u => ids.includes(u.id) && u.ownerId === this.session.selfId);
    if (!units.length) {
      this.ui.toast(`Skupina ${index} už neexistuje.`, 'info');
      this.groups.delete(index);
      return;
    }
    this.session.selectUnits(units);
    this.ui.renderSelection(true);
    audio.play('select');
  }

  centerOnCastle() {
    const castle = this.session.castle;
    if (castle) {
      this.camera.centerOnTile(castle.centerX, castle.centerY);
      this.camera.clampToMap(this.session.state.map.size);
      audio.play('click');
    }
  }

  // ------------------------------------------------------------------
  //  Minimapa
  // ------------------------------------------------------------------

  onMinimapDown(e) {
    if (this.isBlocked() || !this.session) return;
    e.preventDefault();
    this.minimapDragging = true;
    this.moveCameraFromMinimap(e);
  }

  moveCameraFromMinimap(e) {
    if (!this.minimapCanvas || !this.session) return;
    const rect = this.minimapCanvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const size = this.session.state.map.size;
    const tx = Math.max(0, Math.min(size - 1, fx * size));
    const ty = Math.max(0, Math.min(size - 1, fy * size));
    this.camera.centerOnTile(tx, ty);
    this.camera.clampToMap(size);
  }

  // ------------------------------------------------------------------
  //  Průběžná aktualizace
  // ------------------------------------------------------------------

  update(dt) {
    if (this.detached || this.isBlocked() || !this.session) return;
    const speed = CAMERA_SPEEDS[this.settings.cameraSpeed] || CAMERA_SPEEDS.medium;
    const step = speed * Math.min(dt, 0.1);
    let dx = 0;
    let dy = 0;

    if (this.keys.has('w') || this.keys.has('arrowup') || this.keys.has('KeyW')) dy += step;
    if (this.keys.has('s') || this.keys.has('arrowdown') || this.keys.has('KeyS')) dy -= step;
    if (this.keys.has('a') || this.keys.has('arrowleft') || this.keys.has('KeyA')) dx += step;
    if (this.keys.has('d') || this.keys.has('arrowright') || this.keys.has('KeyD')) dx -= step;

    if (this.mouse.inside) {
      if (this.mouse.x < EDGE_MARGIN) dx += step;
      else if (this.mouse.x > window.innerWidth - EDGE_MARGIN) dx -= step;
      if (this.mouse.y < EDGE_MARGIN) dy += step;
      else if (this.mouse.y > window.innerHeight - EDGE_MARGIN) dy -= step;
    }

    if (dx || dy) {
      // Normalizace diagonály.
      const len = Math.hypot(dx, dy);
      if (len > step * 1.05) {
        dx = dx / len * step;
        dy = dy / len * step;
      }
      this.camera.pan(dx, dy);
      this.camera.clampToMap(this.session.state.map.size);
    }

    if (this.mouse.inside && this.mouse.valid) {
      this.setHover(this.mouse.x, this.mouse.y);
    }
  }
}

export { EDGE_MARGIN };

import { t } from '../i18n/index.js';
import { CAMERA_SPEEDS } from './settings.js';
import { audio } from '../engine/audio.js';

const EDGE_MARGIN = 22;

export function onWheel(e) {
  if (this.isBlocked()) return;
  e.preventDefault();
  const rect = this.canvas.getBoundingClientRect();
  this.camera.zoomAt(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
  this.setHover(e.clientX, e.clientY);
}

export function onKeyDown(e) {
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

export function onKeyUp(e) {
  this.keys.delete(e.key.toLowerCase());
  this.keys.delete(e.code);
}

export function saveGroup(index) {
  const ids = this.session.selection
    .filter(u => u.ownerId === this.session.selfId)
    .map(u => u.id);
  if (!ids.length) {
    this.ui.toast(t("Nemáte vybrané jednotky pro uložení skupiny."), 'info');
    return;
  }
  this.groups.set(index, ids);
  this.ui.toast(t("Skupina {0} uložena ({1} jednotek).", { 0: index, 1: ids.length }), 'success');
  audio.play('click');
}

export function selectGroup(index) {
  const ids = this.groups.get(index);
  if (!ids || !ids.length) return;
  const units = this.session.state.units.filter(u => ids.includes(u.id) && u.ownerId === this.session.selfId);
  if (!units.length) {
    this.ui.toast(t("Skupina {0} už neexistuje.", { 0: index }), 'info');
    this.groups.delete(index);
    return;
  }
  this.session.selectUnits(units);
  this.ui.renderSelection(true);
  audio.play('select');
}

export function centerOnCastle() {
  const castle = this.session.castle;
  if (castle) {
    this.camera.centerOnTile(castle.centerX, castle.centerY);
    this.camera.clampToMap(this.session.state.map.size);
    audio.play('click');
  }
}

export function onMinimapDown(e) {
  if (this.isBlocked() || !this.session) return;
  e.preventDefault();
  this.minimapDragging = true;
  this.moveCameraFromMinimap(e);
}

export function moveCameraFromMinimap(e) {
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

export function update(dt) {
  if (this.detached || this.isBlocked() || !this.session) return;
  const speed = CAMERA_SPEEDS[this.settings.cameraSpeed] || CAMERA_SPEEDS.medium;
  const step = speed * Math.min(dt, 0.1);
  let dx = 0;
  let dy = 0;

  if (this.keys.has('w') || this.keys.has('arrowup') || this.keys.has('KeyW')) dy += step;
  if (this.keys.has('s') || this.keys.has('arrowdown') || this.keys.has('KeyS')) dy -= step;
  if (this.keys.has('a') || this.keys.has('arrowleft') || this.keys.has('KeyA')) dx += step;
  if (this.keys.has('d') || this.keys.has('arrowright') || this.keys.has('KeyD')) dx -= step;

  if (this.mouse.valid && !this.minimapDragging) {
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

export { EDGE_MARGIN };

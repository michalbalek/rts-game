import { pickEntityAtWorld, unitsInWorldRect } from './picking.js';
import { audio } from '../engine/audio.js';

export function onRightClick(e) {
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

export function selectAt(clientX, clientY, additive) {
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

export function selectInRect(drag, additive) {
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

export function tryPlaceBuilding() {
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

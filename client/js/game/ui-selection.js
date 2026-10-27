import { t } from '../i18n/index.js';
import { BUILDING_DEFS } from '../sim/constants.js';
import { audio } from '../engine/audio.js';
import { pct, assignedWorkers, workerLabel } from './ui-format.js';

export function bindSelectionPanel() {
  if (!this.el.selectionPanel) return;
  this.el.selectionPanel.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const building = this.session && this.session.selectedBuilding;
    switch (action) {
      case 'train':
        if (building) this.issue({ op: 'train', buildingId: building.id, unitType: el.dataset.unit });
        audio.play('click');
        break;
      case 'assign':
        if (building) this.issue({ op: 'assign', buildingId: building.id, count: 1 });
        audio.play('ack', { volume: 0.5 });
        break;
      case 'unassign':
        if (building) this.issue({ op: 'unassign', buildingId: building.id, count: 1 });
        audio.play('click');
        break;
      case 'repair':
        if (building) this.issue({ op: 'repair', buildingId: building.id });
        audio.play('repair');
        break;
      case 'gate':
        if (building) this.issue({ op: 'gate', buildingId: building.id, open: el.dataset.open === 'true' });
        audio.play('click');
        break;
      case 'ungarrison':
        if (building) this.issue({ op: 'ungarrison', buildingId: building.id });
        audio.play('click');
        break;
      case 'construct': {
        const unitIds = this.selectedVillagerIds();
        if (!unitIds.length) break;
        const result = this.issue({ op: 'construct', buildingId: Number(el.dataset.buildingId), unitIds });
        if (!result || result.ok) audio.play('ack', { volume: 0.5 });
        break;
      }
      case 'demolish':
        if (building) this.confirmDemolish(building);
        break;
      case 'market':
        this.showMarket();
        break;
      case 'release-villagers':
        this.releaseSelectedVillagers();
        break;
      case 'clear-selection':
        this.session.clearSelection();
        this.renderSelection(true);
        break;
      case 'focus':
        if (building && this.hooks.focusBuilding) this.hooks.focusBuilding(building);
        break;
      default:
        break;
    }
  });
}

export function releaseSelectedVillagers() {
  if (!this.session || !this.session.local) return;
  const unitIds = this.session.selection
    .filter(unit => unit.work || unit.build)
    .map(unit => unit.id);
  const result = this.issue({ op: 'release', unitIds });
  if (result && result.ok) audio.play('ack');
}

export function selectedVillagerIds() {
  const s = this.session;
  if (!s) return [];
  return s.selection
    .filter(u => u.isVillager && u.ownerId === s.selfId)
    .map(u => u.id);
}

export function updateSelectionPanel() {
  if (!this.session) return;
  const signature = this.selectionSignature();
  if (signature !== this.lastSelectionSignature) {
    this.lastSelectionSignature = signature;
    this.renderSelection(true);
  }
}

export function selectionSignature() {
  const s = this.session;
  if (!s) return 'none';
  if (s.selectedBuilding) {
    const b = s.selectedBuilding;
    const garrison = s.state.units.filter(u => u.garrison?.towerId === b.id && u.garrison.entered).length;
    return `b:${b.id}:${b.complete}:${b.workers}:${assignedWorkers(b)}:${b.queue ? b.queue.length : 0}:${!!b.repair}:${b.ownerId}:${b.gateOpen}:${b.gateDesiredOpen}:${garrison}`;
  }
  if (s.selection.length) {
    const sites = this.constructionSites().map(b => b.id).join(',');
    // Stav práce určuje tlačítko Uvolnit, takže musí být v podpisu výběru.
    return `u:${s.selection.map(u => `${u.id}:${u.type}:${u.work || u.build ? 'job' : ''}:${!!u.garrison?.entered}`).sort().join(',')}|s:${sites}`;
  }
  return 'none';
}

export function renderSelection() {
  if (!this.el.selectionPanel) return;
  const s = this.session;
  if (!s) {
    this.el.selectionPanel.innerHTML = this.emptySelectionHtml();
    return;
  }
  if (s.selectedBuilding) {
    this.el.selectionPanel.innerHTML = this.buildingPanelHtml(s.selectedBuilding);
  } else if (s.selection.length) {
    this.el.selectionPanel.innerHTML = this.unitsPanelHtml(s.selection);
  } else {
    this.el.selectionPanel.innerHTML = this.emptySelectionHtml();
  }
  this.refreshDynamic();
}

export function refreshDynamic() {
  if (!this.session || !this.el.selectionPanel) return;
  const panel = this.el.selectionPanel;
  panel.querySelectorAll('[data-action="construct"]').forEach(button => {
    const site = this.session.state.buildings.find(x => x.id === Number(button.dataset.buildingId));
    const label = button.querySelector('[data-site-label]');
    if (site && label) label.textContent = this.siteLabel(site);
  });
  const b = this.session.selectedBuilding;
  if (b) {
    const hp = panel.querySelector('[data-hp]');
    if (hp) {
      const ratio = pct(b.hp, b.maxHp);
      hp.style.width = `${Math.round(ratio * 100)}%`;
      hp.className = `fill ${ratio > 0.55 ? 'good' : ratio > 0.25 ? 'warn' : 'bad'}`;
    }
    const hpLabel = panel.querySelector('[data-hp-label]');
    if (hpLabel) hpLabel.textContent = `${Math.ceil(b.hp)} / ${b.maxHp}`;
    const progress = panel.querySelector('[data-build-progress]');
    if (progress) progress.style.width = `${Math.round(b.progress * 100)}%`;
    const progressLabel = panel.querySelector('[data-build-label]');
    if (progressLabel) progressLabel.textContent = `${Math.round(b.progress * 100)} %`;
    const workers = panel.querySelector('[data-workers]');
    if (workers) {
      const def = b.config || BUILDING_DEFS[b.type];
      const enRoute = Math.max(0, assignedWorkers(b) - b.workers);
      workers.textContent = workerLabel(b, def);
      workers.title = enRoute ? t("{0} na cestě do budovy", { 0: enRoute }) : '';
    }
    const siteInfo = panel.querySelector('[data-site-info]');
    if (siteInfo) {
      const stats = this.siteStats(b);
      const builders = siteInfo.querySelector('[data-site-builders]');
      const speed = siteInfo.querySelector('[data-site-speed]');
      const left = siteInfo.querySelector('[data-site-left]');
      if (builders) builders.textContent = stats.builders;
      if (speed) speed.textContent = stats.speed;
      if (left) left.textContent = stats.left;
    }
    const queue = panel.querySelector('[data-queue-progress]');
    if (queue && b.queue && b.queue[0]) {
      const item = b.queue[0];
      queue.style.width = `${Math.round(pct(item.total - item.remaining, item.total) * 100)}%`;
    }
  } else if (this.session.selection.length === 1) {
    const unit = this.session.selection[0];
    const hp = panel.querySelector('[data-hp]');
    if (hp) {
      const ratio = pct(unit.hp, unit.maxHp);
      hp.style.width = `${Math.round(ratio * 100)}%`;
      hp.className = `fill ${ratio > 0.5 ? 'good' : ratio > 0.25 ? 'warn' : 'bad'}`;
    }
    const hpLabel = panel.querySelector('[data-hp-label]');
    if (hpLabel) hpLabel.textContent = `${Math.ceil(unit.hp)} / ${unit.maxHp}`;
  }
}

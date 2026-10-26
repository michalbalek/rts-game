import { t } from '../i18n/index.js';
import { escapeHtml } from './modals.js';
import { fmt } from './ui-format.js';

export function setGameCountdown(seconds) {
  if (!this.el.countdown) return;
  if (seconds === null || seconds === undefined) {
    this.el.countdown.classList.add('hidden');
    return;
  }
  this.el.countdown.classList.remove('hidden');
  this.el.countdown.innerHTML = `<span class="countdown-label">${t("Hra začíná")}</span><span class="countdown-value">${seconds}</span>`;
}

export function updateTopBar() {
  const session = this.session;
  const player = session.player;
  if (!player) return;
  const res = player.resources || {};
  const caps = this.getStorageCaps();

  if (this.el.resMoney) this.el.resMoney.textContent = fmt(res.money);
  if (this.el.resWood) this.el.resWood.textContent = fmt(res.wood);
  if (this.el.resStone) this.el.resStone.textContent = fmt(res.stone);
  if (this.el.resFood) this.el.resFood.textContent = fmt(res.food);
  if (this.el.resIron) this.el.resIron.textContent = fmt(res.iron);

  const stored = (res.wood || 0) + (res.stone || 0) + (res.iron || 0);
  if (this.el.storeValue) this.el.storeValue.textContent = `${fmt(stored)}/${fmt(caps.resources)}`;
  if (this.el.foodStoreValue) this.el.foodStoreValue.textContent = `${fmt(res.food)}/${fmt(caps.food)}`;

  const pop = player.population ?? 0;
  const capacity = player.capacity ?? 20;
  if (this.el.popValue) this.el.popValue.textContent = `${pop}/${capacity}`;

}

export function getStorageCaps() {
  if (this.session.sim) return this.session.sim.getStorageCaps(this.session.selfId);
  let resources = 0;
  let food = 0;
  for (const b of this.session.state.buildings) {
    if (b.ownerId !== this.session.selfId || !b.complete) continue;
    if (b.type === 'castle') { resources += 500; food += 300; }
    if (b.type === 'warehouse') resources += 500;
    if (b.type === 'granary') food += 300;
  }
  return { resources: resources || 500, food: food || 300 };
}

export function updateLegend() {
  const signature = this.session.state.players.map(p => `${p.id}:${p.alive}:${p.name}`).join('|');
  if (signature !== this.lastLegendSignature) this.renderLegend(false);
}

export function renderLegend(force) {
  if (!this.session || !this.el.minimapInfo) return;
  const players = this.session.state.players;
  this.lastLegendSignature = players.map(p => `${p.id}:${p.alive}:${p.name}`).join('|');
  this.el.minimapInfo.innerHTML = players.map(p => `
    <div class="legend-row ${p.alive ? '' : 'dead'} ${p.id === this.session.selfId ? 'self' : ''}">
      <span class="legend-dot" style="background:${p.color}"></span>
      <span class="legend-name">${escapeHtml(p.name)}</span>
      <span class="legend-pop">${p.alive ? p.population : '—'}</span>
    </div>`).join('') || `<div class="legend-row">${t("Žádní hráči")}</div>`;
  if (force) this.el.minimapInfo.classList.remove('hidden');
}

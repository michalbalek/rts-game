import { t } from '../i18n/index.js';
import { BUILDING_DEFS, BUILD_CATEGORIES, MARKET_PRICES } from '../sim/constants.js';
import { escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';

export function buildDock() {
  if (!this.el.buildDock) return;
  const category = BUILD_CATEGORIES.find(item => item.key === this.buildCategory) || BUILD_CATEGORIES[0];
  this.buildCategory = category.key;
  const cards = category.types.map(type => {
    const def = BUILDING_DEFS[type];
    const cost = Object.entries(def.cost)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `${MARKET_PRICES[key]?.icon || '🪙'} ${value}`)
      .join(' · ');
    return `
      <button class="build-card" data-type="${type}" title="${escapeHtml(t(def.name))}">
        <span class="build-icon">${def.icon}</span>
        <span class="build-name">${escapeHtml(t(def.name))}</span>
        <span class="build-cost">${cost}</span>
        <span class="build-size">${def.w}${t("×")}${def.h}</span>
        <span class="build-tip">
          <strong>${escapeHtml(t(def.name))}</strong>
          <span>${escapeHtml(t(def.desc))}</span>
          <span class="tip-line">⏱ ${def.buildTime} ${t("s ·")} ${def.w}${t("×")}${def.h} · ❤️ ${def.hp}</span>
          <span class="tip-line">${cost}</span>
        </span>
      </button>`;
  }).join('');
  this.el.buildDock.innerHTML = `
    <div class="dock-heading">${t("Stavby")} <span>${t("odstup 20 bloků od nepřítele")}</span></div>
    <div class="dock-categories" aria-label="${t('Kategorie staveb')}">
      ${BUILD_CATEGORIES.map(item => `<button class="dock-category${item.key === category.key ? ' active' : ''}" data-category="${item.key}" aria-pressed="${item.key === category.key}">${escapeHtml(t(item.name))}</button>`).join('')}
    </div>
    <div class="dock-cards">${cards}</div>`;

  this.el.buildDock.querySelectorAll('.dock-category').forEach(button => {
    button.addEventListener('click', () => {
      this.buildCategory = button.dataset.category;
      this.buildDock();
      this.refreshBuildDock();
      audio.play('click', { volume: 0.6 });
    });
  });
  this.el.buildDock.querySelectorAll('.build-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      this.setBuildMode(this.buildMode === type ? null : type);
      audio.play('click', { volume: 0.6 });
    });
    this.refreshBuildDock();
  });
}

export function refreshBuildDock() {
  if (!this.session) return;
  this.el.buildDock.querySelectorAll('.build-card').forEach(card => {
    card.classList.toggle('active', card.dataset.type === this.buildMode);
    card.classList.toggle('unaffordable', !this.canAfford(BUILDING_DEFS[card.dataset.type].cost));
  });
}

export function updateDockAffordability() {
  this.refreshBuildDock();
}

export function canAfford(cost) {
  const player = this.session && this.session.player;
  if (!player || !player.resources || !cost) return false;
  return Object.keys(cost).every(key => (player.resources[key] || 0) >= (cost[key] || 0));
}

export function setBuildMode(type) {
  if ((type || null) !== this.buildMode) this.buildRotation = 0;
  this.buildMode = type || null;
  this.refreshBuildDock();
  if (!this.el.buildBanner) return;
  if (!this.buildMode) {
    this.hideBanner();
    return;
  }
  const def = BUILDING_DEFS[this.buildMode];
  if (!def) { this.hideBanner(); return; }
  this.el.buildBanner.classList.remove('hidden');
  this.el.buildBanner.innerHTML = `
    <span class="banner-icon">${def.icon}</span>
    <span class="banner-text">
      <strong>${t("Stavím:")} ${escapeHtml(t(def.name))}</strong>
      <span>${this.buildMode === 'wall' ? t("Tažením levého tlačítka vyznačte hradbu · pravé tlačítko nebo ESC zruší") : t("Levé tlačítko umístí budovu · R otočí · pravé tlačítko nebo ESC zruší")}</span>
    </span>
    <button class="btn btn-secondary btn-small" id="cancel-build">${t("Zrušit")}</button>`;
  const cancel = this.el.buildBanner.querySelector('#cancel-build');
  if (cancel) cancel.addEventListener('click', () => this.setBuildMode(null));
}

export function hideBanner() {
  if (this.el.buildBanner) {
    this.el.buildBanner.classList.add('hidden');
    this.el.buildBanner.innerHTML = '';
  }
}

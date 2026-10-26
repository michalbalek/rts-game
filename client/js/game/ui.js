import {
  BUILDING_DEFS, UNIT_DEFS, BUILD_MENU, MARKET_PRICES,
  RESOURCE_TYPES, PLAYER_COLORS, BUILD, buildSpeedFactor
} from '../sim/constants.js';
import {
  Modals, settingsForm, bindSettingsForm, helpContent, creditsContent, escapeHtml
} from './modals.js';
import { audio } from '../engine/audio.js';

const RESOURCE_ITEMS = [
  { key: 'money', icon: '🪙', name: 'Peníze' },
  { key: 'wood', icon: '🪵', name: 'Dřevo' },
  { key: 'stone', icon: '🪨', name: 'Kámen' },
  { key: 'food', icon: '🍎', name: 'Jídlo' },
  { key: 'iron', icon: '⛓️', name: 'Železo' }
];

function fmt(n) {
  return String(Math.floor(Number(n) || 0));
}

function pct(a, b) {
  if (!b) return 0;
  return Math.max(0, Math.min(1, a / b));
}

function assignedWorkers(b) {
  return Array.isArray(b.assignedWorkerIds) ? b.assignedWorkerIds.length : b.workers;
}

function workerLabel(b, def) {
  const enRoute = Math.max(0, assignedWorkers(b) - b.workers);
  return `${b.workers}/${def.workers}${enRoute ? ` +${enRoute}` : ''}`;
}

function timeLabel(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Herní HUD: horní lišta, dok staveb, výběrový panel, minimapa,
 * hlášení písaře a všechna herní dialogová okna.
 */
export class GameUI {
  constructor({ hooks = {}, settings, modals } = {}) {
    this.hooks = hooks;
    this.settings = settings || {};
    this.modals = modals || new Modals();
    this.session = null;
    this.buildMode = null;
    this.timer = 0;
    this.lastSelectionSignature = '';
    this.lastLegendSignature = '';
    this.resultsOpen = false;
    this.resultsReturnAt = 0;
    this.marketOpen = false;
    this.fps = 0;

    this.el = {
      hud: document.getElementById('hud'),
      buildDock: document.getElementById('build-dock'),
      selectionPanel: document.getElementById('selection-panel'),
      buildBanner: document.getElementById('build-banner'),
      toastRoot: document.getElementById('toast-root'),
      connectionBanner: document.getElementById('connection-banner'),
      minimapInfo: document.getElementById('minimap-info'),
      fps: document.getElementById('fps-counter'),
      countdown: document.getElementById('game-countdown'),
      resMoney: document.getElementById('res-money'),
      resWood: document.getElementById('res-wood'),
      resStone: document.getElementById('res-stone'),
      resFood: document.getElementById('res-food'),
      resIron: document.getElementById('res-iron'),
      storeValue: document.getElementById('store-value'),
      foodStoreValue: document.getElementById('food-store-value'),
      popValue: document.getElementById('pop-value'),
      menuButton: document.getElementById('menu-button')
    };

    this.buildDock();
    this.bindSelectionPanel();
    if (this.el.menuButton) {
      this.el.menuButton.addEventListener('click', () => {
        if (this.hooks.openMenu) this.hooks.openMenu();
      });
    }
  }

  // ------------------------------------------------------------------
  //  Životní cyklus
  // ------------------------------------------------------------------

  setSession(session) {
    this.session = session;
    this.buildMode = null;
    this.lastSelectionSignature = '';
    this.lastLegendSignature = '';
    this.resultsOpen = false;
    this.resultsReturnAt = 0;
    this.marketOpen = false;
    this.el.selectionPanel.innerHTML = '';
    this.hideBanner();
    this.setConnection(null);
    this.buildDock();
    this.refreshBuildDock();
    this.update(1);
    this.renderLegend(true);
  }

  clearSession() {
    this.session = null;
    this.buildMode = null;
    this.el.selectionPanel.innerHTML = '';
    this.el.buildDock.innerHTML = '';
    this.el.minimapInfo.innerHTML = '';
    this.hideBanner();
    this.setConnection(null);
    this.closeResults();
  }

  showHud(show) {
    if (this.el.hud) this.el.hud.classList.toggle('hidden', !show);
  }

  setShowFps(show) {
    this.settings.showFps = !!show;
    if (this.el.fps) this.el.fps.classList.toggle('hidden', !show);
  }

  setFps(value) {
    this.fps = value;
    if (this.el.fps && this.settings.showFps) {
      this.el.fps.textContent = `${Math.round(value)} FPS`;
    }
  }

  setConnection(text, kind = 'warning') {
    if (!this.el.connectionBanner) return;
    if (!text) {
      this.el.connectionBanner.classList.add('hidden');
      this.el.connectionBanner.textContent = '';
      return;
    }
    this.el.connectionBanner.classList.remove('hidden');
    this.el.connectionBanner.className = `connection-banner ${kind}`;
    this.el.connectionBanner.innerHTML = `<span class="spinner"></span><span>${escapeHtml(text)}</span>`;
  }

  setGameCountdown(seconds) {
    if (!this.el.countdown) return;
    if (seconds === null || seconds === undefined) {
      this.el.countdown.classList.add('hidden');
      return;
    }
    this.el.countdown.classList.remove('hidden');
    this.el.countdown.innerHTML = `<span class="countdown-label">Hra začíná</span><span class="countdown-value">${seconds}</span>`;
  }

  // ------------------------------------------------------------------
  //  Pravidelná aktualizace
  // ------------------------------------------------------------------

  update(dt = 0.016) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.15;
    if (!this.session) return;

    this.updateTopBar();
    this.updateDockAffordability();
    this.updateSelectionPanel();
    this.refreshDynamic();
    this.refreshMarket();
    this.updateLegend();
    this.updateResultsCountdown(dt);
  }

  updateTopBar() {
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

  getStorageCaps() {
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

  // ------------------------------------------------------------------
  //  Dok staveb
  // ------------------------------------------------------------------

  buildDock() {
    if (!this.el.buildDock) return;
    const cards = BUILD_MENU.map(type => {
      const def = BUILDING_DEFS[type];
      const cost = Object.entries(def.cost)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${MARKET_PRICES[key]?.icon || '🪙'} ${value}`)
        .join(' · ');
      return `
        <button class="build-card" data-type="${type}" title="${escapeHtml(def.name)}">
          <span class="build-icon">${def.icon}</span>
          <span class="build-name">${escapeHtml(def.name)}</span>
          <span class="build-cost">${cost}</span>
          <span class="build-size">${def.w}×${def.h}</span>
          <span class="build-tip">
            <strong>${escapeHtml(def.name)}</strong>
            <span>${escapeHtml(def.desc)}</span>
            <span class="tip-line">⏱ ${def.buildTime} s · ${def.w}×${def.h} · ❤️ ${def.hp}</span>
            <span class="tip-line">${cost}</span>
          </span>
        </button>`;
    }).join('');
    this.el.buildDock.innerHTML = `
      <div class="dock-heading">Stavby <span>odstup 20 bloků od nepřítele</span></div>
      <div class="dock-cards">${cards}</div>`;

    this.el.buildDock.querySelectorAll('.build-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        this.setBuildMode(this.buildMode === type ? null : type);
        audio.play('click', { volume: 0.6 });
      });
    });
  }

  refreshBuildDock() {
    if (!this.session) return;
    this.el.buildDock.querySelectorAll('.build-card').forEach(card => {
      card.classList.toggle('active', card.dataset.type === this.buildMode);
      card.classList.toggle('unaffordable', !this.canAfford(BUILDING_DEFS[card.dataset.type].cost));
    });
  }

  updateDockAffordability() {
    this.refreshBuildDock();
  }

  canAfford(cost) {
    const player = this.session && this.session.player;
    if (!player || !player.resources || !cost) return false;
    return Object.keys(cost).every(key => (player.resources[key] || 0) >= (cost[key] || 0));
  }

  setBuildMode(type) {
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
        <strong>Stavím: ${escapeHtml(def.name)}</strong>
        <span>Levé tlačítko umístí budovu · pravé tlačítko nebo ESC zruší</span>
      </span>
      <button class="btn btn-secondary btn-small" id="cancel-build">Zrušit</button>`;
    const cancel = this.el.buildBanner.querySelector('#cancel-build');
    if (cancel) cancel.addEventListener('click', () => this.setBuildMode(null));
  }

  hideBanner() {
    if (this.el.buildBanner) {
      this.el.buildBanner.classList.add('hidden');
      this.el.buildBanner.innerHTML = '';
    }
  }

  // ------------------------------------------------------------------
  //  Výběrový panel
  // ------------------------------------------------------------------

  bindSelectionPanel() {
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

  releaseSelectedVillagers() {
    if (!this.session || !this.session.local) return;
    const unitIds = this.session.selection
      .filter(unit => unit.work || unit.build)
      .map(unit => unit.id);
    const result = this.issue({ op: 'release', unitIds });
    if (result && result.ok) audio.play('ack');
  }

  selectedVillagerIds() {
    const s = this.session;
    if (!s) return [];
    return s.selection
      .filter(u => u.isVillager && u.ownerId === s.selfId)
      .map(u => u.id);
  }

  constructionSites() {
    const s = this.session;
    if (!s) return [];
    return s.state.buildings.filter(b => {
      if (b.ownerId !== s.selfId || b.complete) return false;
      const def = b.config || BUILDING_DEFS[b.type];
      return !!def && def.buildTime > 0;
    });
  }

  siteStats(b) {
    const def = b.config || BUILDING_DEFS[b.type];
    const info = this.session.getBuilderInfo(b);
    const active = info.active || 0;
    const total = info.total || 0;
    const factor = buildSpeedFactor(active);
    return {
      progress: Math.round(b.progress * 100),
      active,
      total,
      builders: `${active} na místě · ${total} přiřazeno`,
      speed: `${Math.round(factor * 100)} %`,
      left: factor > 0 ? `~${Math.ceil((1 - b.progress) * def.buildTime / factor)} s` : 'čeká na stavitele'
    };
  }

  siteLabel(b) {
    const { progress, active, total } = this.siteStats(b);
    return total ? `${progress} % · stavitelů ${active}/${total}` : `${progress} % · nikdo nestaví`;
  }

  siteInfoHtml(b) {
    const stats = this.siteStats(b);
    return `
      <div class="sel-rows" data-site-info>
        <div class="sel-row"><span>👷 Stavitelé</span><b data-site-builders>${stats.builders}</b></div>
        <div class="sel-row"><span>Rychlost stavby</span><b data-site-speed>${stats.speed}</b></div>
        <div class="sel-row"><span>Zbývá</span><b data-site-left>${stats.left}</b></div>
      </div>
      <p class="sel-desc">Vyberte poddané a v jejich panelu klikněte na tuto stavbu (sekce Stavět). Každý další stavitel přidá ${Math.round(BUILD.extraBuilderSpeed * 100)} % základní rychlosti.</p>`;
  }

  constructSectionHtml(units) {
    const s = this.session;
    if (!units.some(u => u.isVillager && u.ownerId === s.selfId)) return '';
    const sites = this.constructionSites();
    if (!sites.length) return '';
    let html = '<div class="train-section"><div class="sub-heading">Stavět</div><div class="train-buttons">';
    for (const site of sites) {
      const def = site.config || BUILDING_DEFS[site.type];
      html += `
        <button class="train-button" data-action="construct" data-building-id="${site.id}">
          <span class="train-icon">${def.icon}</span>
          <span class="train-info">
            <strong>${escapeHtml(def.name)}</strong>
            <span data-site-label>${escapeHtml(this.siteLabel(site))}</span>
          </span>
        </button>`;
    }
    html += '</div><p class="sel-desc">Vybraní poddaní půjdou na zvolenou stavbu a začnou stavět.</p></div>';
    return html;
  }

  updateSelectionPanel() {
    if (!this.session) return;
    const signature = this.selectionSignature();
    if (signature !== this.lastSelectionSignature) {
      this.lastSelectionSignature = signature;
      this.renderSelection(true);
    }
  }

  selectionSignature() {
    const s = this.session;
    if (!s) return 'none';
    if (s.selectedBuilding) {
      const b = s.selectedBuilding;
      return `b:${b.id}:${b.complete}:${b.workers}:${assignedWorkers(b)}:${b.queue ? b.queue.length : 0}:${!!b.repair}:${b.ownerId}`;
    }
    if (s.selection.length) {
      const sites = this.constructionSites().map(b => b.id).join(',');
      // Stav práce určuje tlačítko Uvolnit, takže musí být v podpisu výběru.
      return `u:${s.selection.map(u => `${u.id}:${u.type}:${u.work || u.build ? 'job' : ''}`).sort().join(',')}|s:${sites}`;
    }
    return 'none';
  }

  renderSelection() {
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

  emptySelectionHtml() {
    return `
      <div class="selection-empty">
        <span class="empty-crest">✠</span>
        <div>
          <strong>Vyberte budovu nebo jednotky</strong>
          <span>Levým tlačítkem klepněte, tažením vyberte více jednotek. Pravým tlačítkem velíte pohyb.</span>
        </div>
      </div>`;
  }

  buildingPanelHtml(b) {
    const def = b.config || BUILDING_DEFS[b.type];
    if (!def) return this.emptySelectionHtml();
    const owner = this.session.state.players.find(p => p.id === b.ownerId);
    const mine = b.ownerId === this.session.selfId;
    const ownerName = mine ? 'Vaše panství' : (owner ? owner.name : 'Neutrální');
    const hpRatio = pct(b.hp, b.maxHp);
    const hpClass = hpRatio > 0.55 ? 'good' : hpRatio > 0.25 ? 'warn' : 'bad';
    const status = !b.complete
      ? 'Rozestavěno'
      : b.repair ? 'Probíhá oprava' : (b.hp < b.maxHp ? 'Poškozeno' : 'V plném stavu');

    let body = '';
    if (!b.complete) {
      body += `
        <div class="sel-progress">
          <div class="bar"><div class="fill build" data-build-progress style="width:${Math.round(b.progress * 100)}%"></div></div>
          <span data-build-label>${Math.round(b.progress * 100)} %</span>
        </div>`;
      if (def.buildTime > 0) body += this.siteInfoHtml(b);
    }

    if (def.workers) {
      const assigned = assignedWorkers(b);
      const enRoute = Math.max(0, assigned - b.workers);
      body += `
        <div class="sel-rows">
          <div class="sel-row">
            <span>👤 Poddaní</span>
            <div class="worker-controls">
              <button class="icon-btn" data-action="unassign" title="Odebrat dělníka" ${!mine || assigned <= 0 ? 'disabled' : ''}>−</button>
              <b data-workers title="${enRoute ? `${enRoute} na cestě do budovy` : ''}">${workerLabel(b, def)}</b>
              <button class="icon-btn" data-action="assign" title="Přiřadit dělníka" ${!mine || !b.complete || assigned >= def.workers ? 'disabled' : ''}>+</button>
            </div>
          </div>
          <div class="sel-row"><span>Produkce</span><b>${resourceName(def.produce)}</b></div>
        </div>`;
    }

    if (def.trains && def.trains.length && b.complete) {
      body += `<div class="train-section"><div class="sub-heading">Výcvik</div><div class="train-buttons">`;
      for (const unitType of def.trains) {
        const unit = UNIT_DEFS[unitType];
        const cost = Object.entries(unit.cost).filter(([, v]) => v > 0)
          .map(([k, v]) => `${MARKET_PRICES[k]?.icon || '🪙'} ${v}`).join(' · ');
        body += `
          <button class="train-button" data-action="train" data-unit="${unitType}" ${!mine ? 'disabled' : ''}>
            <span class="train-icon">${unit.icon}</span>
            <span class="train-info">
              <strong>${escapeHtml(unit.name)}</strong>
              <span>${cost} · ${unit.trainTime} s</span>
            </span>
          </button>`;
      }
      body += `</div>`;
      if (b.queue && b.queue.length) {
        body += `<div class="queue-list">`;
        b.queue.slice(0, 4).forEach((item, index) => {
          const unit = UNIT_DEFS[item.unitType];
          const ratio = item.total ? 1 - item.remaining / item.total : 0;
          body += `
            <div class="queue-item ${index === 0 ? 'current' : ''}">
              <span>${unit ? unit.icon : '⚔️'} ${unit ? unit.name : item.unitType}</span>
              ${index === 0
                ? `<div class="bar tiny"><div class="fill" data-queue-progress style="width:${Math.round(ratio * 100)}%"></div></div>`
                : `<span class="queue-count">${Math.ceil(item.remaining)} s</span>`}
            </div>`;
        });
        body += `</div>`;
      }
      body += `</div>`;
    }

    if (def.market && b.complete && mine) {
      body += `<button class="btn btn-secondary wide" data-action="market">🪙 Otevřít obchod</button>`;
    }

    if (mine && b.complete && def.cost && (def.cost.money || def.cost.wood || def.cost.stone)) {
      const repairCost = Object.entries(def.cost)
        .filter(([key, v]) => ['money', 'wood', 'stone'].includes(key) && v > 0)
        .map(([key, v]) => `${MARKET_PRICES[key]?.icon || '🪙'} ${Math.floor(v * 0.2)}`)
        .join(' · ');
      body += `
        <div class="building-actions">
          <button class="btn btn-secondary btn-small" data-action="repair" ${b.hp >= b.maxHp || b.repair || !b.complete ? 'disabled' : ''}>
            🔨 Opravit <span class="muted">(${repairCost})</span>
          </button>
          ${b.type !== 'castle' ? '<button class="btn btn-danger btn-small" data-action="demolish">🧱 Zbourat</button>' : ''}
          <button class="btn btn-secondary btn-small" data-action="focus">🎯 Najít</button>
        </div>`;
    }

    return `
      <div class="sel-head">
        <span class="sel-icon">${def.icon}</span>
        <div class="sel-title">
          <h3>${escapeHtml(def.name)}</h3>
          <span class="sel-meta" style="--owner:${b.ownerId ? PLAYER_COLORS[(b.ownerId - 1) % 4] : '#9a9a92'}">
            ${escapeHtml(ownerName)} · ${def.w}×${def.h} · ${status}
          </span>
        </div>
      </div>
      <div class="hp-line">
        <div class="bar"><div class="fill ${hpClass}" data-hp style="width:${Math.round(hpRatio * 100)}%"></div></div>
        <span data-hp-label>${Math.ceil(b.hp)} / ${b.maxHp}</span>
      </div>
      <p class="sel-desc">${escapeHtml(def.desc)}</p>
      ${body}`;
  }

  unitsPanelHtml(units) {
    const groups = new Map();
    for (const unit of units) {
      const g = groups.get(unit.type) || { type: unit.type, count: 0, hp: 0, maxHp: 0 };
      g.count++;
      g.hp += unit.hp;
      g.maxHp += unit.maxHp;
      groups.set(unit.type, g);
    }
    const single = units.length === 1 ? units[0] : null;
    const singleMine = single ? single.ownerId === this.session.selfId : false;
    let details = '';
    if (single) {
      const def = UNIT_DEFS[single.type];
      const ratio = pct(single.hp, single.maxHp);
      details = `
        <div class="hp-line">
          <div class="bar"><div class="fill ${ratio > 0.5 ? 'good' : ratio > 0.25 ? 'warn' : 'bad'}" data-hp style="width:${Math.round(ratio * 100)}%"></div></div>
          <span data-hp-label>${Math.ceil(single.hp)} / ${single.maxHp}</span>
        </div>
        <div class="stat-grid">
          <div><span>Poškození</span><b>${def.damage || 0}</b></div>
          <div><span>Dostřel</span><b>${def.range || 0}</b></div>
          <div><span>Rychlost</span><b>${def.speed}</b></div>
          <div><span>Brnění</span><b>${def.armor || 0}</b></div>
        </div>
        <p class="sel-desc">${escapeHtml(def.desc)}</p>`;
    } else {
      details = `
        <div class="unit-group-list">
          ${[...groups.values()].map(g => {
            const def = UNIT_DEFS[g.type];
            const ratio = pct(g.hp, g.maxHp);
            return `<div class="unit-group">
              <span class="group-icon">${def.icon}</span>
              <span class="group-name">${escapeHtml(def.name)}</span>
              <span class="group-count">${g.count}×</span>
              <div class="bar tiny"><div class="fill ${ratio > 0.5 ? 'good' : ratio > 0.25 ? 'warn' : 'bad'}" style="width:${Math.round(ratio * 100)}%"></div></div>
            </div>`;
          }).join('')}
        </div>`;
    }

    const hasJob = units.some(u => u.work || u.build);
    const ownedSelection = units.every(u => u.ownerId === this.session.selfId);
    const canRelease = hasJob && ownedSelection && this.session.local;
    return `
      <div class="sel-head">
        <span class="sel-icon">${single ? UNIT_DEFS[single.type].icon : '⚔️'}</span>
        <div class="sel-title">
          <h3>${single ? escapeHtml(UNIT_DEFS[single.type].name) : `${units.length} jednotek`}</h3>
          <span class="sel-meta">${single
            ? (singleMine ? 'Vaše jednotka' : 'Cizí jednotka')
            : 'Vybraná skupina'} · ${units.filter(u => u.isVillager).length} poddaných</span>
        </div>
      </div>
      ${details}
      ${this.constructSectionHtml(units)}
      <div class="building-actions">
        ${canRelease ? '<button class="btn btn-secondary btn-small" data-action="release-villagers">🏠 Uvolnit z práce</button>' : ''}
        <button class="btn btn-secondary btn-small" data-action="clear-selection">✖ Zrušit výběr</button>
      </div>`;
  }

  refreshDynamic() {
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
        workers.title = enRoute ? `${enRoute} na cestě do budovy` : '';
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

  // ------------------------------------------------------------------
  //  Minimapa – legenda
  // ------------------------------------------------------------------

  updateLegend() {
    const signature = this.session.state.players.map(p => `${p.id}:${p.alive}:${p.name}`).join('|');
    if (signature !== this.lastLegendSignature) this.renderLegend(false);
  }

  renderLegend(force) {
    if (!this.session || !this.el.minimapInfo) return;
    const players = this.session.state.players;
    this.lastLegendSignature = players.map(p => `${p.id}:${p.alive}:${p.name}`).join('|');
    this.el.minimapInfo.innerHTML = players.map(p => `
      <div class="legend-row ${p.alive ? '' : 'dead'} ${p.id === this.session.selfId ? 'self' : ''}">
        <span class="legend-dot" style="background:${p.color}"></span>
        <span class="legend-name">${escapeHtml(p.name)}</span>
        <span class="legend-pop">${p.alive ? p.population : '—'}</span>
      </div>`).join('') || '<div class="legend-row">Žádní hráči</div>';
    if (force) this.el.minimapInfo.classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  //  Hlášení a příkazy
  // ------------------------------------------------------------------

  issue(cmd) {
    if (!this.session) return null;
    const result = this.hooks.command ? this.hooks.command(cmd) : this.session.command(cmd);
    if (result && result.ok === false && result.reason) {
      this.toast(result.reason, 'error');
      audio.play('error');
    }
    return result;
  }

  toast(text, kind = 'info') {
    if (!this.el.toastRoot) return;
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.innerHTML = `<span class="toast-icon">${kind === 'error' ? '⚠️' : kind === 'success' ? '✅' : '📜'}</span><span>${escapeHtml(text)}</span>`;
    this.el.toastRoot.appendChild(node);
    while (this.el.toastRoot.children.length > 5) {
      this.el.toastRoot.firstElementChild.remove();
    }
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 350);
    }, kind === 'error' ? 6000 : 4500);
  }

  // ------------------------------------------------------------------
  //  Dialogová okna
  // ------------------------------------------------------------------

  openSettings(onClose) {
    const body = settingsForm(this.settings);
    this.modals.open({
      title: 'Nastavení',
      icon: '⚙️',
      body,
      className: 'modal-settings',
      actions: [{ label: 'Zavřít', kind: 'btn-primary', onClick: (m) => m.close() }],
      onClose
    });
    bindSettingsForm(this.modals.root, this.settings, (settings) => {
      if (this.hooks.applySettings) this.hooks.applySettings(settings);
    });
  }

  openHelp() {
    this.modals.open({
      title: 'Nápověda',
      icon: '📖',
      body: helpContent(),
      className: 'modal-help',
      actions: [{ label: 'Rozumím', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
  }

  openCredits() {
    this.modals.open({
      title: 'Kredity',
      icon: '👑',
      body: creditsContent(),
      className: 'modal-credits',
      actions: [{ label: 'Zavřít', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
  }

  showPause({ multiplayer = false, onSave, onResume, onSettings, onQuit }) {
    const body = multiplayer
      ? `<p class="modal-paragraph">Hra v multiplayeru běží dál, i když je toto menu otevřené. Odejitím ze hry okamžitě prohráváte.</p>`
      : `<p class="modal-paragraph">Hra je pozastavena. Čas se zastavil a nic se neděje, dokud nebudete pokračovat.</p>`;
    const actions = [
      { label: 'Pokračovat', kind: 'btn-primary', onClick: (m) => { m.close(); if (onResume) onResume(); } }
    ];
    if (!multiplayer && onSave) {
      actions.push({
        label: 'Uložit hru',
        kind: 'btn-secondary',
        onClick: (m) => { m.close(); onSave(); }
      });
    }
    actions.push(
      { label: 'Nastavení', kind: 'btn-secondary', onClick: (m) => { if (onSettings) onSettings(); else this.openSettings(); } },
      { label: multiplayer ? 'Odejít ze hry' : 'Ukončit hru', kind: 'btn-danger', onClick: (m) => { m.close(); if (onQuit) onQuit(); } }
    );
    this.modals.open({
      title: 'Herní menu',
      icon: '✠',
      body,
      className: 'modal-pause',
      dismissable: true,
      actions,
      onClose: () => { if (onResume) onResume(); }
    });
  }

  confirmDemolish(building) {
    const def = building.config || BUILDING_DEFS[building.type];
    const refund = Object.entries(def.cost)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `${MARKET_PRICES[key]?.icon || '🪙'} ${Math.floor(value * 0.5)}`)
      .join(' · ') || 'nic';
    this.modals.open({
      title: 'Zbourat budovu?',
      icon: '🧱',
      body: `
        <p class="modal-paragraph">Opravdu chcete zbourat <strong>${escapeHtml(def.name)}</strong>?</p>
        <p class="modal-paragraph">Vrátí se 50 % nákladů: ${refund}. Zásoby uvnitř se ztratí a dělníci se vrátí k ohništi.</p>`,
      actions: [
        { label: 'Zrušit', kind: 'btn-secondary', onClick: (m) => m.close() },
        {
          label: 'Zbourat',
          kind: 'btn-danger',
          onClick: (m) => {
            m.close();
            this.issue({ op: 'demolish', buildingId: building.id });
            audio.play('demolish');
          }
        }
      ]
    });
  }

  showMarket() {
    if (!this.session) return;
    const rows = Object.entries(MARKET_PRICES).map(([key, price]) => `
      <div class="market-row">
        <span class="market-name">${price.icon} ${price.name}</span>
        <span class="market-stock" data-market-stock="${key}">0</span>
        <span class="market-price buy">${price.buy} 🪙</span>
        <span class="market-price sell">${price.sell} 🪙</span>
        <div class="market-actions">
          <button class="btn btn-secondary btn-small" data-market-op="buy" data-resource="${key}">Koupit</button>
          <button class="btn btn-secondary btn-small" data-market-op="sell" data-resource="${key}">Prodat</button>
        </div>
      </div>`).join('');

    this.modals.open({
      title: 'Královský obchod',
      icon: '🪙',
      className: 'modal-market',
      body: `
        <div class="market-top">
          <span>Pokladna: <b data-market-money>0</b> 🪙</span>
          <label class="market-amount">Množství
            <input id="market-amount" class="text-input" type="number" min="1" max="500" value="10">
          </label>
        </div>
        <div class="market-head">
          <span>Surovina</span><span>Sklad</span><span>Nákup</span><span>Prodej</span><span></span>
        </div>
        <div class="market-list">${rows}</div>
        <p class="form-hint">Nákup i prodej probíhá okamžitě. Nákup omezuje pokladna a volné místo (sklad pro suroviny, sýpka pro jídlo), prodej zásoba suroviny.</p>`,
      actions: [{ label: 'Zavřít', kind: 'btn-primary', onClick: (m) => m.close() }],
      onClose: () => { this.marketOpen = false; }
    });
    this.marketOpen = true;
    const root = this.modals.root;
    root.querySelectorAll('[data-market-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        const amountInput = root.querySelector('#market-amount');
        const amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
        const op = btn.dataset.marketOp;
        const resource = btn.dataset.resource;
        this.issue({ op, resource, amount });
        audio.play('click');
        setTimeout(() => this.refreshMarket(), 80);
      });
    });
    this.refreshMarket();
  }

  refreshMarket() {
    if (!this.marketOpen || !this.session || !this.modals.root) return;
    const player = this.session.player;
    if (!player) return;
    const res = player.resources || {};
    const money = this.modals.root.querySelector('[data-market-money]');
    if (money) money.textContent = fmt(res.money);
    for (const key of Object.keys(MARKET_PRICES)) {
      const stock = this.modals.root.querySelector(`[data-market-stock="${key}"]`);
      if (stock) stock.textContent = fmt(res[key]);
    }
  }

  showResults({ victory, time, players, winnerId, returnIn, onRestart, onMenu }) {
    this.resultsOpen = true;
    this.resultsReturnAt = returnIn ? performance.now() + returnIn * 1000 : 0;
    const rows = (players || []).map(p => {
      const stats = p.stats || {};
      const isWinner = winnerId && p.id === winnerId;
      return `
        <tr class="${isWinner ? 'winner' : ''} ${p.alive ? '' : 'dead'}">
          <td><span class="legend-dot" style="background:${p.color || '#999'}"></span> ${escapeHtml(p.name)}${isWinner ? ' 👑' : ''}</td>
          <td>${p.alive ? 'Naživu' : 'Vyřazen'}</td>
          <td>${stats.destroyed || 0}</td>
          <td>${stats.trained || 0}</td>
          <td>${stats.gathered || 0}</td>
          <td>${stats.lost || 0}</td>
        </tr>`;
    }).join('');

    const title = victory ? 'Vítězství!' : 'Prohra';
    const icon = victory ? '👑' : '💀';
    const body = `
      <div class="results-banner ${victory ? 'victory' : 'defeat'}">
        <span>${icon}</span>
        <div>
          <strong>${victory ? 'Království je vaše!' : 'Vaše panství padlo.'}</strong>
          <span>Délka hry ${timeLabel(time || 0)}${returnIn ? ` · návrat do lobby za <b id="results-countdown">${returnIn}</b> s` : ''}</span>
        </div>
      </div>
      <table class="results-table">
        <thead><tr><th>Panství</th><th>Stav</th><th>Zničeno</th><th>Vycvičeno</th><th>Sebráno</th><th>Ztraceno</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">Bez záznamů</td></tr>'}</tbody>
      </table>`;

    const actions = [];
    if (onRestart) actions.push({ label: 'Hrát znovu', kind: 'btn-primary', onClick: (m) => { m.close(); this.resultsOpen = false; onRestart(); } });
    actions.push({
      label: 'Hlavní menu', kind: onRestart ? 'btn-secondary' : 'btn-primary',
      onClick: (m) => { m.close(); this.resultsOpen = false; if (onMenu) onMenu(); }
    });

    this.modals.open({
      title, icon, body, actions,
      className: 'modal-results',
      dismissable: false
    });
  }

  updateResultsCountdown() {
    if (!this.resultsOpen || !this.resultsReturnAt) return;
    const left = Math.max(0, Math.ceil((this.resultsReturnAt - performance.now()) / 1000));
    const el = this.modals.root && this.modals.root.querySelector('#results-countdown');
    if (el) el.textContent = String(left);
  }

  closeResults() {
    if (this.resultsOpen) {
      this.resultsOpen = false;
      this.modals.close();
    }
  }
}

function resourceName(key) {
  switch (key) {
    case 'wood': return '🪵 Dřevo';
    case 'stone': return '🪨 Kámen';
    case 'food': return '🍎 Jídlo';
    case 'iron': return '⛓️ Železo';
    default: return key || '—';
  }
}

export { timeLabel };

import { BUILDING_DEFS, UNIT_DEFS, MARKET_PRICES, PLAYER_COLORS } from '../sim/constants.js';
import { escapeHtml } from './modals.js';
import { pct, assignedWorkers, workerLabel, resourceName } from './ui-format.js';

export function emptySelectionHtml() {
  return `
    <div class="selection-empty">
      <span class="empty-crest">✠</span>
      <div>
        <strong>Vyberte budovu nebo jednotky</strong>
        <span>Levým tlačítkem klepněte, tažením vyberte více jednotek. Pravým tlačítkem velíte pohyb.</span>
      </div>
    </div>`;
}

export function buildingPanelHtml(b) {
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

export function unitsPanelHtml(units) {
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

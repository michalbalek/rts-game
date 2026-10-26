import { t } from '../i18n/index.js';
import { MAP_PRESETS, CAPITALS, BOT_DIFFICULTIES } from '../sim/constants.js';
import { escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';

export function showSingle() {
  this.show(`
    <div class="menu-screen sub-screen">
      ${this.backdrop()}
      <div class="sub-shell">
        <header class="sub-header">
          <button class="btn btn-secondary btn-back" data-action="back">${t("← Zpět")}</button>
          <div class="sub-title"><span class="kicker">${t("Single player")}</span><h2>${t("Jak si zahrajete?")}</h2></div>
        </header>
        <div class="mode-grid">
          <button class="mode-card" data-mode="bots">
            <span class="mode-icon">🤖</span>
            <h3>${t("Hra s boty")}</h3>
            <p>${t("Ujměte se panství a změřte síly s jedním až třemi počítačovými protivníky. Boti staví, těží a útočí podle herních pravidel.")}</p>
            <ul><li>${t("1–3 boti")}</li><li>${t("3 úrovně obtížnosti")}</li><li>${t("vítězství zničením hradů")}</li></ul>
            <span class="mode-cta">${t("Připravit tažení →")}</span>
          </button>
          <button class="mode-card sandbox" data-mode="sandbox">
            <span class="mode-icon">🏗️</span>
            <h3>${t("Vlastní stavba")}</h3>
            <p>${t("Klidná písečná pláň bez soupeřů. Stavějte, zkoušejte hospodářství a prohlížejte si království bez tlaku boje.")}</p>
            <ul><li>${t("bez botů")}</li><li>${t("bez vítězné podmínky")}</li><li>${t("konec přes herní menu")}</li></ul>
            <span class="mode-cta">${t("Vstoupit do písku →")}</span>
          </button>
        </div>
      </div>
    </div>`);
  this.bind('[data-action="back"]', 'click', () => this.showMain());
  this.root.querySelectorAll('[data-mode]').forEach(card => {
    card.addEventListener('click', () => {
      audio.play('click');
      this.setup.mode = card.dataset.mode;
      this.showSetup();
    });
  });
}

export function showSetup() {
  const s = this.setup;
  const mapCards = Object.entries(MAP_PRESETS).map(([key, map]) => `
    <button class="map-card ${s.mapType === key ? 'selected' : ''}" data-map="${key}">
      <canvas class="map-preview" width="320" height="150" data-preview="${key}"></canvas>
      <div class="map-card-body">
        <h3>${escapeHtml(t(map.name))}</h3>
        <p>${escapeHtml(t(map.desc))}</p>
        <div class="map-meta">
          <span>${map.size}${t("×")}${map.size}</span>
          <span>${map.positions} ${t("pozice")}</span>
          <span>${escapeHtml(t(map.biome))}</span>
        </div>
      </div>
    </button>`).join('');

  const capitalButtons = Object.entries(CAPITALS).map(([key, cap]) => `
    <button class="choice ${s.capital === key ? 'active' : ''}" data-cap="${key}">
      <strong>${escapeHtml(t(cap.name))}</strong>
      <small>${escapeHtml(t(cap.desc))}</small>
    </button>`).join('');

  const difficultyButtons = Object.entries(BOT_DIFFICULTIES).map(([key, diff]) => `
    <button class="choice ${s.difficulty === key ? 'active' : ''}" data-diff="${key}">
      <strong>${escapeHtml(t(diff.name))}</strong>
      <small>${escapeHtml(t(diff.desc))}</small>
    </button>`).join('');

  const botButtons = [1, 2, 3].map(n => `
    <button class="choice compact ${s.bots === n ? 'active' : ''}" data-bots="${n}">
      <strong>${n} ${n === 1 ? t("bot") : n < 5 ? t("boti") : t("botů")}</strong>
    </button>`).join('');

  const isBots = s.mode === 'bots';
  this.show(`
    <div class="menu-screen setup-screen">
      ${this.backdrop()}
      <div class="setup-shell">
        <header class="sub-header">
          <button class="btn btn-secondary btn-back" data-action="back">${t("← Zpět")}</button>
          <div class="sub-title">
            <span class="kicker">${isBots ? 'Hra s boty' : t("Vlastní stavba")}</span>
            <h2>${t("Příprava tažení")}</h2>
          </div>
          <div class="setup-mode-tag">${isBots ? t("🤖 Proti botům") : '🏗️ Sandbox'}</div>
        </header>

        <div class="setup-grid">
          <section class="setup-section">
            <div class="section-heading"><h3>${t("Výběr mapy")}</h3><span>${t("Náhled, biom a počet pozic")}</span></div>
            <div class="map-grid">${mapCards}</div>
          </section>

          <aside class="setup-options">
            <div class="option-group ${isBots ? '' : 'hidden'}" id="bot-options">
              <label class="option-label">${t("Počet botů")}</label>
              <div class="choice-row">${botButtons}</div>
            </div>

            <div class="option-group ${isBots ? '' : 'hidden'}" id="difficulty-options">
              <label class="option-label">${t("Úroveň bota")}</label>
              <div class="choice-column">${difficultyButtons}</div>
            </div>

            <div class="option-group">
              <label class="option-label">${t("Startovní kapitál")}</label>
              <div class="choice-column">${capitalButtons}</div>
            </div>

            <div class="option-group">
              <label class="toggle-row">
                <span><strong>${t("Mlha války")}</strong><small>${t("Neprozkoumaná země zůstane černá")}</small></span>
                <input type="checkbox" id="fog-toggle" ${s.fog ? 'checked' : ''}>
                <span class="toggle"></span>
              </label>
            </div>

            <div class="setup-summary" id="setup-summary"></div>

            <button class="btn btn-primary btn-start" data-action="start">${t("⚔️ Spustit hru")}</button>
          </aside>
        </div>
      </div>
    </div>`);

  for (const key of Object.keys(MAP_PRESETS)) {
    const canvas = this.root.querySelector(`[data-preview="${key}"]`);
    if (canvas) this.drawPreview(canvas, key);
  }

  this.bind('[data-action="back"]', 'click', () => this.showSingle());
  this.root.querySelectorAll('[data-map]').forEach(card => {
    card.addEventListener('click', () => {
      this.setup.mapType = card.dataset.map;
      this.root.querySelectorAll('[data-map]').forEach(c => c.classList.toggle('selected', c === card));
      this.updateSetupSummary();
      audio.play('click', { volume: 0.6 });
    });
  });
  this.root.querySelectorAll('[data-bots]').forEach(btn => {
    btn.addEventListener('click', () => {
      this.setup.bots = Number(btn.dataset.bots);
      this.root.querySelectorAll('[data-bots]').forEach(b => b.classList.toggle('active', b === btn));
      this.updateSetupSummary();
      audio.play('click', { volume: 0.6 });
    });
  });
  this.root.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      this.setup.difficulty = btn.dataset.diff;
      this.root.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('active', b === btn));
      this.updateSetupSummary();
      audio.play('click', { volume: 0.6 });
    });
  });
  this.root.querySelectorAll('[data-cap]').forEach(btn => {
    btn.addEventListener('click', () => {
      this.setup.capital = btn.dataset.cap;
      this.root.querySelectorAll('[data-cap]').forEach(b => b.classList.toggle('active', b === btn));
      this.updateSetupSummary();
      audio.play('click', { volume: 0.6 });
    });
  });
  this.bind('#fog-toggle', 'change', (e) => {
    this.setup.fog = e.target.checked;
    this.updateSetupSummary();
  });
  this.bind('[data-action="start"]', 'click', () => {
    audio.play('success');
    this.onStartSingle({ ...this.setup });
  });
  this.updateSetupSummary();
}

export function updateSetupSummary() {
  const el = this.root.querySelector('#setup-summary');
  if (!el) return;
  const map = MAP_PRESETS[this.setup.mapType];
  const capital = CAPITALS[this.setup.capital];
  const diff = BOT_DIFFICULTIES[this.setup.difficulty];
  el.innerHTML = `
    <div><span>${t("Mapa")}</span><b>${escapeHtml(t(map.name))}</b></div>
    <div><span>${t("Kapitál")}</span><b>${escapeHtml(t(capital.name))}</b></div>
    ${this.setup.mode === 'bots'
      ? `<div><span>${t("Protivníci")}</span><b>${this.setup.bots}${t("×")} ${escapeHtml(t(diff.name))}</b></div>`
      : `<div><span>${t("Protivníci")}</span><b>${t("žádní")}</b></div>`}
    <div><span>${t("Mlha války")}</span><b>${this.setup.fog ? t("zapnuta") : t("vypnuta")}</b></div>`;
}

import {
  MAP_PRESETS, MAP_SIZE, CAPITALS, BOT_DIFFICULTIES, TILE_TYPES, RESOURCE_TYPES
} from '../sim/constants.js';
import { GameMap } from '../sim/mapgen.js';
import { isValidNick } from './settings.js';
import { readSaveInfo, formatSaveLabel } from './save.js';
import {
  settingsForm, bindSettingsForm, helpContent, creditsContent, escapeHtml
} from './modals.js';
import { audio } from '../engine/audio.js';

const TIPS = [
  'Dřevorubec musí stát na stromě. Kamenolom a Železný důl celou plochou na ložisku.',
  'Mezi budovami musí zůstat volný pruh široký jednu dlaždici. Sklady lze stavět těsně vedle sebe.',
  'Poddaní čekají u ohniště před hradem. Přiřaďte je do hospodářství nebo je povolejte jako vojáky.',
  'Lučištníkova střela letí obloukem a může minout pohybující se cíl. Pěšák je spolehlivější v tlačenici.',
  'Sýpka pojme 300 jídla, hrad slouží jako první sýpka i sklad.',
  'Další peníze získáte prodejem přebytečných surovin v Obchodu.',
  'Vyčerpané ložisko zmizí. Po třech minutách se objeví nové ložisko jinde na mapě.',
  'Stromy se po pokácení obnovují za 30 až 90 sekund. Jablka v sadu jsou nevyčerpatelná.',
  'Zničená budova vrátí 50 % surovin. Při bourání vlastní budovy se vrací také 50 %.',
  'V multiplayeru platí: kdo ztratí hrad, prohrává. Hra pokračuje, dokud nezůstane jediný hrad.',
  'Ctrl + 1–9 uloží skupinu jednotek, samotné číslo ji vybere.',
  'Mezerník kdykoli vycentruje kameru na váš Královský hrad.'
];

const PREVIEW_SEEDS = { desert: 1337, oasis: 4242, canyon: 9001 };

const MINI_COLORS = {
  [TILE_TYPES.SAND]: [216, 177, 113],
  [TILE_TYPES.DUNE]: [203, 160, 95],
  [TILE_TYPES.CLAY]: [184, 140, 83],
  [TILE_TYPES.GRASS]: [79, 125, 56],
  [TILE_TYPES.WATER_DEEP]: [29, 98, 118],
  [TILE_TYPES.WATER_SHALLOW]: [61, 146, 158],
  [TILE_TYPES.ROCK]: [161, 129, 90]
};

/**
 * Úvodní menu, příprava hry, načítání, hledání serveru a lobby.
 */
export class Menu {
  constructor({
    root, modals, getSettings, applySettings,
    onStartSingle, onStartMultiplayer, onLoadGame, onCancelSearch, onLeaveLobby, onQuit
  }) {
    this.root = root;
    this.modals = modals;
    this.getSettings = getSettings || (() => ({}));
    this.applySettings = applySettings || (() => {});
    this.onStartSingle = onStartSingle || (() => {});
    this.onStartMultiplayer = onStartMultiplayer || (() => {});
    this.onLoadGame = onLoadGame || (() => {});
    this.onCancelSearch = onCancelSearch || (() => {});
    this.onLeaveLobby = onLeaveLobby || (() => {});
    this.onQuit = onQuit || (() => {});
    this.previewCache = new Map();
    this.lastNick = '';
    this.lobby = null;
    this.setup = {
      mode: 'bots',
      mapType: 'desert',
      bots: 1,
      difficulty: 'medium',
      capital: 'medium',
      fog: false
    };
    this.loadingTip = TIPS[0];
    this.loadingBack = null;
  }

  // ------------------------------------------------------------------
  //  Pomocné
  // ------------------------------------------------------------------

  show(html) {
    if (!this.root) return;
    this.root.classList.remove('hidden');
    this.root.innerHTML = html;
    const firstButton = this.root.querySelector('.menu-entry.primary, .btn-primary');
    if (firstButton) firstButton.focus({ preventScroll: true });
  }

  hide() {
    if (!this.root) return;
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
    this.lobby = null;
  }

  bind(selector, event, fn) {
    const el = this.root.querySelector(selector);
    if (el) el.addEventListener(event, fn);
    return el;
  }

  crest() {
    return `<div class="crusader-crest"><span class="crest-cross">✠</span></div>`;
  }

  backdrop() {
    return `
      <div class="menu-backdrop" aria-hidden="true">
        <div class="menu-sun"></div>
        <div class="menu-cloud cloud-a"></div>
        <div class="menu-cloud cloud-b"></div>
        <div class="dune dune-back"></div>
        <div class="dune dune-mid"></div>
        <div class="dune dune-front"></div>
        <div class="menu-silhouette">
          <svg viewBox="0 0 420 150" aria-hidden="true">
            <path fill="rgba(38,23,10,0.55)" d="M0 150V110h26V70h10V56h16v14h8v40h18V84h12V58h10V40h12v18h10v26h14v66z"/>
            <path fill="rgba(38,23,10,0.55)" d="M120 150V92h14V70h12V46h10V22h12v24h10v24h12v22h18v58z"/>
            <path fill="rgba(38,23,10,0.55)" d="M214 150V104h30V82h14V60h12V38h10v22h10v22h14v22h28v46z"/>
            <path fill="rgba(30,18,8,0.6)" d="M322 150v-42h20V80h10V62h14v18h10v28h16V86h14V66h14v84z"/>
            <path fill="rgba(38,23,10,0.55)" d="M30 150v-8h60v8zM140 150v-8h50v8zM250 150v-8h70v8z"/>
            <rect x="270" y="12" width="3" height="34" fill="rgba(38,23,10,0.6)"/>
            <path d="M273 13h20l-6 7 6 7h-20z" fill="rgba(190,48,48,0.55)"/>
          </svg>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------
  //  Hlavní menu
  // ------------------------------------------------------------------

  showMain() {
    const settings = this.getSettings();
    const nick = settings.nick ? `<span class="menu-note">Nick: ${escapeHtml(settings.nick)}</span>` : '';
    const saveInfo = readSaveInfo();
    const loadEntry = saveInfo ? `
            <button class="menu-entry load" data-action="load">
              <span class="entry-icon">📜</span>
              <span class="entry-text"><strong>Načíst hru</strong><small>${escapeHtml(formatSaveLabel(saveInfo))}</small></span>
              <span class="entry-arrow">›</span>
            </button>` : '';
    this.show(`
      <div class="menu-screen main-menu">
        ${this.backdrop()}
        <div class="menu-shell">
          <div class="menu-brand">
            <div class="brand-crest">${this.crest()}</div>
            <div class="brand-kicker">Izometrická real-time strategie</div>
            <h1>KRÁLOVSTVÍ</h1>
            <p class="brand-subtitle">Poušť, oázy a pískovcové hrady</p>
            <p class="brand-flavor">Ujměte se vlády, řiďte poddané, stavte hradby a veďte své vojsko k jedinému královskému trůnu.</p>
            <div class="brand-badges">
              <span>🏰 3 mapy</span><span>⚔️ 4 hráči</span><span>👑 10 budov</span>
            </div>
            <div class="brand-footer">
              <span>Verze 2.0.0</span>
              ${nick}
            </div>
          </div>
          <div class="menu-panel main-links">
            <button class="menu-entry primary" data-action="single">
              <span class="entry-icon">🛡️</span>
              <span class="entry-text"><strong>Single player</strong><small>Hra s boty nebo vlastní stavba</small></span>
              <span class="entry-arrow">›</span>
            </button>
            ${loadEntry}
            <button class="menu-entry multiplayer" data-action="multiplayer">
              <span class="entry-icon">🌐</span>
              <span class="entry-text"><strong>Multiplayer</strong><small>Až 4 hráči na jednom serveru</small></span>
              <span class="entry-arrow">›</span>
            </button>
            <div class="menu-secondary-row">
              <button class="menu-entry small" data-action="settings"><span>⚙️</span><strong>Nastavení</strong></button>
              <button class="menu-entry small" data-action="help"><span>📖</span><strong>Nápověda</strong></button>
            </div>
            <div class="menu-secondary-row">
              <button class="menu-entry small" data-action="credits"><span>👑</span><strong>Kredity</strong></button>
              <button class="menu-entry small danger" data-action="quit"><span>🚪</span><strong>Konec</strong></button>
            </div>
          </div>
        </div>
        <footer class="menu-footer">Vyberte režim a vstupte do pouštního království.</footer>
      </div>`);

    this.bind('[data-action="single"]', 'click', () => { audio.play('click'); this.showSingle(); });
    this.bind('[data-action="load"]', 'click', () => { audio.play('click'); this.onLoadGame(); });
    this.bind('[data-action="multiplayer"]', 'click', () => { audio.play('click'); this.showMultiplayer(); });
    this.bind('[data-action="settings"]', 'click', () => { audio.play('click'); this.openSettings(); });
    this.bind('[data-action="help"]', 'click', () => { audio.play('click'); this.openHelp(); });
    this.bind('[data-action="credits"]', 'click', () => { audio.play('click'); this.openCredits(); });
    this.bind('[data-action="quit"]', 'click', () => { audio.play('click'); this.onQuit(); });
  }

  // ------------------------------------------------------------------
  //  Single player
  // ------------------------------------------------------------------

  showSingle() {
    this.show(`
      <div class="menu-screen sub-screen">
        ${this.backdrop()}
        <div class="sub-shell">
          <header class="sub-header">
            <button class="btn btn-secondary btn-back" data-action="back">← Zpět</button>
            <div class="sub-title"><span class="kicker">Single player</span><h2>Jak si zahrajete?</h2></div>
          </header>
          <div class="mode-grid">
            <button class="mode-card" data-mode="bots">
              <span class="mode-icon">🤖</span>
              <h3>Hra s boty</h3>
              <p>Ujměte se panství a změřte síly s jedním až třemi počítačovými protivníky. Boti staví, těží a útočí podle herních pravidel.</p>
              <ul><li>1–3 boti</li><li>3 úrovně obtížnosti</li><li>vítězství zničením hradů</li></ul>
              <span class="mode-cta">Připravit tažení →</span>
            </button>
            <button class="mode-card sandbox" data-mode="sandbox">
              <span class="mode-icon">🏗️</span>
              <h3>Vlastní stavba</h3>
              <p>Klidná písečná pláň bez soupeřů. Stavějte, zkoušejte hospodářství a prohlížejte si království bez tlaku boje.</p>
              <ul><li>bez botů</li><li>bez vítězné podmínky</li><li>konec přes herní menu</li></ul>
              <span class="mode-cta">Vstoupit do písku →</span>
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

  // ------------------------------------------------------------------
  //  Nastavení hry
  // ------------------------------------------------------------------

  showSetup() {
    const s = this.setup;
    const mapCards = Object.entries(MAP_PRESETS).map(([key, map]) => `
      <button class="map-card ${s.mapType === key ? 'selected' : ''}" data-map="${key}">
        <canvas class="map-preview" width="320" height="150" data-preview="${key}"></canvas>
        <div class="map-card-body">
          <h3>${escapeHtml(map.name)}</h3>
          <p>${escapeHtml(map.desc)}</p>
          <div class="map-meta">
            <span>${map.size}×${map.size}</span>
            <span>${map.positions} pozice</span>
            <span>${escapeHtml(map.biome)}</span>
          </div>
        </div>
      </button>`).join('');

    const capitalButtons = Object.entries(CAPITALS).map(([key, cap]) => `
      <button class="choice ${s.capital === key ? 'active' : ''}" data-cap="${key}">
        <strong>${escapeHtml(cap.name)}</strong>
        <small>${escapeHtml(cap.desc)}</small>
      </button>`).join('');

    const difficultyButtons = Object.entries(BOT_DIFFICULTIES).map(([key, diff]) => `
      <button class="choice ${s.difficulty === key ? 'active' : ''}" data-diff="${key}">
        <strong>${escapeHtml(diff.name)}</strong>
        <small>${escapeHtml(diff.desc)}</small>
      </button>`).join('');

    const botButtons = [1, 2, 3].map(n => `
      <button class="choice compact ${s.bots === n ? 'active' : ''}" data-bots="${n}">
        <strong>${n} ${n === 1 ? 'bot' : n < 5 ? 'boti' : 'botů'}</strong>
      </button>`).join('');

    const isBots = s.mode === 'bots';
    this.show(`
      <div class="menu-screen setup-screen">
        ${this.backdrop()}
        <div class="setup-shell">
          <header class="sub-header">
            <button class="btn btn-secondary btn-back" data-action="back">← Zpět</button>
            <div class="sub-title">
              <span class="kicker">${isBots ? 'Hra s boty' : 'Vlastní stavba'}</span>
              <h2>Příprava tažení</h2>
            </div>
            <div class="setup-mode-tag">${isBots ? '🤖 Proti botům' : '🏗️ Sandbox'}</div>
          </header>

          <div class="setup-grid">
            <section class="setup-section">
              <div class="section-heading"><h3>Výběr mapy</h3><span>Náhled, biom a počet pozic</span></div>
              <div class="map-grid">${mapCards}</div>
            </section>

            <aside class="setup-options">
              <div class="option-group ${isBots ? '' : 'hidden'}" id="bot-options">
                <label class="option-label">Počet botů</label>
                <div class="choice-row">${botButtons}</div>
              </div>

              <div class="option-group ${isBots ? '' : 'hidden'}" id="difficulty-options">
                <label class="option-label">Úroveň bota</label>
                <div class="choice-column">${difficultyButtons}</div>
              </div>

              <div class="option-group">
                <label class="option-label">Startovní kapitál</label>
                <div class="choice-column">${capitalButtons}</div>
              </div>

              <div class="option-group">
                <label class="toggle-row">
                  <span><strong>Mlha války</strong><small>Neprozkoumaná země zůstane černá</small></span>
                  <input type="checkbox" id="fog-toggle" ${s.fog ? 'checked' : ''}>
                  <span class="toggle"></span>
                </label>
              </div>

              <div class="setup-summary" id="setup-summary"></div>

              <button class="btn btn-primary btn-start" data-action="start">⚔️ Spustit hru</button>
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

  updateSetupSummary() {
    const el = this.root.querySelector('#setup-summary');
    if (!el) return;
    const map = MAP_PRESETS[this.setup.mapType];
    const capital = CAPITALS[this.setup.capital];
    const diff = BOT_DIFFICULTIES[this.setup.difficulty];
    el.innerHTML = `
      <div><span>Mapa</span><b>${escapeHtml(map.name)}</b></div>
      <div><span>Kapitál</span><b>${escapeHtml(capital.name)}</b></div>
      ${this.setup.mode === 'bots'
        ? `<div><span>Protivníci</span><b>${this.setup.bots}× ${escapeHtml(diff.name)}</b></div>`
        : '<div><span>Protivníci</span><b>žádní</b></div>'}
      <div><span>Mlha války</span><b>${this.setup.fog ? 'zapnuta' : 'vypnuta'}</b></div>`;
  }

  drawPreview(canvas, type) {
    try {
      let dataUrl = this.previewCache.get(type);
      if (!dataUrl) {
        const map = new GameMap(PREVIEW_SEEDS[type] || 1234, type, MAP_SIZE);
        const off = document.createElement('canvas');
        off.width = MAP_SIZE;
        off.height = MAP_SIZE;
        const ctx = off.getContext('2d');
        const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
        for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
          const tile = map.tiles[i];
          let rgb = MINI_COLORS[tile] || [216, 177, 113];
          const res = map.resources[i];
          if (res === RESOURCE_TYPES.TREE) rgb = [60, 103, 45];
          else if (res === RESOURCE_TYPES.STONE) rgb = [196, 166, 120];
          else if (res === RESOURCE_TYPES.IRON) rgb = [102, 96, 92];
          const o = i * 4;
          img.data[o] = rgb[0];
          img.data[o + 1] = rgb[1];
          img.data[o + 2] = rgb[2];
          img.data[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        // Startovní pozice.
        for (const [ix, iy] of [[55, 55], [142, 55], [142, 142], [55, 142]]) {
          ctx.fillStyle = 'rgba(255,240,190,0.95)';
          ctx.beginPath();
          ctx.arc(ix + 1.5, iy + 1.5, 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(120,60,20,0.9)';
          ctx.beginPath();
          ctx.arc(ix + 1.5, iy + 1.5, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        dataUrl = off.toDataURL();
        this.previewCache.set(type, dataUrl);
      }
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.imageSmoothingEnabled = false;
        const cropH = 118;
        ctx.drawImage(img, 0, 60, MAP_SIZE, cropH, 0, 0, canvas.width, canvas.height);
        const grad = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
        grad.addColorStop(0, 'rgba(20,12,6,0)');
        grad.addColorStop(1, 'rgba(20,12,6,0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };
      img.src = dataUrl;
    } catch (err) {
      console.warn('Náhled mapy se nepodařilo vykreslit', err);
    }
  }

  // ------------------------------------------------------------------
  //  Multiplayer
  // ------------------------------------------------------------------

  showMultiplayer() {
    const settings = this.getSettings();
    this.lastNick = settings.nick || '';
    this.show(`
      <div class="menu-screen sub-screen">
        ${this.backdrop()}
        <div class="multi-shell">
          <header class="sub-header">
            <button class="btn btn-secondary btn-back" data-action="back">← Zpět</button>
            <div class="sub-title"><span class="kicker">Multiplayer</span><h2>Vstupte do království</h2></div>
          </header>
          <div class="multi-card">
            <div class="multi-card-art">🌐</div>
            <div class="multi-card-body">
              <p>Hra vás automaticky přiřadí na dostupný server. Server zvolí mapu, startovní kapitál i mlhu války. Hra začne, jakmile jsou v lobby alespoň dva hráči.</p>
              <div class="form-row">
                <label for="mp-nick">Váš nick</label>
                <input id="mp-nick" class="text-input large" maxlength="16" value="${escapeHtml(settings.nick || '')}" placeholder="3–16 znaků">
                <div class="form-hint" id="mp-nick-hint">Písmena, číslice, mezera a podtržítko. Nick musí být na serveru jedinečný.</div>
              </div>
              <div class="multi-rules">
                <div><span>👥</span><b>2–4 hráči</b><small>žádné týmy</small></div>
                <div><span>🗺️</span><b>náhodná mapa</b><small>Střední kapitál</small></div>
                <div><span>🌫️</span><b>mlha války</b><small>výchozí vypnuta</small></div>
              </div>
              <button class="btn btn-primary btn-start" data-action="connect">🔌 Připojit se</button>
            </div>
          </div>
        </div>
      </div>`);

    this.bind('[data-action="back"]', 'click', () => this.showMain());
    const input = this.root.querySelector('#mp-nick');
    const hint = this.root.querySelector('#mp-nick-hint');
    const validate = () => {
      const nick = input.value.trim();
      this.lastNick = nick;
      if (!nick) {
        hint.textContent = 'Zadejte prosím nick.';
        hint.className = 'form-hint error';
        return false;
      }
      if (!isValidNick(nick)) {
        hint.textContent = 'Nick musí mít 3–16 znaků: písmena, číslice, mezera nebo podtržítko.';
        hint.className = 'form-hint error';
        return false;
      }
      hint.textContent = 'Nick je v pořádku.';
      hint.className = 'form-hint success';
      return true;
    };
    if (input) {
      input.addEventListener('input', validate);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && validate()) {
          audio.play('click');
          this.onStartMultiplayer(input.value.trim());
        }
      });
      setTimeout(() => input.focus(), 30);
    }
    this.bind('[data-action="connect"]', 'click', () => {
      if (!validate()) {
        audio.play('error');
        return;
      }
      audio.play('click');
      this.onStartMultiplayer(input.value.trim());
    });
  }

  showSearching() {
    this.show(`
      <div class="menu-screen center-screen">
        ${this.backdrop()}
        <div class="center-card">
          <div class="search-spinner"><span></span><span></span><span></span></div>
          <h2>Hledáme dostupný server…</h2>
          <p>Zkoušíme server na této adrese. Hledání může trvat nejdéle 10 sekund.</p>
          <button class="btn btn-secondary" data-action="cancel">Zrušit hledání</button>
        </div>
      </div>`);
    this.bind('[data-action="cancel"]', 'click', () => {
      audio.play('click');
      this.onCancelSearch();
    });
  }

  showMultiplayerError(message, { full = false } = {}) {
    this.show(`
      <div class="menu-screen center-screen">
        ${this.backdrop()}
        <div class="center-card error-card">
          <div class="error-icon">${full ? '🚫' : '⚠️'}</div>
          <h2>${full ? 'Všechny servery jsou plné' : 'Server není dostupný'}</h2>
          <p>${escapeHtml(message)}</p>
          <div class="center-actions">
            <button class="btn btn-primary" data-action="retry">Zkusit znovu</button>
            <button class="btn btn-secondary" data-action="back">Zpět do menu</button>
          </div>
        </div>
      </div>`);
    this.bind('[data-action="retry"]', 'click', () => {
      audio.play('click');
      this.onStartMultiplayer(this.lastNick || this.getSettings().nick || '');
    });
    this.bind('[data-action="back"]', 'click', () => this.showMain());
  }

  showLobby(lobby) {
    this.lobby = lobby;
    this.show(`
      <div class="menu-screen lobby-screen">
        ${this.backdrop()}
        <div class="lobby-shell">
          <header class="lobby-header">
            <div>
              <span class="kicker">${escapeHtml(lobby.serverName || 'Království server')}</span>
              <h2>Lobby</h2>
            </div>
            <button class="btn btn-secondary" data-action="leave">Opustit lobby</button>
          </header>
          <div class="lobby-grid">
            <section class="lobby-map panel">
              <canvas id="lobby-preview" width="360" height="170"></canvas>
              <div id="lobby-map-info"></div>
            </section>
            <section class="lobby-players panel">
              <div class="lobby-countdown" id="lobby-countdown"></div>
              <div id="lobby-players-list"></div>
              <div class="lobby-status" id="lobby-status"></div>
            </section>
          </div>
          <footer class="lobby-footer">
            <span>🌫️ Mlha války: <b>${lobby.fog ? 'zapnuta' : 'vypnuta'}</b></span>
            <span>🪙 Kapitál: <b>Střední</b></span>
            <span>🎲 Mapa: <b id="lobby-map-name">${escapeHtml(lobby.map ? lobby.map.name : 'náhodná')}</b></span>
          </footer>
        </div>
      </div>`);
    this.bind('[data-action="leave"]', 'click', () => {
      audio.play('click');
      this.onLeaveLobby();
    });
    if (lobby.map) {
      const canvas = this.root.querySelector('#lobby-preview');
      if (canvas) this.drawPreview(canvas, lobby.map.key);
    }
    this.updateLobby(lobby);
  }

  updateLobby(lobby) {
    if (!lobby) return;
    this.lobby = lobby;
    const playersEl = this.root.querySelector('#lobby-players-list');
    const countdownEl = this.root.querySelector('#lobby-countdown');
    const statusEl = this.root.querySelector('#lobby-status');
    const mapInfo = this.root.querySelector('#lobby-map-info');
    if (!playersEl) return;

    const max = lobby.maxPlayers || 4;
    const players = lobby.players || [];
    let slots = '';
    for (let i = 0; i < max; i++) {
      const player = players[i];
      if (player) {
        slots += `
          <div class="lobby-slot filled" style="--player-color:${player.color}">
            <span class="slot-dot"></span>
            <span class="slot-name">${escapeHtml(player.name)}</span>
            <span class="slot-tag">připraven</span>
          </div>`;
      } else {
        slots += `
          <div class="lobby-slot empty">
            <span class="slot-dot"></span>
            <span class="slot-name">Volné místo</span>
            <span class="slot-tag">čekáme</span>
          </div>`;
      }
    }
    playersEl.innerHTML = `
      <div class="lobby-players-head"><span>Hráči</span><span>${players.length}/${max}</span></div>
      <div class="lobby-slots">${slots}</div>`;

    if (countdownEl) {
      if (lobby.countdown && lobby.countdown > 0) {
        countdownEl.innerHTML = `<span>Hra začíná za</span><b>${lobby.countdown}</b><span>s</span>`;
        countdownEl.classList.add('active');
      } else {
        countdownEl.innerHTML = `<span>Čekáme na hráče</span><b>${players.length}/${max}</b><span>pro start</span>`;
        countdownEl.classList.remove('active');
      }
    }
    if (statusEl) {
      statusEl.textContent = players.length >= 2
        ? 'Hra se spustí automaticky. Hráči, kteří se připojí během odpočtu, se přidají.'
        : 'Hra začne, jakmile budou v lobby alespoň dva hráči.';
    }
    if (mapInfo && lobby.map) {
      mapInfo.innerHTML = `
        <h3>${escapeHtml(lobby.map.name)}</h3>
        <p>${escapeHtml(lobby.map.desc || '')}</p>
        <div class="map-meta">
          <span>${lobby.map.size || 200}×${lobby.map.size || 200}</span>
          <span>${lobby.map.positions || 4} pozice</span>
          <span>${escapeHtml(lobby.map.biome || '')}</span>
        </div>`;
    }
    const mapName = this.root.querySelector('#lobby-map-name');
    if (mapName && lobby.map) mapName.textContent = lobby.map.name;
  }

  // ------------------------------------------------------------------
  //  Načítání
  // ------------------------------------------------------------------

  showLoading(onBack) {
    this.loadingTip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.loadingBack = onBack || (() => this.showMain());
    this.show(`
      <div class="menu-screen loading-screen">
        ${this.backdrop()}
        <div class="loading-card">
          <div class="loading-crest">${this.crest()}</div>
          <span class="kicker">Království</span>
          <h2>Načítáme panství…</h2>
          <div class="loading-bar"><div class="loading-fill" id="loading-fill"></div></div>
          <div class="loading-percent" id="loading-percent">0 %</div>
          <div class="loading-tip">
            <span class="tip-label">Tip písaře</span>
            <span id="loading-tip">${escapeHtml(this.loadingTip)}</span>
          </div>
          <div class="loading-error hidden" id="loading-error">
            <p id="loading-error-text"></p>
            <button class="btn btn-primary" data-action="loading-back">Zpět do menu</button>
          </div>
        </div>
      </div>`);
    this.bind('[data-action="loading-back"]', 'click', () => this.loadingBack());
    this.setLoading(0, null);
  }

  setLoading(progress, tip) {
    if (!this.root) return;
    const fill = this.root.querySelector('#loading-fill');
    const percent = this.root.querySelector('#loading-percent');
    const tipEl = this.root.querySelector('#loading-tip');
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    if (fill) fill.style.width = `${value}%`;
    if (percent) percent.textContent = `${value} %`;
    if (tipEl && tip) tipEl.textContent = tip;
  }

  showLoadingError(message) {
    const box = this.root.querySelector('#loading-error');
    const text = this.root.querySelector('#loading-error-text');
    if (box) box.classList.remove('hidden');
    if (text) text.textContent = message || 'Při načítání hry došlo k chybě.';
    const fill = this.root.querySelector('#loading-fill');
    if (fill) fill.style.background = '#b91c1c';
  }

  // ------------------------------------------------------------------
  //  Dialogová okna
  // ------------------------------------------------------------------

  openSettings() {
    this.modals.open({
      title: 'Nastavení',
      icon: '⚙️',
      body: settingsForm(this.getSettings()),
      className: 'modal-settings',
      actions: [{ label: 'Zavřít', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
    bindSettingsForm(this.modals.root, this.getSettings(), (settings) => this.applySettings(settings));
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
}

export { TIPS };

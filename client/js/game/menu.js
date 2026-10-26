import { readSaveInfo, formatSaveLabel } from './save.js';
import { settingsForm, bindSettingsForm, helpContent, creditsContent, escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';
import { showSingle, showSetup, updateSetupSummary } from './menu-setup.js';
import { drawPreview } from './menu-preview.js';
import { showMultiplayer, showSearching, showMultiplayerError } from './menu-multiplayer.js';
import { showLobby, updateLobby } from './menu-lobby.js';
import { showLoading, setLoading, showLoadingError } from './menu-loading.js';

import { TIPS } from './menu-tips.js';

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

  showSingle(...args) {
    return showSingle.apply(this, args);
  }

  showSetup(...args) {
    return showSetup.apply(this, args);
  }

  updateSetupSummary(...args) {
    return updateSetupSummary.apply(this, args);
  }

  drawPreview(...args) {
    return drawPreview.apply(this, args);
  }

  showMultiplayer(...args) {
    return showMultiplayer.apply(this, args);
  }

  showSearching(...args) {
    return showSearching.apply(this, args);
  }

  showMultiplayerError(...args) {
    return showMultiplayerError.apply(this, args);
  }

  showLobby(...args) {
    return showLobby.apply(this, args);
  }

  updateLobby(...args) {
    return updateLobby.apply(this, args);
  }

  showLoading(...args) {
    return showLoading.apply(this, args);
  }

  setLoading(...args) {
    return setLoading.apply(this, args);
  }

  showLoadingError(...args) {
    return showLoadingError.apply(this, args);
  }

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

export { TIPS } from './menu-tips.js';

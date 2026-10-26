import { t } from '../i18n/index.js';
import { isValidNick } from './settings.js';
import { escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';

export function showMultiplayer() {
  const settings = this.getSettings();
  this.lastNick = settings.nick || '';
  this.show(`
    <div class="menu-screen sub-screen">
      ${this.backdrop()}
      <div class="multi-shell">
        <header class="sub-header">
          <button class="btn btn-secondary btn-back" data-action="back">${t("← Zpět")}</button>
          <div class="sub-title"><span class="kicker">${t("Multiplayer")}</span><h2>${t("Vstupte do království")}</h2></div>
        </header>
        <div class="multi-card">
          <div class="multi-card-art">🌐</div>
          <div class="multi-card-body">
            <p>${t("Hra vás automaticky přiřadí na dostupný server. Server zvolí mapu, startovní kapitál i mlhu války. Hra začne, jakmile jsou v lobby alespoň dva hráči.")}</p>
            <div class="form-row">
              <label for="mp-nick">${t("Váš nick")}</label>
              <input id="mp-nick" class="text-input large" maxlength="16" value="${escapeHtml(settings.nick || '')}" placeholder="${t("3–16 znaků")}">
              <div class="form-hint" id="mp-nick-hint">${t("Písmena, číslice, mezera a podtržítko. Nick musí být na serveru jedinečný.")}</div>
            </div>
            <div class="multi-rules">
              <div><span>👥</span><b>${t("2–4 hráči")}</b><small>${t("žádné týmy")}</small></div>
              <div><span>🗺️</span><b>${t("náhodná mapa")}</b><small>${t("Střední kapitál")}</small></div>
              <div><span>🌫️</span><b>${t("mlha války")}</b><small>${t("výchozí vypnuta")}</small></div>
            </div>
            <button class="btn btn-primary btn-start" data-action="connect">${t("🔌 Připojit se")}</button>
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
      hint.textContent = t("Zadejte prosím nick.");
      hint.className = 'form-hint error';
      return false;
    }
    if (!isValidNick(nick)) {
      hint.textContent = t("Nick musí mít 3–16 znaků: písmena, číslice, mezera nebo podtržítko.");
      hint.className = 'form-hint error';
      return false;
    }
    hint.textContent = t("Nick je v pořádku.");
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

export function showSearching() {
  this.show(`
    <div class="menu-screen center-screen">
      ${this.backdrop()}
      <div class="center-card">
        <div class="search-spinner"><span></span><span></span><span></span></div>
        <h2>${t("Hledáme dostupný server…")}</h2>
        <p>${t("Zkoušíme server na této adrese. Hledání může trvat nejdéle 10 sekund.")}</p>
        <button class="btn btn-secondary" data-action="cancel">${t("Zrušit hledání")}</button>
      </div>
    </div>`);
  this.bind('[data-action="cancel"]', 'click', () => {
    audio.play('click');
    this.onCancelSearch();
  });
}

export function showMultiplayerError(message, { full = false } = {}) {
  this.show(`
    <div class="menu-screen center-screen">
      ${this.backdrop()}
      <div class="center-card error-card">
        <div class="error-icon">${full ? '🚫' : '⚠️'}</div>
        <h2>${full ? t("Všechny servery jsou plné") : t("Server není dostupný")}</h2>
        <p>${escapeHtml(t(message))}</p>
        <div class="center-actions">
          <button class="btn btn-primary" data-action="retry">${t("Zkusit znovu")}</button>
          <button class="btn btn-secondary" data-action="back">${t("Zpět do menu")}</button>
        </div>
      </div>
    </div>`);
  this.bind('[data-action="retry"]', 'click', () => {
    audio.play('click');
    this.onStartMultiplayer(this.lastNick || this.getSettings().nick || '');
  });
  this.bind('[data-action="back"]', 'click', () => this.showMain());
}

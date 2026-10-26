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

export function showSearching() {
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

export function showMultiplayerError(message, { full = false } = {}) {
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

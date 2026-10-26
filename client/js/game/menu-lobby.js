import { escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';

export function showLobby(lobby) {
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

export function updateLobby(lobby) {
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

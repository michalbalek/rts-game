import { t } from '../i18n/index.js';
import { escapeHtml } from './modals.js';
import { timeLabel } from './ui-format.js';

export function showResults({ victory, time, players, winnerId, returnIn, onRestart, onMenu }) {
  this.resultsOpen = true;
  this.resultsReturnAt = returnIn ? performance.now() + returnIn * 1000 : 0;
  const rows = (players || []).map(p => {
    const stats = p.stats || {};
    const isWinner = winnerId && p.id === winnerId;
    return `
      <tr class="${isWinner ? 'winner' : ''} ${p.alive ? '' : 'dead'}">
        <td><span class="legend-dot" style="background:${p.color || '#999'}"></span> ${escapeHtml(p.name)}${isWinner ? ' 👑' : ''}</td>
        <td>${p.alive ? t("Naživu") : t("Vyřazen")}</td>
        <td>${stats.destroyed || 0}</td>
        <td>${stats.trained || 0}</td>
        <td>${stats.gathered || 0}</td>
        <td>${stats.lost || 0}</td>
      </tr>`;
  }).join('');

  const title = victory ? t("Vítězství!") : t("Prohra");
  const icon = victory ? '👑' : '💀';
  const body = `
    <div class="results-banner ${victory ? 'victory' : 'defeat'}">
      <span>${icon}</span>
      <div>
        <strong>${victory ? t("Království je vaše!") : t("Vaše panství padlo.")}</strong>
        <span>${t("Délka hry")} ${timeLabel(time || 0)}${returnIn ? ` ${t("· návrat do lobby za")} <b id="results-countdown">${returnIn}</b> s` : ''}</span>
      </div>
    </div>
    <table class="results-table">
      <thead><tr><th>${t("Panství")}</th><th>${t("Stav")}</th><th>${t("Zničeno")}</th><th>${t("Vycvičeno")}</th><th>${t("Sebráno")}</th><th>${t("Ztraceno")}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">${t("Bez záznamů")}</td></tr>`}</tbody>
    </table>`;

  const actions = [];
  if (onRestart) actions.push({ label: t("Hrát znovu"), kind: 'btn-primary', onClick: (m) => { m.close(); this.resultsOpen = false; onRestart(); } });
  actions.push({
    label: t("Hlavní menu"), kind: onRestart ? 'btn-secondary' : 'btn-primary',
    onClick: (m) => { m.close(); this.resultsOpen = false; if (onMenu) onMenu(); }
  });

  this.modals.open({
    title, icon, body, actions,
    className: 'modal-results',
    dismissable: false
  });
}

export function updateResultsCountdown() {
  if (!this.resultsOpen || !this.resultsReturnAt) return;
  const left = Math.max(0, Math.ceil((this.resultsReturnAt - performance.now()) / 1000));
  const el = this.modals.root && this.modals.root.querySelector('#results-countdown');
  if (el) el.textContent = String(left);
}

export function closeResults() {
  if (this.resultsOpen) {
    this.resultsOpen = false;
    this.modals.close();
  }
}

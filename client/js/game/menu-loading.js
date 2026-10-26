import { t } from '../i18n/index.js';
import { TIPS } from './menu-tips.js';
import { escapeHtml } from './modals.js';

export function showLoading(onBack) {
  this.loadingTip = TIPS[Math.floor(Math.random() * TIPS.length)];
  this.loadingBack = onBack || (() => this.showMain());
  this.show(`
    <div class="menu-screen loading-screen">
      ${this.backdrop()}
      <div class="loading-card">
        <div class="loading-crest">${this.crest()}</div>
        <span class="kicker">${t("Království")}</span>
        <h2>${t("Načítáme panství…")}</h2>
        <div class="loading-bar"><div class="loading-fill" id="loading-fill"></div></div>
        <div class="loading-percent" id="loading-percent">0 %</div>
        <div class="loading-tip">
          <span class="tip-label">${t("Tip písaře")}</span>
          <span id="loading-tip">${escapeHtml(t(this.loadingTip))}</span>
        </div>
        <div class="loading-error hidden" id="loading-error">
          <p id="loading-error-text"></p>
          <button class="btn btn-primary" data-action="loading-back">${t("Zpět do menu")}</button>
        </div>
      </div>
    </div>`);
  this.bind('[data-action="loading-back"]', 'click', () => this.loadingBack());
  this.setLoading(0, null);
}

export function setLoading(progress, tip) {
  if (!this.root) return;
  const fill = this.root.querySelector('#loading-fill');
  const percent = this.root.querySelector('#loading-percent');
  const tipEl = this.root.querySelector('#loading-tip');
  const value = Math.max(0, Math.min(100, Math.round(progress)));
  if (fill) fill.style.width = `${value}%`;
  if (percent) percent.textContent = `${value} %`;
  if (tipEl && tip) tipEl.textContent = t(tip);
}

export function showLoadingError(message) {
  const box = this.root.querySelector('#loading-error');
  const text = this.root.querySelector('#loading-error-text');
  if (box) box.classList.remove('hidden');
  if (text) text.textContent = t(message || 'Při načítání hry došlo k chybě.');
  const fill = this.root.querySelector('#loading-fill');
  if (fill) fill.style.background = '#b91c1c';
}

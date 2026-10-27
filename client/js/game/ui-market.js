import { t } from '../i18n/index.js';
import { MARKET_PRICES, AUTO_MARKET_MAX } from '../sim/constants.js';
import { audio } from '../engine/audio.js';
import { fmt } from './ui-format.js';

export function showMarket() {
  if (!this.session) return;
  const rows = Object.entries(MARKET_PRICES).map(([key, price]) => `
    <div class="market-row">
      <span class="market-name">${price.icon} ${t(price.name)}</span>
      <span class="market-stock" data-market-stock="${key}">0</span>
      <span class="market-price buy">${price.buy} 🪙</span>
      <span class="market-price sell">${price.sell} 🪙</span>
      <div class="market-actions">
        <button class="btn btn-secondary btn-small" data-market-op="buy" data-resource="${key}">${t("Koupit")}</button>
        <button class="btn btn-secondary btn-small" data-market-op="sell" data-resource="${key}">${t("Prodat")}</button>
      </div>
    </div>`).join('');
  const rules = Object.entries(MARKET_PRICES).map(([key, price]) => {
    const rule = this.session.player?.marketRules?.[key];
    return `
      <div class="market-rule" data-market-rule="${key}">
        <div class="market-rule-title">${price.icon} ${t(price.name)}</div>
        <label>${t("Dokoupit do")}
          <input class="text-input" type="number" min="0" max="${AUTO_MARKET_MAX}" step="1"
            data-rule-buy value="${rule?.buyTo ?? ''}" aria-label="${t("Dokoupit do")} – ${t(price.name)}">
        </label>
        <label>${t("Prodat nad")}
          <input class="text-input" type="number" min="0" max="${AUTO_MARKET_MAX}" step="1"
            data-rule-sell value="${rule?.sellTo ?? ''}" aria-label="${t("Prodat nad")} – ${t(price.name)}">
        </label>
        <button class="btn btn-secondary btn-small" data-rule-save="${key}">${t("Uložit pravidlo")}</button>
        <div class="market-rule-active" data-rule-active="${key}"></div>
      </div>`;
  }).join('');

  this.modals.open({
    title: t("Královský obchod"),
    icon: '🪙',
    className: 'modal-market',
    body: `
      <div class="market-top">
        <span>${t("Pokladna:")} <b data-market-money>0</b> 🪙</span>
        <label class="market-amount">${t("Množství")}
          <input id="market-amount" class="text-input" type="number" min="1" max="500" value="10">
        </label>
      </div>
      <div class="market-head">
        <span>${t("Surovina")}</span><span>${t("Sklad")}</span><span>${t("Nákup")}</span><span>${t("Prodej")}</span><span></span>
      </div>
      <div class="market-list">${rows}</div>
      <p class="form-hint">${t("Nákup i prodej probíhá okamžitě. Nákup omezuje pokladna a volné místo (sklad pro suroviny, sýpka pro jídlo), prodej zásoba suroviny.")}</p>
      <p class="market-error" data-market-error role="alert" hidden></p>
      <section class="market-automatic">
        <h3>${t("Automatický obchod")}</h3>
        <p class="form-hint">${t("Každých 10 herních sekund doplní zásobu pod nákupní hranicí nebo prodá přebytek nad prodejní hranicí. Prázdné pole pravidlo vypíná. Nákupní hranice nesmí být vyšší než prodejní.")}</p>
        <div class="market-rules">${rules}</div>
      </section>`,
    actions: [{ label: t("Zavřít"), kind: 'btn-primary', onClick: (m) => m.close() }],
    onClose: () => { this.marketOpen = false; }
  });
  this.marketOpen = true;
  const root = this.modals.root;
  root.querySelectorAll('[data-market-op]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelector('[data-market-error]').hidden = true;
      const amountInput = root.querySelector('#market-amount');
      const amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
      const op = btn.dataset.marketOp;
      const resource = btn.dataset.resource;
      this.issue({ op, resource, amount });
      audio.play('click');
      setTimeout(() => this.refreshMarket(), 80);
    });
  });
  root.querySelectorAll('[data-rule-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelector('[data-market-error]').hidden = true;
      const row = btn.closest('[data-market-rule]');
      const buy = row.querySelector('[data-rule-buy]');
      const sell = row.querySelector('[data-rule-sell]');
      if (!buy.checkValidity() || !sell.checkValidity()) {
        this.toast(t("Neplatná hranice automatického obchodu."), 'error');
        audio.play('error');
        return;
      }
      this.issue({
        op: 'market-rule', resource: btn.dataset.ruleSave,
        buyTo: buy.value === '' ? null : Number(buy.value),
        sellTo: sell.value === '' ? null : Number(sell.value)
      });
      this.refreshMarket();
    });
  });
  this.refreshMarket();
}

export function refreshMarket() {
  if (!this.marketOpen || !this.session || !this.modals.root) return;
  const player = this.session.player;
  if (!player) return;
  const res = player.resources || {};
  const money = this.modals.root.querySelector('[data-market-money]');
  if (money) money.textContent = fmt(res.money);
  for (const key of Object.keys(MARKET_PRICES)) {
    const stock = this.modals.root.querySelector(`[data-market-stock="${key}"]`);
    if (stock) stock.textContent = fmt(res[key]);
    const active = this.modals.root.querySelector(`[data-rule-active="${key}"]`);
    const rule = player.marketRules?.[key];
    if (active) {
      const buy = rule?.buyTo == null ? '—' : fmt(rule.buyTo);
      const sell = rule?.sellTo == null ? '—' : fmt(rule.sellTo);
      active.textContent = t("Uloženo: nákup do {0}, prodej nad {1}", { 0: buy, 1: sell });
    }
  }
}

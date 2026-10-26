import { t } from '../i18n/index.js';
import { MARKET_PRICES } from '../sim/constants.js';
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
      <p class="form-hint">${t("Nákup i prodej probíhá okamžitě. Nákup omezuje pokladna a volné místo (sklad pro suroviny, sýpka pro jídlo), prodej zásoba suroviny.")}</p>`,
    actions: [{ label: t("Zavřít"), kind: 'btn-primary', onClick: (m) => m.close() }],
    onClose: () => { this.marketOpen = false; }
  });
  this.marketOpen = true;
  const root = this.modals.root;
  root.querySelectorAll('[data-market-op]').forEach(btn => {
    btn.addEventListener('click', () => {
      const amountInput = root.querySelector('#market-amount');
      const amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
      const op = btn.dataset.marketOp;
      const resource = btn.dataset.resource;
      this.issue({ op, resource, amount });
      audio.play('click');
      setTimeout(() => this.refreshMarket(), 80);
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
  }
}

import { showMarket, refreshMarket } from '../../client/js/game/ui-market.js';
import { audio } from '../../client/js/engine/audio.js';

export function testAutoMarketUi(assert) {
  console.log('\n--- Rozhraní automatického obchodu ---');
  const buy = { value: '50', checkValidity: () => true };
  const sell = { value: '100', checkValidity: () => true };
  const row = { querySelector: selector => selector === '[data-rule-buy]' ? buy : sell };
  const ruleButton = {
    dataset: { ruleSave: 'stone' }, listeners: [],
    addEventListener(type, handler) { this.listeners.push(handler); },
    closest() { return row; }
  };
  const manualButtons = Array.from({ length: 8 }, () => ({
    addEventListener() {}
  }));
  const status = { textContent: '' };
  const error = { hidden: true };
  const root = {
    querySelectorAll(selector) {
      return selector === '[data-rule-save]' ? [ruleButton] : manualButtons;
    },
    querySelector(selector) {
      if (selector === '[data-market-error]') return error;
      if (selector === '[data-rule-active="stone"]') return status;
      return null;
    }
  };
  const commands = [];
  const messages = [];
  const ui = {
    session: { player: { resources: {}, marketRules: { stone: { buyTo: 50, sellTo: 100 } } } },
    modals: { root, open() {} },
    issue(cmd) { commands.push(cmd); },
    toast(message) { messages.push(message); },
    refreshMarket() { refreshMarket.call(this); }
  };
  const oldPlay = audio.play;
  audio.play = () => {};
  try {
    showMarket.call(ui);
    assert(ruleButton.listeners.length === 1, 'každé tlačítko pravidla má jen jeden posluchač');
    ruleButton.listeners[0]();
    assert(commands.length === 1 && commands[0].resource === 'stone' &&
      commands[0].buyTo === 50 && commands[0].sellTo === 100,
    'jedno kliknutí odešle jediný příkaz s oběma hranicemi');
    assert(status.textContent.includes('50') && status.textContent.includes('100'),
      'rozhraní zobrazuje uložené pravidlo');
    buy.value = '';
    sell.value = '';
    ruleButton.listeners[0]();
    assert(commands[1].buyTo === null && commands[1].sellTo === null,
      'prázdná pole vypínají nákup a prodej');
    buy.checkValidity = () => false;
    ruleButton.listeners[0]();
    assert(commands.length === 2 && messages.length === 1, 'neplatné pole zobrazí chybu a neodešle příkaz');
  } finally {
    audio.play = oldPlay;
  }
}

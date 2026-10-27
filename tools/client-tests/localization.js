import { readFileSync, readdirSync } from 'node:fs';
import { ENGLISH, getLanguage, getLocale, isLanguage, languageOptions, setLanguage, t } from '../../client/js/i18n/index.js';
import { notice, failure } from '../../client/js/sim/messages.js';
import { BUILDING_DEFS, UNIT_DEFS, MAP_PRESETS, CAPITALS, BOT_DIFFICULTIES, MARKET_PRICES } from '../../client/js/sim/constants.js';
import { Building, Unit } from '../../client/js/sim/entities.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../client/js/game/settings.js';
import { Menu } from '../../client/js/game/menu.js';
import { GameUI } from '../../client/js/game/ui.js';
import { settingsForm, helpContent, creditsContent } from '../../client/js/game/modals.js';
import { TIPS } from '../../client/js/game/menu-tips.js';
import { formatDateTime, formatSaveLabel } from '../../client/js/game/save.js';

export function testLocalization(assert) {
  console.log('\n--- Čeština a angličtina ---');
  const previous = getLanguage();
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = null;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: {
      getItem: () => stored,
      setItem: (key, value) => { stored = value; }
    }
  });
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    assert(loadSettings().language === 'cs', 'bez uložené volby zůstává výchozí čeština');
    saveSettings({ ...DEFAULT_SETTINGS, language: 'en' });
    assert(loadSettings().language === 'en', 'angličtina se zachová po opětovném načtení nastavení');
    stored = JSON.stringify({ language: 'xx', musicVolume: 25 });
    assert(loadSettings().language === 'cs' && loadSettings().musicVolume === 25,
      'nepodporovaný uložený jazyk přejde na češtinu bez ztráty ostatních voleb');
    stored = JSON.stringify({ quality: 'low' });
    assert(loadSettings().language === 'cs', 'starší nastavení bez jazyka zůstává kompatibilní');
    stored = '{broken';
    assert(loadSettings().language === 'cs', 'poškozené nastavení použije výchozí jazyk');
    const write = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => { throw new Error('Storage blocked'); };
    assert(saveSettings(DEFAULT_SETTINGS) === false && warnings.length === 1,
      'blokované úložiště ohlásí chybu a nevrací úspěch');
    warnings.length = 0;
    globalThis.localStorage.setItem = write;
    assert(isLanguage('cs') && isLanguage('en') && !isLanguage('xx') && !isLanguage('toString'),
      'podporovány jsou jen explicitně zaregistrované jazyky');
    let rejected = false;
    try { setLanguage('xx'); } catch (err) { rejected = err instanceof RangeError; }
    assert(rejected, 'neplatný jazyk není tiše přijat');

    for (const [key, translation] of Object.entries(ENGLISH)) {
      const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
      if (!translation || placeholders(key) !== placeholders(translation)) {
        assert(false, `překlad zachovává parametry: ${key}`);
      }
    }
    assert(Object.keys(ENGLISH).length > 450, 'katalog obsahuje překlady celého rozhraní');
    const gameDirectory = new URL('../../client/js/game/', import.meta.url);
    const sources = readdirSync(gameDirectory).filter(name => name.endsWith('.js'))
      .map(name => new URL(name, gameDirectory));
    sources.push(new URL('../../client/js/net.js', import.meta.url));
    const missing = [];
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g)) {
        const literal = match[1];
        const key = literal.startsWith('"') ? JSON.parse(literal)
          : literal.slice(1, -1).replace(/\\(['"\\])/g, '$1');
        if (!Object.hasOwn(ENGLISH, key)) missing.push(key);
      }
    }
    assert(missing.length === 0, `všechny textové klíče mají anglický překlad${missing.length ? ': ' + missing.join(', ') : ''}`);
    const definitions = [BUILDING_DEFS, UNIT_DEFS, MAP_PRESETS, CAPITALS, BOT_DIFFICULTIES, MARKET_PRICES];
    for (const group of definitions) {
      for (const def of Object.values(group)) {
        for (const field of ['name', 'desc', 'biome', 'voice']) {
          if (def[field]) assert(Object.hasOwn(ENGLISH, def[field]), `přeloženo: ${def[field]}`);
        }
      }
    }
    const html = readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8');
    for (const match of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
      assert(Object.hasOwn(ENGLISH, match[1]), `přeložen statický HUD: ${match[1]}`);
    }

    setLanguage('en');
    assert(t('Nastavení') === 'Settings' && getLocale() === 'en-GB', 'jazyk řídí překlady i formátování');
    assert(languageOptions().includes('value="en" selected'), 'selector ukazuje aktivní angličtinu');
    const message = JSON.parse(JSON.stringify(notice('Stavba zahájena: {0}', { 0: { key: 'Obydlí' } })));
    assert(message.text === 'Stavba zahájena: Obydlí' &&
      t(message.message) === 'Construction started: Dwelling',
    'síťová hláška zachová český text a lokalizuje vnořený název budovy na klientovi');
    const named = notice('Panství hráče {0} padlo.', { 0: 'Střední {1} <test>' });
    assert(t(named.message) === "Player Střední {1} <test>'s domain has fallen.",
      'nick není překládán ani znovu interpolován');
    const error = failure('Stavět nelze do {0} bloků od nepřátelské jednotky nebo budovy, sire!', { 0: 20 });
    assert(error.reason.includes('20 bloků') && t(error.message).includes('within 20 tiles'),
      'dynamická chyba umístění podporuje oba jazyky bez změny herních pravidel');
    let invalidBuilding;
    try { new Building(1, 'missing', 1, 0, 0); } catch (err) { invalidBuilding = err; }
    assert(invalidBuilding instanceof Error &&
      t(invalidBuilding.localized) === 'Unknown building: missing',
    'chyba poškozené uložené budovy se překládá včetně parametru');

    const menu = Object.create(Menu.prototype);
    let output = '';
    menu.show = value => { output = value; };
    menu.bind = () => null;
    menu.root = { querySelector: () => null, querySelectorAll: () => [] };
    menu.getSettings = () => ({ ...DEFAULT_SETTINGS, language: getLanguage() });
    menu.setup = { mode: 'bots', mapType: 'desert', bots: 2, difficulty: 'medium', capital: 'rich', fog: false };
    menu.showMain();
    assert(output.includes('id="menu-language"') && output.includes('KINGDOM') &&
      output.includes('Settings') && !output.includes('Nastavení'),
    'hlavní menu obsahuje selector a anglické položky');
    menu.showSingle();
    assert(output.includes('Sandbox') && output.includes('3 difficulty levels'), 'přeloženy oba singleplayer režimy');
    menu.showSetup();
    assert(output.includes('Desert River') && output.includes('Starting capital') &&
      output.includes('2 bots'), 'přeloženo nastavení mapy, kapitálu i počtu botů');
    menu.showMultiplayer();
    assert(output.includes('2–4 players') && output.includes('3–16 characters'),
      'přeložena pravidla multiplayeru i vstupní pole nicku');
    menu.showLobby({
      serverName: 'Království #1',
      serverNameMessage: { key: 'Království #{0}', params: { 0: 1 } },
      map: MAP_PRESETS.desert, players: [], fog: false
    });
    assert(output.includes('Kingdom #1') && output.includes('Leave lobby') &&
      output.includes('Desert River'), 'přeložena multiplayer lobby a serverová metadata');
    assert(settingsForm(DEFAULT_SETTINGS).includes('Graphics quality') &&
      settingsForm(DEFAULT_SETTINGS).includes('id="opt-language"') &&
      helpContent().includes('Right mouse button') && creditsContent().includes('Project authors'),
    'přeložena nastavení, nápověda a kredity');
    assert(helpContent().includes('nearest reachable owned construction site within 10 tiles'),
      'nápověda popisuje automatické pokračování stavby včetně dosahu');
    assert(TIPS.every(tip => t(tip) !== tip), 'tipy se překládají až při zobrazení, ne při importu');

    const ui = Object.create(GameUI.prototype);
    ui.session = {
      selfId: 1, local: true,
      state: { players: [{ id: 1, name: 'Střední' }], buildings: [] },
      getBuilderInfo: () => ({ active: 1, total: 2 })
    };
    const building = new Building(10, 'dwelling', 1, 20, 20, false);
    const buildingHtml = ui.buildingPanelHtml(building);
    assert(buildingHtml.includes('Dwelling') && buildingHtml.includes('Under construction') &&
      buildingHtml.includes('Builders') && buildingHtml.includes('1 on site · 2 assigned'),
    'panel stavby překládá jméno, stav, popis i dynamické počty stavitelů');
    const unit = new Unit(11, 'swordsman', 1, 10, 10);
    assert(ui.unitsPanelHtml([unit]).includes('Swordsman') &&
      ui.unitsPanelHtml([unit]).includes('Armor'), 'panel jednotek překládá typ i vlastnosti');
    const unitHtml = ui.unitsPanelHtml([unit, new Unit(12, 'swordsman', 1, 11, 11)]);
    assert(unitHtml.includes('2 units') && unitHtml.includes('0 subjects'), 'přeloženy počty vybraných jednotek');
    building.ownerId = 2;
    ui.session.state.players.push({ id: 2, name: 'Střední' });
    assert(ui.buildingPanelHtml(building).includes('Střední'), 'jméno hráče v panelu zůstává beze změny');
    const date = '2026-10-26T12:34:00Z';
    assert(formatDateTime(date).includes('Oct') &&
      formatSaveLabel({ startedAt: date, savedAt: date }).startsWith('Started '),
    'uložená hra používá anglický popisek a datum');
    setLanguage('cs');
    assert(t(message.message) === message.text && t('Nastavení') === 'Nastavení',
      'přepnutí zpět obnoví češtinu včetně již přijatých síťových hlášek');
    menu.showMain();
    assert(output.includes('KRÁLOVSTVÍ') && output.includes('Nastavení'), 'hlavní menu se znovu vykreslí česky');
    assert(warnings.length === 0, 'v otestovaných obrazovkách nechybějí překlady');
  } finally {
    console.warn = originalWarn;
    setLanguage(previous);
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  }
}

import { t } from '../i18n/index.js';
import { audio } from '../engine/audio.js';
import { LocalSession } from './session.js';
import { GameSim } from '../sim/sim.js';
import { readSave, formatDateTime } from './save.js';

export function applicationLoading(app) {
  function seed() {
    if (window.crypto && window.crypto.getRandomValues) {
      return window.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return (Math.random() * 0xffffffff) >>> 0;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function startSingle(options) {
    app.lastSingleOptions = { ...options };
    app.searchCancelled = true;
    if (app.multiplayer) app.leaveMultiplayer();
    app.screen = 'loading';
    app.paused = false;
    app.menu.showLoading(() => {
      app.screen = 'menu';
      audio.setMusicMode('menu');
      app.menu.showMain();
    });

    try {
      app.menu.setLoading(6);
      await app.delay(120);
      const players = [{ name: t("Království"), isBot: false }];
      if (options.mode === 'bots') {
        for (let i = 1; i <= options.bots; i++) {
          players.push({ name: `Bot ${i}`, isBot: true, difficulty: options.difficulty });
        }
      }
      app.menu.setLoading(28);
      await app.delay(140);
      app.menu.setLoading(56);
      await app.delay(130);
      const startedAt = new Date().toISOString();
      const newSession = new LocalSession({
        seed: app.seed(),
        mapType: options.mapType,
        mode: options.mode,
        capital: options.capital,
        fog: options.fog,
        players,
        startedAt,
        startOptions: { ...options }
      });
      app.menu.setLoading(84);
      await app.delay(160);
      app.menu.setLoading(100);
      await app.delay(150);
      app.enterGame(newSession, {
        mapType: options.mapType,
        center: true
      });
      audio.setMusicMode('game');
    } catch (err) {
      console.error(t("Hru se nepodařilo spustit"), err);
      app.menu.showLoadingError(t("Hru se nepodařilo načíst: {0}", { 0: t(err.localized || err.message || String(err)) }));
    }
  }

  async function loadSavedGame() {
    if (app.screen !== 'menu') return;
    const saved = readSave();
    if (!saved) {
      app.modals.open({
        title: t("Uložená hra"),
        icon: '📜',
        body: `<p class="modal-paragraph">${t("V prohlížeči není žádná uložená hra. Rozehranou hru můžete uložit v jejím menu.")}</p>`,
        actions: [{ label: t("Rozumím"), kind: 'btn-primary', onClick: (m) => m.close() }]
      });
      return;
    }

    app.searchCancelled = true;
    app.screen = 'loading';
    app.paused = false;
    app.menu.showLoading(() => {
      app.screen = 'menu';
      audio.setMusicMode('menu');
      app.menu.showMain();
    });

    try {
      app.menu.setLoading(12);
      await app.delay(120);
      app.menu.setLoading(45);
      const sim = GameSim.fromSaveState(saved);
      app.menu.setLoading(82);
      await app.delay(140);
      const restored = new LocalSession({
        sim,
        startedAt: saved.meta.startedAt,
        startOptions: saved.meta.options
      });
      app.lastSingleOptions = saved.meta.options ? { ...saved.meta.options } : null;
      app.menu.setLoading(100);
      await app.delay(130);
      app.enterGame(restored, { mapType: sim.mapType, center: true });
      audio.setMusicMode('game');
      app.ui.toast(t("Hra načtena. Zahájena {0}.", { 0: formatDateTime(saved.meta.startedAt) }), 'success');
    } catch (err) {
      console.error(t("Načtení hry se nepodařilo"), err);
      app.menu.showLoadingError(t("Hru se nepodařilo načíst: {0}", { 0: t(err.localized || err.message || String(err)) }));
    }
  }

  return {
    seed, delay, startSingle, loadSavedGame
  };
}

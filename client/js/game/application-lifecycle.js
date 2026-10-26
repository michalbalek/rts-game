import { audio } from '../engine/audio.js';
import { Input } from './input.js';
import { escapeHtml } from './modals.js';
import { saveSettings } from './settings.js';
import { saveLocalSession, formatSaveLabel } from './save.js';

export function applicationLifecycle(app) {
  function applySettings(updated) {
    Object.assign(app.settings, updated || {});
    saveSettings(app.settings);
    audio.setVolumes(app.settings.musicVolume, app.settings.sfxVolume);
    audio.setMuted(app.settings.musicMuted, app.settings.sfxMuted);
    app.renderer.setQuality(app.settings.quality);
    app.ui.setShowFps(app.settings.showFps);
  }

  function unlockAudio() {
    audio.unlock();
    app.applySettings(app.settings);
    if (app.screen === 'game') audio.setMusicMode('game');
    else audio.setMusicMode('menu');
  }

  function enterGame(newSession, opts = {}) {
    if (app.input) {
      app.input.detach();
      app.input = null;
    }
    app.session = newSession;
    app.screen = 'game';
    app.paused = false;
    app.gameOverShown = false;
    app.menu.hide();
    app.ui.showHud(true);
    app.ui.clearSession();
    app.ui.setSession(app.session);
    app.renderer.setSession(app.session);
    app.ui.setShowFps(app.settings.showFps);
    app.renderer.setQuality(app.settings.quality);
    audio.setBiome(app.session.state.mapType || opts.mapType || 'desert');
    audio.setMusicMode('game');

    if (opts.center) {
      const castle = app.session.castle;
      if (castle) app.camera.centerOnTile(castle.centerX, castle.centerY);
      else app.camera.centerOnTile(app.session.state.map.size / 2, app.session.state.map.size / 2);
      app.camera.clampToMap(app.session.state.map.size);
      app.pendingCameraCenter = false;
    } else {
      app.pendingCameraCenter = !!opts.pendingCenter;
    }

    app.input = new Input({
      canvas: app.canvas,
      minimapCanvas: app.minimapCanvas,
      camera: app.camera,
      session: app.session,
      ui: app.ui,
      settings: app.settings,
      isBlocked: () => app.screen !== 'game' || app.modals.isOpen(),
      onOpenMenu: app.openGameMenu
    });
  }

  function teardownGame({ closeNet = false } = {}) {
    if (app.input) {
      app.input.detach();
      app.input = null;
    }
    if (app.session) {
      if (closeNet && !app.session.local && app.session.dispose) app.session.dispose();
      app.session = null;
    }
    app.paused = false;
    app.gameOverShown = false;
    app.pendingCameraCenter = false;
    app.ui.clearSession();
    app.ui.showHud(false);
    audio.duck(false);
  }

  function openGameMenu() {
    if (app.screen !== 'game' || app.modals.isOpen()) return;
    const isMultiplayer = !!(app.session && !app.session.local);
    if (!isMultiplayer) app.paused = true;
    audio.duck(true);

    app.ui.showPause({
      multiplayer: isMultiplayer,
      onSave: isMultiplayer ? null : () => {
        try {
          const meta = saveLocalSession(app.session);
          app.ui.toast(`Hra uložena. ${formatSaveLabel(meta)}.`, 'success');
          audio.play('success');
        } catch (err) {
          console.error('Uložení hry se nepodařilo', err);
          app.ui.toast('Hru se nepodařilo uložit. Zkontrolujte volné místo v prohlížeči.', 'error');
          audio.play('error');
        }
      },
      onResume: () => {
        app.paused = false;
        audio.duck(false);
      },
      onSettings: () => {
        app.ui.openSettings(() => {
          if (app.screen === 'game' && !app.modals.isOpen()) app.openGameMenu();
        });
      },
      onQuit: () => {
        if (isMultiplayer) app.leaveMultiplayer();
        else app.leaveToMenu();
      }
    });
  }

  function leaveToMenu(message) {
    app.teardownGame({ closeNet: true });
    app.screen = 'menu';
    audio.setMusicMode('menu');
    app.menu.showMain();
    if (message) {
      app.modals.open({
        title: 'Hra ukončena',
        icon: '📜',
        body: `<p class="modal-paragraph">${escapeHtml(message)}</p>`,
        actions: [{ label: 'Rozumím', kind: 'btn-primary', onClick: (m) => m.close() }]
      });
    }
  }

  function showSingleResults() {
    if (app.gameOverShown || !app.session || !app.session.local) return;
    app.gameOverShown = true;
    const sim = app.session.sim;
    const victory = sim.winnerId === app.session.selfId;
    audio.setMusicMode(victory ? 'victory' : 'defeat');
    app.ui.showResults({
      victory,
      time: sim.endTime || sim.time,
      players: sim.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        alive: p.alive,
        stats: p.stats
      })),
      winnerId: sim.winnerId,
      onRestart: app.lastSingleOptions ? () => app.startSingle(app.lastSingleOptions) : null,
      onMenu: () => app.leaveToMenu()
    });
  }

  function showMultiplayerResults(msg) {
    if (app.gameOverShown || !app.session) return;
    app.gameOverShown = true;
    const victory = msg.winnerId === app.session.selfId;
    audio.setMusicMode(victory ? 'victory' : 'defeat');
    app.ui.showResults({
      victory,
      time: msg.time || app.session.state.time,
      players: msg.players || app.session.state.players,
      winnerId: msg.winnerId,
      returnIn: msg.returnIn || 30,
      onMenu: () => app.leaveMultiplayer()
    });
  }

  function quitApp() {
    window.close();
    setTimeout(() => {
      if (app.modals.isOpen()) return;
      app.modals.open({
        title: 'Ukončení hry',
        icon: '🚪',
        body: '<p class="modal-paragraph">Prohlížeč nedovolil zavřít tuto záložku. Můžete ji zavřít ručně nebo se vrátit do menu.</p>',
        actions: [{ label: 'Zpět do menu', kind: 'btn-primary', onClick: (m) => m.close() }]
      });
    }, 350);
  }

  return {
    applySettings, unlockAudio, enterGame, teardownGame, openGameMenu, leaveToMenu, showSingleResults, showMultiplayerResults, quitApp
  };
}

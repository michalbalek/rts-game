import { t } from '../i18n/index.js';
import { audio } from '../engine/audio.js';

export function applicationLoop(app) {
  let lastFrame = performance.now();
  let fpsTime = 0;
  let fpsFrames = 0;

  function runCommand(cmd) {
    if (!app.session) return { ok: false, reason: t("Hra neběží.") };
    if (app.session.local) {
      const result = app.session.command(cmd);
      if (result && result.ok === false) audio.play('error', { throttle: 250 });
      return result;
    }
    app.session.command(cmd);
    return null;
  }

  function focusBuilding(building) {
    if (!app.session) return;
    app.camera.centerOnTile(building.centerX || building.tileX, building.centerY || building.tileY);
    app.camera.clampToMap(app.session.state.map.size);
    audio.play('click');
  }

  function processEvents(events) {
    if (!events || !events.length || !app.session) return;
    app.renderer.handleEvents(events);
    for (const ev of events) {
      const mine = ev.playerId === undefined || ev.playerId === app.session.selfId;
      switch (ev.type) {
        case 'toast':
          if (mine) {
            app.ui.toast(ev.message || ev.text, ev.kind || 'info');
            audio.play('scribe', { volume: 0.6, throttle: 120 });
          }
          break;
        case 'gather':
          if (mine) audio.play('gather', { volume: 0.4, throttle: 350 });
          break;
        case 'hit':
          audio.play('hit', { volume: 0.35, throttle: 90 });
          audio.combat();
          break;
        case 'arrow':
          audio.play('arrow', { volume: 0.3, throttle: 110 });
          break;
        case 'buildingComplete':
          if (mine) audio.play('complete', { volume: 0.7 });
          break;
        case 'buildingDestroyed':
          audio.play('destroy', { volume: mine ? 0.8 : 0.4 });
          break;
        case 'depositFound':
          audio.play('deposit', { volume: 0.6 });
          break;
        case 'trained':
          if (mine) audio.play('success', { volume: 0.45, throttle: 180 });
          break;
        case 'citizen':
          if (mine) audio.play('select', { volume: 0.25, throttle: 800 });
          break;
        case 'defeat':
          if (ev.playerId === app.session.selfId) audio.play('defeat');
          break;
        case 'gameEnd':
          if (app.session.local) app.showSingleResults();
          break;
        default:
          break;
      }
    }
  }

  function buildRenderState() {
    return {
      buildMode: app.ui.buildMode,
      buildRotation: app.ui.buildRotation,
      wallDrag: app.ui.wallDrag,
      hoverTile: app.ui.hoverTile,
      hoverEntity: app.ui.hoverEntity,
      dragRect: app.ui.dragRect,
      selectedIds: new Set(app.session ? app.session.selection.map(u => u.id) : []),
      selectedBuilding: app.session ? app.session.selectedBuilding : null
    };
  }

  function frame(now) {
    requestAnimationFrame(app.frame);
    let dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.1);

    audio.update(dt);

    if (app.screen === 'game' && app.session) {
      if (!app.paused) {
        app.session.tick(dt);
        app.processEvents(app.session.drainEvents());
        app.input.update(dt);
        audio.updateAmbient(dt, app.session, app.camera);
      }
      app.ui.update(dt);
      app.renderer.render(dt, app.camera, app.buildRenderState());

      fpsTime += dt;
      fpsFrames++;
      if (fpsTime >= 0.5) {
        app.ui.setFps(fpsFrames / fpsTime);
        fpsTime = 0;
        fpsFrames = 0;
      }
    }
  }

  return {
    runCommand, focusBuilding, processEvents, buildRenderState, frame
  };
}

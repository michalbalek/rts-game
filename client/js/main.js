import { GameMap, CASTLE_START_X, CASTLE_START_Y } from './engine/map.js';
import { Camera } from './engine/camera.js';
import { Renderer } from './engine/renderer.js';
import { GameState } from './game/state.js';
import { UIManager } from './game/ui.js';
import { screenToTile } from './engine/isometric.js';
import { BUILDING_TYPES } from './game/buildings.js';
import { sound } from './engine/audio.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const minimapCanvas = document.getElementById('minimap-canvas');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Herní komponenty
  const map = new GameMap();
  const camera = new Camera(canvas);
  const state = new GameState(map);
  const renderer = new Renderer(canvas, minimapCanvas);
  const ui = new UIManager(state, camera);

  // Vycentrování na Křižácký Donjon uprostřed oázy
  camera.centerOnTile(CASTLE_START_X + 1.5, CASTLE_START_Y + 1.5);
  ui.updateSelectionPanel();

  // Klávesové zkratky
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === 'Escape') {
      ui.cancelBuildMode();
      ui.helpModal.classList.add('hidden');
    } else if (e.key === ' ') {
      camera.centerOnTile(CASTLE_START_X + 1.5, CASTLE_START_Y + 1.5);
    } else if (e.key.toLowerCase() === 'h') {
      ui.helpModal.classList.toggle('hidden');
    } else if (e.key === '1') {
      camera.centerOnTile(CASTLE_START_X + 1.5, CASTLE_START_Y + 1.5);
      if (state.castle) {
        state.selectedEntity = { type: 'building', entity: state.castle };
        ui.updateSelectionPanel();
      }
      ui.cancelBuildMode();
    } else if (e.key === '2') {
      ui.setBuildMode(BUILDING_TYPES.BARRACKS);
    } else if (e.key === '3') {
      ui.setBuildMode(BUILDING_TYPES.LUMBERJACK);
    } else if (e.key === '4') {
      ui.setBuildMode(BUILDING_TYPES.QUARRY);
    } else if (e.key === '5') {
      ui.setBuildMode(BUILDING_TYPES.ORCHARD);
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // Myš
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      camera.pan(mouseX - dragStartX, mouseY - dragStartY);
      dragStartX = mouseX;
      dragStartY = mouseY;
    }

    const worldPos = camera.screenToWorld(mouseX, mouseY);
    const tile = screenToTile(worldPos.x, worldPos.y);
    state.hoverTile = tile;
  });

  canvas.addEventListener('mousedown', (e) => {
    sound.init();

    if (e.button === 1 || e.button === 2) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      return;
    }

    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const worldPos = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const tile = screenToTile(worldPos.x, worldPos.y);

      // Režim stavby
      if (state.buildMode) {
        const result = state.placeBuilding(state.buildMode, tile.x, tile.y);
        if (result.valid) {
          ui.showToast(`Stavba byla úspěšně vystavěna, můj pane!`, 'success');
          ui.updateSelectionPanel();
          if (!e.shiftKey) {
            ui.cancelBuildMode();
          }
        } else {
          ui.showToast(result.reason, 'error');
        }
        return;
      }

      // Výběr
      const found = state.findEntityAtTile(tile.x, tile.y);
      if (found) {
        state.selectedEntity = found;
        sound.playClick();
      } else {
        state.selectedEntity = null;
      }
      ui.updateSelectionPanel();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 2) {
      isDragging = false;
    }
  });

  // Pravé tlačítko myši
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    if (state.buildMode) {
      ui.cancelBuildMode();
      return;
    }

    if (state.selectedEntity?.type === 'unit') {
      const rect = canvas.getBoundingClientRect();
      const worldPos = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const tile = screenToTile(worldPos.x, worldPos.y);

      state.selectedEntity.entity.moveTo(tile.x + 0.5, tile.y + 0.5);
      sound.playClick();
      state.addFloatingText(tile.x + 0.5, tile.y + 0.5, 'K vašim službám!', '#fde047');
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    camera.zoomAt(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  // Smyčka hry
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const panSpeed = (520 / camera.zoom) * dt;
    if (keys['w'] || keys['arrowup']) camera.y -= panSpeed;
    if (keys['s'] || keys['arrowdown']) camera.y += panSpeed;
    if (keys['a'] || keys['arrowleft']) camera.x -= panSpeed;
    if (keys['d'] || keys['arrowright']) camera.x += panSpeed;

    state.update(
      dt,
      (citizensCount) => {
        ui.showToast(`Nová duše usedla k hradnímu ohništi! (${citizensCount} / 20)`, 'info');
        ui.updateSelectionPanel();
      },
      () => {
        ui.updateSelectionPanel();
      }
    );

    ui.update();
    renderer.render(camera, map, state);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  // Uvítání panovníka
  setTimeout(() => {
    ui.showToast('Vítejte v oáze, sire! Začněte stavbou kasáren a sadů k obživě lidu.', 'info');
  }, 500);
});

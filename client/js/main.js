import { Renderer } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { GameUI } from './game/ui.js';
import { Menu } from './game/menu.js';
import { Modals } from './game/modals.js';
import { loadSettings } from './game/settings.js';
import { setLanguage, translatePage } from './i18n/index.js';
import { applicationLoading } from './game/application-loading.js';
import { applicationLifecycle } from './game/application-lifecycle.js';
import { applicationMultiplayer } from './game/application-multiplayer.js';
import { applicationReconnect } from './game/application-reconnect.js';
import { applicationLoop } from './game/application-loop.js';

const canvas = document.getElementById('game-canvas');
const minimapCanvas = document.getElementById('minimap-canvas');
const modalRoot = document.getElementById('modal-root');
const menuRoot = document.getElementById('menu-root');
const settings = loadSettings();
setLanguage(settings.language);
translatePage();
const modals = new Modals(modalRoot);
const renderer = new Renderer(canvas, minimapCanvas);
const camera = new Camera(canvas);

const app = {
  canvas, minimapCanvas, modalRoot, menuRoot, settings, modals, renderer, camera,
  screen: 'menu',
  session: null,
  input: null,
  paused: false,
  lastSingleOptions: null,
  gameOverShown: false,
  searchCancelled: false,
  multiplayer: null,
  pendingCameraCenter: false,
  searchGeneration: 0
};

Object.assign(app,
  applicationLoading(app),
  applicationLifecycle(app),
  applicationMultiplayer(app),
  applicationReconnect(app),
  applicationLoop(app)
);

const hooks = {
  command: app.runCommand,
  openMenu: app.openGameMenu,
  applySettings: app.applySettings,
  focusBuilding: app.focusBuilding
};
const ui = app.ui = new GameUI({ hooks, settings, modals });
const menu = app.menu = new Menu({
  root: menuRoot,
  modals,
  getSettings: () => settings,
  applySettings: app.applySettings,
  onStartSingle: app.startSingle,
  onStartMultiplayer: app.startMultiplayer,
  onLoadGame: app.loadSavedGame,
  onCancelSearch: app.cancelSearch,
  onLeaveLobby: app.leaveLobby,
  onQuit: app.quitApp
});

document.addEventListener('pointerdown', app.unlockAudio, { once: true, capture: true });
document.addEventListener('keydown', app.unlockAudio, { once: true, capture: true });

window.addEventListener('resize', () => {
  renderer.resize();
  if (app.session) camera.clampToMap(app.session.state.map.size);
});

// Ladící háček pro vývojáře a automatické testy; v běžném režimu se nevytváří.
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__rts = {
    camera,
    renderer,
    ui,
    menu,
    modals,
    get session() { return app.session; },
    get input() { return app.input; },
    get screen() { return app.screen; }
  };
}

app.applySettings(settings);
renderer.setQuality(settings.quality);
ui.setShowFps(settings.showFps);
menu.showMain();
requestAnimationFrame(app.frame);

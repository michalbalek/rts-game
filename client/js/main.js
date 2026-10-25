import { Renderer } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { audio } from './engine/audio.js';
import { GameUI } from './game/ui.js';
import { Input } from './game/input.js';
import { Menu } from './game/menu.js';
import { LocalSession, RemoteSession } from './game/session.js';
import { NetClient } from './net.js';
import { Modals, escapeHtml } from './game/modals.js';
import { loadSettings, saveSettings } from './game/settings.js';

const TOKEN_KEY = 'kralovstvi_mp_token';
const NICK_KEY = 'kralovstvi_mp_nick';

const canvas = document.getElementById('game-canvas');
const minimapCanvas = document.getElementById('minimap-canvas');
const modalRoot = document.getElementById('modal-root');
const menuRoot = document.getElementById('menu-root');

const settings = loadSettings();
const modals = new Modals(modalRoot);
const renderer = new Renderer(canvas, minimapCanvas);
const camera = new Camera(canvas);

let screen = 'menu'; // 'menu' | 'loading' | 'game'
let session = null;
let input = null;
let paused = false;
let lastSingleOptions = null;
let gameOverShown = false;
let searchCancelled = false;
let multiplayer = null;
let pendingCameraCenter = false;
let searchGeneration = 0;

const hooks = {
  command: runCommand,
  openMenu: openGameMenu,
  applySettings,
  focusBuilding
};

const ui = new GameUI({ hooks, settings, modals });

const menu = new Menu({
  root: menuRoot,
  modals,
  getSettings: () => settings,
  applySettings,
  onStartSingle: startSingle,
  onStartMultiplayer: startMultiplayer,
  onCancelSearch: cancelSearch,
  onLeaveLobby: leaveLobby,
  onQuit: quitApp
});

// ----------------------------------------------------------------------
//  Nastavení a zvuk
// ----------------------------------------------------------------------

function applySettings(updated) {
  Object.assign(settings, updated || {});
  saveSettings(settings);
  audio.setVolumes(settings.musicVolume, settings.sfxVolume);
  audio.setMuted(settings.musicMuted, settings.sfxMuted);
  renderer.setQuality(settings.quality);
  ui.setShowFps(settings.showFps);
}

function unlockAudio() {
  audio.unlock();
  applySettings(settings);
  if (screen === 'game') audio.setMusicMode('game');
  else audio.setMusicMode('menu');
}

document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
document.addEventListener('keydown', unlockAudio, { once: true, capture: true });

// ----------------------------------------------------------------------
//  Start hry
// ----------------------------------------------------------------------

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
  lastSingleOptions = { ...options };
  searchCancelled = true;
  if (multiplayer) leaveMultiplayer();
  screen = 'loading';
  paused = false;
  menu.showLoading(() => {
    screen = 'menu';
    audio.setMusicMode('menu');
    menu.showMain();
  });

  try {
    menu.setLoading(6);
    await delay(120);
    const players = [{ name: 'Království', isBot: false }];
    if (options.mode === 'bots') {
      for (let i = 1; i <= options.bots; i++) {
        players.push({ name: `Bot ${i}`, isBot: true, difficulty: options.difficulty });
      }
    }
    menu.setLoading(28);
    await delay(140);
    menu.setLoading(56);
    await delay(130);
    const newSession = new LocalSession({
      seed: seed(),
      mapType: options.mapType,
      mode: options.mode,
      capital: options.capital,
      fog: options.fog,
      players
    });
    menu.setLoading(84);
    await delay(160);
    menu.setLoading(100);
    await delay(150);
    enterGame(newSession, {
      mapType: options.mapType,
      center: true
    });
    audio.setMusicMode('game');
  } catch (err) {
    console.error('Hru se nepodařilo spustit', err);
    menu.showLoadingError(`Hru se nepodařilo načíst: ${err.message || err}`);
  }
}

function enterGame(newSession, opts = {}) {
  if (input) {
    input.detach();
    input = null;
  }
  session = newSession;
  screen = 'game';
  paused = false;
  gameOverShown = false;
  menu.hide();
  ui.showHud(true);
  ui.clearSession();
  ui.setSession(session);
  renderer.setSession(session);
  ui.setShowFps(settings.showFps);
  renderer.setQuality(settings.quality);
  audio.setBiome(session.state.mapType || opts.mapType || 'desert');
  audio.setMusicMode('game');

  if (opts.center) {
    const castle = session.castle;
    if (castle) camera.centerOnTile(castle.centerX, castle.centerY);
    else camera.centerOnTile(session.state.map.size / 2, session.state.map.size / 2);
    camera.clampToMap(session.state.map.size);
    pendingCameraCenter = false;
  } else {
    pendingCameraCenter = !!opts.pendingCenter;
  }

  input = new Input({
    canvas,
    minimapCanvas,
    camera,
    session,
    ui,
    settings,
    isBlocked: () => screen !== 'game' || modals.isOpen(),
    onOpenMenu: openGameMenu
  });
}

function teardownGame({ closeNet = false } = {}) {
  if (input) {
    input.detach();
    input = null;
  }
  if (session) {
    if (closeNet && !session.local && session.dispose) session.dispose();
    session = null;
  }
  paused = false;
  gameOverShown = false;
  pendingCameraCenter = false;
  ui.clearSession();
  ui.showHud(false);
  audio.duck(false);
}

// ----------------------------------------------------------------------
//  Herní menu, odchod, výsledky
// ----------------------------------------------------------------------

function openGameMenu() {
  if (screen !== 'game' || modals.isOpen()) return;
  const isMultiplayer = !!(session && !session.local);
  if (!isMultiplayer) paused = true;
  audio.duck(true);

  ui.showPause({
    multiplayer: isMultiplayer,
    onResume: () => {
      paused = false;
      audio.duck(false);
    },
    onSettings: () => {
      ui.openSettings(() => {
        if (screen === 'game' && !modals.isOpen()) openGameMenu();
      });
    },
    onQuit: () => {
      if (isMultiplayer) leaveMultiplayer();
      else leaveToMenu();
    }
  });
}

function leaveToMenu(message) {
  teardownGame({ closeNet: true });
  screen = 'menu';
  audio.setMusicMode('menu');
  menu.showMain();
  if (message) {
    modals.open({
      title: 'Hra ukončena',
      icon: '📜',
      body: `<p class="modal-paragraph">${escapeHtml(message)}</p>`,
      actions: [{ label: 'Rozumím', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
  }
}

function showSingleResults() {
  if (gameOverShown || !session || !session.local) return;
  gameOverShown = true;
  const sim = session.sim;
  const victory = sim.winnerId === session.selfId;
  audio.setMusicMode(victory ? 'victory' : 'defeat');
  ui.showResults({
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
    onRestart: () => {
      if (lastSingleOptions) startSingle(lastSingleOptions);
    },
    onMenu: () => leaveToMenu()
  });
}

function showMultiplayerResults(msg) {
  if (gameOverShown || !session) return;
  gameOverShown = true;
  const victory = msg.winnerId === session.selfId;
  audio.setMusicMode(victory ? 'victory' : 'defeat');
  ui.showResults({
    victory,
    time: msg.time || session.state.time,
    players: msg.players || session.state.players,
    winnerId: msg.winnerId,
    returnIn: msg.returnIn || 30,
    onMenu: () => leaveMultiplayer()
  });
}

function returnToLobby(msg) {
  if (input) {
    input.detach();
    input = null;
  }
  session = null;
  screen = 'menu';
  paused = false;
  gameOverShown = false;
  pendingCameraCenter = false;
  ui.closeResults();
  ui.clearSession();
  ui.showHud(false);
  audio.duck(false);
  audio.setMusicMode('menu');
  if (multiplayer) multiplayer.inGame = false;
  menu.showLobby(msg);
}

function leaveMultiplayer() {
  const current = multiplayer;
  if (current) {
    current.userLeft = true;
    if (current.net) {
      current.net.send({ type: 'leave' });
      current.net.close();
    }
    multiplayer = null;
  }
  teardownGame({ closeNet: false });
  screen = 'menu';
  audio.setMusicMode('menu');
  menu.showMain();
}

// ----------------------------------------------------------------------
//  Multiplayer – hledání, lobby, reconnect
// ----------------------------------------------------------------------

async function startMultiplayer(nick) {
  if (multiplayer) leaveMultiplayer();
  searchCancelled = false;
  const generation = ++searchGeneration;
  menu.showSearching();
  audio.setMusicMode('menu');

  let status;
  try {
    status = await NetClient.findServer(10000);
  } catch (err) {
    if (generation !== searchGeneration || searchCancelled) return;
    menu.showMultiplayerError('Server na této adrese neodpovídá. Zkontrolujte, zda běží `npm start`, a zkuste to znovu.');
    return;
  }
  if (generation !== searchGeneration || searchCancelled) return;

  const savedNick = localStorage.getItem(NICK_KEY);
  const token = savedNick === nick ? localStorage.getItem(TOKEN_KEY) : null;
  const net = new NetClient({
    onMessage: (msg) => handleNetMessage(msg, net),
    onClose: () => handleNetClose(net)
  });
  multiplayer = {
    nick,
    token,
    net,
    serverInfo: status,
    userLeft: false,
    reconnecting: false,
    disconnectedAt: 0,
    inGame: false
  };

  try {
    const welcome = await net.connect({ nick, token }, 9000);
    if (generation !== searchGeneration || searchCancelled || !multiplayer) {
      net.close();
      return;
    }
    handleWelcome(welcome, net);
  } catch (err) {
    if (multiplayer && multiplayer.net === net) multiplayer = null;
    try { net.close(); } catch (e) { /* ignore */ }
    if (generation !== searchGeneration) return;
    handleJoinError(err);
  }
}

function handleJoinError(err) {
  const code = err && err.code;
  const message = err && err.message ? err.message : 'Server není dostupný.';
  if (code === 'FULL') {
    menu.showMultiplayerError('Na serveru právě hraje maximální počet hráčů. Zkuste to znovu později.', { full: true });
    return;
  }
  if (code === 'NICK_TAKEN') {
    menu.showMultiplayer();
    modals.open({
      title: 'Nick je obsazený',
      icon: '👤',
      body: `<p class="modal-paragraph">${escapeHtml(message)} Zvolte prosím jiný nick.</p>`,
      actions: [{ label: 'Změnit nick', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
    return;
  }
  if (code === 'BAD_NICK') {
    menu.showMultiplayer();
    modals.open({
      title: 'Neplatný nick',
      icon: '👤',
      body: `<p class="modal-paragraph">${escapeHtml(message)}</p>`,
      actions: [{ label: 'Změnit nick', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
    return;
  }
  menu.showMultiplayerError(message);
}

function cancelSearch() {
  searchCancelled = true;
  searchGeneration++;
  if (multiplayer) {
    multiplayer.userLeft = true;
    if (multiplayer.net) multiplayer.net.close();
    multiplayer = null;
  }
  screen = 'menu';
  menu.showMain();
}

function leaveLobby() {
  cancelSearch();
}

function handleWelcome(welcome, net) {
  if (!multiplayer) return;
  if (welcome.token) {
    multiplayer.token = welcome.token;
    try {
      localStorage.setItem(TOKEN_KEY, welcome.token);
      localStorage.setItem(NICK_KEY, multiplayer.nick);
    } catch (err) { /* ignore */ }
  }
  if (welcome.selfId) multiplayer.selfId = welcome.selfId;
  multiplayer.net = net;

  if (welcome.resumed && screen === 'game' && session) {
    ui.setConnection(null);
    audio.setMusicMode('game');
    return;
  }

  if (welcome.game) {
    enterMultiplayerGame(welcome.game, net);
    return;
  }

  if (screen === 'game' && session) {
    // Návrat do lobby po skončené hře.
    if (welcome.lobby) returnToLobby(welcome.lobby);
    return;
  }

  if (welcome.lobby) menu.showLobby(welcome.lobby);
  else menu.showSearching();
}

function enterMultiplayerGame(config, net) {
  if (multiplayer) multiplayer.inGame = true;
  if (session && !session.local) {
    session.net = net;
    ui.setConnection(null);
    return;
  }
  const remote = new RemoteSession(config, net);
  enterGame(remote, { mapType: config.mapType, pendingCenter: true });
  ui.setConnection(null);
  if (multiplayer) multiplayer.selfId = remote.selfId;
}

function handleNetMessage(msg, net) {
  if (!multiplayer) return;
  if (msg.type !== 'welcome' && net !== multiplayer.net) return;

  switch (msg.type) {
    case 'welcome':
      handleWelcome(msg, net);
      break;
    case 'lobby':
      if (screen === 'game') returnToLobby(msg);
      else if (screen === 'menu') {
        if (menuRoot.classList.contains('hidden')) menu.showLobby(msg);
        else menu.updateLobby(msg);
      }
      break;
    case 'start':
      if (!multiplayer) return;
      multiplayer.inGame = true;
      multiplayer.selfId = msg.config ? msg.config.selfId : multiplayer.selfId;
      enterMultiplayerGame(msg.config, net);
      break;
    case 'snapshot':
      if (!session || session.local) return;
      session.applySnapshot(msg);
      if (pendingCameraCenter && session.castle) {
        camera.centerOnTile(session.castle.centerX, session.castle.centerY);
        camera.clampToMap(session.state.map.size);
        pendingCameraCenter = false;
      }
      break;
    case 'events':
      if (session && !session.local) session.enqueueEvents(msg.events);
      break;
    case 'cmdResult': {
      const result = msg.result;
      if (result && result.ok === false && result.reason) {
        ui.toast(result.reason, 'error');
        audio.play('error');
      }
      break;
    }
    case 'gameover':
      showMultiplayerResults(msg);
      break;
    case 'info':
      if (screen === 'game') ui.toast(msg.text, msg.kind || 'info');
      break;
    case 'error':
      if (screen === 'game') {
        ui.toast(msg.message || 'Server odmítl požadavek.', 'error');
      } else if (screen === 'menu') {
        menu.showMultiplayerError(msg.message || 'Server odmítl připojení.');
      }
      break;
    default:
      break;
  }
}

function handleNetClose(net) {
  if (!multiplayer || multiplayer.net !== net || multiplayer.userLeft) return;
  if (multiplayer.reconnecting) return;

  if (screen === 'game') {
    multiplayer.disconnectedAt = Date.now();
    ui.setConnection('Spojení přerušeno – pokoušíme se znovu připojit (max. 120 s)…');
    startReconnect();
  } else if (screen === 'menu') {
    if (!menuRoot.classList.contains('hidden')) {
      menu.showMultiplayerError('Spojení se serverem bylo přerušeno. Zkuste se připojit znovu.');
    }
    multiplayer = null;
  }
}

async function startReconnect() {
  if (!multiplayer || multiplayer.reconnecting) return;
  multiplayer.reconnecting = true;
  const startedAt = Date.now();

  while (multiplayer && !multiplayer.userLeft && Date.now() - startedAt < 120000) {
    await delay(3000);
    if (!multiplayer || multiplayer.userLeft) break;
    const net = new NetClient({
      onMessage: (msg) => handleNetMessage(msg, net),
      onClose: () => handleNetClose(net)
    });
    try {
      const welcome = await net.connect({ nick: multiplayer.nick, token: multiplayer.token }, 6000);
      if (!multiplayer) { net.close(); break; }
      multiplayer.net = net;
      multiplayer.reconnecting = false;
      multiplayer.disconnectedAt = 0;
      handleWelcome(welcome, net);
      ui.setConnection(null);
      return;
    } catch (err) {
      net.close();
    }
  }

  if (multiplayer && !multiplayer.userLeft) {
    multiplayer = null;
    teardownGame({ closeNet: false });
    screen = 'menu';
    audio.setMusicMode('menu');
    menu.showMain();
    modals.open({
      title: 'Spojení ztraceno',
      icon: '📡',
      body: '<p class="modal-paragraph">Nepodařilo se obnovit spojení se serverem do 120 sekund. Hra byla opuštěna.</p>',
      actions: [{ label: 'Hlavní menu', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
  }
}

function quitApp() {
  window.close();
  setTimeout(() => {
    if (modals.isOpen()) return;
    modals.open({
      title: 'Ukončení hry',
      icon: '🚪',
      body: '<p class="modal-paragraph">Prohlížeč nedovolil zavřít tuto záložku. Můžete ji zavřít ručně nebo se vrátit do menu.</p>',
      actions: [{ label: 'Zpět do menu', kind: 'btn-primary', onClick: (m) => m.close() }]
    });
  }, 350);
}

// ----------------------------------------------------------------------
//  Příkazy, události, smyčka
// ----------------------------------------------------------------------

function runCommand(cmd) {
  if (!session) return { ok: false, reason: 'Hra neběží.' };
  if (session.local) {
    const result = session.command(cmd);
    if (result && result.ok === false) audio.play('error', { throttle: 250 });
    return result;
  }
  session.command(cmd);
  return null;
}

function focusBuilding(building) {
  if (!session) return;
  camera.centerOnTile(building.centerX || building.tileX, building.centerY || building.tileY);
  camera.clampToMap(session.state.map.size);
  audio.play('click');
}

function processEvents(events) {
  if (!events || !events.length || !session) return;
  renderer.handleEvents(events);
  for (const ev of events) {
    const mine = ev.playerId === undefined || ev.playerId === session.selfId;
    switch (ev.type) {
      case 'toast':
        if (mine) {
          ui.toast(ev.text, ev.kind || 'info');
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
        if (ev.playerId === session.selfId) audio.play('defeat');
        break;
      case 'gameEnd':
        if (session.local) showSingleResults();
        break;
      default:
        break;
    }
  }
}

function buildRenderState() {
  return {
    buildMode: ui.buildMode,
    hoverTile: ui.hoverTile,
    hoverEntity: ui.hoverEntity,
    dragRect: ui.dragRect,
    selectedIds: new Set(session ? session.selection.map(u => u.id) : []),
    selectedBuilding: session ? session.selectedBuilding : null
  };
}

let lastFrame = performance.now();
let fpsTime = 0;
let fpsFrames = 0;
let uiFrameTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.1);

  audio.update(dt);

  if (screen === 'game' && session) {
    if (!paused) {
      session.tick(dt);
      processEvents(session.drainEvents());
      input.update(dt);
      audio.updateAmbient(dt, session, camera);
    }
    ui.update(dt);
    renderer.render(dt, camera, buildRenderState());

    fpsTime += dt;
    fpsFrames++;
    if (fpsTime >= 0.5) {
      ui.setFps(fpsFrames / fpsTime);
      fpsTime = 0;
      fpsFrames = 0;
    }
  }
}

window.addEventListener('resize', () => {
  renderer.resize();
  if (session) camera.clampToMap(session.state.map.size);
});

// ----------------------------------------------------------------------
//  Start aplikace
// ----------------------------------------------------------------------

// Ladící háček pro vývojáře a automatické testy; v běžném režimu se nevytváří.
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__rts = {
    camera,
    renderer,
    ui,
    menu,
    modals,
    get session() { return session; },
    get input() { return input; },
    get screen() { return screen; }
  };
}

applySettings(settings);
renderer.setQuality(settings.quality);
ui.setShowFps(settings.showFps);
menu.showMain();
requestAnimationFrame(frame);

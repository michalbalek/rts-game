import { audio } from '../engine/audio.js';
import { RemoteSession } from './session.js';
import { NetClient } from '../net.js';
import { escapeHtml } from './modals.js';

export function applicationMultiplayer(app) {
  const TOKEN_KEY = 'kralovstvi_mp_token';
  const NICK_KEY = 'kralovstvi_mp_nick';

  function returnToLobby(msg) {
    if (app.input) {
      app.input.detach();
      app.input = null;
    }
    app.session = null;
    app.screen = 'menu';
    app.paused = false;
    app.gameOverShown = false;
    app.pendingCameraCenter = false;
    app.ui.closeResults();
    app.ui.clearSession();
    app.ui.showHud(false);
    audio.duck(false);
    audio.setMusicMode('menu');
    if (app.multiplayer) app.multiplayer.inGame = false;
    app.menu.showLobby(msg);
  }

  function leaveMultiplayer() {
    const current = app.multiplayer;
    if (current) {
      current.userLeft = true;
      if (current.net) {
        current.net.send({ type: 'leave' });
        current.net.close();
      }
      app.multiplayer = null;
    }
    app.teardownGame({ closeNet: false });
    app.screen = 'menu';
    audio.setMusicMode('menu');
    app.menu.showMain();
  }

  async function startMultiplayer(nick) {
    if (app.multiplayer) app.leaveMultiplayer();
    app.searchCancelled = false;
    const generation = ++app.searchGeneration;
    app.menu.showSearching();
    audio.setMusicMode('menu');

    let status;
    try {
      status = await NetClient.findServer(10000);
    } catch (err) {
      if (generation !== app.searchGeneration || app.searchCancelled) return;
      app.menu.showMultiplayerError('Server na této adrese neodpovídá. Zkontrolujte, zda běží `npm start`, a zkuste to znovu.');
      return;
    }
    if (generation !== app.searchGeneration || app.searchCancelled) return;

    const savedNick = localStorage.getItem(NICK_KEY);
    const token = savedNick === nick ? localStorage.getItem(TOKEN_KEY) : null;
    const net = new NetClient({
      onMessage: (msg) => app.handleNetMessage(msg, net),
      onClose: () => app.handleNetClose(net)
    });
    app.multiplayer = {
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
      if (generation !== app.searchGeneration || app.searchCancelled || !app.multiplayer) {
        net.close();
        return;
      }
      app.handleWelcome(welcome, net);
    } catch (err) {
      if (app.multiplayer && app.multiplayer.net === net) app.multiplayer = null;
      try { net.close(); } catch (e) { /* ignore */ }
      if (generation !== app.searchGeneration) return;
      app.handleJoinError(err);
    }
  }

  function handleJoinError(err) {
    const code = err && err.code;
    const message = err && err.message ? err.message : 'Server není dostupný.';
    if (code === 'FULL') {
      app.menu.showMultiplayerError('Na serveru právě hraje maximální počet hráčů. Zkuste to znovu později.', { full: true });
      return;
    }
    if (code === 'NICK_TAKEN') {
      app.menu.showMultiplayer();
      app.modals.open({
        title: 'Nick je obsazený',
        icon: '👤',
        body: `<p class="modal-paragraph">${escapeHtml(message)} Zvolte prosím jiný nick.</p>`,
        actions: [{ label: 'Změnit nick', kind: 'btn-primary', onClick: (m) => m.close() }]
      });
      return;
    }
    if (code === 'BAD_NICK') {
      app.menu.showMultiplayer();
      app.modals.open({
        title: 'Neplatný nick',
        icon: '👤',
        body: `<p class="modal-paragraph">${escapeHtml(message)}</p>`,
        actions: [{ label: 'Změnit nick', kind: 'btn-primary', onClick: (m) => m.close() }]
      });
      return;
    }
    app.menu.showMultiplayerError(message);
  }

  function cancelSearch() {
    app.searchCancelled = true;
    app.searchGeneration++;
    if (app.multiplayer) {
      app.multiplayer.userLeft = true;
      if (app.multiplayer.net) app.multiplayer.net.close();
      app.multiplayer = null;
    }
    app.screen = 'menu';
    app.menu.showMain();
  }

  function leaveLobby() {
    app.cancelSearch();
  }

  function handleWelcome(welcome, net) {
    if (!app.multiplayer) return;
    if (welcome.token) {
      app.multiplayer.token = welcome.token;
      try {
        localStorage.setItem(TOKEN_KEY, welcome.token);
        localStorage.setItem(NICK_KEY, app.multiplayer.nick);
      } catch (err) { /* ignore */ }
    }
    if (welcome.selfId) app.multiplayer.selfId = welcome.selfId;
    app.multiplayer.net = net;

    if (welcome.resumed && app.screen === 'game' && app.session) {
      app.ui.setConnection(null);
      audio.setMusicMode('game');
      return;
    }

    if (welcome.game) {
      app.enterMultiplayerGame(welcome.game, net);
      return;
    }

    if (app.screen === 'game' && app.session) {
      // Návrat do lobby po skončené hře.
      if (welcome.lobby) app.returnToLobby(welcome.lobby);
      return;
    }

    if (welcome.lobby) app.menu.showLobby(welcome.lobby);
    else app.menu.showSearching();
  }

  function enterMultiplayerGame(config, net) {
    if (app.multiplayer) app.multiplayer.inGame = true;
    if (app.session && !app.session.local) {
      app.session.net = net;
      app.ui.setConnection(null);
      return;
    }
    const remote = new RemoteSession(config, net);
    app.enterGame(remote, { mapType: config.mapType, pendingCenter: true });
    app.ui.setConnection(null);
    if (app.multiplayer) app.multiplayer.selfId = remote.selfId;
  }

  function handleNetMessage(msg, net) {
    if (!app.multiplayer) return;
    if (msg.type !== 'welcome' && net !== app.multiplayer.net) return;

    switch (msg.type) {
      case 'welcome':
        app.handleWelcome(msg, net);
        break;
      case 'lobby':
        if (app.screen === 'game') app.returnToLobby(msg);
        else if (app.screen === 'menu') {
          if (app.menuRoot.classList.contains('hidden')) app.menu.showLobby(msg);
          else app.menu.updateLobby(msg);
        }
        break;
      case 'start':
        if (!app.multiplayer) return;
        app.multiplayer.inGame = true;
        app.multiplayer.selfId = msg.config ? msg.config.selfId : app.multiplayer.selfId;
        app.enterMultiplayerGame(msg.config, net);
        break;
      case 'snapshot':
        if (!app.session || app.session.local) return;
        app.session.applySnapshot(msg);
        if (app.pendingCameraCenter && app.session.castle) {
          app.camera.centerOnTile(app.session.castle.centerX, app.session.castle.centerY);
          app.camera.clampToMap(app.session.state.map.size);
          app.pendingCameraCenter = false;
        }
        break;
      case 'events':
        if (app.session && !app.session.local) app.session.enqueueEvents(msg.events);
        break;
      case 'cmdResult': {
        const result = msg.result;
        if (result && result.ok === false && result.reason) {
          app.ui.toast(result.reason, 'error');
          audio.play('error');
        }
        break;
      }
      case 'gameover':
        app.showMultiplayerResults(msg);
        break;
      case 'info':
        if (app.screen === 'game') app.ui.toast(msg.text, msg.kind || 'info');
        break;
      case 'error':
        if (app.screen === 'game') {
          app.ui.toast(msg.message || 'Server odmítl požadavek.', 'error');
        } else if (app.screen === 'menu') {
          app.menu.showMultiplayerError(msg.message || 'Server odmítl připojení.');
        }
        break;
      default:
        break;
    }
  }

  function handleNetClose(net) {
    if (!app.multiplayer || app.multiplayer.net !== net || app.multiplayer.userLeft) return;
    if (app.multiplayer.reconnecting) return;

    if (app.screen === 'game') {
      app.multiplayer.disconnectedAt = Date.now();
      app.ui.setConnection('Spojení přerušeno – pokoušíme se znovu připojit (max. 120 s)…');
      app.startReconnect();
    } else if (app.screen === 'menu') {
      if (!app.menuRoot.classList.contains('hidden')) {
        app.menu.showMultiplayerError('Spojení se serverem bylo přerušeno. Zkuste se připojit znovu.');
      }
      app.multiplayer = null;
    }
  }

  return {
    returnToLobby, leaveMultiplayer, startMultiplayer, handleJoinError, cancelSearch, leaveLobby, handleWelcome, enterMultiplayerGame, handleNetMessage, handleNetClose
  };
}

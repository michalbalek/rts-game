import { audio } from '../engine/audio.js';
import { NetClient } from '../net.js';

export function applicationReconnect(app) {
  async function startReconnect() {
    if (!app.multiplayer || app.multiplayer.reconnecting) return;
    app.multiplayer.reconnecting = true;
    const startedAt = Date.now();

    while (app.multiplayer && !app.multiplayer.userLeft && Date.now() - startedAt < 120000) {
      await app.delay(3000);
      if (!app.multiplayer || app.multiplayer.userLeft) break;
      const net = new NetClient({
        onMessage: (msg) => app.handleNetMessage(msg, net),
        onClose: () => app.handleNetClose(net)
      });
      try {
        const welcome = await net.connect({ nick: app.multiplayer.nick, token: app.multiplayer.token }, 6000);
        if (!app.multiplayer) { net.close(); break; }
        app.multiplayer.net = net;
        app.multiplayer.reconnecting = false;
        app.multiplayer.disconnectedAt = 0;
        app.handleWelcome(welcome, net);
        app.ui.setConnection(null);
        return;
      } catch (err) {
        net.close();
      }
    }

    if (app.multiplayer && !app.multiplayer.userLeft) {
      app.multiplayer = null;
      app.teardownGame({ closeNet: false });
      app.screen = 'menu';
      audio.setMusicMode('menu');
      app.menu.showMain();
      app.modals.open({
        title: 'Spojení ztraceno',
        icon: '📡',
        body: '<p class="modal-paragraph">Nepodařilo se obnovit spojení se serverem do 120 sekund. Hra byla opuštěna.</p>',
        actions: [{ label: 'Hlavní menu', kind: 'btn-primary', onClick: (m) => m.close() }]
      });
    }
  }

  return {
    startReconnect
  };
}

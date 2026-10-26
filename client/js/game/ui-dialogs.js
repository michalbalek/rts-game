import { BUILDING_DEFS, MARKET_PRICES } from '../sim/constants.js';
import { settingsForm, bindSettingsForm, helpContent, creditsContent, escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';

export function openSettings(onClose) {
  const body = settingsForm(this.settings);
  this.modals.open({
    title: 'Nastavení',
    icon: '⚙️',
    body,
    className: 'modal-settings',
    actions: [{ label: 'Zavřít', kind: 'btn-primary', onClick: (m) => m.close() }],
    onClose
  });
  bindSettingsForm(this.modals.root, this.settings, (settings) => {
    if (this.hooks.applySettings) this.hooks.applySettings(settings);
  });
}

export function openHelp() {
  this.modals.open({
    title: 'Nápověda',
    icon: '📖',
    body: helpContent(),
    className: 'modal-help',
    actions: [{ label: 'Rozumím', kind: 'btn-primary', onClick: (m) => m.close() }]
  });
}

export function openCredits() {
  this.modals.open({
    title: 'Kredity',
    icon: '👑',
    body: creditsContent(),
    className: 'modal-credits',
    actions: [{ label: 'Zavřít', kind: 'btn-primary', onClick: (m) => m.close() }]
  });
}

export function showPause({ multiplayer = false, onSave, onResume, onSettings, onQuit }) {
  const body = multiplayer
    ? `<p class="modal-paragraph">Hra v multiplayeru běží dál, i když je toto menu otevřené. Odejitím ze hry okamžitě prohráváte.</p>`
    : `<p class="modal-paragraph">Hra je pozastavena. Čas se zastavil a nic se neděje, dokud nebudete pokračovat.</p>`;
  const actions = [
    { label: 'Pokračovat', kind: 'btn-primary', onClick: (m) => { m.close(); if (onResume) onResume(); } }
  ];
  if (!multiplayer && onSave) {
    actions.push({
      label: 'Uložit hru',
      kind: 'btn-secondary',
      onClick: (m) => { m.close(); onSave(); }
    });
  }
  actions.push(
    { label: 'Nastavení', kind: 'btn-secondary', onClick: (m) => { if (onSettings) onSettings(); else this.openSettings(); } },
    { label: multiplayer ? 'Odejít ze hry' : 'Ukončit hru', kind: 'btn-danger', onClick: (m) => { m.close(); if (onQuit) onQuit(); } }
  );
  this.modals.open({
    title: 'Herní menu',
    icon: '✠',
    body,
    className: 'modal-pause',
    dismissable: true,
    actions,
    onClose: () => { if (onResume) onResume(); }
  });
}

export function confirmDemolish(building) {
  const def = building.config || BUILDING_DEFS[building.type];
  const refund = Object.entries(def.cost)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${MARKET_PRICES[key]?.icon || '🪙'} ${Math.floor(value * 0.5)}`)
    .join(' · ') || 'nic';
  this.modals.open({
    title: 'Zbourat budovu?',
    icon: '🧱',
    body: `
      <p class="modal-paragraph">Opravdu chcete zbourat <strong>${escapeHtml(def.name)}</strong>?</p>
      <p class="modal-paragraph">Vrátí se 50 % nákladů: ${refund}. Zásoby uvnitř se ztratí a dělníci se vrátí k ohništi.</p>`,
    actions: [
      { label: 'Zrušit', kind: 'btn-secondary', onClick: (m) => m.close() },
      {
        label: 'Zbourat',
        kind: 'btn-danger',
        onClick: (m) => {
          m.close();
          this.issue({ op: 'demolish', buildingId: building.id });
          audio.play('demolish');
        }
      }
    ]
  });
}

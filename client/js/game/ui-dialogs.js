import { t, getLanguage } from '../i18n/index.js';
import { BUILDING_DEFS, MARKET_PRICES } from '../sim/constants.js';
import { settingsForm, bindSettingsForm, helpContent, creditsContent, escapeHtml } from './modals.js';
import { audio } from '../engine/audio.js';

export function openSettings(onClose) {
  const body = settingsForm(this.settings);
  this.modals.open({
    title: t("Nastavení"),
    icon: '⚙️',
    body,
    className: 'modal-settings',
    actions: [{ label: t("Zavřít"), kind: 'btn-primary', onClick: (m) => m.close() }],
    onClose
  });
  bindSettingsForm(this.modals.root, this.settings, (settings) => {
    const language = getLanguage();
    if (this.hooks.applySettings) this.hooks.applySettings(settings);
    if (language !== getLanguage()) this.openSettings(onClose);
  });
}

export function openHelp() {
  this.modals.open({
    title: t("Nápověda"),
    icon: '📖',
    body: helpContent(),
    className: 'modal-help',
    actions: [{ label: t("Rozumím"), kind: 'btn-primary', onClick: (m) => m.close() }]
  });
}

export function openCredits() {
  this.modals.open({
    title: t('Kredity'),
    icon: '👑',
    body: creditsContent(),
    className: 'modal-credits',
    actions: [{ label: t("Zavřít"), kind: 'btn-primary', onClick: (m) => m.close() }]
  });
}

export function showPause({ multiplayer = false, onSave, onResume, onSettings, onQuit }) {
  const body = multiplayer
    ? `<p class="modal-paragraph">${t("Hra v multiplayeru běží dál, i když je toto menu otevřené. Odejitím ze hry okamžitě prohráváte.")}</p>`
    : `<p class="modal-paragraph">${t("Hra je pozastavena. Čas se zastavil a nic se neděje, dokud nebudete pokračovat.")}</p>`;
  const actions = [
    { label: t("Pokračovat"), kind: 'btn-primary', onClick: (m) => { m.close(); if (onResume) onResume(); } }
  ];
  if (!multiplayer && onSave) {
    actions.push({
      label: t("Uložit hru"),
      kind: 'btn-secondary',
      onClick: (m) => { m.close(); onSave(); }
    });
  }
  actions.push(
    { label: t("Nastavení"), kind: 'btn-secondary', onClick: (m) => { if (onSettings) onSettings(); else this.openSettings(); } },
    { label: multiplayer ? t("Odejít ze hry") : t("Ukončit hru"), kind: 'btn-danger', onClick: (m) => { m.close(); if (onQuit) onQuit(); } }
  );
  this.modals.open({
    title: t("Herní menu"),
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
    .join(' · ') || t("nic");
  this.modals.open({
    title: 'Zbourat budovu?',
    icon: '🧱',
    body: `
      <p class="modal-paragraph">${t("Opravdu chcete zbourat")} <strong>${escapeHtml(t(def.name))}</strong>?</p>
      <p class="modal-paragraph">${t("Vrátí se 50 % nákladů:")} ${refund}${t(". Zásoby uvnitř se ztratí a dělníci se vrátí k ohništi.")}</p>`,
    actions: [
      { label: t("Zrušit"), kind: 'btn-secondary', onClick: (m) => m.close() },
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

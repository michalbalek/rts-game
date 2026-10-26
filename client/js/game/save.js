import { t, getLanguage, getLocale } from '../i18n/index.js';
/**
 * Ukládání rozehrané singleplayer hry do localStorage prohlížeče.
 * Ukládá se vždy jeden slot; každé uložení nese čas zahájení hry.
 */
export const SAVE_KEY = 'kralovstvi_save_v1';

function safeStorage() {
  try {
    return window.localStorage;
  } catch (err) {
    return null;
  }
}

/** Přečte uloženou hru včetně metadat. Vrací null, pokud žádná není. */
export function readSave() {
  const storage = safeStorage();
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (err) {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.sim || !data.meta) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function readSaveInfo() {
  const save = readSave();
  return save ? save.meta : null;
}

export function hasSave() {
  return !!readSaveInfo();
}

/** Uloží běžící lokální hru. Vrací metadata uložení. */
export function saveLocalSession(session) {
  if (!session || !session.local || !session.sim) {
    throw new Error(t("Uložit lze pouze rozehranou hru v singleplayeru."));
  }
  const storage = safeStorage();
  if (!storage) throw new Error(t("Prohlížeč neumožňuje ukládat data."));

  const data = session.sim.toSaveState({
    startedAt: session.startedAt,
    savedAt: new Date().toISOString(),
    options: session.startOptions || null
  });
  storage.setItem(SAVE_KEY, JSON.stringify(data));
  return data.meta;
}

export function deleteSave() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch (err) {
    /* ignore */
  }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

/** Datum a čas podle zvoleného jazyka, ne nastavení prohlížeče. */
export function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("neznámý čas");
  if (getLanguage() === 'en') {
    return new Intl.DateTimeFormat(getLocale(), {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  }
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatSaveLabel(meta) {
  if (!meta) return t("Bez uložené hry");
  const started = formatDateTime(meta.startedAt);
  const saved = formatDateTime(meta.savedAt);
  return t("Zahájeno {0} · uloženo {1}", { 0: started, 1: saved });
}

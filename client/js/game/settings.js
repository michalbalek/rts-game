import { isLanguage } from '../i18n/index.js';

const KEY = 'kralovstvi_settings_v2';

export const CAMERA_SPEEDS = {
  low: 320,
  medium: 560,
  high: 840
};

export const DEFAULT_SETTINGS = {
  language: 'cs',
  musicVolume: 55,
  sfxVolume: 80,
  musicMuted: false,
  sfxMuted: false,
  cameraSpeed: 'medium',
  quality: 'high',
  showFps: false,
  nick: ''
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, language: isLanguage(parsed.language) ? parsed.language : 'cs' };
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.warn('Could not save settings:', err);
    return false;
  }
}

export function saveNick(nick) {
  const settings = loadSettings();
  settings.nick = nick;
  saveSettings(settings);
}

export function loadNick() {
  return loadSettings().nick || '';
}

export function isValidNick(nick) {
  return /^[A-Za-z0-9_ ]{3,16}$/.test(nick) && nick.trim().length >= 3;
}

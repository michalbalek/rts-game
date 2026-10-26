import ui from './en-ui.js';
import game from './en-game.js';
import { formatMessage } from '../sim/messages.js';

export const LANGUAGES = { cs: 'Čeština', en: 'English' };
export const ENGLISH = { ...ui, ...game };
let language = 'cs';
const missing = new Set();

export function isLanguage(value) {
  return Object.hasOwn(LANGUAGES, value);
}

export function getLanguage() {
  return language;
}

export function getLocale() {
  return language === 'en' ? 'en-GB' : 'cs-CZ';
}

export function setLanguage(value) {
  if (!isLanguage(value)) throw new RangeError(`Unsupported language: ${value}`);
  language = value;
}

export function t(key, params = {}) {
  if (!key) return '';
  const translate = source => {
    if (language === 'cs') return source;
    if (Object.hasOwn(ENGLISH, source)) return ENGLISH[source];
    if (/[áčďéěíňóřšťúůýž]/i.test(source) && !missing.has(source)) {
      missing.add(source);
      console.warn('Missing English translation:', source);
    }
    return source;
  };
  return formatMessage(typeof key === 'object' ? key : { key, params }, translate);
}

export function translatePage(root = document) {
  root.documentElement.lang = language;
  root.title = t('Království | Izometrická RTS');
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  for (const attribute of ['title', 'aria-label', 'placeholder']) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(el => {
      el.setAttribute(attribute, t(el.getAttribute(`data-i18n-${attribute}`)));
    });
  }
}

export function languageOptions() {
  return Object.entries(LANGUAGES).map(([key, name]) =>
    `<option value="${key}"${key === language ? ' selected' : ''}>${name}</option>`
  ).join('');
}

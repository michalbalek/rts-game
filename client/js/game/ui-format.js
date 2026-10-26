import { t } from '../i18n/index.js';
export function fmt(n) {
  return String(Math.floor(Number(n) || 0));
}

export function pct(a, b) {
  if (!b) return 0;
  return Math.max(0, Math.min(1, a / b));
}

export function assignedWorkers(b) {
  return Array.isArray(b.assignedWorkerIds) ? b.assignedWorkerIds.length : b.workers;
}

export function workerLabel(b, def) {
  const enRoute = Math.max(0, assignedWorkers(b) - b.workers);
  return `${b.workers}/${def.workers}${enRoute ? ` +${enRoute}` : ''}`;
}

export function timeLabel(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function resourceName(key) {
  switch (key) {
    case 'wood': return t("🪵 Dřevo");
    case 'stone': return t("🪨 Kámen");
    case 'food': return t("🍎 Jídlo");
    case 'iron': return t("⛓️ Železo");
    default: return key || '—';
  }
}

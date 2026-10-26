import crypto from 'node:crypto';
import { MAP_PRESETS } from '../../client/js/sim/constants.js';

export const TICK_MS = 50;                 // 20 ticků za sekundu
export const SNAPSHOT_MS = 200;            // 5 snímků za sekundu
export const COUNTDOWN_SECONDS = positiveInt(process.env.LOBBY_COUNTDOWN, 20);
export const RETURN_SECONDS = positiveInt(process.env.RETURN_DELAY, 30);
export const RECONNECT_SECONDS = positiveInt(process.env.RECONNECT_GRACE, 120);
export const MAX_ROOMS = positiveInt(process.env.MAX_ROOMS, 8);
export const MAX_COMMANDS_PER_SECOND = 60;

export function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function validNick(nick) {
  return typeof nick === 'string' &&
    /^[A-Za-z0-9_ ]{3,16}$/.test(nick) &&
    nick.trim().length >= 3;
}

export function randomSeed() {
  return crypto.randomBytes(4).readUInt32BE(0);
}

export function randomMapKey() {
  const keys = Object.keys(MAP_PRESETS);
  return keys[crypto.randomInt(keys.length)];
}

export function publicPlayer(p) {
  return {
    id: p.playerId,
    name: p.nick,
    color: p.color,
    colorName: p.colorName
  };
}


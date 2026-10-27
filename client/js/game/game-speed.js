import { getLocale } from '../i18n/index.js';

/** Volitelné rychlosti singleplayerové hry; multiplayer běží vždy 1×. */
export const GAME_SPEEDS = [0.5, 1, 1.5, 2, 3];

// Nejdelší krok simulace. Při zrychlení se snímek rozdělí na více kroků,
// aby se jednotky nepřeskakovaly přes překážky a souboje zůstaly stejné.
const MAX_STEP = 0.05;

export function stepSimulation(sim, dt, speed = 1) {
  const total = dt * speed;
  if (total <= 0) return;
  const steps = Math.max(1, Math.ceil(total / MAX_STEP - 1e-9));
  const step = total / steps;
  for (let i = 0; i < steps && !sim.ended; i++) sim.tick(step);
}

export function nextSpeed(current, direction) {
  const index = GAME_SPEEDS.indexOf(current);
  const base = index === -1 ? GAME_SPEEDS.indexOf(1) : index;
  const next = Math.max(0, Math.min(GAME_SPEEDS.length - 1, base + Math.sign(direction)));
  return GAME_SPEEDS[next];
}

export function formatSpeed(speed) {
  return `${speed.toLocaleString(getLocale())}×`;
}

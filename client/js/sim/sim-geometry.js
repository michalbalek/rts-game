export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Čtvercová vzdálenost k obdélníku budovy. */
export function distanceToBuilding(x, y, b) {
  const cx = clamp(x, b.tileX, b.tileX + b.width);
  const cy = clamp(y, b.tileY, b.tileY + b.height);
  return Math.hypot(x - cx, y - cy);
}

export function isEnemy(a, b) {
  return b !== 0 && a !== b;
}

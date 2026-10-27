/**
 * Matematika izometrické projekce – symetrická dlaždice 56×28 px (úhel 26,6°).
 */

export const TILE_WIDTH = 56;
export const TILE_HEIGHT = 28;
export const HALF_TILE_WIDTH = TILE_WIDTH / 2;
export const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;

/** Převod dlaždicových souřadnic (x, y) na světové/obrazovkové souřadnice. */
export function tileToScreen(tileX, tileY) {
  return {
    x: (tileX - tileY) * HALF_TILE_WIDTH,
    y: (tileX + tileY) * HALF_TILE_HEIGHT
  };
}

/** Zpětný převod světových souřadnic na (nezaokrouhlené) dlaždice. */
export function worldToTile(worldX, worldY) {
  return {
    x: worldY / TILE_HEIGHT + worldX / TILE_WIDTH,
    y: worldY / TILE_HEIGHT - worldX / TILE_WIDTH
  };
}

/** Zpětný převod se zaokrouhlením dolů. */
export function screenToTile(worldX, worldY) {
  const t = worldToTile(worldX, worldY);
  return { x: Math.floor(t.x), y: Math.floor(t.y) };
}

export function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * Stín pod budovou v lokálních izometrických souřadnicích.
 * Střed leží ve středu půdorysu, ne na předním rohu – jinak stín odjíždí
 * před budovu a ta působí, jako by se vznášela nad zemí.
 */
export function buildingShadow(width, height) {
  const span = width + height;
  return {
    cx: (width - height) * HALF_TILE_WIDTH / 2,
    cy: span * HALF_TILE_HEIGHT / 2,
    rx: span * HALF_TILE_WIDTH * 0.53,
    ry: span * HALF_TILE_HEIGHT * 0.53
  };
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

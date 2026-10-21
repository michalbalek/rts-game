/**
 * Matematika pro izometrickou projekci (úhel 45 stupňů)
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// Maximální stavební rádius od hradu podle game.md (100 bloků)
export const MAX_BUILD_RADIUS = 100;

/**
 * Převod z dlaždicových souřadnic (x, y) na souřadnice obrazovky
 */
export function tileToScreen(tileX, tileY) {
  return {
    x: (tileX - tileY) * (TILE_WIDTH / 2),
    y: (tileX + tileY) * (TILE_HEIGHT / 2)
  };
}

/**
 * Převod ze souřadnic obrazovky na dlaždicové souřadnice (x, y)
 */
export function screenToTile(screenX, screenY) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  
  const tileX = Math.floor((screenX / halfW + screenY / halfH) / 2);
  const tileY = Math.floor((screenY / halfH - screenX / halfW) / 2);
  
  return { x: tileX, y: tileY };
}

/**
 * Výpočet eukleidovské vzdálenosti mezi dvěma bloky na mapě
 */
export function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * Kontrola, zda je zadaná dlaždice v povoleném stavebním rádiusu od hradu (100 bloků)
 */
export function isWithinBuildRadius(tileX, tileY, castleX, castleY) {
  return getDistance(tileX, tileY, castleX, castleY) <= MAX_BUILD_RADIUS;
}

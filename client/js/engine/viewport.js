import {
  HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT
} from './isometric.js';

/**
 * Rozdělí viditelný světový obdélník na řádky dlaždic.
 *
 * Izometrická projekce zobrazuje obdélník obrazovky jako kosočtverec
 * v dlaždicových souřadnicích. Pro každý řádek `y` proto stačí kreslit
 * jen průsečík tohoto kosočtverce, ne celý obdélník kolem něj.
 */
export function visibleTileRows(worldX1, worldY1, worldX2, worldY2, size, pad = 3) {
  const left = Math.min(worldX1, worldX2);
  const right = Math.max(worldX1, worldX2);
  const top = Math.min(worldY1, worldY2);
  const bottom = Math.max(worldY1, worldY2);

  const yMin = Math.max(0, Math.floor(top / TILE_HEIGHT - right / TILE_WIDTH) - pad);
  const yMax = Math.min(size - 1, Math.ceil(bottom / TILE_HEIGHT - left / TILE_WIDTH) + pad);

  const rows = [];
  for (let y = yMin; y <= yMax; y++) {
    let x0 = Math.ceil(y + left / HALF_TILE_WIDTH);
    let x1 = Math.floor(y + right / HALF_TILE_WIDTH);
    const byTop = Math.ceil(top / HALF_TILE_HEIGHT - y);
    const byBottom = Math.floor(bottom / HALF_TILE_HEIGHT - y);
    if (byTop > x0) x0 = byTop;
    if (byBottom < x1) x1 = byBottom;
    x0 = Math.max(0, x0 - pad);
    x1 = Math.min(size - 1, x1 + pad);
    if (x0 <= x1) rows.push({ y, x0, x1 });
  }
  return rows;
}

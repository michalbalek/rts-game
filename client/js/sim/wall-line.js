import { BUILDING_DEFS } from './constants.js';
import { validatePlacement } from './placement.js';

export const MAX_WALL_LENGTH = 48;

export function wallLine(x1, y1, x2, y2) {
  if (![x1, y1, x2, y2].every(Number.isInteger)) return null;
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const delta = horizontal ? x2 - x1 : y2 - y1;
  if (Math.abs(delta) + 1 > MAX_WALL_LENGTH) return null;
  const step = Math.sign(delta);
  return Array.from({ length: Math.abs(delta) + 1 }, (_, i) => ({
    x: x1 + (horizontal ? i * step : 0),
    y: y1 + (horizontal ? 0 : i * step)
  }));
}

export function validateWallLine(map, buildings, playerId, player, castle, units, x1, y1, x2, y2) {
  const tiles = wallLine(x1, y1, x2, y2);
  if (!tiles) return { valid: false, reason: 'Neplatný nebo příliš dlouhý úsek hradeb.' };
  const cost = BUILDING_DEFS.wall.cost;
  const affordable = !!(player && player.resources && Object.keys(cost).every(
    key => (player.resources[key] || 0) >= cost[key] * tiles.length
  ));
  const proposed = buildings.slice();
  for (const tile of tiles) {
    const check = validatePlacement(map, proposed, playerId, 'wall', tile.x, tile.y, {
      alive: player ? player.alive : false, castle, units, canAfford: affordable
    });
    if (!check.valid) return check;
    proposed.push({ type: 'wall', ownerId: playerId, tileX: tile.x, tileY: tile.y, width: 1, height: 1 });
  }
  return { valid: true, tiles };
}

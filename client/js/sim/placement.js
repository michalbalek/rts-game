import {
  BUILDING_DEFS, TILE_TYPES, RESOURCE_TYPES, ENEMY_BUILD_DISTANCE
} from './constants.js';
import { failure } from './messages.js';

/** Nejkratší vzdálenost mezi dvěma obdélníky (bod má w = h = 0). */
function rectGap(x, y, w, h, rx, ry, rw, rh) {
  const dx = Math.max(0, rx - (x + w), x - (rx + rw));
  const dy = Math.max(0, ry - (y + h), y - (ry + rh));
  return Math.hypot(dx, dy);
}

/**
 * Ověření umístění budovy nezávisle na simulaci.
 * Používá ho klient pro náhled stavby i server/simulace jako autoritu.
 */
export function validatePlacement(map, buildings, playerId, type, x, y, opts = {}) {
  const def = BUILDING_DEFS[type];
  if (!def) return { valid: false, reason: 'Neznámá stavba, sire!' };
  if (type === 'castle') return { valid: false, reason: 'Královský hrad nelze postavit.' };
  if (opts.alive === false) return { valid: false, reason: 'Vaše panství již padlo.' };

  const castle = opts.castle || buildings.find(b => b.type === 'castle' && b.ownerId === playerId && b.complete);
  if (!castle) return { valid: false, reason: 'Nemáte Královský hrad.' };

  if (x < 1 || y < 1 || x + def.w > map.size - 1 || y + def.h > map.size - 1) {
    return { valid: false, reason: 'Sem nelze stavět, můj pane!' };
  }

  const isEnemyOwner = ownerId => ownerId !== 0 && ownerId !== playerId;
  const enemyBuilding = buildings.some(b => isEnemyOwner(b.ownerId) &&
    rectGap(x, y, def.w, def.h, b.tileX, b.tileY, b.width, b.height) < ENEMY_BUILD_DISTANCE);
  const enemyUnit = (opts.units || []).some(u => isEnemyOwner(u.ownerId) &&
    rectGap(x, y, def.w, def.h, u.x, u.y, 0, 0) < ENEMY_BUILD_DISTANCE);
  if (enemyBuilding || enemyUnit) {
    return { valid: false, ...failure('Stavět nelze do {0} bloků od nepřátelské jednotky nebo budovy, sire!', { 0: ENEMY_BUILD_DISTANCE }) };
  }

  let treeTiles = 0;
  let stoneTiles = 0;
  let ironTiles = 0;
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tile = map.getTile(x + dx, y + dy);
      if (tile === TILE_TYPES.WATER_DEEP || tile === TILE_TYPES.WATER_SHALLOW) {
        return { valid: false, reason: 'Na vodě nelze stavět, sire!' };
      }
      const res = map.getResource(x + dx, y + dy);
      if (res === RESOURCE_TYPES.TREE) treeTiles++;
      if (res === RESOURCE_TYPES.STONE) stoneTiles++;
      if (res === RESOURCE_TYPES.IRON) ironTiles++;
    }
  }

  if (!def.requires && (stoneTiles > 0 || ironTiles > 0)) {
    return { valid: false, reason: 'Na ložisku mohou stát jen kamenolom a železný důl.' };
  }
  if (def.requires === 'tree' && treeTiles === 0) {
    return { valid: false, reason: 'Dřevorubec musí stát na stromě, můj pane!' };
  }
  if (def.requires === 'stone') {
    if (stoneTiles !== def.w * def.h) {
      return { valid: false, reason: 'Kamenolom musí celý ležet na ložisku kamene.' };
    }
    const dep = map.getDepositAt(x, y);
    if (!dep || dep.amount <= 0) return { valid: false, reason: 'Ložisko kamene je vyčerpané.' };
  }
  if (def.requires === 'iron') {
    if (ironTiles !== def.w * def.h) {
      return { valid: false, reason: 'Železný důl musí celý ležet na ložisku železné rudy.' };
    }
    const dep = map.getDepositAt(x, y);
    if (!dep || dep.amount <= 0) return { valid: false, reason: 'Ložisko železné rudy je vyčerpané.' };
  }

  for (const b of buildings) {
    const overlap = x < b.tileX + b.width && x + def.w > b.tileX &&
                    y < b.tileY + b.height && y + def.h > b.tileY;
    if (overlap) return { valid: false, reason: 'Místo je již zabráno jinou stavbou, sire!' };

    const gapOverlap = x - 1 < b.tileX + b.width && x + def.w + 1 > b.tileX &&
                       y - 1 < b.tileY + b.height && y + def.h + 1 > b.tileY;
    const bothWarehouses = type === 'warehouse' && b.type === 'warehouse';
    if (gapOverlap && !bothWarehouses) {
      return { valid: false, reason: 'Mezi budovami musí zůstat volný pruh pro povozy!' };
    }
  }

  if (opts.canAfford === false) {
    return { valid: false, reason: 'Pokladna a sklady nemají dostatek surovin, můj pane!' };
  }

  return { valid: true };
}

import { tileToScreen, HALF_TILE_WIDTH, HALF_TILE_HEIGHT } from '../engine/isometric.js';

/**
 * Výběr entit v izometrickém světě.
 *
 * Klepnutí se vyhodnocuje proti skutečnému tvaru kreslených jednotek a budov,
 * ne proti dlaždici pod kurzorem. Tažení se převádí na obdélník ve světových
 * pixelech, který přesně odpovídá obdélníku na obrazovce.
 */

// Jednotka je kreslená od základny nahoru, proto je hitbox posunutý vzhůru.
const UNIT_HIT = {
  rx: 13,
  ry: 22,
  centerY: -10
};

// Přibližná výška kreslené budovy v pixelech (bez střechy/pochodně).
const BUILDING_HEIGHTS = {
  castle: 78,
  barracks: 58,
  market: 34,
  dwelling: 42,
  warehouse: 36,
  ironmine: 38,
  granary: 78,
  lumberjack: 32,
  quarry: 44,
  orchard: 16
};
const DEFAULT_BUILDING_HEIGHT = 34;

export function unitHitBox(unit) {
  const p = tileToScreen(unit.x, unit.y);
  return {
    minX: p.x - UNIT_HIT.rx,
    maxX: p.x + UNIT_HIT.rx,
    minY: p.y + UNIT_HIT.centerY - UNIT_HIT.ry,
    maxY: p.y + UNIT_HIT.centerY + UNIT_HIT.ry,
    baseX: p.x,
    baseY: p.y
  };
}

export function buildingHitBox(building) {
  const width = building.width || 1;
  const height = building.height || 1;
  const p = tileToScreen(building.tileX, building.tileY);
  const structureHeight = BUILDING_HEIGHTS[building.type] ?? DEFAULT_BUILDING_HEIGHT;
  return {
    minX: p.x - height * HALF_TILE_WIDTH,
    maxX: p.x + width * HALF_TILE_WIDTH,
    minY: p.y - structureHeight,
    maxY: p.y + (width + height) * HALF_TILE_HEIGHT,
    baseX: p.x,
    baseY: p.y
  };
}

function isVisible(session, entity) {
  if (!session || typeof session.isEntityVisible !== 'function') return true;
  return session.isEntityVisible(entity);
}

function unitDepth(unit) {
  return (unit.x || 0) + (unit.y || 0);
}

/**
 * Najde entitu pod světovým bodem. Přednost mají jednotky (jsou menší a hýbou se),
 * mezi nimi vyhrává ta nejblíž kurzoru; při překryvu ta blíž kameře.
 */
export function pickEntityAtWorld(session, worldX, worldY) {
  if (!session || !session.state) return null;
  const state = session.state;

  let bestUnit = null;
  let bestScore = Infinity;
  for (const unit of state.units || []) {
    if (!isVisible(session, unit)) continue;
    const box = unitHitBox(unit);
    const dx = (worldX - box.baseX) / UNIT_HIT.rx;
    const dy = (worldY - (box.baseY + UNIT_HIT.centerY)) / UNIT_HIT.ry;
    const distance = dx * dx + dy * dy;
    if (distance > 1) continue;
    // Při stejném zásahu upřednostníme jednotku vpředu (větší hloubka).
    const score = distance - unitDepth(unit) * 1e-6;
    if (score < bestScore) {
      bestScore = score;
      bestUnit = { type: 'unit', entity: unit };
    }
  }
  if (bestUnit) return bestUnit;

  let bestBuilding = null;
  let bestDepth = -Infinity;
  for (const building of state.buildings || []) {
    if (!isVisible(session, building)) continue;
    const box = buildingHitBox(building);
    if (worldX < box.minX || worldX > box.maxX || worldY < box.minY || worldY > box.maxY) continue;
    const depth = building.tileX + building.tileY +
      (building.width || 1) + (building.height || 1);
    if (depth > bestDepth) {
      bestDepth = depth;
      bestBuilding = { type: 'building', entity: building };
    }
  }
  return bestBuilding;
}

/** Vlastní jednotky, jejichž základna leží ve světovém obdélníku. */
export function unitsInWorldRect(session, minX, minY, maxX, maxY, padding = 12) {
  if (!session || !session.state) return [];
  const left = Math.min(minX, maxX) - padding;
  const right = Math.max(minX, maxX) + padding;
  const top = Math.min(minY, maxY) - padding;
  const bottom = Math.max(minY, maxY) + padding;
  const found = [];
  for (const unit of session.state.units || []) {
    if (unit.ownerId !== session.selfId) continue;
    if (!isVisible(session, unit)) continue;
    const p = tileToScreen(unit.x, unit.y);
    if (p.x < left || p.x > right) continue;
    if (p.y < top || p.y > bottom) continue;
    found.push(unit);
  }
  found.sort((a, b) => a.id - b.id);
  return found;
}

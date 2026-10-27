import { BUILDING_DEFS } from './constants.js';

export function isBuildingRotation(rotation) {
  return Number.isInteger(rotation) && rotation >= 0 && rotation < 4;
}

export function rotatedBuildingSize(def, rotation = 0) {
  return rotation % 2 ? { width: def.h, height: def.w } : { width: def.w, height: def.h };
}

export function rotateBuildingPoint(u, v, width, height, rotation = 0) {
  switch (rotation) {
    case 1: return { u: height - v, v: u };
    case 2: return { u: width - u, v: height - v };
    case 3: return { u: v, v: width - u };
    default: return { u, v };
  }
}

export function legacyGateRotation(gate, buildings) {
  const neighbours = buildings.filter(other => other !== gate && other.ownerId === gate.ownerId &&
    BUILDING_DEFS[other.type]?.fortification);
  const touches = (x, y) => neighbours.some(other =>
    x >= other.tileX && x < other.tileX + other.width && y >= other.tileY && y < other.tileY + other.height);
  return (touches(gate.tileX, gate.tileY - 1) || touches(gate.tileX, gate.tileY + 1)) &&
    !(touches(gate.tileX - 1, gate.tileY) || touches(gate.tileX + 1, gate.tileY)) ? 1 : 0;
}

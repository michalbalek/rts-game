export let failures = 0;
export function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

export function findSpot(targetSim, playerId, type, maxDistance = 24) {
  const castle = targetSim.getCastle(playerId);
  for (let yy = castle.tileY - maxDistance; yy <= castle.tileY + maxDistance; yy++) {
    for (let xx = castle.tileX - maxDistance; xx <= castle.tileX + maxDistance; xx++) {
      if (xx < 0 || yy < 0 || xx >= targetSim.map.size || yy >= targetSim.map.size) continue;
      if (targetSim.canPlaceBuilding(playerId, type, xx, yy).valid) return { x: xx, y: yy };
    }
  }
  return null;
}

export function findLumberSpotNearTree(sim, playerId, treeX, treeY, maxDistance = 1) {
  for (let radius = 1; radius <= maxDistance; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = treeX + dx;
        const y = treeY + dy;
        if (sim.canPlaceBuilding(playerId, 'lumberjack', x, y).valid) return { x, y };
      }
    }
  }
  return null;
}

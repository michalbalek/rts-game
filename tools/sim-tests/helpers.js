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

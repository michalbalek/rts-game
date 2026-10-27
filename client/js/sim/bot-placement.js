import { BUILDING_DEFS, RESOURCE_TYPES } from './constants.js';

/**
 * Hled?n? m?sta pro stavbu bota: lom a d?l na nejbli???m lo?isku,
 * d?evorubec u strom? nejbl?? hradu, ostatn? budovy ve spir?le kolem hradu.
 */
export function findBuildSpot(sim, player, castle, type) {
  const def = BUILDING_DEFS[type];
  if (type === 'quarry' || type === 'ironmine') {
    const wanted = type === 'quarry' ? 'stone' : 'iron';
    const deposits = sim.map.deposits
      .filter(d => d.active && d.type === wanted)
      .sort((a, b) => depositDistance(a, castle, sim.map.size) - depositDistance(b, castle, sim.map.size));
    for (const dep of deposits) {
      for (const idx of dep.tiles) {
        const x = idx % sim.map.size;
        const y = Math.floor(idx / sim.map.size);
        const check = sim.canPlaceBuilding(player.id, type, x, y);
        if (check.valid) return { x, y };
      }
    }
    return null;
  }

  if (type === 'lumberjack') {
    let best = null;
    let bestD = Infinity;
    const cx = Math.floor(castle.centerX);
    const cy = Math.floor(castle.centerY);
    const r = 34;
    for (let y = Math.max(1, cy - r); y <= Math.min(sim.map.size - 2, cy + r); y++) {
      for (let x = Math.max(1, cx - r); x <= Math.min(sim.map.size - 2, cx + r); x++) {
        if (sim.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const tx = x + dx;
            const ty = y + dy;
            const d = Math.hypot(tx - cx, ty - cy);
            if (d >= bestD || !sim.canPlaceBuilding(player.id, type, tx, ty).valid) continue;
            best = { x: tx, y: ty };
            bestD = d;
          }
        }
      }
    }
    if (best) return best;
  }

  // Obecná stavba – spirála kolem hradu.
  const centerX = castle.centerX;
  const centerY = castle.centerY;
  for (let ring = 5; ring <= 38; ring += 1.5) {
    const steps = Math.max(10, Math.round(ring * 2.1));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + (ring % 3) * 0.4;
      const x = Math.round(centerX + Math.cos(angle) * ring - def.w / 2);
      const y = Math.round(centerY + Math.sin(angle) * ring - def.h / 2);
      if (sim.canPlaceBuilding(player.id, type, x, y).valid) return { x, y };
    }
  }
  return null;
}

function depositDistance(dep, castle, size) {
  let best = Infinity;
  for (const idx of dep.tiles) {
    const x = idx % size;
    const y = Math.floor(idx / size);
    const d = Math.hypot(x - castle.centerX, y - castle.centerY);
    if (d < best) best = d;
  }
  return best;
}

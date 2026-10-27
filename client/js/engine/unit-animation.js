import { unitActivity } from '../sim/entities.js';

/** Délku kroku určuje uražená vzdálenost, nikoli časovač nebo naplánovaná cesta. */
export function unitAnimation(unit, time, previous) {
  const dx = previous ? unit.x - previous.x : 0;
  const dy = previous ? unit.y - previous.y : 0;
  const distance = Math.hypot(dx, dy);
  const moved = distance > 0.0001 && distance < 1;
  const hasPath = unit.path
    ? (unit.pathIndex || 0) < unit.path.length
    : !!unit.moving;
  const lastMoved = moved ? time : (previous?.lastMoved ?? -1);
  const chopping = unitActivity(unit) === 'work' &&
    (typeof unit.work === 'object' ? unit.work?.produce : unit.carryResource) === 'wood';
  const moving = chopping && !hasPath ? false : moved || (hasPath && time - lastMoved < 0.12);
  const phase = (previous?.phase || 0) + (moved ? distance * 7.5 : 0);
  const angle = unit.angle || 0;
  const sx = moved && moving ? (dx - dy) / distance : Math.cos(angle) - Math.sin(angle);
  const sy = moved && moving ? (dx + dy) / distance : Math.cos(angle) + Math.sin(angle);
  const facing = Math.abs(sx) < 0.05 ? (previous?.facing || 1) : Math.sign(sx);
  const activity = moving ? 'walk' : unitActivity(unit);
  const workCycle = time * 5.5 + unit.id * 2.4;
  const attackAge = Math.max(0, (unit.config?.cooldown || 1.2) - (unit.cooldown || 0));
  const attack = activity === 'attack' ? Math.sin(Math.min(1, attackAge / 0.38) * Math.PI) : 0;
  return {
    x: unit.x, y: unit.y, phase, lastMoved, facing, moving, activity,
    back: sy < -0.05,
    stride: moving ? Math.sin(phase) : 0,
    lift: moving ? Math.abs(Math.cos(phase)) * 0.6 : 0,
    breathe: Math.sin(time * 2.2 + unit.id) * 0.18,
    effort: ['work', 'build', 'harvest'].includes(activity) ? Math.sin(workCycle) : 0,
    attack
  };
}

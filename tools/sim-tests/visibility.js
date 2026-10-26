import { GameSim } from '../../client/js/sim/sim.js';
import { unitActivity } from '../../client/js/sim/entities.js';
import { assert } from './helpers.js';

export function testVisibility({ sim, lumber }) {
  console.log('\n--- Mlha války a kapacity ---');
  const sim4 = new GameSim({
    seed: 999,
    mapType: 'oasis',
    mode: 'multiplayer',
    capital: 'medium',
    fog: true,
    players: [
      { name: 'Hráč', isBot: false },
      { name: 'Soupeř', isBot: false }
    ]
  });
  const ownCastle = sim4.getCastle(1);
  const enemyCastle = sim4.getCastle(2);
  assert(sim4.isVisible(1, ownCastle.centerX, ownCastle.centerY), 'vlastní hrad je viditelný');
  assert(!sim4.isVisible(1, enemyCastle.centerX, enemyCastle.centerY), 'nepřátelský hrad je skrytý mlhou');
  const snapshot = sim4.serialize(1);
  assert(snapshot.buildings.some(b => b.type === 'castle' && b.ownerId === 1), 'snímek obsahuje vlastní hrad');
  assert(!snapshot.buildings.some(b => b.type === 'castle' && b.ownerId === 2), 'snímek neobsahuje skrytý hrad');
  assert(snapshot.fog === true, 'snímek nese příznak mlhy');
  assert(snapshot.units.every(raw => {
    const unit = sim4.units.find(u => u.id === raw.id);
    return raw.angle === unit.angle && raw.activity === unitActivity(unit) &&
      raw.cooldown === Math.round(unit.cooldown * 100) / 100 &&
      raw.workPaused === unit.workPaused;
  }), 'síťový snímek nese směr, činnost a časování animací viditelných jednotek');
  const visualWorker = sim.units.find(u => u.work && u.work.buildingId === lumber.id);
  const oldPhase = visualWorker.work.phase;
  const oldCarry = visualWorker.work.carry;
  visualWorker.work.phase = 'toStorage';
  visualWorker.work.carry = 10;
  const carryingSnapshot = sim.serialize(1).units.find(u => u.id === visualWorker.id);
  assert(carryingSnapshot.carry === 10 && carryingSnapshot.carryResource === 'wood' &&
    carryingSnapshot.activity === 'idle', 'síťový nosič má správný druh nákladu a netěží cestou');
  visualWorker.work.phase = oldPhase;
  visualWorker.work.carry = oldCarry;

  const caps = sim4.getStorageCaps(1);
  assert(caps.resources === 500 && caps.food === 300, 'hrad poskytuje sklad 500 a sýpku 300');
  const freeSpace = caps.resources - sim4.getStoredResources(1);
  const accepted = sim4.addResource(1, 'wood', 9999);
  assert(accepted === freeSpace, `sklad přijme jen volné místo (${accepted})`);
  assert(sim4.getStoredResources(1) === caps.resources, 'sklad je na kapacitě');
  assert(sim4.addResource(1, 'wood', 10) === 0, 'plný sklad odmítne další suroviny');

  return { sim4, ownCastle, enemyCastle };
}

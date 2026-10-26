import { GameSim } from '../../client/js/sim/sim.js';
import { assert } from './helpers.js';

export function testVictory() {
  console.log('\n--- Boj a vítězství ---');
  const sim2 = new GameSim({
    seed: 42,
    mapType: 'desert',
    mode: 'bots',
    capital: 'rich',
    players: [
      { name: 'Hráč', isBot: false },
      { name: 'Bot', isBot: true, difficulty: 'hard' }
    ]
  });
  // Rychlý test: zničíme hrad bota.
  const botCastle = sim2.getCastle(2);
  assert(!!botCastle, 'bot má hrad');
  sim2.dealDamage(botCastle, 99999, 1);
  assert(!sim2.getCastle(2), 'hrad bota padl');
  assert(sim2.ended && sim2.winnerId === 1, 'hráč vyhrál');

}

export function testCombat() {
  console.log('\n--- Boj jednotek ---');
  const sim5 = new GameSim({
    seed: 555,
    mapType: 'desert',
    mode: 'sandbox',
    capital: 'rich',
    players: [
      { name: 'Hráč', isBot: false },
      { name: 'Soupeř', isBot: false }
    ]
  });
  const enemyCastle5 = sim5.getCastle(2);
  const attacker = sim5.addUnit('swordsman', 1, enemyCastle5.centerX - 5, enemyCastle5.centerY);
  const defender = sim5.addUnit('archer', 2, enemyCastle5.centerX - 4, enemyCastle5.centerY);
  const attackOrder = sim5.command(1, { op: 'attack', unitIds: [attacker.id], targetId: defender.id });
  assert(attackOrder.ok, 'povel k útoku přijat');
  for (let i = 0; i < 20 * 12; i++) sim5.tick(1 / 20);
  assert(defender.hp < defender.maxHp || !sim5.units.includes(defender), 'cíl utrpěl poškození');
  assert(sim5.players[0].stats.damage > 0, 'statistika poškození se zvýšila');

  console.log('\n--- Přesun má přednost před automatickým útokem ---');
  const sim6 = new GameSim({
    seed: 8123,
    mapType: 'desert',
    mode: 'sandbox',
    capital: 'rich',
    fog: false,
    players: [
      { name: 'Hráč', isBot: false },
      { name: 'Soupeř', isBot: false }
    ]
  });
  const castle6 = sim6.getCastle(1);
  const own6 = sim6.addUnit('swordsman', 1, castle6.centerX + 3, castle6.centerY + 1);
  const foe6 = sim6.addUnit('swordsman', 2, castle6.centerX + 6, castle6.centerY + 1);
  foe6.autoAttack = false;
  assert(Math.hypot(foe6.x - own6.x, foe6.y - own6.y) <= own6.config.aggro,
    'nepřítel je v dosahu automatického útoku');

  const moveStartX = own6.x;
  const moveOrder = sim6.command(1, {
    op: 'move', unitIds: [own6.id], x: own6.x - 10, y: own6.y + 1
  });
  assert(moveOrder.ok && !!own6.moveTarget, 'povel k přesunu je přijat i s nepřítelem na dohledu');
  for (let i = 0; i < 4; i++) sim6.tick(1 / 20);
  assert(own6.attackTargetId === null && !!own6.moveTarget,
    'blízký nepřítel během přesunu nezruší povel');
  for (let i = 0; i < 20 * 2; i++) sim6.tick(1 / 20);
  assert(own6.x < moveStartX - 0.8, 'jednotka se po povelu skutečně vzdálila od nepřítele');

}

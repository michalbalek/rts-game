import { GameSim } from '../../client/js/sim/sim.js';
import { Building } from '../../client/js/sim/entities.js';
import { RESOURCE_TYPES, TILE_TYPES } from '../../client/js/sim/constants.js';
import { moneyReserve, needsMarketFirst } from '../../client/js/sim/bot-economy.js';
import { assert } from './helpers.js';

function runBotGame(capital, minutes) {
  const sim = new GameSim({
    seed: 4242, mapType: 'desert', mode: 'bots', capital, fog: true,
    players: [{ name: 'Hráč', isBot: false }, { name: 'Bot', isBot: true, difficulty: 'medium' }]
  });
  const bot = sim.getPlayer(2);
  let maxMoney = 0;
  let sold = 0;
  const command = sim.command.bind(sim);
  sim.command = (playerId, cmd) => {
    const result = command(playerId, cmd);
    if (playerId === 2 && cmd.op === 'sell' && result.ok) sold += result.earned;
    return result;
  };
  for (let i = 0; i < minutes * 60 * 20; i++) {
    sim.tick(1 / 20);
    maxMoney = Math.max(maxMoney, bot.resources.money);
  }
  const own = type => sim.buildings.some(b => b.ownerId === 2 && b.type === type && b.complete);
  return { sim, bot, own, sold, maxMoney };
}

export function testBotEconomy() {
  console.log('\n--- Hospodaření bota bez automatického příjmu ---');
  const fresh = new GameSim({
    seed: 4242, mapType: 'desert', mode: 'bots', capital: 'modest',
    players: [{ name: 'Hráč', isBot: false }, { name: 'Bot', isBot: true }]
  });
  const freshBot = fresh.getPlayer(2);
  assert(moneyReserve(fresh, freshBot) >= 200, 'bez Obchodu bot drží peníze aspoň na jeho stavbu');
  freshBot.bot.nextBuild = 1;
  fresh.buildings.push(new Building(fresh.nextId++, 'lumberjack', 2, 150, 60, true));
  freshBot.resources.money = 250;
  assert(needsMarketFirst(fresh, freshBot), 'se skromnou pokladnou bot staví Obchod dřív než lom');

  for (const capital of ['modest', 'medium']) {
    const { bot, own, sold } = runBotGame(capital, 12);
    assert(own('market') && own('orchard'), `${capital}: bot má po 12 minutách hotový Obchod i sad`);
    assert(sold > 0, `${capital}: bot prodává přebytky surovin za peníze`);
    assert(bot.bot.nextBuild >= 5, `${capital}: bot pokračuje ve stavebním pořadí (${bot.bot.nextBuild})`);
  }
}

export function testFamineOrchardConstruction() {
  console.log('\n--- Stavba sadu při hladu ---');
  const sim = new GameSim({
    seed: 777, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Hráč' }]
  });
  for (let y = 60; y <= 80; y++) {
    for (let x = 60; x <= 80; x++) {
      sim.map.tiles[sim.map.idx(x, y)] = TILE_TYPES.SAND;
      sim.map.setResource(x, y, RESOURCE_TYPES.NONE);
    }
  }
  const orchard = new Building(sim.nextId++, 'orchard', 1, 70, 70, false);
  const barracks = new Building(sim.nextId++, 'barracks', 1, 64, 64, false);
  sim.buildings.push(orchard, barracks);
  sim.rebuildBlockGrid();
  const orchardBuilder = sim.addUnit('villager', 1, 69.5, 71.5);
  const barracksBuilder = sim.addUnit('villager', 1, 63.5, 64.5);
  sim.command(1, { op: 'construct', buildingId: orchard.id, unitIds: [orchardBuilder.id] });
  sim.command(1, { op: 'construct', buildingId: barracks.id, unitIds: [barracksBuilder.id] });
  const player = sim.getPlayer(1);
  player.resources.food = 0;
  player.foodShortage = true;
  for (let i = 0; i < 20 * 10; i++) {
    player.resources.food = 0;
    sim.tick(1 / 20);
  }
  assert(player.foodShortage, 'zásoby jídla jsou prázdné');
  assert(orchard.progress > 0 && !orchardBuilder.workPaused, 'stavba sadu při hladu pokračuje');
  assert(barracks.progress === 0 && barracksBuilder.workPaused, 'ostatní stavby se při hladu zastaví');
}

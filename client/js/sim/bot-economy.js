import { BOT_BUILD_ORDER, BUILDING_DEFS, RESOURCE_TYPES } from './constants.js';

/**
 * Peněžní hospodaření bota. Peníze nepřibývají automaticky, jediným příjmem
 * je prodej surovin v Obchodu. Bot proto šetří na Obchod, dokud ho nemá,
 * nedovolí výcviku vojska utratit peníze potřebné na další stavbu
 * a v Obchodu průběžně prodává přebytky.
 */

const MARKET_COST = BUILDING_DEFS.market.cost;
const SELL_STEP = 40;
const DIRECT_GATHERERS = 3;
const IDLE_GATHERERS = 12;
const MAX_DWELLINGS = 8;
const ESSENTIALS = ['lumberjack', 'orchard', 'quarry'];
const GATHERED = ['wood', 'stone', 'iron'];
const RESOURCE_OF = { wood: RESOURCE_TYPES.TREE, stone: RESOURCE_TYPES.STONE, iron: RESOURCE_TYPES.IRON };

export function hasMarket(sim, playerId, includeSites = false) {
  return sim.buildings.some(b => b.ownerId === playerId && b.type === 'market' && (includeSites || b.complete));
}

/** Další budova ze stavebního pořadí, kterou bot ještě nemá. */
export function nextOrderType(sim, player) {
  for (let i = player.bot.nextBuild; i < BOT_BUILD_ORDER.length; i++) {
    const type = BOT_BUILD_ORDER[i];
    if (!sim.buildings.some(b => b.ownerId === player.id && b.type === type)) return type;
  }
  return null;
}

/**
 * Bez Obchodu nemá bot jak získat peníze. Pokud by další stavba z pořadí
 * snížila pokladnu pod cenu Obchodu, postaví se Obchod přednostně.
 */
export function needsMarketFirst(sim, player) {
  if (hasMarket(sim, player.id, true)) return false;
  const money = player.resources.money;
  if (money < MARKET_COST.money) return false;
  const next = nextOrderType(sim, player);
  if (!next || next === 'market') return false;
  return money - BUILDING_DEFS[next].cost.money < MARKET_COST.money;
}

/**
 * Peníze, které výcvik nesmí utratit, aby bot mohl pokračovat ve stavbě.
 * Dokud nemá Obchod, kryje rezerva všechny stavby z pořadí až po Obchod.
 */
export function moneyReserve(sim, player) {
  const marketPlanned = hasMarket(sim, player.id, true);
  let reserve = 0;
  for (let i = player.bot.nextBuild; i < BOT_BUILD_ORDER.length; i++) {
    const type = BOT_BUILD_ORDER[i];
    if (sim.buildings.some(b => b.ownerId === player.id && b.type === type)) continue;
    reserve += BUILDING_DEFS[type].cost.money;
    if (marketPlanned || type === 'market') break;
  }
  if (!marketPlanned && !BOT_BUILD_ORDER.slice(player.bot.nextBuild).includes('market')) {
    reserve += MARKET_COST.money;
  }
  return reserve;
}

export function foodLow(player) {
  return player.foodShortage || player.resources.food < player.population * 0.6;
}

/** Bot s volnými penězi nečeká s dalším obydlím na konec stavebního pořadí. */
export function wantsHousing(sim, player) {
  if (player.capacity - player.population > 2) return false;
  if (idleVillagers(sim, player.id).length >= 12) return false;
  const dwellings = sim.buildings.filter(b => b.ownerId === player.id && b.type === 'dwelling');
  if (dwellings.length >= MAX_DWELLINGS || dwellings.some(b => !b.complete)) return false;
  return player.resources.money - BUILDING_DEFS.dwelling.cost.money >= moneyReserve(sim, player);
}

/**
 * Budova, kterou bot potřebuje hned: sad dřív, než dojde jídlo (bez jídla
 * stojí veškerá práce kromě sadu), a znovu dřevorubec, sad či lom, pokud
 * zanikly poté, co je pořadí už přeskočilo.
 */
export function urgentBuilding(sim, player) {
  const has = type => sim.buildings.some(b => b.ownerId === player.id && b.type === type);
  if (!has('orchard') && hasMarket(sim, player.id, true) && player.resources.food < 150) return 'orchard';
  for (const type of ESSENTIALS) {
    if (BOT_BUILD_ORDER.indexOf(type) >= player.bot.nextBuild || has(type)) continue;
    if (type === 'quarry' && !sim.map.deposits.some(d => d.active && d.type === 'stone')) continue;
    return type;
  }
  return null;
}

export function enemiesNearCastle(sim, player, castle, radius = 16) {
  return sim.units.some(u => u.ownerId !== player.id && u.ownerId !== 0 && u.isMilitary &&
    Math.hypot(u.x - castle.centerX, u.y - castle.centerY) <= radius);
}

/**
 * Chybí-li na stavbu dřevo nebo kámen, pošle bot několik volných poddaných
 * sbírat surovinu přímo.
 */
export function gatherMissing(sim, player, castle, cost, limit = DIRECT_GATHERERS) {
  for (const key of GATHERED) {
    if ((player.resources[key] || 0) >= (cost[key] || 0)) continue;
    sendGatherers(sim, player, castle, key, limit, 0);
  }
}

/**
 * Volní poddaní nad zálohu pro armádu nezahálejí u ohniště, ale těží dřevo
 * přímo. Dřevo se v Obchodu promění v peníze na vojsko. Pracující poddaní
 * jedí, proto se to vyplatí až se sadem a Obchodem.
 */
export function employIdle(sim, player, castle, reserve) {
  if (foodLow(player) || !hasMarket(sim, player.id)) return;
  if (!sim.buildings.some(b => b.ownerId === player.id && b.type === 'orchard' && b.complete)) return;
  sendGatherers(sim, player, castle, 'wood', IDLE_GATHERERS, reserve);
}

function idleVillagers(sim, playerId) {
  return sim.units.filter(u =>
    u.ownerId === playerId && u.isVillager && !u.work && !u.build && !u.repairBuildingId && !u.fleeing &&
    !u.moveTarget && u.path.length === 0);
}

/** Neprozkoumané místo sběru nejdřív obhlédne jeden poddaný. */
function sendGatherers(sim, player, castle, key, limit, keepIdle) {
  const busy = sim.units.filter(u => u.ownerId === player.id && u.work?.direct && u.work.produce === key).length;
  if (busy >= limit) return;
  const idle = idleVillagers(sim, player.id);
  const available = Math.min(limit - busy, idle.length - keepIdle, 4);
  if (available <= 0) return;
  const target = nearestResourceTile(sim, castle, RESOURCE_OF[key]);
  if (!target) return;
  if (!sim.isExplored(player.id, target.x, target.y)) {
    const scouting = sim.units.some(u => u.ownerId === player.id && u.botScout && u.moveTarget && !u.work);
    if (scouting) return;
    const scout = idle[0];
    if (sim.command(player.id, { op: 'move', unitIds: [scout.id], x: target.x + 0.5, y: target.y + 0.5 }).ok) {
      scout.botScout = true;
    }
    return;
  }
  for (const u of sim.units) if (u.ownerId === player.id && u.botScout) u.botScout = false;
  const unitIds = idle.slice(0, available).map(u => u.id);
  sim.command(player.id, { op: 'gather', unitIds, x: target.x, y: target.y });
}

function nearestResourceTile(sim, castle, resource) {
  const size = sim.map.size;
  const cx = Math.floor(castle.centerX);
  const cy = Math.floor(castle.centerY);
  for (let r = 2; r <= 45; r++) {
    let best = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (sim.map.getResource(x, y) !== resource) continue;
        if (resource !== RESOURCE_TYPES.TREE && !sim.map.getDepositAt(x, y)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Prodá suroviny nad potřebnou zásobu. Zásoba kryje cenu další stavby,
 * výcvik i spotřebu jídla, takže prodej stavbu ani armádu nebrzdí.
 * Při hladu prodá bot dřevo i kámen skoro celé, aby mohl koupit jídlo –
 * bez jídla se zastaví veškerá práce včetně stavby sadu.
 */
export function sellSurplus(sim, player) {
  if (!hasMarket(sim, player.id)) return;
  const urgent = urgentBuilding(sim, player);
  const next = urgent || nextOrderType(sim, player);
  const cost = next ? BUILDING_DEFS[next].cost : BUILDING_DEFS.warehouse.cost;
  const hungry = foodLow(player);
  const pressed = hungry || !!urgent;
  const keep = {
    wood: pressed ? (cost.wood || 0) : Math.max(150, (cost.wood || 0) + 40),
    stone: pressed ? (cost.stone || 0) : Math.max(110, (cost.stone || 0) + 30),
    iron: pressed ? 0 : 20,
    food: hungry ? Infinity : Math.max(150, player.population * 4)
  };
  for (const key of Object.keys(keep)) {
    const surplus = Math.floor((player.resources[key] || 0) - keep[key]);
    if (surplus < 5) continue;
    sim.command(player.id, { op: 'sell', resource: key, amount: Math.min(SELL_STEP, surplus) });
  }
}

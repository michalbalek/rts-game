/**
 * Sdílené herní konstanty.
 * Tento modul nesmí používat DOM ani Node API – používá ho klient i server.
 */

export const MAP_SIZE = 200;
export const TICK_RATE = 20; // server simuluje 20 ticků za sekundu
export const ENEMY_BUILD_DISTANCE = 20;
export const MAX_PLAYERS = 4;

export const TILE_TYPES = {
  SAND: 0,
  DUNE: 1,
  CLAY: 2,
  GRASS: 3,
  WATER_DEEP: 4,
  WATER_SHALLOW: 5,
  ROCK: 6
};

export const RESOURCE_TYPES = {
  NONE: 0,
  TREE: 1,
  STONE: 2,
  IRON: 3
};

// Startovní pozice jsou symetrické (otočené o 90°) a dost daleko od sebe.
// Jedná se o levý horní roh 3×3 hradu.
export const START_POSITIONS = [
  { x: 55, y: 55 },
  { x: 142, y: 55 },
  { x: 142, y: 142 },
  { x: 55, y: 142 }
];

export const PLAYER_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b'];
export const PLAYER_COLOR_NAMES = ['Karmínová', 'Modrá', 'Zelená', 'Zlatá'];

export const MAP_PRESETS = {
  desert: {
    key: 'desert',
    name: 'Poušť s řekou',
    biome: 'Poušť',
    size: MAP_SIZE,
    positions: 4,
    desc: 'Řeka protéká mapou od severu k jihu. Uprostřed jsou dva brody, písečné duny a vzácné oázy.'
  },
  oasis: {
    key: 'oasis',
    name: 'Oáza u jezera',
    biome: 'Oáza',
    size: MAP_SIZE,
    positions: 4,
    desc: 'Velké jezero uprostřed mapy, z něj vytéká potok na východ. Jeden brod na severu, hustá vegetace.'
  },
  canyon: {
    key: 'canyon',
    name: 'Skalní rokle',
    biome: 'Skály',
    size: MAP_SIZE,
    positions: 4,
    desc: 'Skalní masivy ohraničují úzkou rokli s potokem. Dva brody mezi skalami, méně stromů, více kamene.'
  }
};

export const CAPITALS = {
  rich: {
    key: 'rich',
    name: 'Bohatý',
    desc: '1000 peněz, 300 dřeva, 200 kamene, 300 jídla',
    resources: { money: 1000, wood: 300, stone: 200, food: 300, iron: 0 }
  },
  medium: {
    key: 'medium',
    name: 'Střední',
    desc: '600 peněz, 200 dřeva, 100 kamene, 200 jídla',
    resources: { money: 600, wood: 200, stone: 100, food: 200, iron: 0 }
  },
  modest: {
    key: 'modest',
    name: 'Skromný',
    desc: '300 peněz, 150 dřeva, 80 kamene, 100 jídla',
    resources: { money: 300, wood: 150, stone: 80, food: 100, iron: 0 }
  }
};

export const MARKET_PRICES = {
  wood: { buy: 10, sell: 6, name: 'Dřevo', icon: '🪵' },
  stone: { buy: 12, sell: 8, name: 'Kámen', icon: '🪨' },
  food: { buy: 8, sell: 5, name: 'Jídlo', icon: '🍎' },
  iron: { buy: 20, sell: 14, name: 'Železo', icon: '⛓️' }
};

export const BOT_DIFFICULTIES = {
  easy: {
    key: 'easy',
    name: 'Snadná',
    gather: 0.7,
    attackAfter: 15 * 60,
    attackArmy: 15,
    desc: 'Sbírá o 30 % pomaleji a zaútočí až po 15 minutách.'
  },
  medium: {
    key: 'medium',
    name: 'Střední',
    gather: 1,
    attackAfter: 0,
    attackArmy: 15,
    desc: 'Hraje bez úprav.'
  },
  hard: {
    key: 'hard',
    name: 'Těžká',
    gather: 1.2,
    attackAfter: 0,
    attackArmy: 10,
    desc: 'Sbírá o 20 % rychleji a zaútočí už při 10 vojácích.'
  }
};

// Pořadí staveb bota podle dokumentace.
export const BOT_BUILD_ORDER = [
  'lumberjack', 'quarry', 'dwelling', 'orchard', 'barracks',
  'warehouse', 'granary', 'ironmine', 'market'
];

// Kapacity: hrad slouží jako první sklad i sýpka.
export const STORAGE = {
  baseResource: 500,
  warehouse: 500,
  baseFood: 300,
  granary: 300
};

export const DEPOSITS = {
  stone: { amount: 2000, resource: RESOURCE_TYPES.STONE, respawn: 180 },
  iron: { amount: 1000, resource: RESOURCE_TYPES.IRON, respawn: 180 },
  minCastleDistance: 20
};

export const FOG_RANGES = {
  unit: 6,
  building: 4,
  tower: 10
};

export const WORK = {
  carry: 10,
  gatherTime: 20,       // sekund sběru na jeden náklad
  foodPerWorkerMinute: 2,
  foodPerSoldierMinute: 1,
  roamRadius: 3,        // okruh pohybu při sběru mimo těžbu dřeva
  roamPause: [1, 3]     // pauza mezi jednotlivými toulkami v sekundách [min, max]
};

// Jídlo jde do nejbližší sýpky (bez sýpky do hradu), ostatní do nejbližšího skladu nebo hradu.
export const DELIVERY = {
  food: ['granary'],
  wood: ['castle', 'warehouse'],
  stone: ['castle', 'warehouse'],
  iron: ['castle', 'warehouse']
};

export const BUILD = {
  extraBuilderSpeed: 0.5, // každý další stavitel přidá jen 50 % základní rychlosti
  reach: 1.2,             // stavitel dojde k obrysu budovy do této vzdálenosti
  leaveReach: 1.8         // a odejde až za ni (hystereze, aby neposkakoval)
};

// Násobek rychlosti stavby: 1 stavitel = 1×, 2 = 1,5×, 3 = 2×, 4 = 2,5× …
export function buildSpeedFactor(builders) {
  if (builders <= 0) return 0;
  return 1 + BUILD.extraBuilderSpeed * (builders - 1);
}

export const UNIT_DEFS = {
  swordsman: {
    key: 'swordsman',
    name: 'Pěšák',
    icon: '⚔️',
    kind: 'military',
    hp: 100,
    damage: 10,
    range: 1,
    speed: 1,
    armor: 2,
    cooldown: 1.2,
    aggro: 6,
    cost: { money: 60, food: 20, wood: 0, stone: 0, iron: 0 },
    trainTime: 40,
    voice: 'Meče jsou připraveny k boji, pane!',
    desc: 'Těžký pěšák se štítem a mečem. Vyrábí se v Královském hradu.'
  },
  archer: {
    key: 'archer',
    name: 'Lučištník',
    icon: '🏹',
    kind: 'military',
    hp: 60,
    damage: 8,
    range: 6,
    speed: 1,
    armor: 0,
    cooldown: 2,
    aggro: 8,
    projectile: true,
    cost: { money: 70, food: 20, wood: 0, stone: 0, iron: 0 },
    trainTime: 45,
    voice: 'Lukostřelci čekají na vaše rozkazy!',
    desc: 'Střelec s dlouhým tisovým lukem. Šíp letí obloukem a může minout pohybující se cíl.'
  },
  villager: {
    key: 'villager',
    name: 'Poddaný',
    icon: '👤',
    kind: 'villager',
    hp: 50,
    damage: 0,
    range: 0,
    speed: 1.4,
    armor: 0,
    cooldown: 0,
    aggro: 0,
    cost: {},
    trainTime: 0,
    voice: 'K vašim službám, můj pane!',
    desc: 'Poddaný pracuje v hospodářských budovách. Při napadení uteče do hradu.'
  }
};

const emptyCost = { money: 0, wood: 0, stone: 0, food: 0, iron: 0 };
const cost = (money, wood, stone, food = 0, iron = 0) => ({ ...emptyCost, money, wood, stone, food, iron });

export const BUILDING_DEFS = {
  castle: {
    key: 'castle',
    name: 'Královský hrad',
    icon: '🏰',
    w: 3, h: 3,
    hp: 2000,
    buildTime: 0,
    cost: { ...emptyCost },
    workers: 0,
    desc: 'Sídlo lorda a centrální správa. Před branou plane táborové ohniště. Vycvičí pěšáky.',
    trains: ['swordsman'],
    storage: true
  },
  barracks: {
    key: 'barracks',
    name: 'Kasárna',
    icon: '🏹',
    w: 2, h: 2,
    hp: 800,
    buildTime: 60,
    cost: cost(150, 100, 50),
    workers: 0,
    desc: 'Vojenská pískovcová budova s cvičnými terči. Vycvičí lučištníky.',
    trains: ['archer']
  },
  lumberjack: {
    key: 'lumberjack',
    name: 'Dřevorubec',
    icon: '🪓',
    w: 1, h: 1,
    hp: 500,
    buildTime: 30,
    cost: cost(50, 20, 0),
    workers: 4,
    produce: 'wood',
    desc: 'Dřevorubecký tábor. Staví se na volném místě, nejlépe poblíž stromů. Dělníci nosí dřevo do nejbližšího skladu nebo hradu.'
  },
  quarry: {
    key: 'quarry',
    name: 'Kamenolom',
    icon: '⛏️',
    w: 3, h: 3,
    hp: 1200,
    buildTime: 90,
    cost: cost(100, 50, 0),
    workers: 4,
    produce: 'stone',
    requires: 'stone',
    desc: 'Pískovcový lom. Musí stát celý na ložisku kamene (2000 jednotek).'
  },
  orchard: {
    key: 'orchard',
    name: 'Jabloňový sad',
    icon: '🍏',
    w: 4, h: 4,
    hp: 1500,
    buildTime: 120,
    cost: cost(120, 60, 0),
    workers: 4,
    produce: 'food',
    passable: true, // po dokončení neblokuje chůzi, dělníci chodí mezi stromy
    desc: 'Zavlažovaný sad v oázové půdě. Dělníci chodí mezi stromy, sbírají jablka a nosí je do sýpky (bez sýpky do hradu). Jablka jsou nevyčerpatelná.'
  },
  market: {
    key: 'market',
    name: 'Obchod',
    icon: '🪙',
    w: 2, h: 2,
    hp: 800,
    buildTime: 60,
    cost: cost(200, 100, 100),
    workers: 0,
    market: true,
    desc: 'Tržnice, kde hráč nakupuje a prodává suroviny za pevné ceny.'
  },
  dwelling: {
    key: 'dwelling',
    name: 'Obydlí',
    icon: '🏠',
    w: 2, h: 2,
    hp: 800,
    buildTime: 60,
    cost: cost(80, 60, 20),
    workers: 0,
    population: 8,
    desc: 'Jednoduchý kamenný dům. Přidá 8 míst v kapacitě panství.'
  },
  granary: {
    key: 'granary',
    name: 'Sýpka',
    icon: '🌾',
    w: 3, h: 3,
    hp: 1200,
    buildTime: 90,
    cost: cost(150, 100, 50),
    workers: 0,
    foodStorage: 300,
    desc: 'Skladuje jídlo z jabloňového sadu. Kapacita 300 jednotek.'
  },
  warehouse: {
    key: 'warehouse',
    name: 'Sklad',
    icon: '📦',
    w: 3, h: 3,
    hp: 1200,
    buildTime: 90,
    cost: cost(150, 120, 60),
    workers: 0,
    storage: 500,
    desc: 'Centrální sklad dřeva, kamene a železa. Kapacita 500 jednotek. Sklady lze stavět přímo vedle sebe.'
  },
  ironmine: {
    key: 'ironmine',
    name: 'Železný důl',
    icon: '⛓️',
    w: 3, h: 3,
    hp: 1200,
    buildTime: 90,
    cost: cost(150, 80, 40),
    workers: 4,
    produce: 'iron',
    requires: 'iron',
    desc: 'Šachta na ložisku železné rudy (1000 jednotek). Dělníci nosí rudu do nejbližšího skladu nebo hradu.'
  }
};

// Pořadí v panelu staveb (hrad se nestaví).
export const BUILD_MENU = [
  'barracks', 'lumberjack', 'quarry', 'orchard', 'market',
  'dwelling', 'granary', 'warehouse', 'ironmine'
];

export const BUILDING_SIZE_HP = { 1: 500, 2: 800, 3: 1200, 4: 1500 };
export const BUILDING_SIZE_TIME = { 1: 30, 2: 60, 3: 90, 4: 120 };

export const GAME_MODES = {
  bots: 'bots',
  sandbox: 'sandbox',
  multiplayer: 'multiplayer'
};

export const MILITARY_TYPES = ['swordsman', 'archer'];
export const RESOURCE_KEYS = ['money', 'wood', 'stone', 'food', 'iron'];

export function buildingDef(type) {
  return BUILDING_DEFS[type] || null;
}

export function unitDef(type) {
  return UNIT_DEFS[type] || null;
}

export function formatCost(costObj) {
  if (!costObj) return '';
  const parts = [];
  if (costObj.money) parts.push(`🪙 ${costObj.money}`);
  if (costObj.wood) parts.push(`🪵 ${costObj.wood}`);
  if (costObj.stone) parts.push(`🪨 ${costObj.stone}`);
  if (costObj.food) parts.push(`🍎 ${costObj.food}`);
  if (costObj.iron) parts.push(`⛓️ ${costObj.iron}`);
  return parts.join(' · ') || 'zdarma';
}

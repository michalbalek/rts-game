/**
 * Definice budov a jejich rozměrů na herní mřížce
 */

export const BUILDING_TYPES = {
  CASTLE: 'castle',
  BARRACKS: 'barracks',
  LUMBERJACK: 'lumberjack',
  QUARRY: 'quarry',
  ORCHARD: 'orchard'
};

export const BUILDING_CONFIG = {
  [BUILDING_TYPES.CASTLE]: {
    name: 'Královský Donjon (Hrad)',
    icon: '🏰',
    width: 3,
    height: 3,
    description: 'Pevnost lorda. Před branou plane táborové ohniště, kde usedají volní poddaní (1 každých 5s, max 20). Umožňuje výcvik pěšáků.',
    cost: { wood: 0, stone: 0, food: 0 },
    maxWorkers: 0,
    canProduceUnits: true,
    producedUnit: 'swordsman'
  },
  [BUILDING_TYPES.BARRACKS]: {
    name: 'Kasárna',
    icon: '🏹',
    width: 2,
    height: 2,
    description: 'Vojenská pískovcová budova se zbrojnicí a terči pro výcvik lučištníků.',
    cost: { wood: 60, stone: 40, food: 0 },
    maxWorkers: 0,
    canProduceUnits: true,
    producedUnit: 'archer'
  },
  [BUILDING_TYPES.LUMBERJACK]: {
    name: 'Dřevorubecký tábor',
    icon: '🪓',
    width: 2,
    height: 2,
    description: 'Tábor dřevorubců kácících palmy a dřevo v úrodných částech oázy.',
    cost: { wood: 35, stone: 15, food: 0 },
    maxWorkers: 4,
    producesResource: 'wood',
    yieldPerWorker: 3
  },
  [BUILDING_TYPES.QUARRY]: {
    name: 'Pískovcový kamenolom',
    icon: '⛏️',
    width: 2,
    height: 2,
    description: 'Hluboký lom na těžbu pískovcových a vápencových kvádrů s jeřábem.',
    cost: { wood: 50, stone: 25, food: 0 },
    maxWorkers: 4,
    producesResource: 'stone',
    yieldPerWorker: 3
  },
  [BUILDING_TYPES.ORCHARD]: {
    name: 'Jabloňový sad',
    icon: '🍏',
    width: 2,
    height: 2,
    description: 'Zavlažovaný sad v úrodné půdě oázy. Dělníci sklízejí jablka do sýpky a zajišťují tak spokojenost lidu.',
    cost: { wood: 40, stone: 10, food: 0 },
    maxWorkers: 4,
    producesResource: 'food',
    yieldPerWorker: 4
  }
};

export class Building {
  constructor(id, type, tileX, tileY) {
    this.id = id;
    this.type = type;
    this.tileX = tileX;
    this.tileY = tileY;
    this.config = BUILDING_CONFIG[type];
    this.assignedWorkers = 0;
    this.productionTimer = 0;
    this.health = 600;
    this.maxHealth = 600;
  }

  get width() {
    return this.config.width;
  }

  get height() {
    return this.config.height;
  }

  assignWorker() {
    if (this.config.maxWorkers && this.assignedWorkers < this.config.maxWorkers) {
      this.assignedWorkers++;
      return true;
    }
    return false;
  }

  unassignWorker() {
    if (this.assignedWorkers > 0) {
      this.assignedWorkers--;
      return true;
    }
    return false;
  }
}

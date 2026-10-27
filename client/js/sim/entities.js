import { BUILDING_DEFS, UNIT_DEFS } from './constants.js';
import { localizedError } from './messages.js';
import { rotatedBuildingSize, isBuildingRotation } from './building-orientation.js';

export function unitActivity(unit) {
  if (unit.fleeing || unit.workPaused) return 'idle';
  if (unit.type !== 'villager') return unit.cooldown > 0 ? 'attack' : 'idle';
  if (typeof unit.work === 'boolean') return unit.activity || 'idle';
  if (unit.build?.arrived || unit.repairBuildingId) return 'build';
  if (unit.work?.phase === 'gather' || unit.work?.phase === 'pick') {
    return unit.work.produce === 'food' ? 'harvest' : 'work';
  }
  return 'idle';
}

export class Building {
  constructor(id, type, ownerId, tileX, tileY, complete = true, rotation = 0) {
    const def = BUILDING_DEFS[type];
    if (!def) throw localizedError('Neznámá budova: {0}', { 0: type });
    this.id = id;
    this.type = type;
    this.ownerId = ownerId;
    this.tileX = tileX;
    this.tileY = tileY;
    if (!isBuildingRotation(rotation)) throw new RangeError('Neplatná rotace budovy.');
    this.rotation = rotation;
    const size = rotatedBuildingSize(def, rotation);
    this.width = size.width;
    this.height = size.height;
    this.maxHp = def.hp;
    this.complete = complete;
    this.progress = complete ? 1 : 0;
    this.hp = complete ? def.hp : Math.max(1, Math.round(def.hp * 0.05));
    this.workers = 0;
    this.produceTimer = 0;
    this.queue = [];
    this.repair = null;      // { workerId }
    this.depositId = null;
    this.assignedWorkerIds = []; // pro rychlé uvolnění
    if (def.gate) {
      this.gateDesiredOpen = true;
      this.gateOpen = complete;
    }
  }

  get config() {
    return BUILDING_DEFS[this.type];
  }

  get centerX() {
    return this.tileX + this.width / 2;
  }

  get centerY() {
    return this.tileY + this.height / 2;
  }

  containsTile(x, y) {
    return x >= this.tileX && x < this.tileX + this.width &&
           y >= this.tileY && y < this.tileY + this.height;
  }
}

export class Unit {
  constructor(id, type, ownerId, x, y) {
    const def = UNIT_DEFS[type];
    if (!def) throw localizedError('Neznámá jednotka: {0}', { 0: type });
    this.id = id;
    this.type = type;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.speed = def.speed;
    this.cooldown = 0;
    this.path = [];
    this.pathIndex = 0;
    this.targetX = x;
    this.targetY = y;
    this.moveTarget = null;
    this.pathGoal = null;
    this.attackTargetId = null;
    this.autoAttack = true;
    this.work = null;           // { buildingId, phase, carry, timer, source }
    this.repairBuildingId = null;
    this.build = null;          // { buildingId, arrived } – stavba, kterou dělník staví
    this.garrison = null;
    this.fleeing = false;
    this.aggroTimer = Math.random() * 0.4;
    this.repathTimer = 0;
    this.angle = 0;
    this.lastDamageTime = -999;
    this.workPaused = false;
    this.stuckTimer = 0;
  }

  get config() {
    return UNIT_DEFS[this.type];
  }

  get isMilitary() {
    return this.config.kind === 'military';
  }

  get isVillager() {
    return this.config.kind === 'villager';
  }

  setPath(path) {
    this.path = path || [];
    this.pathIndex = 0;
  }

  clearOrders() {
    this.path = [];
    this.pathIndex = 0;
    this.moveTarget = null;
    this.pathGoal = null;
    this.attackTargetId = null;
    this.autoAttack = true;
  }
}

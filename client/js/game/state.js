import { CASTLE_START_X, CASTLE_START_Y, RESOURCE_TYPES } from '../engine/map.js';
import { isWithinBuildRadius, getDistance } from '../engine/isometric.js';
import { BUILDING_TYPES, BUILDING_CONFIG, Building } from './buildings.js';
import { UNIT_TYPES, UNIT_CONFIG, Unit } from './units.js';
import { sound } from '../engine/audio.js';

export class GameState {
  constructor(map) {
    this.map = map;

    // Suroviny panství křižáků
    this.resources = {
      wood: 180,
      stone: 120,
      food: 120
    };

    // Systém poddaných a táborového ohniště podle game.md
    this.unemployedCitizens = 5;
    this.maxUnemployedCitizens = 20;
    this.citizenSpawnInterval = 5.0; // 5 sekund
    this.citizenTimer = this.citizenSpawnInterval;

    // Spokojenost lidu
    this.popularity = 100;

    // Budovy a jednotky
    this.buildings = [];
    this.units = [];
    this.floatingTexts = [];

    // Výběr a režim stavby
    this.selectedEntity = null;
    this.buildMode = null;
    this.hoverTile = { x: CASTLE_START_X, y: CASTLE_START_Y };

    this.productionInterval = 3.0; // cyklus produkce surovin
    this.productionTimer = this.productionInterval;

    this.nextEntityId = 1;

    this.init();
  }

  init() {
    // 1. Křižácký Donjon uprostřed oázy (125, 125)
    const castle = new Building(
      this.nextEntityId++,
      BUILDING_TYPES.CASTLE,
      CASTLE_START_X,
      CASTLE_START_Y
    );
    this.buildings.push(castle);
    this.selectedEntity = { type: 'building', entity: castle };

    // Výchozí křižácká hlídka před hradem
    const knight1 = new Unit(this.nextEntityId++, UNIT_TYPES.SWORDSMAN, CASTLE_START_X + 3.8, CASTLE_START_Y + 1.2);
    const knight2 = new Unit(this.nextEntityId++, UNIT_TYPES.SWORDSMAN, CASTLE_START_X + 3.8, CASTLE_START_Y + 2.5);
    const archer1 = new Unit(this.nextEntityId++, UNIT_TYPES.ARCHER, CASTLE_START_X + 1.2, CASTLE_START_Y + 4.2);
    this.units.push(knight1, knight2, archer1);
  }

  get castle() {
    return this.buildings.find(b => b.type === BUILDING_TYPES.CASTLE);
  }

  get totalArmy() {
    return this.units.filter(u => u.type === UNIT_TYPES.SWORDSMAN || u.type === UNIT_TYPES.ARCHER).length;
  }

  update(dt, onCitizenSpawned, onGathered) {
    // 1. Zrození nového poddaného k ohništi hradu (5 sekund -> 1 člověk, max 20)
    if (this.unemployedCitizens < this.maxUnemployedCitizens) {
      this.citizenTimer -= dt;
      if (this.citizenTimer <= 0) {
        this.unemployedCitizens++;
        this.citizenTimer = this.citizenSpawnInterval;
        sound.playSpawn();
        if (onCitizenSpawned) {
          onCitizenSpawned(this.unemployedCitizens);
        }
        if (this.castle) {
          this.addFloatingText(this.castle.tileX + 2.5, this.castle.tileY + 2.5, '+1 👥 Poddaný k ohništi', '#fde047');
        }
      }
    } else {
      this.citizenTimer = this.citizenSpawnInterval;
    }

    // 2. Cyklus produkce surovin dělníků v budovách
    this.productionTimer -= dt;
    if (this.productionTimer <= 0) {
      this.productionTimer = this.productionInterval;
      this.handleProduction(onGathered);
    }

    // 3. Aktualizace jednotek
    for (const unit of this.units) {
      unit.update(dt);
    }

    // 4. Plovoucí nápisy
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 0.45;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  handleProduction(onGathered) {
    for (const building of this.buildings) {
      if (building.assignedWorkers > 0 && building.config.producesResource) {
        const resType = building.config.producesResource;
        const yieldAmount = building.assignedWorkers * building.config.yieldPerWorker;

        this.resources[resType] += yieldAmount;
        sound.playGather(resType);

        let icon = '🌲';
        let color = '#4ade80';
        if (resType === 'stone') { icon = '🪨'; color = '#f5d087'; }
        if (resType === 'food') { icon = '🍎'; color = '#f87171'; }

        this.addFloatingText(
          building.tileX + building.width / 2,
          building.tileY + building.height / 2,
          `+${yieldAmount} ${icon}`,
          color
        );

        if (onGathered) {
          onGathered(resType, yieldAmount);
        }
      }
    }
  }

  addFloatingText(tileX, tileY, text, color = '#f0c05a') {
    this.floatingTexts.push({
      x: tileX,
      y: tileY,
      text,
      color,
      life: 1.6,
      maxLife: 1.6
    });
  }

  canAfford(cost) {
    return (
      (cost.wood || 0) <= this.resources.wood &&
      (cost.stone || 0) <= this.resources.stone &&
      (cost.food || 0) <= this.resources.food &&
      (cost.citizens || 0) <= this.unemployedCitizens
    );
  }

  deductCost(cost) {
    if (cost.wood) this.resources.wood -= cost.wood;
    if (cost.stone) this.resources.stone -= cost.stone;
    if (cost.food) this.resources.food -= cost.food;
    if (cost.citizens) this.unemployedCitizens -= cost.citizens;
  }

  canPlaceBuilding(type, tileX, tileY) {
    const config = BUILDING_CONFIG[type];
    if (!config) return { valid: false, reason: 'Neznámá stavba, sire!' };

    // 1. Rádius 100 bloků od křižáckého hradu
    const castle = this.castle;
    if (castle) {
      const dist = getDistance(tileX, tileY, castle.tileX, castle.tileY);
      if (dist > 100) {
        return { valid: false, reason: `Stavebníci odmítají stavět tak daleko od hradu! (${Math.round(dist)}/100 bloků)`, distance: dist };
      }
    }

    // 2. Hranice mapy
    if (
      tileX < 1 ||
      tileY < 1 ||
      tileX + config.width >= this.map.size - 1 ||
      tileY + config.height >= this.map.size - 1
    ) {
      return { valid: false, reason: 'Sem nelze stavět, můj pane!' };
    }

    // 3. Kolize
    for (const b of this.buildings) {
      if (
        tileX < b.tileX + b.width &&
        tileX + config.width > b.tileX &&
        tileY < b.tileY + b.height &&
        tileY + config.height > b.tileY
      ) {
        return { valid: false, reason: 'Místo je již zabráno jinou stavbou, sire!' };
      }
    }

    // 4. Suroviny
    if (!this.canAfford(config.cost)) {
      return { valid: false, reason: 'Pokladna a sklady nemají dostatek surovin, můj pane!' };
    }

    const dist = castle ? getDistance(tileX, tileY, castle.tileX, castle.tileY) : 0;
    return { valid: true, distance: dist };
  }

  placeBuilding(type, tileX, tileY) {
    const check = this.canPlaceBuilding(type, tileX, tileY);
    if (!check.valid) {
      sound.playError();
      return check;
    }

    const config = BUILDING_CONFIG[type];
    this.deductCost(config.cost);

    for (let dy = 0; dy < config.height; dy++) {
      for (let dx = 0; dx < config.width; dx++) {
        this.map.setResource(tileX + dx, tileY + dy, RESOURCE_TYPES.NONE);
      }
    }

    const newBuilding = new Building(this.nextEntityId++, type, tileX, tileY);
    this.buildings.push(newBuilding);
    this.selectedEntity = { type: 'building', entity: newBuilding };

    sound.playBuild();
    this.addFloatingText(tileX + config.width / 2, tileY + config.height / 2, `Vystavěno: ${config.name}!`, '#22c55e');

    return { valid: true, building: newBuilding };
  }

  assignWorkerToBuilding(building) {
    if (this.unemployedCitizens <= 0) {
      sound.playError();
      return { success: false, reason: 'U ohniště nesedí žádní volní poddaní, sire!' };
    }

    if (building.assignWorker()) {
      this.unemployedCitizens--;
      sound.playClick();
      return { success: true };
    }

    sound.playError();
    return { success: false, reason: 'Kapacita pracoviště je již zcela naplněna!' };
  }

  unassignWorkerFromBuilding(building) {
    if (building.unassignWorker()) {
      if (this.unemployedCitizens < this.maxUnemployedCitizens) {
        this.unemployedCitizens++;
      }
      sound.playClick();
      return { success: true };
    }

    return { success: false };
  }

  trainUnit(unitType) {
    const config = UNIT_CONFIG[unitType];
    if (!config) return { success: false, reason: 'Neznámá křižácká jednotka' };

    if (!this.canAfford(config.cost)) {
      sound.playError();
      return { success: false, reason: 'Nedostatek zásob jídla, dřeva či rekrutů u ohniště!' };
    }

    let spawnBuilding = null;
    if (unitType === UNIT_TYPES.SWORDSMAN) {
      spawnBuilding = this.castle;
    } else if (unitType === UNIT_TYPES.ARCHER) {
      spawnBuilding = this.buildings.find(b => b.type === BUILDING_TYPES.BARRACKS) || this.castle;
    }

    if (!spawnBuilding) {
      sound.playError();
      return { success: false, reason: 'Nejprve musíte postavit křižácká kasárna, sire!' };
    }

    this.deductCost(config.cost);

    const spawnX = spawnBuilding.tileX + spawnBuilding.width + 0.6;
    const spawnY = spawnBuilding.tileY + 1.2;

    const unit = new Unit(this.nextEntityId++, unitType, spawnX, spawnY);
    this.units.push(unit);

    sound.playRecruit();
    this.addFloatingText(spawnX, spawnY, `${config.name} připraven!`, '#f59e0b');

    return { success: true, unit };
  }

  findEntityAtTile(tileX, tileY) {
    for (const unit of this.units) {
      if (Math.hypot(unit.x - (tileX + 0.5), unit.y - (tileY + 0.5)) < 0.8) {
        return { type: 'unit', entity: unit };
      }
    }

    for (const b of this.buildings) {
      if (
        tileX >= b.tileX &&
        tileX < b.tileX + b.width &&
        tileY >= b.tileY &&
        tileY < b.tileY + b.height
      ) {
        return { type: 'building', entity: b };
      }
    }

    return null;
  }
}

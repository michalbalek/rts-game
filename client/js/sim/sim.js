import { PLAYER_COLORS, PLAYER_COLOR_NAMES, CAPITALS, BOT_DIFFICULTIES, GAME_MODES } from './constants.js';
import { GameMap } from './mapgen.js';
import { createRng, randomSeed } from './rng.js';
import { updateBot } from './bot.js';
import { SimulationUnits } from './sim-units.js';
import { SimulationEconomy } from './sim-economy.js';
import { SimulationVisibility } from './sim-visibility.js';
import { SimulationBuildings } from './sim-buildings.js';
import { SimulationBuilders } from './sim-builders.js';
import { SimulationWorkers } from './sim-workers.js';
import { SimulationWorkCycle } from './sim-work-cycle.js';
import { SimulationGathering } from './sim-gathering.js';
import { SimulationNavigation } from './sim-navigation.js';
import { SimulationCombat } from './sim-combat.js';
import { SimulationLifecycle } from './sim-lifecycle.js';
import { SimulationCommands } from './sim-commands.js';
import { SimulationSave } from './sim-save.js';

export { distanceToBuilding, isEnemy } from './sim-geometry.js';

/**
 * Autoritativní herní simulace. Používá ji klient pro singleplayer
 * a server pro multiplayer – pravidla jsou tak identická.
 */
export class GameSim {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? randomSeed()) >>> 0;
    this.mapType = opts.mapType || 'desert';
    this.mode = opts.mode || GAME_MODES.bots;
    this.rng = createRng((this.seed ^ 0x9e3779b9) >>> 0);
    this.map = opts.map || new GameMap(this.seed, this.mapType);
    this.fogEnabled = !!opts.fog && this.mode === GAME_MODES.multiplayer
      ? true
      : !!opts.fog;

    this.nextId = 1;
    this.time = 0;
    this.tickCount = 0;
    this.ended = false;
    this.winnerId = null;
    this.endTime = 0;

    this.buildings = [];
    this.units = [];
    this.projectiles = [];
    this.effects = [];
    this.players = [];
    this.playerById = new Map();

    this.events = [];
    this.eventSeq = 0;

    this.mapChanges = [];
    this.mapChangeSeq = 0;

    this.blockGrid = new Uint8Array(this.map.size * this.map.size);
    this.regionGrid = new Int32Array(this.map.size * this.map.size);
    this.regionsDirty = true;

    this.fogData = new Map();
    this.fogTimer = 0;
    this.botTimer = 1;
    this.pendingDeposits = [];
    this.slowTimer = 0;
    this.foodWarnTimer = 0;

    this.map.onChange = (idx, res) => {
      this.regionsDirty = true;
      this.mapChanges.push({ seq: ++this.mapChangeSeq, i: idx, r: res });
      if (this.mapChanges.length > 6000) this.mapChanges.splice(0, 1000);
    };

    const capital = CAPITALS[opts.capital] || CAPITALS.medium;
    const rawPlayers = (opts.players && opts.players.length)
      ? opts.players
      : [{ name: 'Království', isBot: false }];

    rawPlayers.slice(0, 4).forEach((p, i) => {
      const id = i + 1;
      const player = {
        id,
        name: p.name || `Hráč ${id}`,
        color: p.color || PLAYER_COLORS[i],
        colorName: PLAYER_COLOR_NAMES[i],
        isBot: !!p.isBot,
        difficulty: p.difficulty || 'medium',
        alive: true,
        resources: { ...capital.resources },
        population: 0,
        capacity: 20,
        spawnTimer: 5,
        foodShortage: false,
        foodDebt: 0,
        stats: { destroyed: 0, trained: 0, gathered: 0, lost: 0, damage: 0 },
        bot: { nextBuild: 0, attackTimer: 0, armyTarget: 8, lastAttack: -999, guardSet: false }
      };
      this.players.push(player);
      this.playerById.set(id, player);
      this.fogData.set(id, {
        explored: new Uint8Array(this.map.size * this.map.size),
        visible: new Uint8Array(this.map.size * this.map.size)
      });
    });

    this.humanId = (this.players.find(p => !p.isBot) || this.players[0]).id;
    this.capitalKey = capital.key;
    for (const p of this.players) {
      p.gatherMultiplier = p.isBot
        ? (BOT_DIFFICULTIES[p.difficulty] || BOT_DIFFICULTIES.medium).gather
        : 1;
    }

    this.createStartingPositions();
    this.updateAllCapacities();
    this.rebuildBlockGrid();
    if (this.fogEnabled) this.recomputeFog();
    else this.markAllVisible();
  }

  static fromSaveState(saved) {
    const state = saved && saved.sim ? saved.sim : saved;
    if (!state || !Array.isArray(state.players) || !state.map) {
      throw new Error('Uložená hra je poškozená.');
    }
    const map = GameMap.fromSaveState(state.map);
    const sim = new GameSim({
      seed: state.seed,
      mapType: state.mapType,
      mode: state.mode,
      capital: state.capitalKey,
      fog: !!state.fogEnabled,
      map,
      players: state.players
    });
    sim.restoreSaveState(state);
    return sim;
  }

  tick(dt = 1 / 20) {
    if (this.ended) return;
    this.time += dt;
    this.tickCount++;

    this.updateBuildings(dt);
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.updateEconomy(dt);
    this.updateDeposits(dt);

    // Efekty (zásahy, šípy).
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }

    this.map.update(dt, this.blockGrid);

    if (this.fogEnabled) {
      this.fogTimer -= dt;
      if (this.fogTimer <= 0) {
        this.fogTimer = 0.5;
        this.recomputeFog();
      }
    }

    this.botTimer -= dt;
    if (this.botTimer <= 0) {
      this.botTimer = 1;
      for (const p of this.players) {
        if (p.isBot && p.alive) {
          try {
            updateBot(this, p, 1);
          } catch (err) {
            console.error('Chyba bota', err);
          }
        }
      }
    }

    this.checkVictory();
  }

  emit(type, data = {}) {
    const ev = { seq: ++this.eventSeq, type, ...data };
    this.events.push(ev);
    if (this.events.length > 400) this.events.splice(0, 100);
    return ev;
  }
}

// Compose domain methods without changing their class-method descriptors or the public prototype.
for (const domain of [
  SimulationUnits,
  SimulationEconomy,
  SimulationVisibility,
  SimulationBuildings,
  SimulationBuilders,
  SimulationWorkers,
  SimulationWorkCycle,
  SimulationGathering,
  SimulationNavigation,
  SimulationCombat,
  SimulationLifecycle,
  SimulationCommands,
  SimulationSave
]) {
  const descriptors = Object.getOwnPropertyDescriptors(domain.prototype);
  delete descriptors.constructor;
  Object.defineProperties(GameSim.prototype, descriptors);
}

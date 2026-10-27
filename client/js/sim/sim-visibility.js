import { FOG_RANGES } from './constants.js';
import { unitActivity } from './entities.js';

export class SimulationVisibility {
  markAllVisible() {
    for (const data of this.fogData.values()) {
      data.explored.fill(1);
      data.visible.fill(1);
    }
  }

  recomputeFog() {
    if (!this.fogEnabled) return;
    const size = this.map.size;
    for (const player of this.players) {
      if (!player.alive) continue;
      const data = this.fogData.get(player.id);
      if (!data) continue;
      data.visible.fill(0);
      const reveal = (cx, cy, radius) => {
        const r = Math.ceil(radius);
        const r2 = radius * radius;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = Math.floor(cx) + dx;
            const y = Math.floor(cy) + dy;
            if (x < 0 || y < 0 || x >= size || y >= size) continue;
            const i = y * size + x;
            data.visible[i] = 1;
            data.explored[i] = 1;
          }
        }
      };
      for (const u of this.units) {
        if (u.ownerId === player.id) reveal(u.x, u.y, FOG_RANGES.unit);
      }
      for (const b of this.buildings) {
        if (b.ownerId === player.id) {
          const range = b.type === 'castle' ? FOG_RANGES.building + 2 : FOG_RANGES.building;
          reveal(b.centerX, b.centerY, range + Math.max(b.width, b.height) * 0.5);
        }
      }
    }
  }

  isVisible(playerId, x, y) {
    if (!this.fogEnabled) return true;
    const data = this.fogData.get(playerId);
    if (!data) return false;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.map.size || iy >= this.map.size) return false;
    return data.visible[iy * this.map.size + ix] === 1;
  }

  isExplored(playerId, x, y) {
    if (!this.fogEnabled) return true;
    const data = this.fogData.get(playerId);
    if (!data) return false;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.map.size || iy >= this.map.size) return false;
    return data.explored[iy * this.map.size + ix] === 1;
  }

  serialize(playerId) {
    const viewer = this.getPlayer(playerId) || this.players[0];
    const fog = this.fogEnabled;
    const vis = (x, y) => !fog || this.isVisible(playerId, x, y);

    const builderCounts = this.getBuilderCounts();
    const buildings = [];
    for (const b of this.buildings) {
      if (fog && b.ownerId !== playerId && !vis(b.centerX, b.centerY)) continue;
      buildings.push({
        id: b.id,
        type: b.type,
        ownerId: b.ownerId,
        tileX: b.tileX,
        tileY: b.tileY,
        rotation: b.rotation,
        hp: Math.round(b.hp),
        maxHp: b.maxHp,
        progress: b.progress,
        complete: b.complete,
        gateOpen: b.gateOpen,
        gateDesiredOpen: b.gateDesiredOpen,
        workers: b.workers,
        builders: builderCounts.get(b.id) || { active: 0, total: 0 },
        depositId: b.depositId,
        repair: !!b.repair,
        queue: b.queue.map(q => ({
          unitType: q.unitType,
          remaining: Math.round(q.remaining * 10) / 10,
          total: q.total
        }))
      });
    }

    const units = [];
    for (const u of this.units) {
      if (fog && u.ownerId !== playerId && !vis(u.x, u.y)) continue;
      units.push({
        id: u.id,
        type: u.type,
        ownerId: u.ownerId,
        x: Math.round(u.x * 100) / 100,
        y: Math.round(u.y * 100) / 100,
        hp: Math.round(u.hp),
        maxHp: u.maxHp,
        work: !!u.work,
        build: !!u.build,
        garrison: u.garrison ? { ...u.garrison } : null,
        carry: u.work ? u.work.carry : 0,
        carryResource: u.work ? u.work.produce : null,
        angle: u.angle,
        activity: unitActivity(u),
        cooldown: Math.round(u.cooldown * 100) / 100,
        workPaused: u.workPaused,
        fleeing: u.fleeing,
        moving: u.pathIndex < u.path.length
      });
    }

    const projectiles = [];
    for (const a of this.projectiles) {
      if (fog && a.ownerId !== playerId && !vis(a.x, a.y)) continue;
      projectiles.push({
        id: a.id,
        x: Math.round(a.x * 100) / 100,
        y: Math.round(a.y * 100) / 100,
        arc: Math.round(a.arc || 0),
        tx: a.tx,
        ty: a.ty
      });
    }

    return {
      time: Math.round(this.time * 10) / 10,
      tick: this.tickCount,
      ended: this.ended,
      winnerId: this.winnerId,
      fog: this.fogEnabled,
      mode: this.mode,
      capital: this.capitalKey,
      seed: this.seed,
      mapType: this.mapType,
      selfId: viewer.id,
      self: {
        resources: {
          money: Math.floor(viewer.resources.money),
          wood: Math.floor(viewer.resources.wood),
          stone: Math.floor(viewer.resources.stone),
          food: Math.floor(viewer.resources.food),
          iron: Math.floor(viewer.resources.iron)
        },
        population: viewer.population,
        capacity: viewer.capacity,
        foodShortage: viewer.foodShortage,
        stats: { ...viewer.stats }
      },
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        colorName: p.colorName,
        isBot: p.isBot,
        alive: p.alive,
        population: p.population,
        capacity: p.capacity,
        stats: { ...p.stats }
      })),
      buildings,
      units,
      projectiles,
      deposits: this.map.deposits.map(d => ({
        id: d.id,
        type: d.type,
        amount: Math.round(d.amount),
        maxAmount: d.maxAmount,
        active: d.active,
        tiles: d.tiles
      })),
      mapChangesSince: this.mapChangeSeq
    };
  }

  getMapChangesSince(seq) {
    const changes = this.mapChanges.filter(c => c.seq > seq);
    return { changes, seq: this.mapChangeSeq };
  }
}

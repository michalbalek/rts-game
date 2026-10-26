import { dist, distanceToBuilding, isEnemy } from './sim-geometry.js';

export class SimulationCombat {
  nearestEnemy(unit, radius) {
    let best = null;
    let bestD = Infinity;
    for (const other of this.units) {
      if (!isEnemy(unit.ownerId, other.ownerId)) continue;
      const owner = this.getPlayer(other.ownerId);
      if (!owner || !owner.alive) continue;
      const d = dist(unit.x, unit.y, other.x, other.y);
      if (d < bestD && d <= radius) {
        bestD = d;
        best = other;
      }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (!isEnemy(unit.ownerId, b.ownerId)) continue;
      const d = distanceToBuilding(unit.x, unit.y, b);
      if (d < bestD && d <= radius) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  targetDistance(unit, target) {
    if (!target) return Infinity;
    if (target.width !== undefined) return distanceToBuilding(unit.x, unit.y, target);
    return dist(unit.x, unit.y, target.x, target.y);
  }

  attackTarget(unit, target) {
    if (unit.cooldown > 0) return;
    const def = unit.config;
    unit.cooldown = def.cooldown;
    const player = this.getPlayer(unit.ownerId);
    if (def.projectile) {
      const tx = target.width !== undefined ? target.centerX : target.x;
      const ty = target.width !== undefined ? target.centerY : target.y;
      const d = dist(unit.x, unit.y, tx, ty);
      this.projectiles.push({
        id: this.nextId++,
        ownerId: unit.ownerId,
        sx: unit.x,
        sy: unit.y,
        tx,
        ty,
        x: unit.x,
        y: unit.y,
        t: 0,
        duration: Math.max(0.18, d / 14),
        damage: def.damage,
        targetId: target.id,
        targetIsBuilding: target.width !== undefined,
        missed: false
      });
      this.emit('arrow', { x: unit.x, y: unit.y });
    } else {
      this.dealDamage(target, def.damage, unit.ownerId);
      this.emit('hit', { x: target.x !== undefined ? target.x : target.centerX, y: target.y !== undefined ? target.y : target.centerY });
    }
  }

  dealDamage(target, amount, attackerOwnerId) {
    if (!target) return;
    const attacker = this.getPlayer(attackerOwnerId);
    if (target.width !== undefined) {
      // Budova – obrana 0, poškození přímo.
      target.hp -= amount;
      if (attacker) attacker.stats.damage += amount;
      if (target.hp <= 0) this.removeBuilding(target, { destroyed: true, byPlayerId: attackerOwnerId });
    } else {
      const defense = target.config.armor || 0;
      const dmg = Math.max(1, amount - defense);
      target.hp -= dmg;
      if (attacker) attacker.stats.damage += dmg;
      target.lastDamageTime = this.time;
      if (target.isVillager) {
        target.fleeing = true;
        target.workPaused = true;
      } else if (!target.attackTargetId && target.autoAttack) {
        target.attackTargetId = this.findAttackerId(target, attackerOwnerId);
      }
      if (target.hp <= 0) {
        this.removeUnit(target, { killed: true, byPlayerId: attackerOwnerId });
      }
    }
  }

  findAttackerId(target, attackerOwnerId) {
    // Vyber nejbližší nepřátelskou jednotku jako odvetu.
    let best = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (u.ownerId !== attackerOwnerId) continue;
      const d = dist(target.x, target.y, u.x, u.y);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best ? best.id : null;
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const a = this.projectiles[i];
      a.t += dt;
      const t = Math.min(1, a.t / a.duration);
      // Lehký oblouk.
      const arc = Math.sin(t * Math.PI) * Math.min(56, dist(a.sx, a.sy, a.tx, a.ty) * 8);
      a.x = a.sx + (a.tx - a.sx) * t;
      a.y = a.sy + (a.ty - a.sy) * t;
      a.arc = arc;
      if (t >= 1) {
        let hit = null;
        if (a.targetIsBuilding) {
          const b = this.buildings.find(x => x.id === a.targetId);
          if (b && dist(a.tx, a.ty, b.centerX, b.centerY) < Math.max(b.width, b.height)) hit = b;
        } else {
          const u = this.units.find(x => x.id === a.targetId);
          // Šíp může minout pohybující se cíl.
          if (u && dist(a.tx, a.ty, u.x, u.y) < 0.65) hit = u;
        }
        if (hit) {
          this.dealDamage(hit, a.damage, a.ownerId);
          this.emit('hit', { x: a.tx, y: a.ty, ranged: true });
        } else {
          this.emit('miss', { x: a.tx, y: a.ty });
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateMilitary(unit, dt) {
    const def = unit.config;

    // Cíl souboje
    let target = null;
    if (unit.attackTargetId) {
      target = this.units.find(u => u.id === unit.attackTargetId) ||
               this.buildings.find(b => b.id === unit.attackTargetId) || null;
      if (target) {
        const owner = target.ownerId !== undefined ? this.getPlayer(target.ownerId) : null;
        if (target.hp <= 0 || (target.ownerId !== undefined && !isEnemy(unit.ownerId, target.ownerId)) ||
            (target.ownerId !== undefined && owner && !owner.alive)) {
          target = null;
          unit.attackTargetId = null;
        }
      } else {
        unit.attackTargetId = null;
      }
    }

    // Ručně zadaný přesun má přednost před automatickým útokem. Bez toho
    // jednotka u nepřítele okamžitě zrušila povel a rozběhla se za ním,
    // takže se hráči zdálo, že vojáci nereagují na kliknutí.
    const moving = !!unit.moveTarget;

    if (!target && !moving && unit.autoAttack && unit.aggroTimer <= 0) {
      unit.aggroTimer = 0.5;
      const found = this.nearestEnemy(unit, def.aggro);
      if (found) {
        target = found;
        unit.attackTargetId = found.id;
      }
    }

    if (target) {
      unit.moveTarget = null;
      const d = this.targetDistance(unit, target);
      const reach = def.range + 0.55;
      if (d <= reach) {
        unit.setPath([]);
        unit.angle = Math.atan2(
          (target.y !== undefined ? target.y : target.centerY) - unit.y,
          (target.x !== undefined ? target.x : target.centerX) - unit.x
        );
        this.attackTarget(unit, target);
      } else {
        if (unit.path.length === 0 || unit.repathTimer <= 0) {
          unit.repathTimer = 1.0;
          if (target.width !== undefined) {
            const approach = this.findBuildingApproach(unit, target);
            if (approach) this.navigateTo(unit, approach.x, approach.y);
          } else {
            this.navigateTo(unit, target.x, target.y);
          }
        }
      }
      return;
    }

    // Běžný přesun – dokud jednotka nedorazí, nevyhledává cíle sama.
    if (moving) {
      if (unit.path.length === 0) {
        unit.moveTarget = null;
        unit.autoAttack = true;
      }
      return;
    }

    // Volná jednotka hlídá okolí.
    if (unit.autoAttack && unit.aggroTimer <= 0) {
      unit.aggroTimer = 0.6;
      const found = this.nearestEnemy(unit, def.aggro);
      if (found) unit.attackTargetId = found.id;
    }
  }
}

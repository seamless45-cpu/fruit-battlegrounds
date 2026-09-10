/**
 * Damage routing, area queries and hit feedback.
 */
import * as THREE from 'three';
import { tmp, clamp } from './utils.js';

export class Combat {
  constructor(world) {
    this.world = world;
    this._q = [];
  }

  get enemies() { return this.world.enemies; }

  /** Enemies inside a sphere. */
  inRadius(pos, radius, { alive = true, limit = 0 } = {}) {
    const out = [];
    const r2 = radius * radius;
    for (const e of this.world.enemies) {
      if (alive && !e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const dy = (e.pos.y + e.height * 0.5) - pos.y;
      if (dx * dx + dz * dz + dy * dy * 0.35 < r2) {
        out.push(e);
        if (limit && out.length >= limit) break;
      }
    }
    return out;
  }

  nearest(pos, maxDist = Infinity, { alive = true } = {}) {
    let best = null, bd = maxDist * maxDist;
    for (const e of this.world.enemies) {
      if (alive && !e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** Enemies inside a horizontal cone (used by pulls / slashes). */
  inCone(origin, dir, range, angleRad) {
    const out = [];
    const dx0 = dir.x, dz0 = dir.z;
    const len = Math.hypot(dx0, dz0) || 1;
    const nx = dx0 / len, nz = dz0 / len;
    const cos = Math.cos(angleRad);
    for (const e of this.world.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      if (d < 0.001 || ((dx / d) * nx + (dz / d) * nz) >= cos) out.push(e);
    }
    return out;
  }

  /**
   * Damage every enemy in a sphere.
   * @param {object} o {pos, radius, amount, pct (of maxHp), source, knockback, from,
   *                    stun, lift, liftHeight, burn, crit, falloff, limit, color, type, blind, slow}
   */
  area(o) {
    const list = this.inRadius(o.pos, o.radius, { limit: o.limit || 0 });
    let hits = 0;
    for (const e of list) {
      let dmg = o.amount || 0;
      if (o.pct) dmg += e.maxHp * o.pct;
      if (o.falloff !== false) {
        const d = Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z);
        const f = clamp(1 - (d / o.radius) * 0.55, 0.35, 1);
        dmg *= f;
      }
      if (o.crit) dmg *= o.crit;
      hits += e.takeDamage(dmg, o) > 0 ? 1 : 0;
    }
    return hits;
  }

  damage(target, amount, opts = {}) {
    if (!target || !target.alive) return 0;
    return target.takeDamage(opts.crit ? amount * opts.crit : amount, opts);
  }

  heal(target, amount, opts = {}) {
    return target?.heal(amount);
  }

  /** Pull enemies toward a point (gravity skills). */
  pull(pos, radius, strength, { duration = 0.5, stopDistance = 2.5, lift = 0 } = {}) {
    const list = this.inRadius(pos, radius);
    for (const e of list) {
      const d = tmp.v1.set(pos.x - e.pos.x, 0, pos.z - e.pos.z);
      const dist = d.length();
      if (dist < stopDistance) continue;
      d.normalize();
      const s = strength * clamp(dist / radius, 0.25, 1.4);
      e.kb.x += d.x * s;
      e.kb.z += d.z * s;
      if (lift) { e.vel.y = Math.max(e.vel.y, lift); e.liftT = Math.max(e.liftT, duration); }
      e.stunT = Math.max(e.stunT, duration * 0.6);
    }
    return list.length;
  }

  /* ------------------------------------------------------------ feedback */
  onHit(entity, amount, opts = {}) {
    if (amount < 1) return;
    const ui = this.world.ui;
    if (ui && !opts.silentNumber) {
      ui.damageNumber(
        tmp.v3.set(entity.pos.x + (Math.random() - 0.5), entity.pos.y + entity.height * 0.95, entity.pos.z + (Math.random() - 0.5)),
        amount,
        { crit: !!opts.crit, color: opts.color, player: entity === this.world.player, heal: false },
      );
    }
  }

  onHeal(entity, amount) {
    const ui = this.world.ui;
    if (ui) {
      ui.damageNumber(
        tmp.v3.set(entity.pos.x, entity.pos.y + entity.height * 1.05, entity.pos.z),
        amount, { heal: true, player: entity === this.world.player },
      );
    }
  }
}

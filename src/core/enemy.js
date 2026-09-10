/**
 * Enemy bots — chase, flank, melee. React to every status effect
 * (stun, blind, lift, petrify, burn, knockback).
 */
import * as THREE from 'three';
import { Entity } from './entity.js';
import { rand, randInt, pick, clamp, damp, tmp } from './utils.js';

const LOOKS = [
  { shirt: 0xdc2626, pants: 0x1f2937, accent: 0xfacc15, skin: 0xe8b98a, hair: 0x1b1b1b, eye: 0xff5a5a },
  { shirt: 0x0ea5e9, pants: 0x0f172a, accent: 0xe2e8f0, skin: 0xd9a066, hair: 0x3b2a1a, eye: 0x7dd3fc },
  { shirt: 0x16a34a, pants: 0x052e16, accent: 0xfde047, skin: 0xf1c27d, hair: 0x241608, eye: 0x86efac },
  { shirt: 0x7c3aed, pants: 0x1e1b4b, accent: 0xc4b5fd, skin: 0xc98d63, hair: 0x111111, eye: 0xc4b5fd },
  { shirt: 0x334155, pants: 0x0b1220, accent: 0x94a3b8, skin: 0xb98355, hair: 0x2a1a10, eye: 0x93c5fd },
];

export class Enemy extends Entity {
  constructor(world, { pos, level = 1 } = {}) {
    super(world, {
      pos, faction: 'enemy', maxHp: 1000 + level * 55, radius: 0.62, height: 2.0,
      speed: rand(7.5, 9.6), showBar: true, look: pick(LOOKS), scale: rand(0.96, 1.08),
    });
    this.level = level;
    this.attackRange = 2.9;
    this.attackCd = 0;
    this.attackWindup = 0;
    this.wanderT = rand(0, 2);
    this.wanderDir = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
    this.attackAnim = { t: 99, dur: 0.45, kind: 'slash' };
    this.damage = 0.012 + Math.min(0.05, level * 0.0006);   // fraction of player maxHp
    this.tokenValue = () => randInt(10, 100);
    this.xpValue = 40 + level * 12;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitT = rand(1, 4);

    // glowing fists so melee reads clearly
    this.rig.parts.eyeMat.color.setHex(pick([0xff5a5a, 0x7dd3fc, 0xfbbf24]));
    this.bar.visible = true;
  }

  update(dt) {
    const stunned = super.update(dt);
    if (!this.alive) return;

    const player = this.world.player;
    const toPlayer = tmp.v1.set(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toPlayer.length();

    // desired horizontal velocity
    let vx = 0, vz = 0;
    if (!stunned && player.alive) {
      if (this.blindT > 0) {
        // blinded: wander randomly, cannot attack
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = rand(0.5, 1.4);
          this.wanderDir.set(rand(-1, 1), 0, rand(-1, 1)).normalize();
        }
        vx = this.wanderDir.x * this.speed * 0.75;
        vz = this.wanderDir.z * this.speed * 0.75;
      } else if (dist > this.attackRange * 0.85) {
        toPlayer.normalize();
        // slight orbit so they don't stack into a single line
        this.orbitT -= dt;
        if (this.orbitT <= 0) { this.orbitT = rand(1.5, 4.5); this.orbitDir *= -1; }
        const ox = -toPlayer.z * this.orbitDir * 0.35, oz = toPlayer.x * this.orbitDir * 0.35;
        const dx = toPlayer.x + ox, dz = toPlayer.z + oz;
        const l = Math.hypot(dx, dz) || 1;
        const sp = this.speed * (this.slowT > 0 ? 0.45 : 1);
        vx = (dx / l) * sp; vz = (dz / l) * sp;
        this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
      } else {
        // in range: attack
        this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
        this.attackCd -= dt;
        if (this.attackCd <= 0 && this.attackWindup <= 0) {
          this.attackWindup = 0.28;
          this.attackCd = rand(1.3, 2.1);
        }
        if (this.attackWindup > 0) {
          this.attackWindup -= dt;
          if (this.attackWindup <= 0) this._strike(player);
        }
      }

      // separation from other enemies
      let sx = 0, sz = 0;
      for (const o of this.world.enemies) {
        if (o === this || !o.alive) continue;
        const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 2.6 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          sx += (dx / d) * (2.6 - d) * 1.4;
          sz += (dz / d) * (2.6 - d) * 1.4;
        }
      }
      vx += sx; vz += sz;
    }

    this.vel.x = damp(this.vel.x, vx, 9, dt);
    this.vel.z = damp(this.vel.z, vz, 9, dt);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.rig.update(dt, {
      speed, t: this.t, grounded: this.grounded,
      attack: this.attackAnim, stunned: this.stunT > 0, lifted: this.liftT > 0,
    });
    if (this.attackAnim.t < this.attackAnim.dur) this.attackAnim.t += dt;

    // burning embers
    if (this.burn && Math.random() < dt * 12) {
      this.world.fx.glow.spawn({
        pos: { x: this.pos.x + rand(-0.4, 0.4), y: 0.5 + rand(0, 1.4), z: this.pos.z + rand(-0.4, 0.4) },
        vel: { x: rand(-0.4, 0.4), y: rand(1, 3), z: rand(-0.4, 0.4) },
        color: 0xff8a3d, size: rand(0.8, 1.8), life: rand(0.3, 0.7), gravity: 1.2, drag: 1,
      });
    }
    // blinded: sparks + question mark vibes
    if (this.blindT > 0 && Math.random() < dt * 8) {
      this.world.fx.glow.spawn({
        pos: { x: this.pos.x + rand(-0.3, 0.3), y: this.height + rand(0, 0.4), z: this.pos.z + rand(-0.3, 0.3) },
        vel: { x: rand(-1, 1), y: rand(0.5, 2), z: rand(-1, 1) },
        color: 0xffffff, size: rand(0.7, 1.5), life: rand(0.2, 0.5), gravity: 2, drag: 1,
      });
    }
  }

  _strike(player) {
    this.attackAnim = { t: 0, dur: 0.42, kind: 'slash' };
    const d = tmp.v1.set(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    if (d.length() < this.attackRange + 1.2 && player.alive && this.blindT <= 0) {
      player.takeDamage(player.maxHp * this.damage, {
        source: this, type: 'melee', knockback: 1.6, from: this.pos, color: 0xff6b7a,
      });
      this.world.fx.impact(
        tmp.v2.set(player.pos.x, player.pos.y + 1.1, player.pos.z),
        { color: 0xff4d5e, radius: 0.9, count: 8 },
      );
      this.world.audio?.play('hit');
    }
  }

  die(opts = {}) {
    if (!this.alive) return;
    super.die(opts);
    // poof
    this.world.fx.deathPoof(this);
    this.bar.visible = false;
    // sink + spin out
    const start = performance.now();
    const mesh = this.mesh;
    const tick = () => {
      const k = (performance.now() - start) / 420;
      if (k >= 1) { this.destroy(); return; }
      mesh.scale.setScalar(1 - k);
      mesh.rotation.y += 0.25;
      mesh.position.y = this.pos.y - k * 0.7;
      requestAnimationFrame(tick);
    };
    tick();
  }
}

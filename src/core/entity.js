/**
 * Base entity: humanoid rig + health + status effects (stun, burn, knockback,
 * lift, blind, petrify) + floating health bar.
 */
import * as THREE from 'three';
import { makeHumanoid } from './character.js';
import { clamp, rand, damp, tmp } from './utils.js';

let NEXT_ID = 1;

const BAR_BG = new THREE.MeshBasicMaterial({ color: 0x0b0f18, transparent: true, opacity: 0.72, depthTest: false });
const BAR_FG = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, depthTest: false });
const BAR_FG_HURT = new THREE.MeshBasicMaterial({ color: 0xff5470, transparent: true, depthTest: false });
const barGeo = new THREE.PlaneGeometry(1, 1);

export class Entity {
  constructor(world, opts = {}) {
    this.id = NEXT_ID++;
    this.world = world;
    this.faction = opts.faction || 'enemy';
    this.pos = new THREE.Vector3().copy(opts.pos || new THREE.Vector3());
    this.vel = new THREE.Vector3();
    this.kb = new THREE.Vector3();
    this.yaw = opts.yaw || 0;
    this.radius = opts.radius !== undefined ? opts.radius : 0.62;
    this.height = opts.height !== undefined ? opts.height : 2.0;
    this.maxHp = opts.maxHp !== undefined ? opts.maxHp : 100;
    this.hp = this.maxHp;
    this.alive = true;
    this.speed = opts.speed !== undefined ? opts.speed : 7;
    this.grounded = true;
    this.t = rand(0, 100);

    // ---- statuses ----
    this.stunT = 0;
    this.rootT = 0;
    this.liftT = 0;
    this.blindT = 0;
    this.rockT = 0;
    this.frozenT = 0;
    this.burn = null;         // { pct, dur, t, tick, acc, source }
    this.slowT = 0;
    this.invulnT = 0;

    // ---- rig ----
    const look = opts.look || {};
    this.rig = makeHumanoid({
      skin: look.skin, shirt: look.shirt, pants: look.pants, accent: look.accent,
      hair: look.hair, eye: look.eye, cape: look.cape, scale: (opts.scale || 1),
    });
    this.mesh = new THREE.Group();
    this.mesh.add(this.rig.group);
    this.mesh.position.copy(this.pos);
    world.scene.add(this.mesh);

    // ---- health bar ----
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(barGeo, BAR_BG);
    bg.scale.set(1.6, 0.19, 1);
    this.barFill = new THREE.Mesh(barGeo, BAR_FG);
    this.barFill.scale.set(1.54, 0.13, 1);
    this.barFill.position.z = 0.001;
    this.bar.add(bg, this.barFill);
    this.bar.position.y = this.height + 0.5;
    this.bar.renderOrder = 20;
    this.mesh.add(this.bar);
    this.bar.visible = !!opts.showBar;

    this.attackAnim = { t: 99, dur: 0.4, kind: 'slash' };
    this._wq = new THREE.Quaternion();
    this._flash = 0;
    this._materials = [];
    this.rig.group.traverse(o => { if (o.isMesh && o.material && o.material.emissive) this._materials.push(o.material); });
    this._baseEmissive = this._materials.map(m => m.emissiveIntensity || 0);
  }

  get eyePos() { return tmp.v1.set(this.pos.x, this.pos.y + this.height * 0.82, this.pos.z); }
  get center() { return tmp.v2.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }

  /* ------------------------------------------------------------- statuses */
  stun(d) { this.stunT = Math.max(this.stunT, d); }
  root(d) { this.rootT = Math.max(this.rootT, d); }
  blind(d) { this.blindT = Math.max(this.blindT, d); }
  slow(d) { this.slowT = Math.max(this.slowT, d); }
  freeze(d) { this.frozenT = Math.max(this.frozenT, d); }

  applyBurn({ pct = 0.03, dur = 10, tick = 0.5, source = null, color = 0xff7a1a } = {}) {
    if (!this.burn || this.burn.pct < pct) {
      this.burn = { pct, dur, t: 0, tick, acc: 0, source, color };
    } else {
      this.burn.dur = Math.max(this.burn.dur, dur);
      this.burn.t = 0;
    }
  }

  applyKnockback(fromPos, distance, { up = 0.55, dur = 0.42 } = {}) {
    const d = tmp.v1.set(this.pos.x - fromPos.x, 0, this.pos.z - fromPos.z);
    if (d.lengthSq() < 1e-6) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    d.normalize();
    const speed = distance / Math.max(0.08, dur);
    this.kb.set(d.x * speed, up * speed, d.z * speed);
    this.stunT = Math.max(this.stunT, dur * 0.55);
  }

  lift(duration = 1, height = 6) {
    this.liftT = Math.max(this.liftT, duration);
    this.vel.y = Math.max(this.vel.y, (height / Math.max(0.2, duration)) * 0.85);
    this.stun(duration);
  }

  /* --------------------------------------------------------------- damage */
  takeDamage(amount, opts = {}) {
    if (!this.alive || this.invulnT > 0) return 0;
    const applied = Math.max(0, amount);
    this.hp -= applied;
    this._flash = 1;
    this.world.combat?.onHit?.(this, applied, opts);
    if (opts.stun) this.stun(opts.stun);
    if (opts.blind) this.blind(opts.blind);
    if (opts.burn) this.applyBurn(opts.burn);
    if (opts.knockback && opts.from) this.applyKnockback(opts.from, opts.knockback, opts.knockbackOpts || {});
    if (opts.lift) this.lift(opts.lift, opts.liftHeight || 6);
    if (this.hp <= 0) { this.hp = 0; this.die(opts); }
    return applied;
  }

  heal(amount) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (gained > 0.5) this.world.combat?.onHeal?.(this, gained);
    return gained;
  }

  die(opts = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.onDeath?.(opts);
    this.world.onEntityDeath?.(this, opts);
  }

  /** Called by skills like Hiauna: turn into a giant rock. */
  petrify(duration) {
    this.rockT = duration;
    this.stun(duration);
  }

  /* --------------------------------------------------------------- update */
  update(dt) {
    this.t += dt;
    const stunned = this.stunT > 0 || this.frozenT > 0;

    if (this.frozenT > 0) { this.frozenT -= dt; dt = 0; }
    if (this.stunT > 0) this.stunT -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.liftT > 0) this.liftT -= dt;
    if (this.blindT > 0) this.blindT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.rockT > 0) this.rockT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;

    // burn ticks
    if (this.burn) {
      this.burn.t += dt;
      this.burn.acc += dt;
      if (this.burn.acc >= this.burn.tick) {
        this.burn.acc = 0;
        const dmg = this.maxHp * this.burn.pct;
        this.takeDamage(dmg, { source: this.burn.source, type: 'burn', silentNumber: false, color: 0xff8a3d });
        this.world.fx?.burnTick(this, this.burn.color);
      }
      if (this.burn.t >= this.burn.dur) this.burn = null;
    }

    // integrate (controlled velocity + knockback impulse)
    if (dt > 0) {
      this.pos.x += (this.vel.x + this.kb.x) * dt;
      this.pos.y += (this.vel.y + this.kb.y) * dt;
      this.pos.z += (this.vel.z + this.kb.z) * dt;

      this.vel.y -= 30 * dt;                    // gravity on controlled motion (jumps)
      this.kb.y -= 26 * dt;                     // gravity on knockback
      const kd = Math.exp(-4.0 * dt);           // air drag on knockback
      this.kb.x *= kd; this.kb.z *= kd;

      if (this.pos.y <= 0) {
        this.pos.y = 0;
        if (this.vel.y < 0) this.vel.y = 0;
        if (this.kb.y < 0) this.kb.y *= -0.25;
        this.grounded = true;
      } else this.grounded = false;
    }

    // arena bounds
    const r = Math.hypot(this.pos.x, this.pos.z);
    const maxR = this.world.arenaRadius - 2;
    if (r > maxR) {
      const k = maxR / r;
      this.pos.x *= k; this.pos.z *= k;
      this.vel.x *= 0.2; this.vel.z *= 0.2;
    }

    // ---- mesh sync ----
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = damp(this.mesh.rotation.y, this.yaw, 12, dt || 0.016);

    // health bar + billboard
    if (this.bar.visible) {
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      this.barFill.scale.x = 1.54 * ratio;
      this.barFill.position.x = -(1.54 - this.barFill.scale.x) / 2;
      this.barFill.material = ratio > 0.35 ? BAR_FG : BAR_FG_HURT;
      // convert the camera's world quaternion into the parent's local space
      this.mesh.getWorldQuaternion(this._wq).invert();
      this.bar.quaternion.copy(this._wq).multiply(this.world.camera.quaternion);
    }

    // hit flash
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 5);
      const f = this._flash;
      for (let i = 0; i < this._materials.length; i++) {
        const m = this._materials[i];
        m.emissive.setRGB(f * 0.9, f * 0.25, f * 0.25);
        m.emissiveIntensity = this._baseEmissive[i] + f * 0.9;
      }
    }

    return stunned;
  }

  destroy() {
    this.world.scene.remove(this.mesh);
  }
}

/**
 * FX manager — the single high-level effects API used by every skill.
 *
 *  • explosions (fireball + shockwave + debris + scorch + shake)
 *  • lightning bolts (tall vertical jagged, purple for gravity / neon blue for lightning)
 *  • fire pits, cracks, shockwave rings, meteors, tsunamis, slash arcs, pillars
 */
import * as THREE from 'three';
import { ParticleSystem } from './particles.js';
import { LightningSystem } from './lightning.js';
import { DebrisSystem } from './debris.js';
import { DecalSystem } from './decals.js';
import { BlastSystem } from './blasts.js';
import { ProjectileSystem } from './projectiles.js';
import { TsunamiSystem } from './tsunami.js';
import { Settings } from '../core/settings.js';
import { rand, randInt, clamp, TAU, tmp } from '../core/utils.js';

export const PURPLE = 0xa855f7;
export const NEON = 0x38bdf8;

export class FX {
  constructor(scene, camera, rig) {
    this.scene = scene;
    this.camera = camera;
    this.rig = rig;
    this.world = null;

    this.glow = new ParticleSystem(scene, { max: 4200, additive: true, soft: true, renderOrder: 6 });
    this.smoke = new ParticleSystem(scene, { max: 1800, additive: false, soft: true, renderOrder: 4 });

    this.bolts = new LightningSystem(scene, camera);
    this.debris = new DebrisSystem(scene);
    this.projectiles = new ProjectileSystem(scene, this);
    this.blasts = new BlastSystem(scene, { pool: 30 });
    this.tsunamis = new TsunamiSystem(scene, this);
    this.decals = new DecalSystem(scene, this);

    this.group = new THREE.Group();
    scene.add(this.group);

    // ---- slash arc pool ----
    this.slashes = [];
    this.slashGeo = new THREE.RingGeometry(0.42, 1.0, 30, 1, 0, 1.15);
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(this.slashGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      }));
      m.visible = false;
      m.renderOrder = 7;
      this.group.add(m);
      this.slashes.push({ mesh: m, t: 0, life: 0, active: false, spin: 0, scale: 1, travel: null });
    }

    // ---- pillars (gravity / lightning columns) ----
    this.pillars = [];
    this.pillarGeo = new THREE.CylinderGeometry(1, 1.25, 1, 26, 1, true);
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 40);

    // ---- storm clouds ----
    this.clouds = [];

    // ---- rising boulders (Pilmae) ----
    this.boulders = [];
    this.boulderGeo = new THREE.IcosahedronGeometry(1, 1);
    this.boulderMat = new THREE.MeshStandardMaterial({ color: 0x7a6f60, roughness: 1, flatShading: true });
  }

  setWorld(world) { this.world = world; }

  get pq() { return Settings.get('particleQuality'); }

  /* ==================================================================== */
  /*  SHAKE                                                               */
  /* ==================================================================== */
  ring(pos, opts = {}) { return this.decals.ring(pos, opts); }
  slashArc(pos, dir, opts = {}) { return this.slash({ pos, dir, color: 0xffffff, radius: 2, life: 0.24, ...opts }); }

  shake(amp, dur = 0.5) { this.rig?.addShake(amp, dur); }
  shakeAt(pos, amp, radius = 70, dur = 0.5) { this.rig?.addShakeAt(pos, amp, radius, dur); }

  /* ==================================================================== */
  /*  LIGHTNING                                                           */
  /* ==================================================================== */
  /** Tall vertical jagged bolt down onto a point. */
  strike(pos, opts = {}) {
    return this.bolts.strike(pos, {
      height: opts.height || 58,
      color: opts.color !== undefined ? opts.color : PURPLE,
      width: opts.width !== undefined ? opts.width : 1.25,
      life: opts.life || 0.34,
      branches: opts.branches !== undefined ? opts.branches : 3,
      jitter: opts.jitter,
      intensity: opts.intensity !== undefined ? opts.intensity : 1.25,
      endFade: opts.endFade,
    });
  }

  /** Bolt between two arbitrary points. */
  bolt(from, to, opts = {}) {
    return this.bolts.spawn({
      from, to,
      color: opts.color !== undefined ? opts.color : PURPLE,
      width: opts.width !== undefined ? opts.width : 1.0,
      life: opts.life || 0.3,
      branches: opts.branches !== undefined ? opts.branches : 2,
      jitter: opts.jitter,
      intensity: opts.intensity !== undefined ? opts.intensity : 1.1,
    });
  }

  /** Overlapping bolt cluster on one spot (Tormenta / Juicio Celestial). */
  boltBurst(pos, { count = 4, radius = 2.5, color = NEON, height = 46 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = tmp.v1.set(pos.x + rand(-radius, radius), pos.y, pos.z + rand(-radius, radius));
      this.strike(p, { color, height: height + rand(-8, 12), width: rand(0.7, 1.5), life: rand(0.22, 0.42) });
    }
    this.impact(pos, { color, radius: radius * 1.4, count: Math.round(8 * this.pq) });
  }

  /* ==================================================================== */
  /*  EXPLOSIONS                                                          */
  /* ==================================================================== */
  /**
   * @param {object} o
   *  pos, radius, color, colorB, damage, pct, source, crit, knockback, stun, burn,
   *  lift, blind, shake, shakeDur, debris(bool), scorch(bool), life, ringColor, falloff, limit
   */
  explosion(o) {
    const pos = o.pos;
    const radius = o.radius !== undefined ? o.radius : 8;
    const color = o.color !== undefined ? o.color : 0xff5a00;
    const colorB = o.colorB !== undefined ? o.colorB : 0xffd166;
    const pq = this.pq;

    this.blasts.spawn(pos, {
      radius: radius * 0.92, life: o.life || clamp(0.42 + radius * 0.012, 0.42, 1.1),
      color, colorB, amp: 0.55,
    });
    this.blasts.flash(pos, colorB, Math.min(2600, 260 + radius * 90), 0.34, radius * 7);

    // ground shockwave ring
    this.decals.ring(pos, {
      from: radius * 0.18, to: radius * 1.25, duration: clamp(0.42 + radius * 0.012, 0.4, 1.0),
      color: o.ringColor !== undefined ? o.ringColor : colorB, opacity: 0.9,
    });
    this.decals.ring(pos, {
      from: radius * 0.1, to: radius * 0.8, duration: 0.34,
      color: 0xffffff, opacity: 0.55,
    });

    // sparks
    const nSpark = Math.round(clamp(radius * 3.2, 10, 150) * pq);
    for (let i = 0; i < nSpark; i++) {
      const a = Math.random() * TAU, el = rand(0.05, 1.15);
      const sp = rand(0.35, 1.25) * radius * 2.1;
      this.glow.spawn({
        pos: { x: pos.x + rand(-1, 1), y: pos.y + rand(0.2, 1.6), z: pos.z + rand(-1, 1) },
        vel: { x: Math.cos(a) * Math.cos(el) * sp, y: Math.sin(el) * sp * 0.9 + 3, z: Math.sin(a) * Math.cos(el) * sp },
        color: Math.random() < 0.4 ? colorB : color,
        size: rand(1.1, 3.4) * (1 + radius * 0.02),
        life: rand(0.35, 1.1), gravity: -9, drag: 1.1, grow: -0.2,
      });
    }
    // smoke
    const nSmoke = Math.round(clamp(radius * 1.5, 5, 60) * pq);
    for (let i = 0; i < nSmoke; i++) {
      const a = Math.random() * TAU;
      const sp = rand(0.2, 0.8) * radius;
      this.smoke.spawn({
        pos: { x: pos.x + rand(-2, 2), y: pos.y + rand(0.5, 2.5), z: pos.z + rand(-2, 2) },
        vel: { x: Math.cos(a) * sp, y: rand(2.5, 8), z: Math.sin(a) * sp },
        color: 0x2b2622, size: rand(3.5, 9) * (1 + radius * 0.02),
        life: rand(1.1, 2.6), gravity: -1.6, drag: 0.8, grow: 1.9, alpha: 0.5,
      });
    }
    // firey ground wash
    for (let i = 0; i < Math.round(clamp(radius * 0.9, 4, 40) * pq); i++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius * 0.7;
      this.glow.spawn({
        pos: { x: pos.x + Math.cos(a) * r, y: 0.4, z: pos.z + Math.sin(a) * r },
        vel: { x: Math.cos(a) * rand(2, 10), y: rand(1, 5), z: Math.sin(a) * rand(2, 10) },
        color: Math.random() < 0.5 ? color : 0xffb703,
        size: rand(2, 5), life: rand(0.4, 0.9), gravity: -3, drag: 1.6, grow: 0.8,
      });
    }

    if (o.debris !== false) {
      this.debris.spawn(pos, {
        count: clamp(radius * 0.9, 4, 40), speed: radius * 1.5, up: 0.9,
        scale: clamp(radius * 0.06, 0.4, 2.4), color: o.debrisColor !== undefined ? o.debrisColor : 0x6b6154,
      });
    }
    if (o.scorch !== false) this.decals.scorch(pos, radius * 0.72, { life: 22 + radius });

    // ---- camera shake (positional only) ----
    const shakeAmp = clamp(radius * 0.075, 0.15, 4.2) * (o.shake !== undefined ? o.shake : 1);
    this.shakeAt(pos, shakeAmp, radius * 4.5 + 55, o.shakeDur || clamp(0.3 + radius * 0.012, 0.3, 1.1));

    // ---- damage ----
    if ((o.damage || o.pct) && this.world) {
      this.world.combat.area({
        pos, radius, amount: o.damage || 0, pct: o.pct || 0,
        source: o.source, crit: o.crit, knockback: o.knockback, from: o.from || pos,
        stun: o.stun, burn: o.burn, lift: o.lift, blind: o.blind, slow: o.slow,
        falloff: o.falloff !== false, limit: o.limit, color: o.numberColor,
      });
    }
    this.world?.audio?.play('boom', { volume: clamp(radius / 30, 0.25, 1.4), pitch: 1.6 / (1 + radius * 0.05) });
  }

  /** Small hit spark (melee / projectile impacts). */
  impact(pos, { color = 0xffffff, radius = 1, count = 10, shake = 0 } = {}) {
    const pq = this.pq;
    this.blasts.flash(pos, color, 120, 0.16, radius * 10);
    for (let i = 0; i < Math.round(count * pq); i++) {
      const a = Math.random() * TAU, el = rand(-0.4, 1.2);
      const sp = rand(3, 12) * radius;
      this.glow.spawn({
        pos, vel: { x: Math.cos(a) * sp, y: Math.sin(el) * sp, z: Math.sin(a) * sp },
        color, size: rand(0.8, 2.2), life: rand(0.18, 0.5), gravity: -12, drag: 2.2,
      });
    }
    this.decals.ring(pos, { from: 0.3, to: radius * 2.2, duration: 0.3, color, opacity: 0.6 });
    if (shake) this.shakeAt(pos, shake, 40, 0.25);
  }

  /* ==================================================================== */
  /*  FIRE PITS                                                           */
  /* ==================================================================== */
  firepit({ pos, radius, duration = 10, pct = 0.03, color = 0xff6a1a, source = null, tickInterval = 0.5, burn = null }) {
    const pit = this.decals.firepit(pos, radius, {
      duration, color, tickInterval,
      onTick: (p) => {
        if (!this.world) return;
        this.world.combat.area({
          pos: new THREE.Vector3(p.mesh.position.x, 0, p.mesh.position.z),
          radius: p.radius, amount: 0, pct, source, color: 0xff8a3d, falloff: false,
          burn: burn || undefined, stun: 0,
        });
      },
    });
    // initial burst
    this.decals.ring(pos, { from: radius * 0.2, to: radius * 1.1, duration: 0.6, color, opacity: 0.8 });
    return pit;
  }

  /* ==================================================================== */
  /*  CRACKS / SHOCKWAVES                                                 */
  /* ==================================================================== */
  cracks(pos, radius, { color = NEON, life = 3.4, count = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = count > 1
        ? tmp.v1.set(pos.x + rand(-radius, radius), 0, pos.z + rand(-radius, radius))
        : tmp.v1.copy(pos);
      this.decals.crack(p, radius * rand(0.7, 1.1), { color, life, opacity: 1 });
    }
    // sparks along the cracks
    const n = Math.round(clamp(radius * 1.4, 4, 50) * this.pq);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius;
      this.glow.spawn({
        pos: { x: pos.x + Math.cos(a) * r, y: rand(0.1, 0.6), z: pos.z + Math.sin(a) * r },
        vel: { x: rand(-1, 1), y: rand(1.5, 6), z: rand(-1, 1) },
        color, size: rand(0.9, 2.4), life: rand(0.3, 0.9), gravity: -6, drag: 1.4,
      });
    }
  }

  shockwave(pos, { radius = 20, duration = 0.6, color = 0xffffff, opacity = 0.9, width = 1 } = {}) {
    return this.decals.ring(pos, { from: 1, to: radius, duration, color, opacity, width });
  }

  /* ==================================================================== */
  /*  METEORS                                                             */
  /* ==================================================================== */
  meteor({ to, height = 120, speed = 95, radius = 25, color = 0xff5a00, marker = true, onImpact = null, tilt = 0.16, size = 2.6, damage, pct, source, stun, burn, knockback, firepit = null, shake }) {
    const from = new THREE.Vector3(to.x + rand(-6, 6) + tilt * height, height, to.z + rand(-6, 6) + tilt * height);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const fallTime = from.distanceTo(to) / speed;

    if (marker) {
      this.decals.ring(to, { from: radius * 0.9, to: radius * 0.22, duration: fallTime, color: 0xff4d1a, opacity: 0.55, y: 0.11 });
    }

    return this.projectiles.spawn({
      type: 'rock', pos: from, dir, speed, radius: size, gravity: 0, life: fallTime + 1.5,
      trail: { color: 0xff7b1a, size: 3.2, rate: 120, gravity: 0 },
      onEnd: (p) => {
        this.explosion({
          pos: p, radius, color, colorB: 0xffb703, damage, pct, source, stun, burn, knockback, shake,
          debris: true,
        });
        if (firepit) {
          this.firepit({ pos: p, radius: radius, duration: firepit.duration, pct: firepit.pct, color: firepit.color, source });
        }
        onImpact?.(p);
      },
    });
  }

  /** Small meteor (gravity blade 343g, Hiauna meteors). */
  smallMeteor({ to, height = 70, speed = 130, radius = 5, color = 0xff7b1a, damage = 0, pct = 0, source = null, shake = 1 }) {
    const from = new THREE.Vector3(to.x + rand(-3, 3), height, to.z + rand(-3, 3));
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    return this.projectiles.spawn({
      type: 'rock', pos: from, dir, speed, radius: rand(0.5, 1.1), gravity: 0, life: 4,
      trail: { color: color, size: 1.8, rate: 90 },
      onEnd: (p) => {
        this.explosion({ pos: p, radius, color, colorB: 0xffd166, damage, pct, source, shake: 0.8 * shake, debris: true });
      },
    });
  }

  /* ==================================================================== */
  /*  SLASHES                                                             */
  /* ==================================================================== */
  /**
   * Curved slash arc. If `travel` is given the arc flies toward a target.
   */
  slash({ pos, dir, color = 0xffffff, radius = 3, life = 0.28, tilt = 0, spin = rand(-1, 1), scale = 1, travel = null, onHit = null, source = null, damage = 0, crit = 0, stun = 0, burn = null, knockback = 0, curve = 1.15 }) {
    let rec = this.slashes.find(s => !s.active);
    if (!rec) rec = this.slashes[0];
    rec.active = true;
    rec.t = 0; rec.life = life; rec.scale = radius * scale;
    rec.spin = spin;
    rec.color = color;
    rec.travel = travel;
    rec.onHit = onHit;
    rec.hit = false;
    rec.damage = damage;
    rec.crit = crit;
    rec.stun = stun;
    rec.burn = burn;
    rec.knockback = knockback;
    rec.source = source;
    rec.mesh.visible = true;
    rec.mesh.material.color.set(color);
    rec.mesh.material.opacity = 1;
    rec.mesh.position.set(pos.x, pos.y, pos.z);
    rec.mesh.rotation.set(-Math.PI / 2 + tilt, Math.atan2(dir.x, dir.z), spin, 'YXZ');
    rec.mesh.scale.setScalar(radius * scale);
    return rec;
  }

  /* ==================================================================== */
  /*  PILLARS / CLOUDS                                                    */
  /* ==================================================================== */
  /** Purple ring-stacked pillar (Gravitational Lightning). */
  pillar({ pos, height = 42, radius = 4, color = PURPLE, duration = 1.6, rings = 7 }) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const tube = new THREE.Mesh(this.pillarGeo, mat);
    tube.scale.set(radius, height, radius);
    tube.position.y = height / 2;
    group.add(tube);

    const inner = new THREE.Mesh(this.pillarGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    inner.scale.set(radius * 0.45, height, radius * 0.45);
    inner.position.y = height / 2;
    group.add(inner);

    const ringList = [];
    for (let i = 0; i < rings; i++) {
      const rm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const r = new THREE.Mesh(this.ringGeo, rm);
      r.rotation.x = -Math.PI / 2;
      r.scale.setScalar(radius * (1.25 + i * 0.13));
      r.position.y = 1 + i * (height / rings) * 0.9;
      group.add(r);
      ringList.push(r);
    }
    group.position.copy(pos);
    this.group.add(group);

    const rec = { group, tube, inner, rings: ringList, t: 0, dur: duration, height, radius, color, active: true };
    this.pillars.push(rec);
    this.decals.ring(pos, { from: 1, to: radius * 3, duration: 0.5, color, opacity: 0.8 });
    return rec;
  }

  /** A thundercloud that spawns and then strikes bolts. */
  stormCloud({ pos, radius = 6, color = NEON, life = 4, flash = true }) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2f45, roughness: 1, emissive: color, emissiveIntensity: 0.35,
      transparent: true, opacity: 0.92, flatShading: true,
    });
    const blobs = randInt(5, 8);
    for (let i = 0; i < blobs; i++) {
      const s = rand(0.55, 1.15) * radius;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
      b.position.set(rand(-radius, radius) * 0.7, rand(-0.3, 0.5) * radius, rand(-radius, radius) * 0.5);
      group.add(b);
    }
    group.position.copy(pos);
    this.group.add(group);
    const rec = { group, mat, t: 0, dur: life, flash, color, radius, active: true, pos: pos.clone() };
    this.clouds.push(rec);
    return rec;
  }

  /** A boulder that erupts upward, hangs, then slams back down. */
  risingRock({ pos, height = 14, riseTime = 0.8, fallSpeed = 90, scale = 1.4, color = 0x7a6f60, hang = 0.15, onLand = null }) {
    let mesh = this._boulderPool?.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(this.boulderGeo, this.boulderMat.clone());
    }
    mesh.visible = true;
    mesh.material.color.setHex(color);
    mesh.scale.setScalar(scale * rand(0.8, 1.3));
    mesh.position.set(pos.x, -scale, pos.z);
    mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    this.group.add(mesh);
    this.boulders.push({
      mesh, t: 0, riseTime, height, fallSpeed, hang, scale,
      y: -scale, vy: 0, state: 'rise', onLand, landed: false,
      spin: { x: rand(-2, 2), y: rand(-2, 2), z: rand(-2, 2) },
    });
    // dust on emergence
    for (let i = 0; i < Math.round(6 * this.pq); i++) {
      const a = Math.random() * TAU;
      this.smoke.spawn({
        pos: { x: pos.x + Math.cos(a) * scale, y: 0.3, z: pos.z + Math.sin(a) * scale },
        vel: { x: Math.cos(a) * rand(2, 7), y: rand(1, 4), z: Math.sin(a) * rand(2, 7) },
        color: 0x9a8f7d, size: rand(1.5, 3.5), life: rand(0.4, 0.9), gravity: -2, drag: 1.4, grow: 1.4, alpha: 0.4,
      });
    }
    return mesh;
  }

  /* ==================================================================== */
  /*  MISC                                                                */
  /* ==================================================================== */
  deathPoof(entity) {
    const p = entity.pos;
    for (let i = 0; i < Math.round(26 * this.pq); i++) {
      const a = Math.random() * TAU;
      this.glow.spawn({
        pos: { x: p.x, y: p.y + rand(0.4, 1.8), z: p.z },
        vel: { x: Math.cos(a) * rand(2, 9), y: rand(2, 9), z: Math.sin(a) * rand(2, 9) },
        color: 0xff5470, size: rand(1, 3), life: rand(0.4, 0.9), gravity: -8, drag: 1.4,
      });
    }
    this.debris.spawn(p, { count: 6, speed: 9, scale: 0.5, color: 0x8b3a3a });
    this.decals.ring(p, { from: 0.5, to: 5, duration: 0.5, color: 0xff5470, opacity: 0.7 });
  }

  burnTick(entity, color = 0xff8a3d) {
    for (let i = 0; i < 2; i++) {
      this.glow.spawn({
        pos: { x: entity.pos.x + rand(-0.4, 0.4), y: entity.pos.y + rand(0.3, 1.7), z: entity.pos.z + rand(-0.4, 0.4) },
        vel: { x: rand(-0.6, 0.6), y: rand(1.5, 4), z: rand(-0.6, 0.6) },
        color, size: rand(0.8, 1.8), life: rand(0.25, 0.6), gravity: 1.5, drag: 1,
      });
    }
  }

  levelUp(entity) {
    this.decals.ring(entity.pos, { from: 1, to: 14, duration: 0.9, color: 0xf5c451, opacity: 1 });
    for (let i = 0; i < Math.round(40 * this.pq); i++) {
      const a = Math.random() * TAU;
      this.glow.spawn({
        pos: { x: entity.pos.x + Math.cos(a) * 1.6, y: 0.2, z: entity.pos.z + Math.sin(a) * 1.6 },
        vel: { x: Math.cos(a) * 1.5, y: rand(5, 12), z: Math.sin(a) * 1.5 },
        color: 0xffd75e, size: rand(1.2, 2.8), life: rand(0.7, 1.5), gravity: -6, drag: 0.6,
      });
    }
  }

  /* ==================================================================== */
  /*  UPDATE                                                              */
  /* ==================================================================== */
  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    this.bolts.update(dt);
    this.debris.update(dt);
    this.blasts.update(dt);
    this.decals.update(dt);
    this.projectiles.update(dt, this.world);
    this.tsunamis.update(dt, this.world);

    // ---- slashes ----
    for (const s of this.slashes) {
      if (!s.active) continue;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { s.active = false; s.mesh.visible = false; continue; }
      s.mesh.material.opacity = Math.pow(1 - k, 0.8);
      s.mesh.scale.setScalar(s.scale * (1 + k * 0.35));
      s.mesh.rotateZ(dt * s.spin * 6);
      if (s.travel) {
        s.mesh.position.addScaledVector(s.travel.dir, s.travel.speed * dt);
        s.travel.traveled += s.travel.speed * dt;
        if (Math.random() < dt * 60 * this.pq) {
          this.glow.spawn({
            pos: s.mesh.position, vel: { x: rand(-1, 1), y: rand(-0.5, 1), z: rand(-1, 1) },
            color: s.color, size: rand(1.2, 3), life: rand(0.15, 0.4), gravity: 0, drag: 2,
          });
        }
        if (s.onHit && !s.hit) {
          for (const e of this.world.enemies.slice()) {
            if (!e.alive) continue;
            const d = Math.hypot(e.pos.x - s.mesh.position.x, e.pos.z - s.mesh.position.z);
            if (d < e.radius + 2.2 && Math.abs(e.pos.y + 1 - s.mesh.position.y) < 3.2) {
              s.hit = true;
              s.onHit(e, s.mesh.position);
              break;
            }
          }
        }
        if (s.travel.traveled >= s.travel.distance) { s.active = false; s.mesh.visible = false; }
      }
    }

    // ---- pillars ----
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) {
        this.group.remove(p.group);
        this.pillars.splice(i, 1);
        continue;
      }
      const grow = Math.min(1, k / 0.22);
      p.tube.scale.y = p.height * grow;
      p.tube.position.y = (p.height * grow) / 2;
      p.inner.scale.y = p.height * grow;
      p.inner.position.y = p.tube.position.y;
      p.tube.material.opacity = 0.42 * (1 - Math.pow(k, 3));
      p.inner.material.opacity = 0.25 * (1 - Math.pow(k, 3));
      for (let r = 0; r < p.rings.length; r++) {
        const ring = p.rings[r];
        const rk = (k * 1.5 + r / p.rings.length) % 1;
        ring.position.y = rk * p.height * grow;
        ring.material.opacity = (1 - rk) * 0.85 * (1 - k * 0.5);
        ring.scale.setScalar(p.radius * (1.2 + Math.sin(rk * 6) * 0.12) * (1 + rk * 0.35));
      }
    }

    // ---- rising boulders ----
    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i];
      b.t += dt;
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      if (b.state === 'rise') {
        const k = clamp(b.t / b.riseTime, 0, 1);
        const e = 1 - Math.pow(1 - k, 2.2);
        b.y = -b.scale + (b.height + b.scale) * e;
        b.mesh.position.y = b.y;
        if (k >= 1) { b.state = 'hang'; b.t = 0; }
      } else if (b.state === 'hang') {
        b.mesh.position.y = b.height + Math.sin(b.t * 12) * 0.25;
        if (b.t >= b.hang) { b.state = 'fall'; b.t = 0; b.vy = -b.fallSpeed * 0.35; }
      } else {
        b.vy -= 120 * dt;
        b.y += b.vy * dt;
        b.mesh.position.y = b.y;
        // air trail
        if (Math.random() < dt * 30 * this.pq) {
          this.glow.spawn({
            pos: b.mesh.position, vel: { x: rand(-1, 1), y: rand(-2, 0), z: rand(-1, 1) },
            color: 0xff9d4d, size: rand(0.8, 2), life: rand(0.15, 0.4), gravity: 0, drag: 2,
          });
        }
        if (b.y <= 0) {
          b.mesh.visible = false;
          this.group.remove(b.mesh);
          (this._boulderPool ||= []).push(b.mesh);
          this.boulders.splice(i, 1);
          b.onLand?.(b.mesh.position.clone());
        }
      }
    }

    // ---- storm clouds ----
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t += dt;
      const k = c.t / c.dur;
      if (k >= 1) {
        this.group.remove(c.group);
        this.clouds.splice(i, 1);
        continue;
      }
      const fade = k > 0.8 ? (1 - k) / 0.2 : Math.min(1, c.t / 0.25);
      c.mat.opacity = 0.92 * fade;
      c.mat.emissiveIntensity = c.flash ? 0.35 + Math.abs(Math.sin(c.t * 14)) * 1.4 : 0.35;
      c.group.rotation.y += dt * 0.15;
    }
  }

  clear() {
    this.glow.clear();
    this.smoke.clear();
    this.bolts.clear();
    this.debris.clear();
    this.blasts.clear();
    this.decals.clear();
    this.projectiles.clear();
    this.tsunamis.clear();
    for (const s of this.slashes) { s.active = false; s.mesh.visible = false; }
    for (const p of this.pillars) this.group.remove(p.group);
    this.pillars.length = 0;
    for (const c of this.clouds) this.group.remove(c.group);
    this.clouds.length = 0;
    for (const b of this.boulders) { this.group.remove(b.mesh); (this._boulderPool ||= []).push(b.mesh); }
    this.boulders.length = 0;
  }
}

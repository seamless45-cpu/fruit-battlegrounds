/**
 * The player: movement, equipment (fruit + sword are SEPARATE slots),
 * skill cooldowns, M1 combos, charges, kill tokens and levels.
 */
import * as THREE from 'three';
import { Entity } from './entity.js';
import { makeSword, makePole, makeBisento } from './character.js';
import { FRUITS, WEAPONS, FRUIT_COLORS, FRUIT_KEYS, WEAPON_KEYS } from '../data/loadout.js';
import { clamp, damp, rand, tmp } from './utils.js';
import { Settings } from './settings.js';

export class Player extends Entity {
  constructor(world, { pos } = {}) {
    super(world, {
      pos, faction: 'player', maxHp: 5200, radius: 0.62, height: 2.0, speed: 11.5, showBar: false,
      look: { skin: 0xf1c27d, shirt: 0x1e293b, pants: 0x0f172a, accent: 0xa855f7, hair: 0x241608, eye: 0xa5f3fc, cape: 0x6d28d9 },
    });

    // start facing away from the third-person camera
    this.yaw = Math.PI;
    this.mesh.rotation.y = this.yaw;

    // ---- equipment (fruit and sword are independent slots) ----
    this.fruit = 'gravity';
    this.weapon = 'gravityblade';
    this.owned = { fruits: Object.keys(FRUITS), weapons: Object.keys(WEAPONS) };

    // ---- progression ----
    this.level = 1;
    this.xp = 0;
    this.tokens = 0;
    this.kills = 0;

    // ---- combat state ----
    this.cd = new Map();          // key -> {t, total}
    this.charge = 0;              // gravity blade superforce charge (0..100)
    this.m1Combo = 0;
    this.m1Timer = 0;
    this.attackLock = 0;          // end-lag
    this.cast = null;             // {t, dur, kind}
    this.channel = null;          // {kind, index, def, t}
    this.upgrades = { deathSlashes: { level: 0, over: 0, bonus: 0 } };
    this.dashCharges = 3;
    this.dashChargeT = 0;
    this.dashTimer = 0;
    this.comboWindow = 0;

    // ---- visuals ----
    this.weaponMesh = null;
    this.fruitOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.17, 1),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.fruitOrb.position.set(0, 1.6, 0);
    this.mesh.add(this.fruitOrb);
    this.orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xa855f7, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.orbHalo.scale.setScalar(1.1);
    this.fruitOrb.add(this.orbHalo);

    this.handLight = new THREE.PointLight(0xa855f7, 0, 14, 2);
    this.handLight.position.set(0, 1.3, 0);
    this.mesh.add(this.handLight);

    this._lastHp = this.hp;
    this.setWeapon(this.weapon);
    this.setFruit(this.fruit);
  }

  /* ------------------------------------------------------------- stats */
  get atk() { return 180 * (1 + (this.level - 1) * 0.035); }
  get xpNeeded() { return 220 + this.level * 90; }

  /* --------------------------------------------------------- equipment */
  setWeapon(id) {
    if (this.weaponMesh) {
      this.weaponMesh.parent?.remove(this.weaponMesh);
      this.weaponMesh.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
      });
      this.weaponMesh = null;
    }
    this.weapon = id && WEAPONS[id] ? id : null;
    this.m1Combo = 0;
    if (!this.weapon) { this.world.ui?.rebuildSkillBars(); return; }
    const def = WEAPONS[this.weapon];
    let m;
    if (def.mesh === 'sword') m = makeSword({ color: def.color, blade: def.blade, length: def.length || 1.9 });
    else if (def.mesh === 'pole') m = makePole({ color: def.color });
    else m = makeBisento({ color: def.color, accent: def.accent });
    m.position.set(0, -0.1, 0);
    m.rotation.set(-0.25, 0, 0.15);
    this.rig.parts.armR.hand.add(m);
    this.weaponMesh = m;
    this.world.ui?.rebuildSkillBars();
  }

  setFruit(id) {
    this.fruit = id && FRUITS[id] ? id : null;
    const c = this.fruit ? FRUIT_COLORS[this.fruit] || FRUITS[this.fruit].color : 0xffffff;
    this.fruitOrb.visible = !!this.fruit;
    this.fruitOrb.material.color.setHex(c);
    this.orbHalo.material.color.setHex(c);
    this.handLight.color.setHex(c);
    this.world.ui?.rebuildSkillBars();
  }

  get fruitSkills() { return this.fruit ? (FRUITS[this.fruit].skills || []) : []; }
  get weaponSkills() { return this.weapon ? (WEAPONS[this.weapon].skills || []) : []; }

  /* --------------------------------------------------------- cooldowns */
  cdLeft(key) { const c = this.cd.get(key); return c ? Math.max(0, c.t) : 0; }
  cdTotal(key) { const c = this.cd.get(key); return c ? c.total : 0; }
  cdRatio(key) { const c = this.cd.get(key); return c ? clamp(c.t / c.total, 0, 1) : 0; }
  onCooldown(key) { return this.cdLeft(key) > 0; }
  setCd(key, sec) { this.cd.set(key, { t: sec, total: sec }); }

  /* ------------------------------------------------------------ combat */
  get attackState() {
    return this.cast ? { t: this.cast.t, dur: this.cast.dur, kind: this.cast.kind || 'cast' } : this.attackAnim;
  }

  pressedSkill(kind, index, opts = {}) {
    const list = kind === 'fruit' ? this.fruitSkills : this.weaponSkills;
    const def = list[index];
    if (!def) return false;
    const key = kind + ':' + def.id;
    if (this.onCooldown(key) || !this.alive || this.attackLock > 0) return false;

    const ctx = this.makeCtx(def, key);
    if (def.hold) {
      const codes = kind === 'fruit' ? FRUIT_KEYS : WEAPON_KEYS;
      this.channel = { kind, index, def, key, t: 0, code: codes[index], via: opts.via || 'key' };
      def.onStart?.(ctx);
      this.world.ui?.showChannel(def.name, 0);
      return true;
    }
    const ok = def.cast(ctx);
    if (ok === false) return false;
    const cd = (ctx.cooldown !== undefined ? ctx.cooldown : def.cd) * (ctx.cdScale || 1);
    this.setCd(key, cd);
    this.cast = { t: 0, dur: def.castTime || 0.35, kind: def.anim || 'cast' };
    this.faceAim();
    this.world.ui?.flashSkill(kind, index);
    this.world.audio?.play(def.sfx || 'cast', { pitch: def.sfxPitch });
    return true;
  }

  releasedSkill(kind, index) {
    const ch = this.channel;
    if (!ch || ch.kind !== kind || ch.index !== index) return false;
    this.channel = null;
    const ctx = this.makeCtx(ch.def, ch.key);
    ctx.chargeTime = ch.t;
    const res = ch.def.onRelease?.(ctx);
    const cd = (ctx.cooldown !== undefined ? ctx.cooldown : ch.def.cd) * (ctx.cdScale || 1);
    if (res !== false) this.setCd(ch.key, cd);
    this.world.ui?.hideChannel();
    this.world.ui?.flashSkill(kind, index);
    return true;
  }

  makeCtx(def, key) {
    return {
      world: this.world,
      fx: this.world.fx,
      combat: this.world.combat,
      player: this,
      def,
      key,
      aim: this.world.aimPoint,
      level: this.level,
      atk: this.atk,
    };
  }

  /** Light attack (M1). Combo rules come from the equipped weapon. */
  m1() {
    if (!this.alive || this.m1Timer > 0 || this.attackLock > 0 || this.cast) return false;
    const w = this.weapon ? WEAPONS[this.weapon] : null;
    const ctx = this.makeCtx(w, 'm1');
    this.m1Combo++;
    this.comboWindow = 1.1;

    if (w && w.m1) {
      const combo = this.m1Combo;
      w.m1.cast(ctx, combo);
      this.m1Timer = w.m1.interval;
      // end-lag rules
      if (w.m1.endLagEvery && combo % w.m1.endLagEvery === 0) this.attackLock = w.m1.endLag;
      if (w.m1.maxCombo && combo >= w.m1.maxCombo) this.m1Combo = 0;
    } else {
      // unarmed punch
      this.attackAnim = { t: 0, dur: 0.34, kind: 'punch' };
      this.m1Timer = 0.34;
      const hit = this.world.combat.inCone(this.pos, this.forwardVec(), 3.0, 0.9);
      for (const e of hit) {
        e.takeDamage(this.atk * 1.2, { source: this, knockback: 1.2, from: this.pos, stun: 0.12 });
      }
      this.world.fx.slashArc(this.pos, this.forwardVec(), { color: 0xffffff, radius: 1.6 });
    }
    this.faceAim();
    this.world.audio?.play('slash');
    this.world.ui?.flashM1();
    return true;
  }

  forwardVec(out = tmp.v4) {
    return out.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
  }

  faceAim() {
    const a = this.world.aimPoint;
    const dx = a.x - this.pos.x, dz = a.z - this.pos.z;
    if (dx * dx + dz * dz > 0.04) this.yaw = Math.atan2(dx, dz);
  }

  addCharge(pct) { this.charge = clamp(this.charge + pct, 0, 100); }

  onKill(enemy) {
    this.kills++;
    const tokens = enemy.tokenValue ? enemy.tokenValue() : 25;
    this.tokens = Math.min(1_000_000, this.tokens + tokens);
    this.addXp(enemy.xpValue || 50);
    this.addCharge(10);            // superforce charge: +10% per kill
    // bundle the loot spam so the toast layer stays readable during big waves
    this._loot = (this._loot || 0) + tokens;
    this._lootKills = (this._lootKills || 0) + 1;
    if (this._lootKills >= 5) {
      this.world.ui?.toast(`+${this._loot} kill tokens`, 'good', 1000);
      this._loot = 0; this._lootKills = 0;
    }
  }

  addXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeeded && this.level < 100000) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.maxHp += 120;
      this.hp = Math.min(this.maxHp, this.hp + 260);
      this.world.ui?.toast(`LEVEL UP — <b>${this.level}</b>`, 'good', 1300);
      this.world.fx.levelUp(this);
    }
  }

  /* ------------------------------------------------------------- update */
  update(dt, input) {
    const stunned = super.update(dt);
    if (!this.alive) return;

    const canAct = !stunned && this.attackLock <= 0;
    const channeling = !!this.channel;

    // ---- movement ----
    const ax = input.moveAxis();
    const rig = this.world.rig;
    const fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw);
    const rx = -fz, rz = fx;
    let mx = fx * ax.y + rx * ax.x;
    let mz = fz * ax.y + rz * ax.x;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    let speed = this.speed * (this.slowT > 0 ? 0.5 : 1);
    if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) speed *= 1.42;
    if (channeling) speed *= 0.55;
    if (this.cast) speed *= 0.35;
    if (!canAct) speed *= 0.15;

    const targetVx = mx * speed, targetVz = mz * speed;
    const accel = this.grounded ? 16 : 6;
    this.vel.x = damp(this.vel.x, targetVx, accel, dt);
    this.vel.z = damp(this.vel.z, targetVz, accel, dt);

    if (ml > 0.05 && !this.cast && !channeling) {
      this.yaw = Math.atan2(mx, mz);
    }

    // jump
    if (canAct && input.isDown('Space') && this.grounded) {
      this.vel.y = 12.5;
      this.grounded = false;
    }

    // ---- timers ----
    if (this.m1Timer > 0) this.m1Timer -= dt;
    if (this.attackLock > 0) this.attackLock -= dt;
    if (this.comboWindow > 0) { this.comboWindow -= dt; if (this.comboWindow <= 0) this.m1Combo = 0; }
    if (this.cast) { this.cast.t += dt; if (this.cast.t >= this.cast.dur) this.cast = null; }
    if (this.channel) {
      // the keyup can be lost (alt-tab, focus stolen by the page around an
      // iframe) — fire the charge instead of hanging in "charging" forever
      // (only for keyboard casts — a held USE button has no key to watch)
      if (this.channel.via === 'key' && this.world.input && this.channel.code
          && !this.world.input.isDown(this.channel.code)) {
        this.releasedSkill(this.channel.kind, this.channel.index);
        return;
      }
      this.channel.t += dt;
      const ctx = this.makeCtx(this.channel.def, this.channel.key);
      ctx.chargeTime = this.channel.t;
      ctx.dt = dt;
      const keep = this.channel.def.onChannel?.(ctx);
      if (keep === false) {
        this.releasedSkill(this.channel.kind, this.channel.index);
      } else {
        this.world.ui?.showChannel(this.channel.def.name, this.channel.def.chargeRatio ? this.channel.def.chargeRatio(this.channel.t) : 0);
      }
    }
    if (this.dashChargeT >= 0) {
      this.dashChargeT += dt;
      if (this.dashChargeT >= 3) { this.dashChargeT = 0; this.dashCharges = Math.min(3, this.dashCharges + 1); }
    }
    if (this.dashTimer > 0) this.dashTimer -= dt;

    for (const [k, c] of this.cd) {
      if (c.t > 0) { c.t -= dt; if (c.t < 0) c.t = 0; }
    }

    // ---- visuals ----
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.rig.update(dt, {
      speed: sp, t: this.t, grounded: this.grounded,
      attack: this.attackAnim, cast: this.cast, stunned: this.stunT > 0, lifted: this.liftT > 0,
    });
    if (this.attackAnim.t < this.attackAnim.dur) this.attackAnim.t += dt;

    // fruit orb orbit + hand glow
    const c = this.fruit ? (FRUIT_COLORS[this.fruit] || FRUITS[this.fruit].color) : 0xffffff;
    this.fruitOrb.position.set(Math.cos(this.t * 1.9) * 0.85, 1.55 + Math.sin(this.t * 2.6) * 0.09, Math.sin(this.t * 1.9) * 0.85);
    this.fruitOrb.rotation.y += dt * 2.2;
    this.fruitOrb.rotation.x += dt * 1.4;
    const glow = (this.cast ? 1 : 0) + (this.channel ? 0.7 : 0);
    this.handLight.intensity = damp(this.handLight.intensity, glow * 26 + (this.charge > 0 ? 6 : 0), 8, dt);
    this.handLight.color.setHex(c);
    this.orbHalo.material.opacity = 0.35 + glow * 0.5;

    // charge shimmer on the weapon
    if (this.weaponMesh) {
      const blade = this.weaponMesh.userData.blade || this.weaponMesh.userData.tip || this.weaponMesh.userData.guard;
      if (blade && blade.material.emissiveIntensity !== undefined) {
        const base = this.weapon === 'gravityblade' ? 0.9 : 1.2;
        blade.material.emissiveIntensity = base + glow * 2.4 + (this.charge / 100) * 1.6;
      }
    }

    // ---- footstep dust ----
    if (this.grounded && sp > 6 && Math.random() < dt * 14 * Settings.get('particleQuality')) {
      this.world.fx.smoke.spawn({
        pos: { x: this.pos.x, y: 0.15, z: this.pos.z },
        vel: { x: rand(-0.7, 0.7), y: rand(0.2, 1.1), z: rand(-0.7, 0.7) },
        color: 0x9a8f7d, size: rand(0.5, 1.1), life: rand(0.3, 0.6), gravity: -0.4, drag: 2, grow: 1.4, alpha: 0.3,
      });
    }
  }
}

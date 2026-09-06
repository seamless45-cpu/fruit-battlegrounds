// ============================================================
//  Enemy manager — remodeled pirates, HP numbers, damage pops.
// ============================================================
import * as THREE from 'three';
import { ENEMY, WORLD } from './config.js';
import { createEnemyModel, drawHpLabel } from './models.js';

const _look = new THREE.Vector3();

export class EnemyManager {
  constructor(scene, getPlayer, onPlayerHit, onKill, fx) {
    this.scene = scene;
    this.getPlayer = getPlayer;
    this.onPlayerHit = onPlayerHit;
    this.onKill = onKill;
    this.fx = fx;
    this.enemies = [];
    this.spawnTimer = 0.4;
  }

  spawn() {
    if (this.enemies.length >= ENEMY.maxAlive) return;
    const a = Math.random() * Math.PI * 2;
    const r = 28 + Math.random() * 50;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const tier = r > 62 ? 3 : r > 48 ? 2 : 1;
    const hp = ENEMY.maxHp * tier * (0.7 + Math.random() * 0.6);
    const rig = createEnemyModel(tier);
    rig.group.position.copy(pos);
    this.scene.add(rig.group);
    drawHpLabel(rig.hp, hp, hp);
    this.enemies.push({
      group: rig.group, body: rig.body, head: rig.head, bar: rig.bar, barGroup: rig.barGroup, aura: rig.aura,
      leftArm: rig.leftArm, rightArm: rig.rightArm, leftLeg: rig.leftLeg, rightLeg: rig.rightLeg,
      hpLabel: rig.hp,
      position: pos.clone(), hp, maxHp: hp,
      radius: ENEMY.radius, tier, baseY: 0,
      stunUntil: 0, liftUntil: 0, blindUntil: 0,
      burnDps: 0, burnUntil: 0, knockVel: new THREE.Vector3(),
      alive: true, randDir: new THREE.Vector3(), walk: Math.random() * 10,
    });
  }

  update(dt, now) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = ENEMY.spawnEvery; this.spawn(); }
    const player = this.getPlayer();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.burnUntil > now) { e.hp -= e.burnDps * dt; if (e.hp <= 0) { this._kill(e); continue; } }
      const stunned = e.stunUntil > now;
      const lifted = e.liftUntil > now;
      let moving = false;
      if (e.knockVel.lengthSq() > 0.001) {
        e.position.addScaledVector(e.knockVel, dt);
        e.knockVel.multiplyScalar(0.86);
        if (e.knockVel.lengthSq() < 0.01) e.knockVel.set(0, 0, 0);
      } else if (!stunned && !lifted) {
        const toP = player.position.clone().sub(e.position); toP.y = 0;
        const dist = toP.length();
        if (e.blindUntil > now) {
          e.randDir.set((Math.random() * 2 - 1), 0, (Math.random() * 2 - 1)).normalize();
          e.position.addScaledVector(e.randDir, ENEMY.speed * 0.6 * dt);
          e.group.lookAt(e.position.clone().add(e.randDir));
          moving = true;
        } else if (dist > 1.6) {
          toP.normalize();
          e.position.addScaledVector(toP, ENEMY.speed * (1 + (e.tier - 1) * 0.18) * dt);
          e.group.lookAt(player.position.x, e.position.y, player.position.z);
          if (dist < 2.0) this.onPlayerHit(ENEMY.touchDamage * e.tier * dt * 6);
          moving = true;
        }
      }
      if (lifted) e.group.position.y = 4 + Math.sin(now * 6) * 0.5;
      else if (e.group.position.y > 0.01) e.group.position.y = Math.max(0, e.group.position.y - 20 * dt);
      else e.group.position.y = 0;

      const ir = WORLD.islandRadius - 4;
      const er = Math.hypot(e.position.x, e.position.z);
      if (er > ir) { e.position.x *= ir / er; e.position.z *= ir / er; }

      e.group.position.x = e.position.x; e.group.position.z = e.position.z;
      e.walk += dt * (moving ? 10 : 0);
      const swing = moving ? Math.sin(e.walk) * 0.6 : 0;
      if (e.leftLeg) {
        e.leftLeg.rotation.x = swing; e.rightLeg.rotation.x = -swing;
        e.leftArm.rotation.x = -swing * 0.5; e.rightArm.rotation.x = swing * 0.5;
      }
      e.aura.rotation.z += dt * 1.8;
      e.aura.material.opacity = 0.25 + Math.sin(now * 5) * 0.16;
      const hpFrac = Math.max(0, e.hp / e.maxHp);
      e.bar.scale.x = hpFrac; e.bar.position.x = -(1 - hpFrac);
      e.barGroup.getWorldPosition(_look);
      e.barGroup.lookAt(player.position.x, _look.y, player.position.z);
      drawHpLabel(e.hpLabel, e.hp, e.maxHp);
    }
    this._cleanup();
  }

  _kill(e) {
    e.alive = false;
    this.scene.remove(e.group);
    this.onKill(e);
  }
  _cleanup() { this.enemies = this.enemies.filter((e) => e.alive); }

  count() { return this.enemies.filter((e) => e.alive).length; }
  alive() { return this.enemies.filter((e) => e.alive); }

  getNearby(center, radius) {
    return this.alive().filter((e) => e.position.distanceTo(center) <= radius);
  }
  randomNearby(center, radius, n) {
    const near = this.getNearby(center, radius);
    for (let i = near.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [near[i], near[j]] = [near[j], near[i]]; }
    return near.slice(0, n);
  }

  applyArea(center, radius, dmg, opts = {}) {
    let hits = 0;
    for (const e of this.alive()) {
      if (e.position.distanceTo(center) <= radius) { hits++; this.damage(e, dmg, opts); }
    }
    return hits;
  }
  damage(e, dmg, opts = {}) {
    const dealt = (dmg || 0) * (1 + this.getPlayer().damageBonus);
    if (dealt) {
      e.hp -= dealt;
      if (this.fx && dealt >= 6) {
        const y = (e.group.position.y || 0) + 3.3;
        this.fx.popup(e.position.x, y, e.position.z, dealt, dealt > 400 ? 'crit' : 'hit');
      }
    }
    const t = performance.now() / 1000;
    if (opts.stun) e.stunUntil = Math.max(e.stunUntil, t + (opts.stunDur || 2));
    if (opts.lift) e.liftUntil = Math.max(e.liftUntil, t + (opts.liftDur || 1.5));
    if (opts.knock) {
      const k = e.position.clone().sub(opts.knock).normalize().multiplyScalar(opts.knockForce || 18);
      e.knockVel.add(k);
    }
    if (opts.knockDir) e.knockVel.add(opts.knockDir.clone().multiplyScalar(opts.knockForce || 18));
    if (opts.burn) { e.burnDps = Math.max(e.burnDps, opts.burnDps || 25); e.burnUntil = Math.max(e.burnUntil, t + (opts.burnDur || 5)); }
    if (opts.blind) e.blindUntil = Math.max(e.blindUntil, t + (opts.blindDur || 5));
    if (e.hp <= 0) this._kill(e);
  }
  damageAll(dmg, opts = {}) {
    let hits = 0;
    for (const e of this.alive()) { hits++; this.damage(e, dmg, opts); }
    return hits;
  }
  pullTo(center, strength = 60, opts = {}) {
    const now = performance.now() / 1000;
    for (const e of this.alive()) {
      const dir = center.clone().sub(e.position); dir.y = 0;
      const d = dir.length();
      if (d > 0.5) { dir.normalize().multiplyScalar(strength * (1 - d / 200)); e.position.addScaledVector(dir, 0.05); }
      if (opts.lift) e.liftUntil = Math.max(e.liftUntil, now + (opts.liftDur || 0.5));
    }
  }
  healPlayer(amount) { this.onPlayerHit(-amount); }
}

export default EnemyManager;

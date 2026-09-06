// ============================================================
//  Enemy manager — spawning, AI, status effects, area damage.
// ============================================================
import * as THREE from 'three';
import { ENEMY } from './config.js';

export class EnemyManager {
  constructor(scene, getPlayer, onPlayerHit, onKill) {
    this.scene = scene;
    this.getPlayer = getPlayer;       // () => player
    this.onPlayerHit = onPlayerHit;   // (dmg) => void
    this.onKill = onKill;             // (enemy) => void
    this.enemies = [];
    this.spawnTimer = 0;
  }

  spawn() {
    if (this.enemies.length >= ENEMY.maxAlive) return;
    const a = Math.random() * Math.PI * 2;
    const r = 90 + Math.random() * 50;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const hp = ENEMY.maxHp * (0.7 + Math.random() * 0.6);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.3, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a2f3a, roughness: 0.8 }));
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xc24a55, roughness: 0.7 }));
    head.position.y = 2.8; g.add(head);
    // hp bar
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x220000 }));
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
    bar.position.z = 0.01; barBg.position.z = 0;
    const barGroup = new THREE.Group(); barGroup.add(barBg); barGroup.add(bar);
    barGroup.position.y = 3.6; barGroup.rotation.x = -0.4; g.add(barGroup);

    g.position.copy(pos);
    this.scene.add(g);
    this.enemies.push({
      group: g, body, head, bar, barGroup,
      position: pos.clone(), hp, maxHp: hp,
      radius: ENEMY.radius, baseY: 0,
      stunUntil: 0, liftUntil: 0, blindUntil: 0,
      burnDps: 0, burnUntil: 0, knockVel: new THREE.Vector3(),
      alive: true, randDir: new THREE.Vector3(),
    });
  }

  update(dt, now) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = ENEMY.spawnEvery; this.spawn(); }
    const player = this.getPlayer();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // burn dot
      if (e.burnUntil > now) { e.hp -= e.burnDps * dt; if (e.hp <= 0) { this._kill(e); continue; } }
      const stunned = e.stunUntil > now;
      const lifted = e.liftUntil > now;
      // knockback velocity
      if (e.knockVel.lengthSq() > 0.001) {
        e.position.addScaledVector(e.knockVel, dt);
        e.knockVel.multiplyScalar(0.86);
        if (e.knockVel.lengthSq() < 0.01) e.knockVel.set(0, 0, 0);
      } else if (!stunned && !lifted) {
        const toP = player.position.clone().sub(e.position); toP.y = 0;
        const dist = toP.length();
        if (e.blindUntil > now) {
          // blind: wander randomly, can't attack
          e.randDir.set((Math.random() * 2 - 1), 0, (Math.random() * 2 - 1)).normalize();
          e.position.addScaledVector(e.randDir, ENEMY.speed * 0.6 * dt);
          e.group.lookAt(e.position.clone().add(e.randDir));
        } else if (dist > 1.6) {
          toP.normalize();
          e.position.addScaledVector(toP, ENEMY.speed * dt);
          e.group.lookAt(player.position.x, e.position.y, player.position.z);
          // touch damage
          if (dist < 2.0) this.onPlayerHit(ENEMY.touchDamage * dt * 6);
        }
      }
      // lift visual
      if (lifted) { e.group.position.y = 4 + Math.sin(now * 6) * 0.5; }
      else if (e.group.position.y > 0.01) { e.group.position.y = Math.max(0, e.group.position.y - 20 * dt); }
      else e.group.position.y = 0;

      e.group.position.x = e.position.x; e.group.position.z = e.position.z;
      // hp bar
      const hpFrac = Math.max(0, e.hp / e.maxHp);
      e.bar.scale.x = hpFrac; e.bar.position.x = -(1 - hpFrac);
      e.barGroup.lookAt(player.position.x, e.barGroup.position.y + e.position.y, player.position.z);
    }
    this._cleanup();
  }

  _kill(e) {
    e.alive = false;
    this.scene.remove(e.group);
    this.onKill(e);
  }
  _cleanup() {
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  count() { return this.enemies.filter((e) => e.alive).length; }
  alive() { return this.enemies.filter((e) => e.alive); }

  getNearby(center, radius) {
    return this.alive().filter((e) => e.position.distanceTo(center) <= radius);
  }
  randomNearby(center, radius, n) {
    const near = this.getNearby(center, radius);
    // shuffle
    for (let i = near.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [near[i], near[j]] = [near[j], near[i]]; }
    return near.slice(0, n);
  }

  // apply damage + statuses in a radius
  applyArea(center, radius, dmg, opts = {}) {
    const now = performance.now() / 1000;
    let hits = 0;
    for (const e of this.alive()) {
      if (e.position.distanceTo(center) <= radius) {
        hits++;
        this.damage(e, dmg, opts);
      }
    }
    return hits;
  }
  damage(e, dmg, opts = {}) {
    if (dmg) e.hp -= dmg;
    if (opts.stun) e.stunUntil = Math.max(e.stunUntil, performance.now() / 1000 + (opts.stunDur || 2));
    if (opts.lift) e.liftUntil = Math.max(e.liftUntil, performance.now() / 1000 + (opts.liftDur || 1.5));
    if (opts.knock) {
      const k = e.position.clone().sub(opts.knock).normalize().multiplyScalar(opts.knockForce || 18);
      e.knockVel.add(k);
    }
    if (opts.knockDir) e.knockVel.add(opts.knockDir.clone().multiplyScalar(opts.knockForce || 18));
    if (opts.burn) { e.burnDps = Math.max(e.burnDps, opts.burnDps || 25); e.burnUntil = Math.max(e.burnUntil, performance.now() / 1000 + (opts.burnDur || 5)); }
    if (opts.blind) e.blindUntil = Math.max(e.blindUntil, performance.now() / 1000 + (opts.blindDur || 5));
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

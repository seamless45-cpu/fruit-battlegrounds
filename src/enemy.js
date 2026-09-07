// ============================================================
//  Enemy manager — island homes, bosses, elites, HP pops.
// ============================================================
import * as THREE from 'three';
import { ENEMY, WORLD } from './config.js';
import { createEnemyModel, drawHpLabel } from './models.js';

const _look = new THREE.Vector3();

export class EnemyManager {
  constructor(scene, getPlayer, onPlayerHit, onKill, fx, world) {
    this.scene = scene;
    this.getPlayer = getPlayer;
    this.onPlayerHit = onPlayerHit;
    this.onKill = onKill;
    this.fx = fx;
    this.world = world || null;
    this.enemies = [];
    this.spawnTimer = 0.4;
    this.bossTimer = 10;
    this.eliteTimer = 24;
    this.seeded = false;
  }

  homes() {
    if (this.world && this.world.islandCenters && this.world.islandCenters.length) {
      return this.world.islandCenters;
    }
    return [{ id: 'arena', name: 'Grand Arena', x: 0, z: 0, r: WORLD.islandRadius, faction: 'pirate', boss: 'Captain Rook', elite: 'Warlord Ember' }];
  }

  pickHome() {
    const homes = this.homes();
    let best = homes[0], bestN = 1e9;
    for (const h of homes) {
      const n = this.enemies.filter((e) => e.alive && e.home && e.home.id === h.id).length;
      if (n < bestN) { bestN = n; best = h; }
    }
    return best;
  }

  seed() {
    if (this.seeded) return;
    this.seeded = true;
    for (const home of this.homes()) {
      const n = home.id === 'arena' ? 5 : 3;
      for (let i = 0; i < n; i++) this.spawn({ home, force: true });
      if (home.boss) this.spawn({ home, kind: 'boss', name: home.boss, force: true, hpMult: 8, tier: 3 });
    }
  }

  spawn(opts = {}) {
    if (!opts.force && this.enemies.length >= ENEMY.maxAlive) return;
    const home = opts.home || this.pickHome();
    const kind = opts.kind || 'grunt';
    const elite = kind === 'elite';
    const boss = kind === 'boss' || elite;
    const faction = opts.faction || home.faction || 'pirate';
    if (faction === 'neutral') {
      // arena mixes both
    }
    const side = faction === 'marine' ? 'marine' : faction === 'pirate' ? 'pirate' : (Math.random() < 0.5 ? 'pirate' : 'marine');
    const a = Math.random() * Math.PI * 2;
    const r = (home.r * 0.18) + Math.random() * (home.r * 0.68);
    const pos = new THREE.Vector3(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r);
    let tier = opts.tier || (boss ? 3 : r / Math.max(1, home.r) > 0.7 ? 3 : r / Math.max(1, home.r) > 0.42 ? 2 : 1);
    if (elite) tier = 4;
    const hp = ENEMY.maxHp * (opts.hpMult || (elite ? 14 : boss ? 8 : tier)) * (0.75 + Math.random() * 0.5);
    const rig = createEnemyModel(Math.min(3, tier), { faction: side, elite, boss });
    const scale = elite ? 2.05 : boss ? 1.55 : 1;
    rig.group.scale.setScalar(scale);
    rig.group.position.copy(pos);
    this.scene.add(rig.group);
    drawHpLabel(rig.hp, hp, hp);
    this.enemies.push({
      group: rig.group, body: rig.body, head: rig.head, bar: rig.bar, barGroup: rig.barGroup, aura: rig.aura,
      leftArm: rig.leftArm, rightArm: rig.rightArm, leftLeg: rig.leftLeg, rightLeg: rig.rightLeg,
      hpLabel: rig.hp,
      position: pos.clone(), hp, maxHp: hp,
      radius: ENEMY.radius * scale, tier, baseY: 0,
      stunUntil: 0, liftUntil: 0, blindUntil: 0,
      burnDps: 0, burnUntil: 0, knockVel: new THREE.Vector3(),
      alive: true, randDir: new THREE.Vector3(), walk: Math.random() * 10,
      animAttack: 0, animHurt: 0, dying: 0,
      home, kind, faction: side, name: opts.name || null, wander: Math.random() * 2,
    });
  }

  _clampHome(e) {
    const h = e.home;
    if (!h) {
      const ir = WORLD.islandRadius - 4;
      const er = Math.hypot(e.position.x, e.position.z);
      if (er > ir) { e.position.x *= ir / er; e.position.z *= ir / er; }
      return;
    }
    const dx = e.position.x - h.x, dz = e.position.z - h.z;
    const er = Math.hypot(dx, dz);
    const ir = Math.max(3.2, h.r - 2.2);
    if (er > ir) {
      e.position.x = h.x + dx * ir / er;
      e.position.z = h.z + dz * ir / er;
    }
  }

  update(dt, now) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = ENEMY.spawnEvery; this.spawn(); }
    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = 32;
      const homes = this.homes().filter((h) => h.boss);
      const h = homes[(Math.random() * homes.length) | 0];
      if (h && !this.enemies.some((e) => e.alive && e.kind === 'boss' && e.home && e.home.id === h.id)) {
        this.spawn({ home: h, kind: 'boss', name: h.boss, force: true, hpMult: 8, tier: 3 });
      }
    }
    this.eliteTimer -= dt;
    if (this.eliteTimer <= 0) {
      this.eliteTimer = 58;
      const homes = this.homes().filter((h) => h.elite);
      const h = homes[(Math.random() * homes.length) | 0];
      if (h && !this.enemies.some((e) => e.alive && e.kind === 'elite')) {
        this.spawn({ home: h, kind: 'elite', name: h.elite, force: true, hpMult: 14, tier: 4 });
      }
    }
    const player = this.getPlayer();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.dying > 0) {
        e.dying -= dt;
        const k = 1 - Math.max(0, e.dying) / 0.55;
        e.group.rotation.x = k * 1.25;
        e.group.position.y = Math.sin(k * Math.PI) * 0.4;
        if (e.aura) e.aura.material.opacity = Math.max(0, 0.4 * (1 - k));
        if (e.dying <= 0) this._finishKill(e);
        continue;
      }
      e.animAttack = Math.max(0, e.animAttack - dt);
      e.animHurt = Math.max(0, e.animHurt - dt);
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
        const aggroR = e.kind === 'elite' ? 95 : e.kind === 'boss' ? 72 : 46;
        if (e.blindUntil > now) {
          e.randDir.set((Math.random() * 2 - 1), 0, (Math.random() * 2 - 1)).normalize();
          e.position.addScaledVector(e.randDir, ENEMY.speed * 0.6 * dt);
          e.group.lookAt(e.position.clone().add(e.randDir));
          moving = true;
        } else if (dist < aggroR && dist > 1.6) {
          toP.normalize();
          const spd = ENEMY.speed * (1 + (Math.min(3, e.tier) - 1) * 0.18) * (e.kind === 'elite' ? 1.15 : 1);
          e.position.addScaledVector(toP, spd * dt);
          e.group.lookAt(player.position.x, e.position.y, player.position.z);
          if (dist < 2.4 * (e.kind === 'elite' ? 1.4 : e.kind === 'boss' ? 1.25 : 1)) {
            e.animAttack = 0.28;
            const touch = ENEMY.touchDamage * Math.min(4, e.tier) * dt * 6 * (e.kind === 'elite' ? 1.8 : e.kind === 'boss' ? 1.4 : 1);
            this.onPlayerHit(touch);
          }
          moving = true;
        } else if (dist >= aggroR) {
          e.wander = (e.wander || 0) - dt;
          if (e.wander <= 0) {
            e.wander = 1.4 + Math.random() * 2.2;
            const a = Math.random() * Math.PI * 2;
            e.randDir.set(Math.cos(a), 0, Math.sin(a));
          }
          e.position.addScaledVector(e.randDir, ENEMY.speed * 0.42 * dt);
          e.group.lookAt(e.position.x + e.randDir.x, e.position.y, e.position.z + e.randDir.z);
          moving = true;
        }
      }
      if (lifted) e.group.position.y = 4 + Math.sin(now * 6) * 0.5;
      else if (e.group.position.y > 0.01) e.group.position.y = Math.max(0, e.group.position.y - 20 * dt);
      else e.group.position.y = 0;

      this._clampHome(e);

      e.group.position.x = e.position.x; e.group.position.z = e.position.z;
      e.walk += dt * (moving ? 12 : 0);
      const swing = moving ? Math.sin(e.walk) * 0.75 : 0;
      const atk = e.animAttack > 0 ? Math.sin((1 - e.animAttack / 0.28) * Math.PI) : 0;
      const ht = e.animHurt > 0 ? Math.sin((1 - e.animHurt / 0.22) * Math.PI) : 0;
      if (e.leftLeg) {
        e.leftLeg.rotation.x = swing; e.rightLeg.rotation.x = -swing;
        e.leftArm.rotation.x = -swing * 0.55 - ht * 0.4;
        e.rightArm.rotation.x = swing * 0.55 + atk * 1.4;
        e.rightArm.rotation.z = -atk * 0.5;
      }
      if (e.head) e.head.rotation.x = -ht * 0.4;
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
    if (e.dying) return;
    e.dying = 0.55;
  }
  _finishKill(e) {
    if (!e.alive) return;
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
    if (e.dying) return;
    const dealt = (dmg || 0) * (1 + this.getPlayer().damageBonus);
    if (dealt) {
      e.hp -= dealt;
      e.animHurt = 0.22;
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

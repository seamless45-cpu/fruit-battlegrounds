// ============================================================
//  Skills — all fruit & sword abilities.
//  ctx (game) provides: fx, player, enemies, aimPoint(),
//  enemyPct(p), after(sec,fn), tokens, upgrades, shade(hex,sec)
// ============================================================
import * as THREE from 'three';
import { ENEMY } from './config.js';

const PURPLE = 0x9b30ff;
const BLUE = 0x39c0ff;
const QUAKE = 0x39c0ff;

const rand = (a, b) => a + Math.random() * (b - a);
const DMG = (pct) => ENEMY.maxHp * pct;
const V = (x, z) => new THREE.Vector3(x, 0, z);
const ground = (v) => V(v.x, v.z);

// random point near a center within radius
function nearPoint(center, radius) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return V(center.x + Math.cos(a) * r, center.z + Math.sin(a) * r);
}
function randomArena() {
  const a = Math.random() * Math.PI * 2, r = Math.random() * 120;
  return V(Math.cos(a) * r, Math.sin(a) * r);
}

// ------------------------------------------------------------
//  ACTIVE SKILLS
// ------------------------------------------------------------
const handlers = {
  // ================= GRAVITY FRUIT =================
  g_asteroid(game, aim) {
    const { fx, enemies, player } = game;
    fx.asteroid({
      x: aim.x, z: aim.z, radius: 25, color: 0x6b4a8a, explosionColor: PURPLE, fallTime: 1.0,
      onImpact: (x, z, r) => {
        enemies.applyArea(V(x, z), r, DMG(0.6), { stun: true, stunDur: 1.2 });
        fx.firepit({ x, z, radius: r, duration: 10, dps: DMG(0.03), color: 0xff5a1e },
          (px, pz, pr, d) => enemies.applyArea(V(px, pz), pr, d, {}));
      }
    });
  },

  g_pressure(game) {
    const { fx, enemies, player } = game;
    const center = player.position.clone();
    const n = enemies.count();
    const bonus = Math.min(0.6, n * 0.02);
    const radius = 14 * (1 + bonus);
    const dmg = DMG(0.5) * (1 + bonus);
    let t = 0;
    fx.add({ update: (dt) => { t += dt; enemies.pullTo(center, 90, { lift: true, liftDur: 0.3 }); return t < 0.95; }, dispose() {} });
    game.after(1.0, () => {
      fx.pillar({ x: center.x, z: center.z, height: 30, color: PURPLE, duration: 1.2, rings: 6 });
      fx.explosion({ x: center.x, z: center.z, radius, color: PURPLE, life: 0.9, debris: 18, intensity: 1.5 });
      enemies.applyArea(center, radius, dmg, { stun: true, stunDur: 1.6 });
      fx.shake(0.85, radius * 0.05);
    });
  },

  g_lightning(game) {
    const { fx, enemies, player } = game;
    const p = player.position;
    fx.pillar({ x: p.x, z: p.z, height: 42, color: PURPLE, duration: 2.4, rings: 9 });
    for (let i = 0; i < 8; i++) {
      game.after(i * 0.25, () => {
        const near = enemies.randomNearby(p, 17, 3);
        const target = near.length ? near[(Math.random() * near.length) | 0].position : nearPoint(p, 17);
        fx.bolt({ x: target.x, z: target.z, height: 34, color: PURPLE, life: 0.3, branches: 2 });
        enemies.applyArea(V(target.x, target.z), 6, DMG(0.22), { stun: true, stunDur: 0.6 });
        if (Math.random() < 0.12) {
          const m = 1 + ((Math.random() * 5) | 0);
          for (let k = 0; k < m; k++) game.after(Math.random() * 0.4, () => {
            const rp = nearPoint(p, 12);
            fx.meteor({ x: rp.x, z: rp.z, radius: 5, explosionColor: PURPLE, fallTime: 0.5,
              onImpact: (x, z, r) => enemies.applyArea(V(x, z), r, DMG(0.15), {}) });
          });
        }
      });
    }
  },

  g_hiauna(game) {
    const { fx, enemies, player } = game;
    const near = enemies.getNearby(player.position, 29);
    if (near.length) {
      near.forEach((e, i) => game.after(i * 0.2, () => {
        fx.rockRise({
          x: e.position.x, z: e.position.z, radius: 8, rise: 1.5,
          onSlam: (x, z, r) => {
            fx.explosion({ x, z, radius: 22, color: PURPLE, life: 0.8, debris: 12, intensity: 1.4 });
            enemies.applyArea(V(x, z), 22, DMG(0.7), { stun: true, stunDur: 1.5 });
            fx.shake(0.7, 2.2);
          }
        });
      }));
    } else {
      for (let i = 0; i < 4; i++) game.after(i * 0.5, () => {
        fx.bolt({ x: player.position.x, z: player.position.z, height: 44, color: PURPLE, life: 0.3 });
        enemies.healPlayer(DMG(0.08));
      });
    }
  },

  g_rain(game) {
    const { fx, enemies } = game;
    for (let i = 0; i < 8; i++) game.after(i * 0.3, () => {
      const rp = randomArena();
      fx.asteroid({
        x: rp.x, z: rp.z, radius: 25, color: 0x6b4a8a, explosionColor: PURPLE, fallTime: 0.9,
        onImpact: (x, z, r) => {
          enemies.applyArea(V(x, z), r, DMG(0.6), { stun: true, stunDur: 1.2 });
          fx.firepit({ x, z, radius: r, duration: 10, dps: DMG(0.05), color: 0xff5a1e },
            (px, pz, pr, d) => enemies.applyArea(V(px, pz), pr, d, {}));
        }
      });
    });
  },

  g_punch(game) {
    const { fx, enemies, player } = game;
    const center = player.position.clone();
    enemies.pullTo(center, 140, { lift: true, liftDur: 0.45 });
    game.after(0.5, () => {
      fx.shakeFor(0.7, 1.3, 4.0); // intense positional shake
      fx.explosion({ x: center.x, z: center.z, radius: 12, color: PURPLE, life: 0.7, debris: 14, intensity: 1.6 });
      enemies.getNearby(center, 12).forEach((e) => {
        for (let i = 0; i < 4; i++) game.after(i * 0.5, () => {
          fx.bolt({ x: e.position.x, z: e.position.z, height: 26, color: PURPLE, life: 0.28 });
        });
        enemies.damage(e, DMG(0.3), { knockDir: e.position.clone().sub(center), knockForce: 22, stun: true, stunDur: 1 });
      });
    });
  },

  // ================= LIGHTNING FRUIT =================
  l_bestia(game, aim) {
    const { fx, enemies, player } = game;
    const from = player.position.clone();
    // auto-aim nearest enemy in front, else aim point
    const near = enemies.randomNearby(player.position, 200, 1);
    const to = near.length ? near[0].position.clone() : aim.clone();
    to.y = 1.5; from.y = 1.5;
    const beast = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.4, 8),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    beast.position.copy(from); beast.lookAt(to); game.scene.add(beast);
    const dir = to.clone().sub(from).normalize();
    let t = 0; const speed = 20;
    fx.add({
      update: (dt) => {
        t += dt; beast.position.addScaledVector(dir, speed * dt); beast.rotation.z += dt * 10;
        // hit?
        const hit = enemies.alive().find((e) => e.position.distanceTo(beast.position) < 2.5);
        if (hit || beast.position.distanceTo(to) < 1.5 || t > 8) {
          fx.explosion({ x: beast.position.x, z: beast.position.z, radius: 3, color: BLUE, life: 0.5, debris: 4 });
          enemies.applyArea(beast.position, 3, DMG(0.35), { stun: true, stunDur: 0.8 });
          game.scene.remove(beast); return false;
        }
        return true;
      }, dispose() {}
    });
  },

  l_tormenta(game, aim) {
    const { fx, enemies } = game;
    const c = aim.clone();
    for (let i = 0; i < 17; i++) game.after(i * 0.22, () => {
      const rp = nearPoint(c, 14);
      fx.bolt({ x: rp.x, z: rp.z, height: 30, color: BLUE, life: 0.26, branches: 1 });
      enemies.applyArea(V(rp.x, rp.z), 4.5, DMG(0.18), { stun: true, stunDur: 0.5 });
    });
  },

  l_juicio(game, aim) {
    const { fx, enemies } = game;
    const c = aim.clone();
    let i = 0, t = 0;
    fx.add({
      update: (dt) => {
        t += dt; i += dt * 14;
        if (i >= 1) {
          i = 0;
          const rp = nearPoint(c, 5);
          fx.bolt({ x: rp.x, z: rp.z, height: 40, color: BLUE, life: 0.3, branches: 2 });
          enemies.applyArea(V(rp.x, rp.z), 7, DMG(0.3), { stun: true, stunDur: 3, lift: true, liftDur: 1.2 });
        }
        return t < 2.5;
      }, dispose() {}
    });
  },

  l_destru(game, aim, chargeT = 1) {
    const { fx, enemies } = game;
    const c = aim.clone();
    const maxGain = Math.min(1.2, chargeT / 0.05 * 0.03); // up to +120%
    const expR = 8 + maxGain * 60;
    fx.explosion({ x: c.x, z: c.z, radius: expR, color: 0x111122, life: 0.5, debris: 8 });
    // expanding continuous explosion
    let r = 2, t = 0;
    fx.add({
      update: (dt) => {
        t += dt; r = Math.min(90, r + 15 * dt);
        if (t % 0.15 < dt) {
          fx.explosion({ x: c.x, z: c.z, radius: r, color: BLUE, life: 0.4, debris: 0, intensity: 1.2 });
          enemies.applyArea(V(c.x, c.z), r, DMG(0.12), { stun: true, stunDur: 1 });
        }
        return t < 5;
      }, dispose() {}
    });
    fx.shake(0.8, 3);
  },

  l_destello(game, aim) {
    const { fx, enemies, player } = game;
    if ((game.dashCharges || 0) <= 0) return false;
    game.dashCharges = (game.dashCharges || 3) - 1;
    const dir = aim.clone().sub(player.position); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    dir.normalize();
    const dist = 10;
    let moved = 0;
    fx.add({
      update: (dt) => {
        const s = Math.min(240 * dt, dist - moved);
        moved += s;
        player.position.addScaledVector(dir, s);
        enemies.alive().forEach((e) => {
          if (e.position.distanceTo(player.position) < 2.6) enemies.damage(e, DMG(0.4), { knockDir: dir, knockForce: 16 });
        });
        fx.boltLine(player.position.x, player.position.z, 6, BLUE, 0.12);
        return moved < dist;
      }, dispose() {}
    });
  },

  l_masalla(game, aim) {
    const { fx, enemies, player } = game;
    const c = aim.clone();
    for (let i = 0; i < 120; i++) game.after(i * 0.1, () => {
      const rp = randomArena();
      fx.bolt({ x: rp.x, z: rp.z, height: 36, color: BLUE, life: 0.22, branches: 1 });
      enemies.applyArea(V(rp.x, rp.z), 16, DMG(0.1), { stun: true, stunDur: 3 });
    });
    void c;
  },

  // ================= QUAKE FRUIT =================
  q_fatal(game, aim) {
    const { fx, enemies, player, shade } = game;
    const near = enemies.getNearby(player.position, 18);
    if (!near.length) return;
    const target = near[0];
    // screen turns red
    shade(0xff0000, 1.0, true);
    let t = 0;
    fx.add({
      update: (dt) => { t += dt; enemies.pullTo(target.position.clone(), 30); return t < 0.9; }, dispose() {}
    });
    game.after(1.0, () => {
      fx.explosion({ x: target.position.x, z: target.position.z, radius: 16, color: 0xff3355, life: 0.9, debris: 16, intensity: 1.8 });
      fx.shockwave({ x: target.position.x, z: target.position.z, radius: 18, color: 0xffffff, duration: 0.8, debrisCount: 10 });
      enemies.applyArea(V(target.position.x, target.position.z), 18, DMG(0.8), { knockDir: target.position.clone().sub(player.position), knockForce: 40, stun: true, stunDur: 2 });
      fx.shake(1.0, 3.5);
    });
  },

  q_air(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aim.clone().sub(player.position); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    dir.normalize();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12),
      new THREE.MeshStandardMaterial({ color: QUAKE, emissive: 0x114a88, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
    orb.position.copy(player.position); orb.position.y = 1.5; game.scene.add(orb);
    let d = 0;
    fx.add({
      update: (dt) => {
        d += 40 * dt; orb.position.addScaledVector(dir, 40 * dt);
        orb.rotation.y += dt * 6;
        const hit = enemies.alive().find((e) => e.position.distanceTo(orb.position) < 2.5);
        if (hit || d > 120) {
          fx.explosion({ x: orb.position.x, z: orb.position.z, radius: 8, color: QUAKE, life: 0.6, debris: 6 });
          fx.shockwave({ x: orb.position.x, z: orb.position.z, radius: 8, color: 0xffffff, duration: 0.6, debrisCount: 6 });
          enemies.applyArea(orb.position, 8, DMG(0.4), { stun: true, stunDur: 2 });
          game.scene.remove(orb); return false;
        }
        return true;
      }, dispose() {}
    });
  },

  q_spatial(game) {
    const { fx, enemies, player } = game;
    const c = player.position.clone();
    fx.shockwave({ x: c.x, z: c.z, radius: 22, color: 0xffffff, duration: 1.0, debrisCount: 16 });
    // debris at arms
    fx.debris(c.x + 2, c.z, 4, 0xcfe8ff, 4);
    fx.debris(c.x - 2, c.z, 4, 0xcfe8ff, 4);
    enemies.applyArea(c, 22, DMG(0.5), { stun: true, stunDur: 5, knockDir: new THREE.Vector3(1, 0, 0), knockForce: 18 });
    enemies.alive().forEach((e) => { const k = e.position.clone().sub(c).setY(0).normalize().multiplyScalar(18); e.knockVel.add(k); });
    fx.shake(0.9, 3);
  },

  q_sea(game) {
    const { fx, enemies, player } = game;
    const c = player.position.clone();
    for (let i = 0; i < 3; i++) game.after(i * 0.25, () => {
      fx.shockwave({ x: c.x, z: c.z, radius: 20 + i * 8, color: 0xffffff, duration: 0.7, debrisCount: 8 });
      enemies.applyArea(c, 20 + i * 8, DMG(0.15), {});
    });
    const eight = Math.random() < 0.1;
    const sides = eight ? 8 : 4;
    const dmgEach = eight ? 0.125 : 0.25;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      fx.tsunami({ x: c.x, z: c.z, dir, distance: 260, speed: 70, height: 12, width: 60, damage: DMG(dmgEach),
        onPass: (x, z) => enemies.applyArea(V(x, z), 8, DMG(dmgEach * 0.5), { knockDir: dir, knockForce: 14 }) });
    }
    fx.shake(0.7, 2.5);
  },

  // ================= GRAVITY BLADE =================
  gb_super(game, aim) {
    const { fx, enemies, player } = game;
    const up = game.upgrades.gb_super;
    const maxCharge = up.charge >= 1;
    const weak = up.charge <= 0;
    // sword glow 1s
    game.swordGlow = 1.0;
    game.after(1.0, () => {
      const big = maxCharge && Math.random() < 0.30;
      const mult = big ? 20 : 1;
      const dmg = DMG(weak ? 0.4 : 0.9) * mult;
      const range = weak ? 30 : 70;
      fx.bolt({ x: player.position.x, z: player.position.z, height: 90, color: PURPLE, life: 0.6, branches: 4, thickness: 0.6 });
      enemies.getNearby(player.position, range).forEach((e) => {
        enemies.damage(e, dmg, { blind: true, blindDur: 10, stun: true, stunDur: 1 });
      });
      fx.shakeFor(range / 12, range / 70 * 0.6, Math.min(5, range / 14));
      up.charge = Math.max(0, up.charge - 0.1);
    });
  },

  gb_343(game) {
    const { fx, enemies } = game;
    let i = 0;
    const id = setInterval(() => {
      if (i++ > 60) { clearInterval(id); return; }
      const rp = randomArena();
      fx.meteor({ x: rp.x, z: rp.z, radius: 4, explosionColor: PURPLE, fallTime: 0.5,
        onImpact: (x, z, r) => enemies.applyArea(V(x, z), r, DMG(0.1), {}) });
    }, 60);
  },

  gb_pilmae(game) {
    const { fx, enemies, player } = game;
    const follow = player.position.clone();
    const rocks = [];
    for (let i = 0; i < 72; i++) {
      const rp = nearPoint(follow, 22);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0),
        new THREE.MeshStandardMaterial({ color: 0x9a9aa6, roughness: 1, flatShading: true }));
      rock.position.set(rp.x, -2, rp.z); game.scene.add(rock); rocks.push(rock);
    }
    let t = 0, slamIdx = 0;
    fx.add({
      update: (dt) => {
        t += dt;
        if (t < 1.2) {
          rocks.forEach((r, i) => { const k = Math.min(1, (t) / 1.2); r.position.y = -2 + k * 4 + (i % 3); });
          return true;
        }
        // slam one by one 0.06s
        if (slamIdx < rocks.length) {
          const r = rocks[slamIdx];
          if (!r._done) {
            r._done = true;
            fx.explosion({ x: r.position.x, z: r.position.z, radius: 8, color: PURPLE, life: 0.5, debris: 4 });
            enemies.applyArea(V(r.position.x, r.position.z), 8, DMG(0.25), { stun: true, stunDur: 1 });
          }
          slamIdx += 1;
          return true;
        }
        rocks.forEach((r) => game.scene.remove(r));
        return false;
      }, dispose() {}
    });
  },

  gb_death(game) {
    const { fx, enemies, player } = game;
    const up = game.upgrades.gb_death;
    const lvl = up.level;
    const bigChance = [0.15, 0.21, 0.30, 0.48, 0.72][Math.min(4, lvl - 1)];
    const burnDmg = DMG(0.27);
    const near = enemies.alive().slice();
    for (let s = 0; s < 20; s++) {
      game.after(s * 0.06, () => {
        // pick a random alive enemy not yet targeted this volley-ish
        const alive = enemies.alive();
        if (!alive.length) return;
        const target = alive[(Math.random() * alive.length) | 0];
        const from = player.position.clone(); from.y = 1.6;
        const big = Math.random() < bigChance;
        const slash = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 6, 16, Math.PI),
          new THREE.MeshBasicMaterial({ color: PURPLE, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        slash.position.copy(from); game.scene.add(slash);
        const speed = big ? 372 : 186;
        const dir = target.position.clone().sub(from).normalize();
        let d = 0; const maxD = from.distanceTo(target.position) + 6;
        fx.add({
          update: (dt) => {
            d += speed * dt; slash.position.addScaledVector(dir, speed * dt); slash.rotation.z += dt * 20;
            if (d >= maxD || slash.position.distanceTo(target.position) < 2) {
              const radius = big ? 25 * 25 : 8; // 2500% bigger
              fx.explosion({ x: target.position.x, z: target.position.z, radius: big ? 25 : 7, color: PURPLE, life: big ? 0.9 : 0.5, debris: big ? 16 : 5, intensity: big ? 2 : 1 });
              fx.bolt({ x: target.position.x, z: target.position.z, height: 24, color: PURPLE, life: 0.25 });
              enemies.applyArea(V(target.position.x, target.position.z), big ? 30 : 8, DMG(0.5) * (big ? 25 : 1),
                { stun: true, stunDur: 1, burn: true, burnDps: burnDmg * 2, burnDur: 10 });
              if (big) fx.shake(0.9, 5); // 200% more intense (base 2.5)
              game.scene.remove(slash); return false;
            }
            return true;
          }, dispose() {}
        });
      });
    }
  },

  // ================= POLE =================
  p_asalto(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aim.clone().sub(player.position); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    dir.normalize();
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    cloud.position.copy(player.position).addScaledVector(dir, 12); cloud.position.y = 2; game.scene.add(cloud);
    game.after(1.0, () => {
      fx.explosion({ x: cloud.position.x, z: cloud.position.z, radius: 2, color: BLUE, life: 0.5, debris: 3 });
      enemies.applyArea(V(cloud.position.x, cloud.position.z), 2, DMG(0.3), { stun: true, stunDur: 1 });
      game.scene.remove(cloud);
    });
  },

  // ================= BISENTO =================
  bi_slam(game) {
    const { fx, enemies, player } = game;
    const c = player.position.clone();
    fx.shockwave({ x: c.x, z: c.z, radius: 18, color: 0xffffff, duration: 0.9, debrisCount: 14 });
    enemies.alive().forEach((e) => { const k = e.position.clone().sub(c).setY(0).normalize().multiplyScalar(22); e.knockVel.add(k); });
    enemies.applyArea(c, 18, DMG(0.5), { stun: true, stunDur: 2.5 });
    fx.shake(0.8, 2.5);
  },

  bi_ball(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aim.clone().sub(player.position); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    dir.normalize();
    for (let i = 0; i < 3; i++) game.after(i * 0.12, () => {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10),
        new THREE.MeshStandardMaterial({ color: QUAKE, emissive: 0x114a88, emissiveIntensity: 0.9 }));
      orb.position.copy(player.position); orb.position.y = 1.5; game.scene.add(orb);
      let d = 0; const odir = dir.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))).normalize();
      fx.add({
        update: (dt) => {
          d += 45 * dt; orb.position.addScaledVector(odir, 45 * dt);
          const hit = enemies.alive().find((e) => e.position.distanceTo(orb.position) < 2.2);
          if (hit || d > 100) {
            fx.explosion({ x: orb.position.x, z: orb.position.z, radius: 6, color: QUAKE, life: 0.5, debris: 5 });
            enemies.applyArea(orb.position, 6, DMG(0.3), { stun: true, stunDur: 1.5 });
            game.scene.remove(orb); return false;
          }
          return true;
        }, dispose() {}
      });
    });
  },

  bi_mini(game) {
    const { fx, enemies, player } = game;
    const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
    dirs.forEach((dir) => {
      fx.tsunami({ x: player.position.x - dir.x * 60, z: player.position.z - dir.z * 60, dir, distance: 120, speed: 55, height: 8, width: 40, damage: DMG(0.2),
        onPass: (x, z) => enemies.applyArea(V(x, z), 7, DMG(0.2 * 0.5), { knockDir: dir, knockForce: 12 }) });
    });
    fx.shake(0.5, 1.5);
  },
};

// ------------------------------------------------------------
//  M1 BASIC ATTACKS (slash combos)
// ------------------------------------------------------------
export function castM1(game, weaponId) {
  const { fx, enemies, player } = game;
  const isBlade = weaponId === 'gravityblade';
  game.m1Combo = (game.m1Combo || 0) + 1;
  if (game.m1Combo > 6) game.m1Combo = 1;
  // slash visual
  const slash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.5),
    new THREE.MeshBasicMaterial({ color: isBlade ? PURPLE : BLUE, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  slash.position.copy(player.position); slash.position.y = 1.8;
  slash.rotation.y = player.facing;
  slash.position.add(new THREE.Vector3(Math.sin(player.facing) * 2, 0, Math.cos(player.facing) * 2));
  game.scene.add(slash);
  let t = 0;
  fx.add({ update: (dt) => { t += dt; slash.material.opacity = 0.8 * (1 - t / 0.15); slash.scale.x = 1 + t * 4; return t < 0.15; }, dispose: () => game.scene.remove(slash) });

  // hit enemies in front
  const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  enemies.alive().forEach((e) => {
    const to = e.position.clone().sub(player.position).setY(0); const d = to.length();
    if (d < 5 && to.normalize().dot(fwd) > 0.4) enemies.damage(e, DMG(0.18), {});
  });

  if (isBlade) {
    if (game.m1Combo % 4 === 0) {
      const n = 1 + ((Math.random() * 12) | 0);
      for (let i = 0; i < n; i++) game.after(Math.random() * 0.2, () => {
        const rp = nearPoint(player.position, 6);
        fx.bolt({ x: rp.x, z: rp.z, height: 16, color: PURPLE, life: 0.2, branches: 1 });
        enemies.applyArea(V(rp.x, rp.z), 4, DMG(0.12), {});
      });
    }
    game.endLag = 0.4;
  } else {
    // pole: combo 4 -> small bolt
    if (game.m1Combo === 4) {
      fx.bolt({ x: player.position.x + fwd.x * 4, z: player.position.z + fwd.z * 4, height: 18, color: BLUE, life: 0.22 });
      enemies.applyArea(V(player.position.x + fwd.x * 4, player.position.z + fwd.z * 4), 4, DMG(0.15), {});
    }
    game.endLag = 0;
  }
}

// ------------------------------------------------------------
//  CONTINUOUS / CHARGE SKILLS (hold keys)
// ------------------------------------------------------------
export function tickHeld(game, id, dt, heldT) {
  const { fx, enemies, player } = game;
  if (id === 'p_juicio') {
    // continuous lightning at cursor, drags enemies, +radius/s, -1% hp/s
    const c = game.aimPoint();
    const mult = 1 + Math.min(0.5, heldT * 0.05);
    const radius = 8 * mult;
    fx.bolt({ x: c.x, z: c.z, height: 42, color: BLUE, life: 0.18, branches: 2 });
    enemies.applyArea(c, radius, DMG(0.06), { stun: true, stunDur: 0.4 });
    enemies.pullTo(c, 60);
    player.hp = Math.max(player.maxHp * 0.5, player.hp - player.maxHp * 0.01 * dt);
    game._juicioRadius = radius;
  } else if (id === 'l_destru') {
    // grow a black ball above the cursor while charging
    if (!game._ball) {
      game._ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x05050a }));
      const c = game.aimPoint(); game._ball.position.set(c.x, 30, c.z); game.scene.add(game._ball);
      game._prevAim = c.clone();
    }
    const c = game.aimPoint(); game._ball.position.x = c.x; game._ball.position.z = c.z;
    const s = Math.min(120, heldT / 0.05 * 3) / 100 * 6 + 1;
    game._ball.scale.setScalar(s);
  }
}
export function releaseHeld(game, id) {
  const { fx, enemies, player } = game;
  if (id === 'l_destru') {
    const heldT = game.chargeT || 1;
    const c = game._prevAim ? game._prevAim.clone() : game.aimPoint();
    if (game._ball) { game.scene.remove(game._ball); game._ball = null; }
    handlers.l_destru(game, c, heldT);
  }
}

// ------------------------------------------------------------
//  CAST dispatcher
// ------------------------------------------------------------
export function castSkill(game, id, aim) {
  const h = handlers[id];
  if (h) { try { return h(game, aim); } catch (e) { console.warn('skill error', id, e); } }
  return true;
}

// skill ids that use hold-to-activate
export const HOLD_SKILLS = new Set(['p_juicio', 'l_destru']);

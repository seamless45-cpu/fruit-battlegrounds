// ============================================================
//  Skills — all fruit & sword abilities.
//  ctx (game) provides: fx, player, enemies, aimPoint(),
//  enemyPct(p), after(sec,fn), tokens, upgrades, shade(hex,sec)
// ============================================================
import * as THREE from 'three';
import { ENEMY, MELEE } from './config.js';

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
  const a = Math.random() * Math.PI * 2, r = Math.random() * 70;
  return V(Math.cos(a) * r, Math.sin(a) * r);
}
function blast(game, x, z, r, dmgPct, color, extra = {}) {
  game.fx.explosion({ x, z, radius: r, color, life: 0.5, debris: 5, intensity: 1.1 });
  let hits = 0;
  const center = V(x, z);
  game.enemies.alive().forEach((e) => {
    const d = e.position.distanceTo(center);
    if (d > r) return;
    hits++;
    const fall = 1 - (d / Math.max(0.01, r)) * 0.42;
    const knock = extra.knockDir ? extra.knockDir : e.position.clone().sub(center).setY(0);
    if (knock.lengthSq() > 0.0001) knock.normalize();
    game.enemies.damage(e, DMG(dmgPct * fall), {
      ...extra,
      knockDir: extra.knockDir || knock,
      knockForce: (extra.knockForce || 10) * fall,
    });
  });
  if (hits && game.sfx) game.sfx.play(hits > 3 ? 'explosion' : 'impact');
  return hits;
}
function lunge(game, dir, dist = 6) {
  const d = dir.clone(); d.y = 0;
  if (d.lengthSq() < 0.0001) d.set(Math.sin(game.player.facing), 0, Math.cos(game.player.facing));
  d.normalize();
  game.player.lunge.copy(d).multiplyScalar(dist * 9);
  if (game.player.playSkill) game.player.playSkill();
}
function coneHit(game, dir, reach, width, pct, extra = {}) {
  const fwd = dir.clone(); fwd.y = 0; if (fwd.lengthSq() < 0.0001) return 0; fwd.normalize();
  let n = 0;
  game.enemies.alive().forEach((e) => {
    const to = e.position.clone().sub(game.player.position); to.y = 0;
    const d = to.length();
    if (d > reach + 1) return;
    if (to.normalize().dot(fwd) < 0.45) return;
    const side = Math.abs(to.x * fwd.z - to.z * fwd.x) * d;
    if (side > width) return;
    n++;
    game.enemies.damage(e, DMG(pct), { ...extra, knockDir: fwd, knockForce: extra.knockForce || 12 });
  });
  return n;
}
function aimDir(player, aim) {
  const dir = aim.clone().sub(player.position); dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(Math.sin(player.facing), 0, Math.cos(player.facing));
  return dir.normalize();
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
    const near = enemies.randomNearby(player.position, 200, 1);
    const to = near.length ? near[0].position.clone() : aim.clone();
    fx.launchOrb(player.position.clone(), to.sub(player.position), {
      speed: 28, range: 160, color: BLUE, radius: 1.1, enemies,
      onExplode: (p) => enemies.applyArea(p, 3, DMG(0.35), { stun: true, stunDur: 0.8 }),
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
    for (let i = 0; i < 40; i++) game.after(i * 0.12, () => {
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
    fx.launchOrb(player.position.clone(), aimDir(player, aim), {
      speed: 40, range: 120, color: QUAKE, radius: 1.4, enemies,
      onExplode: (p) => {
        fx.shockwave({ x: p.x, z: p.z, radius: 8, color: 0xffffff, duration: 0.6, debrisCount: 6 });
        enemies.applyArea(p, 8, DMG(0.4), { stun: true, stunDur: 2 });
      },
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
    for (let i = 0; i < 12; i++) {
      const rp = nearPoint(player.position, 18);
      game.after(i * 0.06, () => {
        fx.rockRise({
          x: rp.x, z: rp.z, radius: 5, rise: 0.45, color: 0x9a9aa6,
          onSlam: (x, z) => enemies.applyArea(V(x, z), 8, DMG(0.22), { stun: true, stunDur: 0.8 }),
        });
      });
    }
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
    const dir = aimDir(player, aim);
    const pos = player.position.clone().addScaledVector(dir, 12);
    fx._flash(fx.glow, pos.x, 2, pos.z, BLUE, 3, 1.0, 0.2);
    game.after(1.0, () => {
      fx.explosion({ x: pos.x, z: pos.z, radius: 2, color: BLUE, life: 0.5, debris: 3 });
      enemies.applyArea(V(pos.x, pos.z), 2, DMG(0.3), { stun: true, stunDur: 1 });
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
    const dir = aimDir(player, aim);
    for (let i = 0; i < 3; i++) game.after(i * 0.12, () => {
      const odir = dir.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))).normalize();
      fx.launchOrb(player.position.clone(), odir, {
        speed: 45, range: 100, color: QUAKE, radius: 0.9, enemies,
        onExplode: (p) => enemies.applyArea(p, 6, DMG(0.3), { stun: true, stunDur: 1.5 }),
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

  ice_spear(game, aim) {
    const { fx, enemies, player } = game;
    fx.launchOrb(player.position.clone(), aimDir(player, aim), {
      speed: 52, range: 90, color: 0x9fe9ff, radius: 0.9, enemies,
      onExplode: (p) => blast(game, p.x, p.z, 5, 0.4, 0x9fe9ff, { stun: true, stunDur: 1.4 }),
    });
  },
  ice_age(game) {
    const { fx, enemies, player } = game;
    fx.frost(player.position.x, player.position.z, 18, 0x9fe9ff);
    enemies.applyArea(player.position, 18, DMG(0.45), { stun: true, stunDur: 2.8 });
    fx.shake(0.5, 1.6);
  },
  ice_path(game, aim) {
    const { fx, player } = game;
    const dir = aimDir(player, aim);
    for (let i = 1; i <= 6; i++) game.after(i * 0.08, () => {
      const x = player.position.x + dir.x * i * 5, z = player.position.z + dir.z * i * 5;
      fx.frost(x, z, 5, 0xb8f4ff);
      blast(game, x, z, 5, 0.2, 0x9fe9ff, { stun: true, stunDur: 0.7 });
    });
  },
  ice_glacier(game, aim) {
    const { fx } = game;
    fx.rockRise({ x: aim.x, z: aim.z, radius: 10, rise: 0.8, color: 0xcfefff,
      onSlam: (x, z) => { fx.frost(x, z, 16); blast(game, x, z, 16, 0.7, 0x9fe9ff, { stun: true, stunDur: 2 }); } });
  },

  fl_fist(game) {
    const { fx, player } = game;
    const p = player.position;
    fx.slashFx(p.x, 1.8, p.z, 0xff6a2e, player.facing);
    blast(game, p.x + Math.sin(player.facing) * 4, p.z + Math.cos(player.facing) * 4, 7, 0.4, 0xff6a2e, { burn: true, burnDps: DMG(0.08), burnDur: 4 });
  },
  fl_ball(game, aim) {
    const { fx, enemies, player } = game;
    fx.launchOrb(player.position.clone(), aimDir(player, aim), {
      speed: 38, range: 100, color: 0xff6a2e, radius: 1.2, enemies,
      onExplode: (p) => blast(game, p.x, p.z, 7, 0.35, 0xff6a2e, { burn: true, burnDps: DMG(0.06), burnDur: 5 }),
    });
  },
  fl_pillar(game) {
    const { fx, player } = game;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = player.position.x + Math.cos(a) * 8, z = player.position.z + Math.sin(a) * 8;
      fx.pillar({ x, z, height: 22, color: 0xff6a2e, duration: 1.1, rings: 4 });
      blast(game, x, z, 6, 0.28, 0xff6a2e, { burn: true, burnDps: DMG(0.05), burnDur: 4 });
    }
  },
  fl_meteor(game, aim) {
    const { fx, enemies } = game;
    fx.meteor({ x: aim.x, z: aim.z, radius: 12, color: 0xff4a1a, explosionColor: 0xff6a2e, fallTime: 0.7,
      onImpact: (x, z, r) => {
        enemies.applyArea(V(x, z), r, DMG(0.65), { burn: true, burnDps: DMG(0.1), burnDur: 6 });
        fx.firepit({ x, z, radius: r * 0.6, duration: 6, dps: DMG(0.04), color: 0xff5a1e }, (px, pz, pr, d) => enemies.applyArea(V(px, pz), pr, d, {}));
      } });
  },

  li_kick(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aimDir(player, aim);
    let moved = 0; const dist = 16;
    fx.add({
      update: (dt) => {
        const s = Math.min(260 * dt, dist - moved); moved += s;
        player.position.addScaledVector(dir, s);
        enemies.alive().forEach((e) => { if (e.position.distanceTo(player.position) < 2.8) enemies.damage(e, DMG(0.32), { knockDir: dir, knockForce: 14 }); });
        fx.slashFx(player.position.x, 1.8, player.position.z, 0xfff1a8, player.facing);
        return moved < dist;
      }, dispose() {},
    });
  },
  li_beam(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aimDir(player, aim);
    for (let i = 1; i <= 10; i++) {
      const x = player.position.x + dir.x * i * 4, z = player.position.z + dir.z * i * 4;
      fx._flash(fx.glow, x, 1.6, z, 0xfff1a8, 3.5, 0.28, 0.4);
      enemies.applyArea(V(x, z), 3.2, DMG(0.16), { blind: true, blindDur: 1.5 });
    }
  },
  li_jewels(game, aim) {
    const { fx } = game;
    for (let i = 0; i < 10; i++) game.after(i * 0.08, () => {
      const rp = nearPoint(aim, 12);
      fx._flash(fx.sparks, rp.x, 8, rp.z, 0xfff1a8, 2, 0.4, 2);
      blast(game, rp.x, rp.z, 4.5, 0.18, 0xfff1a8, { stun: true, stunDur: 0.5 });
    });
  },
  li_flash(game) {
    const { fx, enemies, player, shade } = game;
    shade(0xfff6c8, 0.35, true);
    fx.explosion({ x: player.position.x, z: player.position.z, radius: 20, color: 0xfff1a8, life: 0.6, debris: 8, intensity: 1.5 });
    enemies.applyArea(player.position, 20, DMG(0.5), { blind: true, blindDur: 4, stun: true, stunDur: 1.2 });
    fx.shake(0.7, 2);
  },

  mg_fist(game) {
    const { player } = game;
    const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    const x = player.position.x + dir.x * 4, z = player.position.z + dir.z * 4;
    blast(game, x, z, 8, 0.42, 0xff3b1a, { knockDir: dir, knockForce: 16, burn: true, burnDps: DMG(0.07), burnDur: 5 });
  },
  mg_pool(game, aim) {
    const { fx, enemies } = game;
    fx.firepit({ x: aim.x, z: aim.z, radius: 10, duration: 8, dps: DMG(0.08), color: 0xff3b1a },
      (px, pz, pr, d) => enemies.applyArea(V(px, pz), pr, d, { burn: true, burnDps: DMG(0.04), burnDur: 3 }));
    blast(game, aim.x, aim.z, 8, 0.3, 0xff3b1a, {});
  },
  mg_volcano(game) {
    const { fx, enemies, player } = game;
    fx.pillar({ x: player.position.x, z: player.position.z, height: 36, color: 0xff3b1a, duration: 1.4, rings: 5 });
    fx.shockwave({ x: player.position.x, z: player.position.z, radius: 16, color: 0xff7a3a, duration: 0.8, debrisCount: 8 });
    enemies.applyArea(player.position, 16, DMG(0.55), { knockForce: 12, burn: true, burnDps: DMG(0.08), burnDur: 5 });
    fx.shake(0.8, 2.4);
  },
  mg_rain(game) {
    const { fx, enemies } = game;
    for (let i = 0; i < 8; i++) game.after(i * 0.16, () => {
      const rp = randomArena();
      fx.meteor({ x: rp.x, z: rp.z, radius: 7, color: 0x6a2010, explosionColor: 0xff3b1a, fallTime: 0.55,
        onImpact: (x, z, r) => enemies.applyArea(V(x, z), r, DMG(0.28), { burn: true, burnDps: DMG(0.05), burnDur: 4 }) });
    });
  },

  ct_wave(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aimDir(player, aim);
    fx.slashFx(player.position.x, 1.7, player.position.z, 0xd4af70, player.facing);
    fx.launchOrb(player.position.clone(), dir, {
      speed: 48, range: 70, color: 0xd4af70, radius: 1.1, enemies,
      onExplode: (p) => enemies.applyArea(V(p.x, p.z), 5, DMG(0.32), { knockDir: dir, knockForce: 12 }),
    });
  },
  ct_flurry(game) {
    const { fx, enemies, player } = game;
    for (let i = 0; i < 6; i++) game.after(i * 0.07, () => {
      fx.slashFx(player.position.x, 1.7, player.position.z, 0xd4af70, player.facing + i * 0.5);
      enemies.applyArea(player.position, 6, DMG(0.12), {});
    });
  },

  ka_iai(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aimDir(player, aim);
    const from = player.position.clone();
    player.position.addScaledVector(dir, 18);
    fx.slashFx(from.x, 1.8, from.z, 0xe8eefc, player.facing);
    enemies.alive().forEach((e) => {
      const to = e.position.clone().sub(from); const d = to.length();
      if (d < 20 && to.normalize().dot(dir) > 0.55) enemies.damage(e, DMG(0.55), { stun: true, stunDur: 0.8 });
    });
  },
  ka_petal(game) {
    const { fx, player } = game;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      fx.slashFx(player.position.x + Math.cos(a) * 2, 1.7, player.position.z + Math.sin(a) * 2, 0xe8eefc, a);
    }
    blast(game, player.position.x, player.position.z, 8, 0.4, 0xe8eefc, { stun: true, stunDur: 0.6 });
  },
  ka_storm(game) {
    const { fx, enemies, player } = game;
    let t = 0;
    fx.add({
      update: (dt) => {
        t += dt;
        enemies.pullTo(player.position, 70);
        if (t % 0.12 < dt) {
          fx.slashFx(player.position.x, 1.8, player.position.z, 0xe8eefc, t * 8);
          enemies.applyArea(player.position, 9, DMG(0.1), {});
        }
        return t < 1.6;
      }, dispose() {},
    });
  },

  tr_pierce(game, aim) {
    const { fx, enemies, player } = game;
    const dir = aimDir(player, aim);
    fx.launchOrb(player.position.clone(), dir, {
      speed: 55, range: 95, color: 0x5ad0c8, radius: 0.8, enemies,
      onExplode: (p) => enemies.applyArea(V(p.x, p.z), 4, DMG(0.38), { knockDir: dir, knockForce: 18 }),
    });
  },
  tr_tide(game, aim) {
    const { fx, enemies, player } = game;
    const base = aimDir(player, aim);
    for (let i = -1; i <= 1; i++) {
      const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.28);
      fx.launchOrb(player.position.clone(), dir, {
        speed: 44, range: 80, color: 0x5ad0c8, radius: 0.7, enemies,
        onExplode: (p) => blast(game, p.x, p.z, 4, 0.22, 0x5ad0c8, {}),
      });
    }
  },
  tr_whirl(game) {
    const { fx, enemies, player } = game;
    fx.shockwave({ x: player.position.x, z: player.position.z, radius: 14, color: 0x5ad0c8, duration: 1.1, debrisCount: 6 });
    let t = 0;
    fx.add({
      update: (dt) => {
        t += dt; enemies.pullTo(player.position, 90);
        if (t % 0.2 < dt) enemies.applyArea(player.position, 12, DMG(0.12), {});
        return t < 1.8;
      }, dispose() {},
    });
  },

  dk_slash(game, aim) {
    const { fx, player } = game;
    fx.slashFx(player.position.x, 1.8, player.position.z, 0x5b2bff, player.facing);
    const dir = aimDir(player, aim);
    blast(game, player.position.x + dir.x * 6, player.position.z + dir.z * 6, 9, 0.5, 0x5b2bff, { knockDir: dir, knockForce: 20, stun: true, stunDur: 1 });
  },
  dk_void(game) {
    const { fx, enemies, player } = game;
    let t = 0;
    fx.add({
      update: (dt) => { t += dt; enemies.pullTo(player.position, 110, { lift: true, liftDur: 0.3 }); return t < 0.7; }, dispose() {},
    });
    game.after(0.7, () => blast(game, player.position.x, player.position.z, 12, 0.6, 0x5b2bff, { stun: true, stunDur: 1.5 }));
  },
  dk_night(game) {
    const { fx, enemies, player, shade } = game;
    shade(0x1a0830, 0.8, true);
    fx.pillar({ x: player.position.x, z: player.position.z, height: 40, color: 0x5b2bff, duration: 1.6, rings: 5 });
    enemies.applyArea(player.position, 22, DMG(0.55), { blind: true, blindDur: 3, burn: true, burnDps: DMG(0.06), burnDur: 6 });
    fx.shake(0.85, 2.8);
  },

  st_cut(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 3);
    game.fx.slashFx(game.player.position.x, 1.8, game.player.position.z, 0x8ec8ff, game.player.facing, 8);
    coneHit(game, dir, 12, 4, 0.32, { knockForce: 16 });
    if (game.sfx) game.sfx.whoosh();
  },
  st_burst(game) {
    blast(game, game.player.position.x, game.player.position.z, 10, 0.35, 0x8ec8ff, { knockForce: 22 });
    game.fx.shockwave({ x: game.player.position.x, z: game.player.position.z, radius: 12, color: 0xcfe8ff, duration: 0.7, debrisCount: 6 });
  },
  st_spin(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => {
        t += dt; game.enemies.pullTo(game.player.position, 80, { lift: true, liftDur: 0.4 });
        if (t % 0.18 < dt) game.enemies.applyArea(game.player.position, 9, DMG(0.1), {});
        return t < 1.5;
      }, dispose() {},
    });
    if (game.sfx) game.sfx.whoosh();
  },
  st_bolt(game, aim) {
    game.fx.meteor({ x: aim.x, z: aim.z, radius: 9, color: 0x8ec8ff, explosionColor: 0xb8e0ff, fallTime: 0.55,
      onImpact: (x, z, r) => blast(game, x, z, r, 0.5, 0x8ec8ff, { knockForce: 14 }) });
  },

  sh_lash(game, aim) {
    game.fx.launchOrb(game.player.position.clone(), aimDir(game.player, aim), {
      speed: 42, range: 80, color: 0x5b3aa0, radius: 0.7, enemies: game.enemies, homing: 6,
      onExplode: (p) => blast(game, p.x, p.z, 4, 0.34, 0x5b3aa0, {}),
    });
  },
  sh_step(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 14);
    coneHit(game, dir, 16, 3, 0.4, { knockForce: 8 });
    if (game.sfx) game.sfx.whoosh();
  },
  sh_bind(game) {
    game.enemies.applyArea(game.player.position, 14, DMG(0.28), { stun: true, stunDur: 2.2 });
    game.fx.frost(game.player.position.x, game.player.position.z, 14, 0x5b3aa0);
  },
  sh_nova(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => { t += dt; game.enemies.pullTo(game.player.position, 110, { lift: true, liftDur: 0.3 }); return t < 0.55; },
      dispose() {},
    });
    game.after(0.55, () => blast(game, game.player.position.x, game.player.position.z, 14, 0.62, 0x5b3aa0, { stun: true, stunDur: 1.2 }));
  },

  vn_spit(game, aim) {
    game.fx.launchOrb(game.player.position.clone(), aimDir(game.player, aim), {
      speed: 36, range: 70, color: 0x7dff6a, radius: 0.9, gravity: 28, arc: 10, enemies: game.enemies,
      onExplode: (p) => blast(game, p.x, p.z, 5, 0.3, 0x7dff6a, { burn: true, burnDps: DMG(0.07), burnDur: 5 }),
    });
  },
  vn_cloud(game, aim) {
    game.fx.firepit({ x: aim.x, z: aim.z, radius: 8, duration: 7, dps: DMG(0.07), color: 0x7dff6a },
      (px, pz, pr, d) => game.enemies.applyArea(V(px, pz), pr, d, { burn: true, burnDps: DMG(0.04), burnDur: 3 }));
  },
  vn_fang(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 8);
    coneHit(game, dir, 8, 3, 0.4, { burn: true, burnDps: DMG(0.08), burnDur: 4, knockForce: 10 });
  },
  vn_bloom(game) { blast(game, game.player.position.x, game.player.position.z, 16, 0.55, 0x7dff6a, { burn: true, burnDps: DMG(0.09), burnDur: 6 }); },

  sd_blade(game, aim) {
    const dir = aimDir(game.player, aim);
    game.fx.slashFx(game.player.position.x, 1.7, game.player.position.z, 0xe8c07a, game.player.facing, 8);
    coneHit(game, dir, 11, 3.5, 0.3, { knockForce: 12 });
  },
  sd_bury(game) {
    game.enemies.applyArea(game.player.position, 12, DMG(0.38), { stun: true, stunDur: 2, lift: false });
    game.fx.shockwave({ x: game.player.position.x, z: game.player.position.z, radius: 12, color: 0xe8c07a, duration: 0.7, debrisCount: 8 });
  },
  sd_storm(game) {
    game.shade(0xe8c07a, 0.4, true);
    blast(game, game.player.position.x, game.player.position.z, 16, 0.32, 0xe8c07a, { blind: true, blindDur: 3 });
  },
  sd_tomb(game, aim) {
    game.fx.rockRise({ x: aim.x, z: aim.z, radius: 9, rise: 0.7, color: 0xc4a574,
      onSlam: (x, z) => blast(game, x, z, 12, 0.6, 0xe8c07a, { stun: true, stunDur: 1.6 }) });
  },

  sg_bind(game) {
    game.enemies.pullTo(game.player.position, 140);
    game.enemies.applyArea(game.player.position, 16, DMG(0.18), { stun: true, stunDur: 1.2 });
  },
  sg_snip(game, aim) {
    const dir = aimDir(game.player, aim);
    coneHit(game, dir, 14, 2.2, 0.38, { knockForce: 8 });
    game.fx.slashFx(game.player.position.x, 1.8, game.player.position.z, 0xf2d6ea, game.player.facing, 10);
  },
  sg_pup(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => { t += dt; game.enemies.pullTo(game.player.position, 90, { lift: true, liftDur: 0.6 }); return t < 0.7; },
      dispose() {},
    });
    game.after(0.7, () => blast(game, game.player.position.x, game.player.position.z, 12, 0.5, 0xf2d6ea, { knockForce: 18 }));
  },
  sg_cage(game) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = game.player.position.x + Math.cos(a) * 7, z = game.player.position.z + Math.sin(a) * 7;
      game.fx.slashFx(x, 1.6, z, 0xf2d6ea, a, 4);
    }
    blast(game, game.player.position.x, game.player.position.z, 9, 0.48, 0xf2d6ea, { stun: true, stunDur: 1 });
  },

  rb_pistol(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 10);
    coneHit(game, dir, 12, 3, 0.42, { knockForce: 18 });
    if (game.sfx) game.sfx.punch();
  },
  rb_gat(game) {
    for (let i = 0; i < 8; i++) game.after(i * 0.06, () => {
      game.fx.slashFx(game.player.position.x, 1.7, game.player.position.z, 0xff8aa8, game.player.facing + i * 0.4, 6);
      game.enemies.applyArea(game.player.position, 7, DMG(0.1), {});
    });
  },
  rb_bounce(game) {
    game.player.vy = 18;
    game.after(0.45, () => blast(game, game.player.position.x, game.player.position.z, 10, 0.48, 0xff8aa8, { knockForce: 16 }));
  },
  rb_whip(game, aim) {
    const dir = aimDir(game.player, aim);
    coneHit(game, dir, 18, 3.2, 0.4, { knockForce: 14 });
    game.fx.slashFx(game.player.position.x, 1.8, game.player.position.z, 0xff8aa8, game.player.facing, 14);
  },

  so_drain(game) {
    const hits = game.enemies.getNearby(game.player.position, 12);
    hits.forEach((e) => game.enemies.damage(e, DMG(0.22), {}));
    if (hits.length) game.enemies.healPlayer(DMG(0.08 * Math.min(4, hits.length)));
    game.fx.pillar({ x: game.player.position.x, z: game.player.position.z, height: 18, color: 0xc9b6ff, duration: 0.8, rings: 3 });
  },
  so_scream(game) {
    blast(game, game.player.position.x, game.player.position.z, 14, 0.36, 0xc9b6ff, { stun: true, stunDur: 2, knockForce: 8 });
    if (game.sfx) game.sfx.thunder();
  },
  so_chain(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => { t += dt; game.enemies.pullTo(game.player.position, 130); return t < 0.8; }, dispose() {},
    });
    game.after(0.8, () => blast(game, game.player.position.x, game.player.position.z, 10, 0.4, 0xc9b6ff, {}));
  },
  so_burst(game) {
    blast(game, game.player.position.x, game.player.position.z, 20, 0.7, 0xc9b6ff, { stun: true, stunDur: 1.5, knockForce: 20 });
    game.fx.shake(0.9, 3);
  },

  dr_breath(game, aim) {
    const dir = aimDir(game.player, aim);
    coneHit(game, dir, 16, 6, 0.4, { burn: true, burnDps: DMG(0.08), burnDur: 4, knockForce: 10 });
    for (let i = 1; i <= 5; i++) game.fx._flash(game.fx.fires, game.player.position.x + dir.x * i * 3, 1.4, game.player.position.z + dir.z * i * 3, 0x3ecf7a, 3, 0.25, 0.6);
    if (game.sfx) game.sfx.fire();
  },
  dr_dash(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 16);
    coneHit(game, dir, 18, 3.4, 0.45, { burn: true, burnDps: DMG(0.06), burnDur: 3, knockForce: 14 });
  },
  dr_roar(game) {
    blast(game, game.player.position.x, game.player.position.z, 16, 0.4, 0x3ecf7a, { stun: true, stunDur: 1.8, knockForce: 16 });
    if (game.sfx) game.sfx.thunder();
  },
  dr_sky(game) {
    for (let i = 0; i < 7; i++) game.after(i * 0.14, () => {
      const rp = randomArena();
      game.fx.meteor({ x: rp.x, z: rp.z, radius: 7, color: 0x1a6a3a, explosionColor: 0x3ecf7a, fallTime: 0.5,
        onImpact: (x, z, r) => game.enemies.applyArea(V(x, z), r, DMG(0.28), { burn: true, burnDps: DMG(0.05), burnDur: 3 }) });
    });
  },

  ma_pull(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => { t += dt; game.enemies.pullTo(game.player.position, 160); return t < 0.6; }, dispose() {},
    });
    game.after(0.6, () => blast(game, game.player.position.x, game.player.position.z, 8, 0.5, 0xff5a6a, { knockForce: 6 }));
  },
  ma_push(game) { blast(game, game.player.position.x, game.player.position.z, 14, 0.38, 0xff5a6a, { knockForce: 28 }); },
  ma_rail(game, aim) {
    game.fx.launchOrb(game.player.position.clone(), aimDir(game.player, aim), {
      speed: 70, range: 110, color: 0xff5a6a, radius: 0.6, enemies: game.enemies,
      onExplode: (p) => blast(game, p.x, p.z, 4, 0.42, 0xff5a6a, { knockForce: 16 }),
    });
  },
  ma_field(game) {
    let t = 0, r = 4;
    game.fx.add({
      update: (dt) => {
        t += dt; r = Math.min(16, r + 8 * dt);
        if (t % 0.2 < dt) game.enemies.applyArea(game.player.position, r, DMG(0.1), {});
        return t < 1.6;
      }, dispose() {},
    });
  },

  ph_heal(game) {
    game.enemies.healPlayer(DMG(0.35));
    game.fx.pillar({ x: game.player.position.x, z: game.player.position.z, height: 22, color: 0xffb070, duration: 0.9, rings: 4 });
    if (game.sfx) game.sfx.levelup();
  },
  ph_dive(game, aim) {
    const dir = aim.clone().sub(game.player.position); dir.y = 0;
    const dist = dir.length();
    if (dist > 0.01) { dir.normalize(); game.player.position.addScaledVector(dir, Math.min(18, dist)); }
    blast(game, game.player.position.x, game.player.position.z, 9, 0.5, 0xffb070, { burn: true, burnDps: DMG(0.06), burnDur: 4 });
  },
  ph_wing(game) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      game.fx._flash(game.fx.fires, game.player.position.x + Math.cos(a) * 6, 1.5, game.player.position.z + Math.sin(a) * 6, 0xffb070, 3, 0.3, 0.8);
    }
    blast(game, game.player.position.x, game.player.position.z, 10, 0.42, 0xffb070, {});
  },
  ph_nova(game) {
    game.enemies.healPlayer(DMG(0.5));
    blast(game, game.player.position.x, game.player.position.z, 18, 0.65, 0xffb070, { burn: true, burnDps: DMG(0.08), burnDur: 5, knockForce: 16 });
    game.fx.shake(0.85, 2.6);
  },

  bl_dash(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 12);
    coneHit(game, dir, 14, 3, 0.42, { knockForce: 14 });
    if (game.sfx) game.sfx.whoosh();
  },
  bl_spin(game) {
    for (let i = 0; i < 6; i++) game.after(i * 0.07, () => {
      game.fx.slashFx(game.player.position.x, 1.6, game.player.position.z, 0xf0b36a, i * 1.1, 7);
      game.enemies.applyArea(game.player.position, 7, DMG(0.12), {});
    });
  },
  bl_axe(game) {
    game.player.vy = 14;
    game.after(0.35, () => blast(game, game.player.position.x, game.player.position.z, 9, 0.55, 0xf0b36a, { knockForce: 18, stun: true, stunDur: 0.8 }));
  },

  if_blow(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 7);
    coneHit(game, dir, 8, 3.6, 0.55, { knockForce: 24 });
    if (game.sfx) game.sfx.impact();
  },
  if_barrage(game) {
    for (let i = 0; i < 7; i++) game.after(i * 0.06, () => {
      if (game.player.playAttack) game.player.playAttack();
      game.enemies.applyArea(game.player.position, 6, DMG(0.12), {});
    });
  },
  if_upper(game) {
    blast(game, game.player.position.x, game.player.position.z, 8, 0.5, 0xb0b8c8, { lift: true, liftDur: 1.1, knockForce: 8 });
  },

  el_jab(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 6);
    coneHit(game, dir, 9, 3, 0.34, { stun: true, stunDur: 0.6 });
    const p = game.player.position;
    game.fx.bolt({ x: p.x + dir.x * 4, z: p.z + dir.z * 4, height: 14, color: 0xffe066, life: 0.18 });
  },
  el_surge(game) {
    game.fx.shockwave({ x: game.player.position.x, z: game.player.position.z, radius: 12, color: 0xffe066, duration: 0.7, debrisCount: 5 });
    game.enemies.applyArea(game.player.position, 12, DMG(0.36), { stun: true, stunDur: 1.2 });
    if (game.sfx) game.sfx.thunder();
  },
  el_cage(game) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      game.fx.bolt({ x: game.player.position.x + Math.cos(a) * 6, z: game.player.position.z + Math.sin(a) * 6, height: 22, color: 0xffe066, life: 0.3 });
    }
    blast(game, game.player.position.x, game.player.position.z, 8, 0.45, 0xffe066, { stun: true, stunDur: 2 });
  },

  fk_pistol(game, aim) {
    game.fx.launchOrb(game.player.position.clone(), aimDir(game.player, aim), {
      speed: 58, range: 90, color: 0x3aa0d8, radius: 0.7, enemies: game.enemies,
      onExplode: (p) => blast(game, p.x, p.z, 4, 0.36, 0x3aa0d8, { knockForce: 16 }),
    });
    if (game.sfx) game.sfx.water();
  },
  fk_tide(game) {
    game.fx.shockwave({ x: game.player.position.x, z: game.player.position.z, radius: 14, color: 0x3aa0d8, duration: 0.8, debrisCount: 6 });
    blast(game, game.player.position.x, game.player.position.z, 14, 0.4, 0x3aa0d8, { knockForce: 18 });
  },
  fk_shock(game) {
    blast(game, game.player.position.x, game.player.position.z, 12, 0.55, 0x3aa0d8, { lift: true, liftDur: 0.8, knockForce: 14 });
    if (game.sfx) game.sfx.water();
  },

  ss_reap(game, aim) {
    const dir = aimDir(game.player, aim);
    coneHit(game, dir, 11, 5, 0.4, {});
    const hits = game.enemies.getNearby(game.player.position, 11);
    if (hits.length) game.enemies.healPlayer(DMG(0.05 * Math.min(3, hits.length)));
    game.fx.slashFx(game.player.position.x, 1.8, game.player.position.z, 0x8a6cff, game.player.facing, 10);
  },
  ss_harvest(game) {
    let t = 0;
    game.fx.add({ update: (dt) => { t += dt; game.enemies.pullTo(game.player.position, 100); return t < 0.45; }, dispose() {} });
    game.after(0.45, () => blast(game, game.player.position.x, game.player.position.z, 10, 0.5, 0x8a6cff, {}));
  },
  ss_void(game, aim) {
    blast(game, aim.x, aim.z, 10, 0.55, 0x8a6cff, { stun: true, stunDur: 1.2 });
    game.fx.pillar({ x: aim.x, z: aim.z, height: 24, color: 0x8a6cff, duration: 1, rings: 4 });
  },

  su_pierce(game, aim) {
    const dir = aimDir(game.player, aim);
    coneHit(game, dir, 18, 2.4, 0.42, { knockForce: 12, blind: true, blindDur: 1 });
    for (let i = 1; i <= 6; i++) game.fx._flash(game.fx.glow, game.player.position.x + dir.x * i * 3, 1.6, game.player.position.z + dir.z * i * 3, 0xffc14a, 2.4, 0.2, 0.3);
  },
  su_solar(game, aim) {
    const dir = aimDir(game.player, aim);
    coneHit(game, dir, 14, 7, 0.36, { burn: true, burnDps: DMG(0.06), burnDur: 3, blind: true, blindDur: 2 });
    if (game.sfx) game.sfx.fire();
  },
  su_nova(game, aim) {
    game.fx.meteor({ x: aim.x, z: aim.z, radius: 11, color: 0xffc14a, explosionColor: 0xffe08a, fallTime: 0.6,
      onImpact: (x, z, r) => blast(game, x, z, r, 0.6, 0xffc14a, { burn: true, burnDps: DMG(0.07), burnDur: 4 }) });
  },

  ff_bite(game, aim) {
    const dir = aimDir(game.player, aim); lunge(game, dir, 8);
    coneHit(game, dir, 9, 3.2, 0.4, { stun: true, stunDur: 1.2 });
    if (game.sfx) game.sfx.ice();
  },
  ff_howl(game) {
    game.fx.frost(game.player.position.x, game.player.position.z, 14, 0xa8e8ff);
    game.enemies.applyArea(game.player.position, 14, DMG(0.36), { stun: true, stunDur: 1.8 });
  },
  ff_blizzard(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => {
        t += dt;
        if (t % 0.2 < dt) {
          const rp = nearPoint(game.player.position, 10);
          game.fx.frost(rp.x, rp.z, 4, 0xa8e8ff);
          game.enemies.applyArea(V(rp.x, rp.z), 4, DMG(0.12), { stun: true, stunDur: 0.5 });
        }
        return t < 1.6;
      }, dispose() {},
    });
  },

  td_smash(game) {
    blast(game, game.player.position.x, game.player.position.z, 10, 0.5, 0xffe066, { knockForce: 20, stun: true, stunDur: 0.8 });
    game.fx.shake(0.7, 2.2);
    if (game.sfx) game.sfx.impact();
  },
  td_quake(game) {
    for (let i = 0; i < 3; i++) game.after(i * 0.18, () => {
      game.fx.shockwave({ x: game.player.position.x, z: game.player.position.z, radius: 10 + i * 5, color: 0xffe066, duration: 0.55, debrisCount: 4 });
      game.enemies.applyArea(game.player.position, 10 + i * 5, DMG(0.16), {});
    });
  },
  td_storm(game) {
    for (let i = 0; i < 6; i++) game.after(i * 0.12, () => {
      const rp = nearPoint(game.player.position, 12);
      game.fx.bolt({ x: rp.x, z: rp.z, height: 28, color: 0xffe066, life: 0.22 });
      game.enemies.applyArea(V(rp.x, rp.z), 5, DMG(0.18), { stun: true, stunDur: 0.6 });
    });
    if (game.sfx) game.sfx.thunder();
  },

  bb_petal(game) {
    for (let i = 0; i < 6; i++) game.fx.slashFx(game.player.position.x, 1.7, game.player.position.z, 0xff9ac8, game.player.facing + i * 0.5, 7);
    blast(game, game.player.position.x, game.player.position.z, 8, 0.36, 0xff9ac8, {});
  },
  bb_garden(game) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = game.player.position.x + Math.cos(a) * 7, z = game.player.position.z + Math.sin(a) * 7;
      game.after(i * 0.05, () => blast(game, x, z, 4, 0.18, 0xff9ac8, {}));
    }
  },
  bb_sakura(game) {
    let t = 0;
    game.fx.add({
      update: (dt) => {
        t += dt; game.enemies.pullTo(game.player.position, 60);
        if (t % 0.12 < dt) {
          game.fx.slashFx(game.player.position.x, 1.8, game.player.position.z, 0xff9ac8, t * 9, 8);
          game.enemies.applyArea(game.player.position, 9, DMG(0.1), {});
        }
        return t < 1.5;
      }, dispose() {},
    });
  },
};

// ------------------------------------------------------------
//  M1 BASIC ATTACKS (slash combos)
// ------------------------------------------------------------
export function castM1(game, weaponId) {
  const { fx, enemies, player } = game;
  const melee = MELEE[weaponId] || MELEE.combat;
  const isBlade = weaponId === 'gravityblade';
  const isCombat = weaponId === 'combat';
  const isPole = weaponId === 'pole';

  const aim = game.aimPoint();
  const dirAim = aim.clone().sub(player.position); dirAim.y = 0;
  if (dirAim.lengthSq() > 0.01) player.facing = Math.atan2(dirAim.x, dirAim.z);
  if (player.playAttack) player.playAttack();
  if (game.sfx) game.sfx.play(isCombat ? 'punch' : 'slash');
  const fwdLunge = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  player.lunge.addScaledVector(fwdLunge, 10);

  game.m1Combo = (game.m1Combo || 0) + 1;
  if (game.m1Combo > 6) game.m1Combo = 1;
  const color = isBlade ? PURPLE : isCombat ? 0xf0b36a : BLUE;
  fx.slashFx(player.position.x, player.position.y + 1.8, player.position.z, color, player.facing, melee.reach);

  const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const halfW = melee.width * 0.5;
  const reach = melee.reach;
  const height = melee.height;
  const er = ENEMY.radius;

  enemies.alive().forEach((e) => {
    const dx = e.position.x - player.position.x;
    const dz = e.position.z - player.position.z;
    const dy = (e.position.y || 0) - player.position.y;
    const along = dx * fwd.x + dz * fwd.z;
    const side = dx * right.x + dz * right.z;
    if (along > -0.45 && along < reach + er && Math.abs(side) < halfW + er && Math.abs(dy) < height) {
      enemies.damage(e, DMG(melee.dmg), { knockDir: fwd, knockForce: 5 });
    }
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
  } else if (isPole) {
    if (game.m1Combo === 4) {
      fx.bolt({ x: player.position.x + fwd.x * 5, z: player.position.z + fwd.z * 5, height: 18, color: BLUE, life: 0.22 });
      enemies.applyArea(V(player.position.x + fwd.x * 5, player.position.z + fwd.z * 5), 4.5, DMG(0.15), {});
    }
    game.endLag = 0;
  } else game.endLag = isCombat ? 0.08 : 0.05;
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
  if (h) {
    try {
      if (game.sfx) game.sfx.skill();
      if (game.player.playSkill) game.player.playSkill();
      return h(game, aim);
    } catch (e) { console.warn('skill error', id, e); }
  }
  return true;
}

export const HOLD_SKILLS = new Set(['p_juicio', 'l_destru']);

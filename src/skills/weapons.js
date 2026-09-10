/**
 * WEAPONS — Gravity Blade, Pole, Bisento.
 * Weapons are a separate slot from the fruit (equip / unequip independently).
 */
import * as THREE from 'three';
import { PURPLE, NEON } from '../fx/index.js';
import { randNear, dirTo, handPos, armPositions, pickTargets } from './util.js';
import { rand, randInt, clamp, chance, TAU, tmp } from '../core/utils.js';

/* ======================================================================== */
/*  GRAVITY BLADE                                                           */
/* ======================================================================== */
export const GRAVITY_BLADE = {
  id: 'gravityblade',
  name: 'Gravity Blade',
  short: 'GRAV BLADE',
  color: 0xa855f7,
  blade: 0xe9d5ff,
  mesh: 'sword',
  length: 2.0,
  glyph: '🗡',
  kind: 'sword',

  /* --- M1: 0.2s CD, every 4th slash calls 1–12 bolts, 0.4s end-lag --- */
  m1: {
    interval: 0.2,
    maxCombo: 4,
    endLag: 0.4,
    endLagEvery: 4,
    cast(ctx, combo) {
      const { fx, player, world, combat, atk, aim } = ctx;
      const dir = dirTo(player.pos, aim);
      const origin = player.pos.clone().addScaledVector(dir, 1.6); origin.y = 1.2;

      fx.slash({
        pos: origin, dir, color: 0xd8b4fe, radius: 2.6 + combo * 0.25,
        life: 0.24, tilt: rand(-0.5, 0.5), spin: rand(-1, 1) * 3,
      });
      const hits = combat.inCone(player.pos, dir, 4.2, 1.1);
      for (const e of hits) {
        e.takeDamage(atk * 1.8 * (combo === 4 ? 1.6 : 1), {
          source: player, knockback: combo === 4 ? 4 : 1.1, from: player.pos, stun: combo === 4 ? 0.3 : 0.08,
        });
      }

      // every 4th slash: 1–12 bolts in a single area near the sword
      if (combo % 4 === 0) {
        const p = origin.clone().addScaledVector(dir, 2.6);
        const n = randInt(1, 12);
        for (let i = 0; i < n; i++) {
          world.after(i * 0.03, () => fx.strike(p, { color: PURPLE, height: 55, width: rand(0.8, 1.6), life: rand(0.22, 0.4) }));
        }
        fx.explosion({
          pos: p, radius: 6.5, color: PURPLE, colorB: 0xf5f3ff,
          damage: atk * 2.2, source: player, stun: 0.25, shake: 0.7, scorch: false,
        });
        world.audio?.play('thunder', { volume: 0.5, pitch: 1.3 });
      }
    },
  },

  skills: [
    /* ------------------------------------------------------------------ */
    {
      id: 'superforce',
      name: 'Superforce Lightning Gravitational of Force',
      key: '1',
      glyph: '⚡',
      cd: 3,
      castTime: 1.0,
      anim: 'smash',
      sfx: 'charge',
      desc: 'The blade glows for 1s, then calls a lightning strike whose roar carries 22km. Blinded enemies wander and cannot attack for 10s.',
      cast(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const charge = player.charge;                 // 0 – 100
        const rangeKm = 4 + 18 * (charge / 100);      // roar reach: 4km → 22km
        const rangeFactor = rangeKm / 22;
        let dmg = atk * (6 + rangeFactor * 36);       // damage depends on the roar range
        let mega = false;
        if (charge >= 100 && chance(0.30)) { mega = true; dmg *= 20; }   // max charge: 30% for x20
        player.charge = Math.max(0, charge - 10);     // each strike consumes 10% charge
        ctx.cooldown = 3;
        ctx.cdScale = charge <= 0 ? 1 / 2.5 : 1;      // 0% charge → 2.5x faster cooldown

        // ---- 1 second glow ----
        const hand = handPos(player);
        world.every(0.05, 20, () => {
          fx.glow.spawn({
            pos: { x: hand.x + rand(-0.3, 0.3), y: hand.y + rand(-0.3, 0.3), z: hand.z + rand(-0.3, 0.3) },
            vel: { x: rand(-1, 1), y: rand(0.5, 3), z: rand(-1, 1) },
            color: 0xd8b4fe, size: rand(1, 2.6), life: rand(0.2, 0.5), gravity: 0, drag: 1.4,
          });
        });
        fx.decals.ring(player.pos, { from: 14, to: 2, duration: 1.0, color: PURPLE, opacity: 0.55 });

        // ---- the strike ----
        world.after(1.0, () => {
          const p = aim.clone(); p.y = 0.6;
          const radius = 14 + 26 * rangeFactor * (mega ? 1.6 : 1);

          // giant jagged bolt from extremely high up
          fx.strike(p, {
            height: 260, width: 5 + rangeFactor * 7, color: 0xe9d5ff,
            life: 0.55, branches: 10, jitter: 7, intensity: 2.4,
          });
          for (let i = 0; i < 8; i++) {
            world.after(i * 0.02, () => fx.strike(randNear(p, 6), { height: 200, width: 2.5, color: PURPLE, life: 0.4 }));
          }

          fx.explosion({
            pos: p, radius, color: 0x8b5cf6, colorB: 0xffffff, ringColor: 0xe9d5ff,
            damage: dmg, source: player, stun: 0.6, blind: 10, knockback: 14,
            shake: 2 + rangeFactor * 2.6, shakeDur: clamp(rangeKm * 0.12, 0.5, 2.75),
            debrisColor: 0x6b6154,
          });
          fx.shockwave(p, { radius: radius * 3.2, duration: 1.2, color: 0xe9d5ff, opacity: 0.9 });
          fx.cracks(p, radius * 1.2, { color: 0xa78bfa, life: 3, count: 4 });

          // the roar: long, loud, and the ground keeps shaking for as long as it carries
          fx.shake((1.2 + rangeFactor * 3.2) * (mega ? 1.5 : 1), clamp(rangeKm * 0.12, 0.6, 2.75));
          world.audio?.play('roar', { volume: 1.2 + rangeFactor * 0.6 });
          world.ui?.toast(
            mega ? `<b>×20 SUPERFORCE</b> — roar ${rangeKm.toFixed(1)}km`
                 : `Roar carries <b>${rangeKm.toFixed(1)}km</b>`,
            'good', 1400,
          );
          if (mega) world.ui?.flashWhite(0.85);
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'g343',
      name: '343g',
      key: '2',
      glyph: '☄',
      cd: 5,
      castTime: 0.6,
      anim: 'cast',
      sfx: 'boom',
      desc: 'Rains a storm of small meteors at extreme speed (one every 0.06s).',
      cast(ctx) {
        const { fx, player, atk, aim } = ctx;
        const center = aim.clone();
        fx.stormCloud({ pos: center.clone().setY(80), radius: 16, color: 0xff7b1a, life: 3 });
        world_every(ctx, 0.06, 42, () => {
          fx.smallMeteor({
            to: randNear(center, 30), height: 110, speed: 210, radius: 4.5,
            color: 0xff7b1a, damage: atk * 0.75, source: player, shake: 0.5,
          });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'pilmae',
      name: 'Pilmae',
      key: '3',
      glyph: '🪨',
      cd: 7,
      castTime: 1.2,
      anim: 'cast',
      sfx: 'rumble',
      desc: '72 boulders erupt from the ground around you, then slam back down one by one (8m blasts). The area follows you.',
      cast(ctx) {
        const { fx, player, world, atk } = ctx;
        const rocks = [];
        world.every(1.2 / 72, 72, () => {
          // square AoE that follows the player
          const p = new THREE.Vector3(
            player.pos.x + rand(-20, 20),
            0,
            player.pos.z + rand(-20, 20),
          );
          rocks.push(p);
          fx.risingRock({
            pos: p, height: rand(10, 20), riseTime: rand(0.5, 0.9),
            fallSpeed: 95, scale: rand(0.9, 2.1), color: 0x7a6f60,
          });
        });

        world.after(1.2, () => {
          world.every(0.06, 72, (i) => {
            const p = rocks[i];
            if (!p) return;
            p.y = 0.5;
            fx.explosion({
              pos: p, radius: 8, color: 0xff7b1a, colorB: 0xffd166,
              damage: atk * 1.6, source: player, stun: 0.25, knockback: 4,
              shake: 0.35, scorch: false, debris: true, debrisColor: 0x7a6f60,
            });
            if (i % 6 === 0) world.audio?.play('boom', { volume: 0.4, pitch: rand(1.4, 2.0) });
          });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'death_slashes',
      name: 'Death Gravity Slashes',
      key: '4',
      glyph: '🌙',
      cd: 3,
      castTime: 0.5,
      anim: 'smash',
      sfx: 'slash',
      upgradable: true,
      desc: '20 diagonal curved slashes that auto-aim, always crit (+25000%), explode, stun and burn. Upgrade with kill tokens.',
      cast(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const up = player.upgrades.deathSlashes;
        const CHANCES = [0.15, 0.21, 0.30, 0.48, 0.72];
        const level = up.level;                                    // 0 – 5
        const bonus = 1 + up.bonus;                                // +10% per over-upgrade (max +100%)
        const chanceCrit = level > 0 ? Math.min(0.95, CHANCES[level - 1] * bonus) : 0;
        const count = 20 + (level >= 5 ? 10 : 0);
        const cdScale = level >= 5 ? 0.76 : 1;                     // level 5: CD -24%
        const critMult = 251 + (level >= 5 ? 120 : 0);             // always crits (+25000%), L5 +x120
        ctx.cooldown = 3 * cdScale;

        const pool = combat.inRadius(player.pos, 110);
        const targets = pickTargets(pool, count);

        world.every(0.055, count, (i) => {
          const target = targets[i % Math.max(1, targets.length)];
          const from = player.pos.clone(); from.y = 1.5 + rand(-0.3, 0.6);
          const dir = target && target.alive
            ? dirTo(from, target.pos)
            : dirTo(from, randNear(aim, 20));
          const mega = chance(chanceCrit);
          const speed = mega ? 372 : 186;                          // m/s
          const slashDamage = atk * 2.4;
          const blastRadius = mega ? 3.2 * 26 : 3.2;               // 2500% bigger
          const distance = target && target.alive
            ? Math.min(120, from.distanceTo(target.pos) + 8) : 70;

          fx.slash({
            pos: from, dir,
            color: mega ? 0xffe066 : 0xd8b4fe,
            radius: mega ? 6.5 : 3.4,
            life: mega ? 0.5 : 0.34,
            tilt: rand(-1.2, -0.6),
            spin: rand(-1, 1) * 6,
            travel: { dir, speed, distance, traveled: 0 },
            onHit: (e, pos) => {
              const dmg = slashDamage * critMult * (mega ? 26 : 1);   // 2500% more damage
              e.takeDamage(dmg, {
                source: player, crit: 1, stun: mega ? 1.2 : 0.8,
                knockback: mega ? 16 : 6, from: player.pos,
                burn: { pct: (slashDamage * critMult * 0.27 / 20) / e.maxHp, dur: 10, tick: 0.5, source: player },
              });
              fx.explosion({
                pos: pos.clone(), radius: blastRadius,
                color: mega ? 0xffb703 : 0x8b5cf6, colorB: 0xffffff,
                source: player, damage: 0,
                shake: (mega ? 2.4 : 0.5) * (mega ? 3 : 1),          // 200% more intense shake
                shakeDur: mega ? 1.1 : 0.4,
                scorch: mega, debris: true,
              });
              fx.strike(e.pos, { color: mega ? 0xffe066 : PURPLE, height: 60, width: mega ? 2.4 : 1.1, life: 0.32 });
              if (mega) {
                fx.boltBurst(e.pos, { count: 4, radius: 4, color: 0xffe066, height: 70 });
                world.audio?.play('boom', { volume: 1, pitch: 0.9 });
              }
            },
          });
        });
        world.audio?.play('slash', { volume: 1, pitch: 0.8 });
        return true;
      },
    },
  ],
};

/* ======================================================================== */
/*  POLE                                                                    */
/* ======================================================================== */
export const POLE = {
  id: 'pole',
  name: 'Pole',
  short: 'POLE',
  color: 0x38bdf8,
  mesh: 'pole',
  glyph: '🥢',
  kind: 'sword',

  /* --- M1: 3 hit combo, 4th hit strikes a small bolt, no end lag --- */
  m1: {
    interval: 0.1,
    maxCombo: 4,
    cast(ctx, combo) {
      const { fx, player, world, combat, atk, aim } = ctx;
      const dir = dirTo(player.pos, aim);
      const origin = player.pos.clone().addScaledVector(dir, 1.8); origin.y = 1.3;
      fx.slash({
        pos: origin, dir, color: 0xbae6fd, radius: 2.2 + combo * 0.3,
        life: 0.2, tilt: rand(-0.8, 0.2), spin: rand(-1, 1) * 4,
      });
      const hits = combat.inCone(player.pos, dir, 4.6, 1.2);
      for (const e of hits) {
        e.takeDamage(atk * 1.5, { source: player, knockback: 1.2, from: player.pos, stun: 0.06 });
      }
      if (combo >= 4) {
        // finisher: small lightning bolt
        const target = combat.nearest(player.pos, 40);
        const p = target ? target.pos.clone() : randNear(aim, 6);
        fx.strike(p, { color: NEON, height: 50, width: 1.1, life: 0.3 });
        fx.explosion({
          pos: p.clone().setY(0.4), radius: 4.5, color: NEON, colorB: 0xe0f2fe,
          damage: atk * 2.2, source: player, stun: 0.3, shake: 0.5, scorch: false,
        });
        world.audio?.play('zap', { volume: 0.6, pitch: 1.4 });
      }
    },
  },

  skills: [
    {
      id: 'asalto',
      name: 'Asalto Atronador',
      key: '1',
      glyph: '☁',
      cd: 3,
      castTime: 0.3,
      anim: 'cast',
      sfx: 'whoosh',
      desc: 'Sends a storm cloud forward that detonates after 1s (2m).',
      cast(ctx) {
        const { fx, player, world, atk, aim } = ctx;
        const dir = dirTo(player.pos, aim);
        const p0 = player.pos.clone().addScaledVector(dir, 2); p0.y = 1.6;
        fx.projectiles.spawn({
          type: 'cloud', pos: p0, dir, speed: 26, radius: 1.7, life: 1.0,
          spin: 3, trail: { color: 0x9ad9ff, size: 2, rate: 40 },
          onEnd: (p) => {
            fx.explosion({
              pos: p.clone(), radius: 2, color: NEON, colorB: 0xe0f2fe,
              damage: atk * 3.4, source: player, stun: 0.4, shake: 0.4, scorch: false,
            });
            fx.boltBurst(p, { count: 3, radius: 1.6, color: NEON, height: 30 });
          },
          onHit: (e) => {
            fx.explosion({
              pos: e.pos.clone().setY(1), radius: 2, color: NEON, colorB: 0xe0f2fe,
              damage: atk * 3.4, source: player, stun: 0.4, shake: 0.4, scorch: false,
            });
          },
        });
        return true;
      },
    },
    {
      id: 'juicio_continuo',
      name: 'Juicio Continuo',
      key: '2',
      glyph: '🔆',
      cd: 10,
      hold: true,
      castTime: 0.3,
      anim: 'cast',
      sfx: 'thunder',
      desc: 'Hold: continuous bolts at the cursor. Costs 1% HP/s, +5% radius per second (max +50%), drags enemies within 9m. Stops under 50% HP.',
      onStart(ctx) {
        const { fx, player, aim } = ctx;
        player._jc = { t: 0, acc: 0, dmgAcc: 0, point: aim.clone() };
        fx.pillar({ pos: aim.clone(), height: 30, radius: 3.5, color: NEON, duration: 0.6, rings: 4 });
      },
      onChannel(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const st = player._jc;
        if (!st) return false;
        st.point.copy(aim);
        const dt = ctx.dt || 1 / 60;
        st.t += dt;
        const radius = 8 * (1 + Math.min(0.5, st.t * 0.05));       // +5% per second, max +50%

        // 1% max HP per second
        player.hp -= player.maxHp * 0.01 * dt;
        if (player.hp <= player.maxHp * 0.5) {
          player.hp = player.maxHp * 0.5;
          player._jc = null;
          world.ui?.toast('Juicio Continuo — health limit reached', 'warn', 900);
          return false;                                            // force release
        }

        // overlapping bolts
        st.acc += dt;
        if (st.acc > 0.09) {
          st.acc = 0;
          fx.boltBurst(st.point, { count: 3, radius: radius * 0.5, color: NEON, height: 54 });
          fx.decals.ring(st.point, { from: radius * 0.7, to: radius, duration: 0.3, color: NEON, opacity: 0.5 });
          world.audio?.play('zap', { volume: 0.35, pitch: rand(0.9, 1.4) });
        }
        // damage ticks
        st.dmgAcc += dt;
        if (st.dmgAcc > 0.25) {
          st.dmgAcc = 0;
          combat.area({ pos: st.point, radius, amount: atk * 0.9, source: player, stun: 0.2, falloff: false });
        }
        // drag enemies in
        combat.pull(st.point, 9, 16, { duration: 0.2 });
        return true;
      },
      onRelease(ctx) {
        const { fx, player } = ctx;
        player._jc = null;
        return true;
      },
    },
  ],
};

/* ======================================================================== */
/*  BISENTO                                                                 */
/* ======================================================================== */
export const BISENTO = {
  id: 'bisento',
  name: 'Bisento',
  short: 'BISENTO',
  color: 0xcbd5e1,
  accent: 0x38bdf8,
  mesh: 'bisento',
  glyph: '🔱',
  kind: 'sword',
  skills: [
    {
      id: 'quake_slam',
      name: 'Quake Slam',
      key: '1',
      glyph: '⬇',
      cd: 2,
      castTime: 0.5,
      anim: 'smash',
      sfx: 'boom',
      desc: 'Slams the blade down: shockwave, cracks, 2.5s stun and a huge knockback.',
      cast(ctx) {
        const { fx, player, world, atk, aim } = ctx;
        const dir = dirTo(player.pos, aim);
        const p = player.pos.clone().addScaledVector(dir, 3); p.y = 0.6;
        world.after(0.16, () => {
          fx.cracks(p, 22, { color: NEON, life: 2.6, count: 3 });
          fx.shockwave(p, { radius: 30, duration: 0.65, color: 0xe8f4ff, opacity: 0.95 });
          fx.explosion({
            pos: p, radius: 16, color: 0x94a3b8, colorB: 0xffffff,
            damage: atk * 5.5, source: player, stun: 2.5, knockback: 22, shake: 1.6,
            debrisColor: 0x6b6154,
          });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            fx.debris.spawn(tmp.v1.set(p.x + Math.cos(a) * 5, 0.5, p.z + Math.sin(a) * 5),
              { count: Math.round(4 * fx.pq), speed: 18, up: 1, scale: 0.9, color: 0x7a6f60 });
          }
        });
        return true;
      },
    },
    {
      id: 'quake_ball',
      name: 'Quake Ball',
      key: '2',
      glyph: '🔵',
      cd: 3,
      castTime: 0.35,
      anim: 'punch',
      sfx: 'whoosh',
      desc: 'Fires small quake orbs that detonate on contact.',
      cast(ctx) {
        const { fx, player, world, atk, aim } = ctx;
        const dir = dirTo(player.pos, aim);
        for (let i = 0; i < 3; i++) {
          const d = dir.clone();
          d.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1) * 0.13);
          const p0 = player.pos.clone().addScaledVector(d, 1.6); p0.y = 1.4;
          fx.projectiles.spawn({
            type: 'orb', pos: p0, dir: d, speed: 68, radius: 1.1, color: 0xa5d8ff,
            life: 2.2, trail: { color: 0x9ad9ff, size: 2, rate: 55 },
            onHit: (e) => {
              fx.explosion({
                pos: e.pos.clone().setY(1.1), radius: 6, color: 0x7dd3fc, colorB: 0xe8f4ff,
                damage: atk * 2.4, source: player, stun: 0.8, knockback: 5, shake: 0.6, scorch: false,
              });
              fx.cracks(e.pos, 6, { color: NEON, life: 1.6 });
            },
            onEnd: (p) => {
              fx.explosion({
                pos: p.clone(), radius: 6, color: 0x7dd3fc, colorB: 0xe8f4ff,
                damage: atk * 2.4, source: player, stun: 0.8, knockback: 5, shake: 0.6, scorch: false,
              });
            },
          });
        }
        return true;
      },
    },
    {
      id: 'mini_seaquake',
      name: 'Mini Seaquake',
      key: '3',
      glyph: '🌊',
      cd: 5,
      castTime: 0.6,
      anim: 'smash',
      sfx: 'boom',
      desc: 'Two small tsunamis rush in from both sides and sweep through you.',
      cast(ctx) {
        const { fx, player, world, atk } = ctx;
        const center = player.pos.clone();
        world.after(0.18, () => {
          fx.cracks(center, 14, { color: NEON, life: 2, count: 2 });
          for (const sign of [1, -1]) {
            const dir = new THREE.Vector3(sign, 0, 0);
            const origin = center.clone().addScaledVector(dir, -60);
            fx.tsunamis.spawn({
              origin, dir, width: 26, height: 9, speed: 44, distance: 120, curl: 4.5,
              color: 0x1d6fb8, foam: 0xdff3ff,
              onHit: (e) => {
                e.takeDamage(atk * 3.2, { source: player, stun: 0.8, knockback: 10, from: center, color: 0x7dd3fc });
              },
            });
          }
          fx.shake(1.4, 0.8);
        });
        return true;
      },
    },
  ],
};

function world_every(ctx, interval, count, fn) { ctx.world.every(interval, count, fn); }

/* ------------------------------------------------------------------ */
/*  Death Gravity Slashes upgrade economy                              */
/* ------------------------------------------------------------------ */
export const UPGRADE = {
  baseCost: 1000,
  growth: 1.75,
  maxLevel: 5,
  maxOver: 10,
};

export function upgradeCost(up) {
  return Math.floor(UPGRADE.baseCost * Math.pow(UPGRADE.growth, up.level + up.over));
}

export function canUpgrade(player) {
  const up = player.upgrades.deathSlashes;
  if (up.level >= UPGRADE.maxLevel && up.over >= UPGRADE.maxOver) return false;
  return player.tokens >= upgradeCost(up);
}

export function doUpgrade(player) {
  const up = player.upgrades.deathSlashes;
  const cost = upgradeCost(up);
  if (player.tokens < cost) return false;
  if (up.level >= UPGRADE.maxLevel && up.over >= UPGRADE.maxOver) return false;
  player.tokens -= cost;
  if (up.level < UPGRADE.maxLevel) {
    up.level++;
    player.world.ui?.toast(`Death Gravity Slashes → <b>Lv ${up.level}</b>`, 'good', 1400);
  } else {
    up.over++;
    up.bonus = Math.min(1, up.over * 0.1);
    player.world.ui?.toast(`Death Gravity Slashes buff <b>+${Math.round(up.bonus * 100)}%</b>`, 'good', 1400);
  }
  return true;
}

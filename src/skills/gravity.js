/**
 * GRAVITY FRUIT — purple (#a855f7)
 * Meteor summoning, gravitational collapse and purple lightning pillars.
 */
import * as THREE from 'three';
import { PURPLE } from '../fx/index.js';
import { randNear, randArena, rockify, unrockify, dirTo, pickTargets, handPos } from './util.js';
import { rand, randInt, clamp, chance, TAU, tmp } from '../core/utils.js';

const C = PURPLE;
const FIRE = 0xff5a00;

export const GRAVITY = {
  id: 'gravity',
  name: 'Gravity',
  color: 0xa855f7,
  glyph: '🟣',
  kind: 'fruit',
  skills: [
    /* ------------------------------------------------------------------ */
    {
      id: 'asteroid',
      name: 'Asteroid',
      key: 'Z',
      glyph: '☄',
      cd: 2,
      castTime: 0.35,
      anim: 'cast',
      sfx: 'boom',
      desc: 'Drops a giant asteroid onto the cursor. Explodes for 25m and leaves a fire pit (3% tick) for 10s.',
      cast(ctx) {
        const { fx, player, aim, atk } = ctx;
        const to = aim.clone();
        fx.meteor({
          to, height: 150, speed: 135, radius: 25, size: 3.4, color: FIRE,
          damage: atk * 7.5, source: player, stun: 0.5, knockback: 6, shake: 1.15,
          firepit: { duration: 10, pct: 0.03, color: 0xff6a1a },
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'grav_pressure',
      name: 'Gravitational Pressure',
      key: 'X',
      glyph: '◉',
      cd: 4,
      castTime: 0.9,
      anim: 'cast',
      sfx: 'whoosh',
      desc: 'Sucks every enemy into the centre of the arena, then detonates. +2% damage & radius per enemy (max +60%).',
      cast(ctx) {
        const { fx, player, world, combat, atk } = ctx;
        const center = new THREE.Vector3(0, 0, 0);
        const count = world.enemies.filter(e => e.alive).length;
        const bonus = Math.min(count * 0.02, 0.60);

        // pull stream visuals + repeated suction
        let ticks = 0;
        world.every(0.08, 11, () => {
          ticks++;
          combat.pull(center, 400, 34, { duration: 0.3, lift: 2.2 });
          // swirling particles
          const n = Math.round(14 * fx.pq);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const r = rand(18, 70);
            fx.glow.spawn({
              pos: { x: center.x + Math.cos(a) * r, y: rand(0.4, 12), z: center.z + Math.sin(a) * r },
              vel: { x: -Math.cos(a) * 26, y: rand(-1, 3), z: -Math.sin(a) * 26 },
              color: C, size: rand(1, 2.4), life: rand(0.25, 0.55), gravity: 0, drag: 0.2,
            });
          }
          fx.decals.ring(center, { from: 74 - ticks * 6, to: 66 - ticks * 6, duration: 0.3, color: C, opacity: 0.35 });
        });

        world.after(1.0, () => {
          const radius = 15 * (1 + bonus);
          fx.explosion({
            pos: center.clone().setY(0.5), radius,
            color: 0x7c3aed, colorB: 0xd8b4fe, ringColor: 0xc4b5fd,
            damage: atk * 9 * (1 + bonus), source: player, stun: 1.1, knockback: 12, shake: 1.6,
            debrisColor: 0x554b6b,
          });
          fx.shockwave(center, { radius: radius * 2.2, duration: 0.7, color: 0xd8b4fe, opacity: 0.8 });
          fx.cracks(center, radius * 1.4, { color: 0xc4b5fd, life: 2.4, count: 3 });
          // collapse column
          fx.pillar({ pos: center, height: 70, radius: 7, color: C, duration: 1.1, rings: 9 });
          world.audio?.play('boom', { volume: 1.5, pitch: 0.75 });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'grav_lightning',
      name: 'Gravitational Lightning',
      key: 'C',
      glyph: '⚡',
      cd: 6.5,
      castTime: 0.6,
      anim: 'cast',
      sfx: 'thunder',
      desc: 'A purple ring-stacked pillar erupts and fires 8 bursts of overlapped bolts at enemies within 17m.',
      cast(ctx) {
        const { fx, player, world, combat, atk } = ctx;
        const origin = player.pos.clone();
        fx.pillar({ pos: origin, height: 46, radius: 4.6, color: C, duration: 2.6, rings: 8 });
        world.audio?.play('thunder', { volume: 0.9, pitch: 1.1 });

        let burst = 0;
        world.every(0.25, 8, () => {
          burst++;
          const targets = combat.inRadius(origin, 17);
          const spots = targets.length ? targets.map(e => e.pos.clone()) : [randNear(origin, 12)];
          for (const p of spots.slice(0, 8)) {
            fx.strike(p, { color: C, height: 62, width: rand(0.9, 1.6), life: rand(0.26, 0.4) });
            fx.explosion({
              pos: p.clone().setY(0.4), radius: 5.2, color: 0x8b5cf6, colorB: 0xe9d5ff,
              damage: atk * 1.8, source: player, stun: 0.18, shake: 0.35, scorch: false, debris: false,
            });
          }
          // 12% chance to drop 1–5 small meteors around the lightning
          if (chance(0.12)) {
            const n = randInt(1, 5);
            for (let i = 0; i < n; i++) {
              fx.smallMeteor({
                to: randNear(origin, 22), height: 80, speed: 145, radius: 6,
                color: 0xff7b1a, damage: atk * 1.4, source: player,
              });
            }
          }
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'hiauna',
      name: 'Hiauna',
      key: 'V',
      glyph: '🪨',
      cd: 8,
      castTime: 1.5,
      anim: 'cast',
      sfx: 'rumble',
      desc: 'Enemies within 29m become giant rocks, rise for 1.5s then slam down and explode for 22m. With no enemies, 4 lightning bursts heal you.',
      cast(ctx) {
        const { fx, player, world, combat, atk } = ctx;
        const list = combat.inRadius(player.pos, 29);

        if (!list.length) {
          // ---- heal branch ----
          let i = 0;
          world.every(0.5, 4, () => {
            i++;
            fx.strike(player.pos, { color: C, height: 70, width: 1.6, life: 0.4 });
            fx.impact(tmp.v1.set(player.pos.x, player.pos.y + 1, player.pos.z), { color: 0xc4b5fd, radius: 2.4, count: 14 });
            player.heal(player.maxHp * 0.07);
            fx.decals.ring(player.pos, { from: 1, to: 9, duration: 0.5, color: 0x86efac, opacity: 0.7 });
            world.audio?.play('thunder', { volume: 0.7, pitch: 1.5 });
          });
          world.ui?.toast('No enemies detected — <b>lightning recovery</b>', 'good', 1200);
          return true;
        }

        // ---- petrify branch ----
        list.forEach((e, idx) => {
          const delay = idx * 0.2;                 // individual slam interval
          rockify(e, 1.5 + delay, { scale: 2.4 });
          e.petrify(1.5 + delay);
          e.lift(1.5 + delay, 11);
          fx.decals.ring(e.pos, { from: 1, to: 8, duration: 0.6, color: 0x8b5cf6, opacity: 0.7 });
          fx.impact(e.pos, { color: 0x8b5cf6, radius: 2, count: 10 });

          world.after(1.5 + delay, () => {
            if (!e.alive) { unrockify(e); return; }
            // slam down at high speed
            e.kb.set(0, -260, 0);
            e.vel.y = -40;
            world.after(0.14, () => {
              unrockify(e);
              const p = e.pos.clone(); p.y = 0.4;
              fx.explosion({
                pos: p, radius: 22, color: 0x7c3aed, colorB: 0xe9d5ff,
                damage: atk * 6.5, source: player, stun: 1.4, knockback: 14, shake: 1.4,
                debrisColor: 0x6b6154,
              });
              fx.cracks(p, 20, { color: 0xa78bfa, life: 2.2, count: 2 });
              fx.shockwave(p, { radius: 30, duration: 0.65, color: 0xd8b4fe, opacity: 0.9 });
            });
          });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'asteroid_rain',
      name: 'Asteroid Rain',
      key: 'B',
      glyph: '🌠',
      cd: 10,
      castTime: 1.2,
      anim: 'cast',
      sfx: 'boom',
      desc: '8 giant asteroids rain down on random positions. 25m explosions leave 10s fire pits (5% tick).',
      cast(ctx) {
        const { fx, player, aim, atk } = ctx;
        world_every(ctx, 0.3, 8, () => {
          const to = randNear(aim, 45);
          fx.meteor({
            to, height: 160, speed: 145, radius: 25, size: 3.4, color: FIRE,
            damage: atk * 7.5, source: player, stun: 0.6, knockback: 7, shake: 1.1,
            firepit: { duration: 10, pct: 0.05, color: 0xff6a1a },
          });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'grav_punch',
      name: 'Gravitational Punch',
      key: 'F',
      glyph: '👊',
      cd: 10,
      castTime: 1.0,
      anim: 'punch',
      sfx: 'boom',
      desc: 'Pulls enemies in, then unleashes a charged punch that knocks them 10m and calls 4 bursts of lightning as they land.',
      cast(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const dir = dirTo(player.pos, aim);
        const anchor = player.pos.clone();

        // suction
        world.every(0.1, 6, () => {
          combat.pull(anchor, 45, 26, { duration: 0.35 });
          for (let i = 0; i < Math.round(8 * fx.pq); i++) {
            const a = Math.random() * TAU, r = rand(10, 40);
            fx.glow.spawn({
              pos: { x: anchor.x + Math.cos(a) * r, y: rand(0.5, 8), z: anchor.z + Math.sin(a) * r },
              vel: { x: -Math.cos(a) * 30, y: 0, z: -Math.sin(a) * 30 },
              color: C, size: rand(1, 2.2), life: rand(0.2, 0.45), gravity: 0, drag: 0.2,
            });
          }
        });

        world.after(0.62, () => {
          const hitPos = anchor.clone().addScaledVector(dir, 7);
          hitPos.y = 1.2;
          // the punch
          fx.explosion({
            pos: hitPos, radius: 16, color: 0x6d28d9, colorB: 0xede9fe,
            damage: atk * 13, source: player, knockback: 10, stun: 1.6, shake: 2.6, shakeDur: 1.1,
            from: anchor, debrisColor: 0x554b6b,
          });
          fx.shockwave(hitPos, { radius: 44, duration: 0.75, color: 0xede9fe, opacity: 0.95 });
          fx.cracks(hitPos, 26, { color: 0xa78bfa, life: 2.6, count: 3 });
          fx.shake(2.4, 1.2);
          world.audio?.play('boom', { volume: 1.6, pitch: 0.6 });

          // lightning bursts as they land
          let b = 0;
          world.every(0.5, 4, () => {
            b++;
            const targets = combat.inRadius(anchor, 34);
            const spots = targets.length ? targets.map(e => e.pos.clone()) : [randNear(anchor, 16)];
            for (const p of spots.slice(0, 8)) {
              fx.strike(p, { color: C, height: 68, width: rand(1.1, 2.0), life: rand(0.3, 0.5) });
              fx.explosion({
                pos: p.clone().setY(0.4), radius: 7, color: 0x8b5cf6, colorB: 0xf5f3ff,
                damage: atk * 2.4, source: player, stun: 0.2, shake: 0.5, scorch: false,
              });
            }
          });
        });
        return true;
      },
    },
  ],
};

/* local helper so the module reads cleanly */
function world_every(ctx, interval, count, fn) { ctx.world.every(interval, count, fn); }

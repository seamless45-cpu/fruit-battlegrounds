/**
 * LIGHTNING FRUIT — neon blue (#38bdf8)
 * Beasts, storms, judgement pillars and a chargeable thunder ball.
 */
import * as THREE from 'three';
import { NEON } from '../fx/index.js';
import { randNear, randArena, dirTo, pickTargets, handPos } from './util.js';
import { rand, randInt, clamp, chance, TAU, tmp } from '../core/utils.js';

const C = NEON;
const WHITE = 0xe0f2fe;

export const LIGHTNING = {
  id: 'lightning',
  name: 'Lightning',
  color: NEON,
  glyph: '⚡',
  kind: 'fruit',
  skills: [
    /* ------------------------------------------------------------------ */
    {
      id: 'bestia',
      name: 'Bestia Relámpago',
      key: 'Z',
      glyph: '🐺',
      cd: 5,
      castTime: 0.35,
      anim: 'cast',
      sfx: 'zap',
      desc: 'Launches a beast of lightning that auto-aims and explodes on impact (3m).',
      cast(ctx) {
        const { fx, player, combat, world, atk, aim } = ctx;
        const target = combat.nearest(player.pos, 80);
        const dir = target ? dirTo(player.pos, target.pos) : dirTo(player.pos, aim);
        const p0 = player.pos.clone().addScaledVector(dir, 1.8); p0.y = 1.3;

        fx.projectiles.spawn({
          type: 'beast',
          pos: p0,
          dir,
          speed: 20,
          radius: 1.25,
          color: C,
          life: 6,
          turn: target ? 2.6 : 0,
          target,
          trail: { color: C, size: 2.2, rate: 70 },
          onHit: (e) => {
            fx.explosion({
              pos: e.pos.clone().setY(1), radius: 3, color: C, colorB: WHITE,
              damage: atk * 4.5, source: player, stun: 0.4, shake: 0.5, scorch: false,
            });
          },
          onEnd: (p) => {
            fx.explosion({
              pos: p.clone(), radius: 3, color: C, colorB: WHITE,
              damage: atk * 4.5, source: player, stun: 0.4, shake: 0.5, scorch: false,
            });
          },
        });
        fx.impact(p0, { color: C, radius: 1.6, count: 12 });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'tormenta',
      name: 'Tormenta',
      key: 'X',
      glyph: '🌩',
      cd: 8,
      castTime: 0.5,
      anim: 'cast',
      sfx: 'thunder',
      desc: '17 showers of overlapped bolts rain on random areas (4.5m blasts).',
      cast(ctx) {
        const { fx, player, world, atk, aim } = ctx;
        const center = aim.clone();
        let i = 0;
        world.every(0.22, 17, () => {
          i++;
          const p = randNear(center, 26);
          fx.boltBurst(p, { count: 3, radius: 2.2, color: C, height: 52 });
          fx.explosion({
            pos: p.clone().setY(0.4), radius: 4.5, color: C, colorB: WHITE,
            damage: atk * 2.6, source: player, stun: 0.3, shake: 0.4, scorch: false, debris: false,
          });
          if (i % 3 === 0) world.audio?.play('thunder', { volume: 0.55, pitch: rand(0.9, 1.3) });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'juicio',
      name: 'Juicio Celestial',
      key: 'C',
      glyph: '⚖',
      cd: 12,
      castTime: 0.8,
      anim: 'cast',
      sfx: 'thunder',
      desc: 'A pillar of overlapping bolts lifts and stuns everything within 7m for 3s.',
      cast(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const p = aim.clone();
        fx.pillar({ pos: p, height: 60, radius: 5.5, color: C, duration: 2.2, rings: 10 });
        world.every(0.1, 16, () => {
          fx.boltBurst(p, { count: 5, radius: 3.4, color: C, height: 66 });
        });
        world.after(0.25, () => {
          combat.area({
            pos: p, radius: 7, amount: atk * 2.2, source: player,
            stun: 3, lift: 1.1, liftHeight: 8, falloff: false,
          });
          fx.shockwave(p, { radius: 26, duration: 0.6, color: WHITE, opacity: 0.9 });
          fx.explosion({
            pos: p.clone().setY(1), radius: 9, color: C, colorB: WHITE,
            source: player, damage: 0, shake: 1.1, scorch: true,
          });
        });
        world.audio?.play('thunder', { volume: 1.3, pitch: 0.85 });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'bola_trueno',
      name: 'Destrucción de Bola de Trueno',
      key: 'V',
      glyph: '🔮',
      cd: 20,
      hold: true,
      castTime: 0.4,
      anim: 'cast',
      sfx: 'charge',
      desc: 'Hold to grow a black thunder ball (+3% per 0.05s, max 120%). Release to crash it down — the blast keeps expanding for 5s.',
      chargeRatio(t) { return Math.min(1, (Math.floor(t / 0.05) * 3) / 120); },
      onStart(ctx) {
        const { fx, player, world } = ctx;
        const pos = player.pos.clone(); pos.y += 58;
        player._ball = fx.projectiles.spawn({
          type: 'ball', pos, dir: new THREE.Vector3(0, -1, 0), speed: 0.001,
          radius: 3, color: 0x8b5cf6, life: 30, scale: 1,
          trail: { color: 0x8b5cf6, size: 2.4, rate: 30 },
          onEnd: () => {},
        });
        player._ballCloud = fx.stormCloud({ pos: pos.clone().setY(64), radius: 9, color: 0x8b5cf6, life: 30 });
        world.audio?.play('charge');
      },
      onChannel(ctx) {
        const { fx, player, world } = ctx;
        const ball = player._ball;
        if (!ball) return false;
        const charge = Math.min(120, Math.floor(ctx.chargeTime / 0.05) * 3);
        ball.charge = charge;
        const s = 1 + (charge / 100) * 1.15;
        ball.mesh.scale.setScalar(ball.radius * s);
        // crackling energy + rising particles
        for (let i = 0; i < Math.round(3 * fx.pq); i++) {
          const a = Math.random() * TAU, r = 3 * s * rand(0.8, 1.4);
          fx.glow.spawn({
            pos: { x: ball.pos.x + Math.cos(a) * r, y: ball.pos.y + rand(-2, 2), z: ball.pos.z + Math.sin(a) * r },
            vel: { x: -Math.cos(a) * 6, y: rand(-2, 3), z: -Math.sin(a) * 6 },
            color: 0xa78bfa, size: rand(1, 2.6), life: rand(0.2, 0.5), gravity: 0, drag: 0.6,
          });
        }
        if (Math.random() < 0.25) {
          fx.bolt(
            tmp.v1.set(ball.pos.x + rand(-8, 8), ball.pos.y + 30, ball.pos.z + rand(-8, 8)),
            tmp.v2.set(ball.pos.x + rand(-3, 3), ball.pos.y, ball.pos.z + rand(-3, 3)),
            { color: 0x8b5cf6, width: 0.7, life: 0.2 },
          );
        }
        // follow the player while charging
        ball.pos.x = player.pos.x; ball.pos.z = player.pos.z;
        ball.pos.y = player.pos.y + 58;
        if (player._ballCloud) player._ballCloud.group.position.set(player.pos.x, 64, player.pos.z);
        return true;
      },
      onRelease(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const ball = player._ball;
        player._ball = null;
        if (player._ballCloud) { player._ballCloud.dur = 1.2; player._ballCloud = null; }
        if (!ball) return false;

        const charge = Math.min(120, Math.floor(ctx.chargeTime / 0.05) * 3);
        const scale = 1 + (charge / 100) * 1.15;
        const to = aim.clone(); to.y = 0.5;
        const dir = new THREE.Vector3().subVectors(to, ball.pos).normalize();
        const dist = ball.pos.distanceTo(to);
        ball.vel.copy(dir).multiplyScalar(50);            // crash speed 50 m/s
        ball.life = dist / 50 + 1.2;
        ball.spin = 2;

        const dmg = atk * (10 + (charge / 100) * 16);
        ball.onEnd = (p) => {
          const center = p.clone(); center.y = 0.5;
          fx.explosion({
            pos: center, radius: 12 * scale, color: 0x8b5cf6, colorB: WHITE,
            damage: dmg * 0.35, source: player, stun: 1, knockback: 12, shake: 2.2, shakeDur: 1.2,
          });
          fx.shockwave(center, { radius: 40, duration: 0.8, color: WHITE, opacity: 0.9 });
          world.audio?.play('boom', { volume: 1.6, pitch: 0.7 });

          // the blast keeps expanding at 15 m/s for 5 seconds
          const hit = new Set();
          let r = 12 * scale;
          world.every(0.08, 62, () => {
            r += 15 * 0.08;
            for (const e of world.enemies) {
              if (!e.alive || hit.has(e.id)) continue;
              const d = Math.hypot(e.pos.x - center.x, e.pos.z - center.z);
              if (d <= r + e.radius) {
                hit.add(e.id);
                e.takeDamage(dmg * 0.09, { source: player, stun: 0.5, knockback: 8, from: center, crit: 1 });
              }
            }
            fx.decals.ring(center, { from: r - 2, to: r + 1, duration: 0.5, color: WHITE, opacity: 0.5 });
            if (Math.random() < 0.5) {
              const a = Math.random() * TAU;
              const pr = tmp.v1.set(center.x + Math.cos(a) * r * 0.9, 0.5, center.z + Math.sin(a) * r * 0.9);
              fx.explosion({
                pos: pr.clone(), radius: 5, color: 0x8b5cf6, colorB: WHITE,
                source: player, damage: 0, shake: 0.4, scorch: false, debris: false,
              });
            }
            if (Math.random() < 0.3) fx.boltBurst(randNear(center, r * 0.8), { count: 2, radius: 2, color: C, height: 40 });
          });
          // lightning pillar at the impact
          fx.pillar({ pos: center, height: 70, radius: 8 * scale, color: 0x8b5cf6, duration: 1.4, rings: 8 });
        };
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'destello',
      name: 'Destello Eléctrico',
      key: 'B',
      glyph: '💨',
      cd: 1,
      castTime: 0.2,
      anim: 'cast',
      sfx: 'zap',
      desc: 'Lightning-speed dash (10m). 3 charges, +1 every 3s. Damages whatever you pass through.',
      cast(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        if (player.dashCharges <= 0) { world.ui?.toast('No dash charges', 'warn', 700); return false; }
        if (player.dashTimer > 0) return false;
        player.dashCharges--;
        player.dashTimer = 0.2;

        const dir = player.channel ? dirTo(player.pos, aim) : dirTo(player.pos, aim);
        const steps = 6, stepLen = 10 / steps;
        const hit = new Set();
        player.invulnT = Math.max(player.invulnT, 0.12);
        world.every(0.007, steps, () => {
          player.pos.addScaledVector(dir, stepLen);
          fx.glow.spawn({
            pos: { x: player.pos.x, y: 1 + rand(-0.4, 0.6), z: player.pos.z },
            vel: { x: rand(-1, 1), y: rand(-1, 1), z: rand(-1, 1) },
            color: C, size: rand(1.4, 3.2), life: rand(0.15, 0.35), gravity: 0, drag: 2,
          });
          for (const e of world.enemies) {
            if (!e.alive || hit.has(e.id)) continue;
            if (Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < e.radius + 1.8) {
              hit.add(e.id);
              e.takeDamage(atk * 2.2, { source: player, stun: 0.25, knockback: 3, from: player.pos });
            }
          }
        });
        fx.bolt(
          player.pos.clone().setY(1.4),
          player.pos.clone().addScaledVector(dir, 10).setY(1.4),
          { color: C, width: 0.8, life: 0.18, branches: 1 },
        );
        fx.impact(player.pos.clone().setY(1), { color: C, radius: 1.4, count: 10 });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'mas_alla',
      name: 'Más Allá del Trueno',
      key: 'F',
      glyph: '🌪',
      cd: 30,
      castTime: 1.0,
      anim: 'cast',
      sfx: 'thunder',
      desc: '120 thunderclouds blanket the sky and hammer random areas with 16m blasts, stunning for 3s.',
      cast(ctx) {
        const { fx, player, world, combat, atk } = ctx;
        const center = player.pos.clone();
        world.ui?.toast('<b>MÁS ALLÁ DEL TRUENO</b>', 'warn', 2200);
        world.audio?.play('thunder', { volume: 1.4, pitch: 0.7 });

        let i = 0;
        world.every(0.1, 120, () => {
          i++;
          const p = randNear(center, 85);
          const cloud = fx.stormCloud({ pos: p.clone().setY(rand(40, 58)), radius: rand(4, 7), color: C, life: 1.8 });
          fx.boltBurst(p, { count: 3, radius: 4, color: C, height: 46 });
          fx.explosion({
            pos: p.clone().setY(0.4), radius: 16, color: C, colorB: WHITE,
            damage: atk * 1.1, source: player, stun: 3, shake: 0.35, scorch: false, debris: false,
          });
          if (i % 8 === 0) world.audio?.play('thunder', { volume: 0.5, pitch: rand(0.8, 1.4) });
          if (i % 20 === 0) fx.shake(1.2, 0.6);
        });
        return true;
      },
    },
  ],
};

/**
 * QUAKE FRUIT — shockwaves, cracks (neon blue, quake-flavoured lightning)
 * and tsunamis.
 */
import * as THREE from 'three';
import { NEON } from '../fx/index.js';
import { randNear, dirTo, handPos, armPositions } from './util.js';
import { rand, randInt, clamp, chance, TAU, tmp } from '../core/utils.js';

const CRACK = NEON;      // quake cracks reuse the neon-blue lightning look
const WHITE = 0xe8f4ff;

export const QUAKE = {
  id: 'quake',
  name: 'Quake',
  color: 0xcbd5e1,
  glyph: '💥',
  kind: 'fruit',
  skills: [
    /* ------------------------------------------------------------------ */
    {
      id: 'fatal_destruction',
      name: 'Fatal Destruction',
      key: 'Z',
      glyph: '✊',
      cd: 5,
      castTime: 1.4,
      anim: 'punch',
      sfx: 'boom',
      desc: 'Grabs an enemy in front of you: the screen freezes red, then a devastating quake punch launches them away.',
      cast(ctx) {
        const { fx, player, world, combat, atk, aim } = ctx;
        const dir = dirTo(player.pos, aim);
        const caught = combat.inCone(player.pos, dir, 15, 0.55);
        if (!caught.length) {
          world.ui?.toast('Fatal Destruction — nothing caught', 'warn', 800);
          return true;                       // nothing happens, cooldown still burns
        }

        // ---- screen pause + red shift for 1 second ----
        world.slowmo(1.0, 0.02);
        world.ui?.redShift(1.0);
        world.audio?.play('heartbeat');

        const target = caught[0];
        combat.pull(player.pos, 22, 30, { duration: 0.6 });
        fx.decals.ring(target.pos, { from: 8, to: 1.5, duration: 0.9, color: 0xff0033, opacity: 0.8 });

        world.after(1.0, () => {
          const hit = player.pos.clone().addScaledVector(dir, 5.5); hit.y = 1.4;
          fx.explosion({
            pos: hit, radius: 17, color: 0xb91c1c, colorB: 0xffd7d7, ringColor: 0xffffff,
            damage: atk * 17, source: player, knockback: 30, stun: 1.8, shake: 3.2, shakeDur: 1.4,
            debrisColor: 0x6b6154,
          });
          fx.shockwave(hit, { radius: 52, duration: 0.8, color: WHITE, opacity: 1 });
          fx.cracks(hit, 30, { color: CRACK, life: 3, count: 4 });
          fx.pillar({ pos: hit, height: 40, radius: 6, color: 0xff5a5a, duration: 0.9, rings: 6 });
          world.audio?.play('boom', { volume: 1.8, pitch: 0.55 });
          world.ui?.flashWhite(0.55);
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'air_crusher',
      name: 'Air Crusher',
      key: 'X',
      glyph: '🌀',
      cd: 7,
      castTime: 0.4,
      anim: 'punch',
      sfx: 'whoosh',
      desc: 'Fires a large quake orb that stuns for 2s. Cracks tear out of your hand as you cast.',
      cast(ctx) {
        const { fx, player, world, atk, aim } = ctx;
        const dir = dirTo(player.pos, aim);
        const hand = handPos(player);
        fx.cracks(hand, 5, { color: CRACK, life: 1.6 });
        fx.impact(hand, { color: WHITE, radius: 1.6, count: 12 });

        const p0 = hand.clone().addScaledVector(dir, 1.2);
        fx.projectiles.spawn({
          type: 'orb',
          pos: p0,
          dir,
          speed: 55,
          radius: 2.6,
          color: 0xa5d8ff,
          life: 3,
          spin: 8,
          trail: { color: 0x9ad9ff, size: 3, rate: 70 },
          onHit: (e) => {
            fx.explosion({
              pos: e.pos.clone().setY(1.2), radius: 10, color: 0x7dd3fc, colorB: WHITE,
              damage: atk * 7, source: player, stun: 2, knockback: 8, shake: 1,
            });
            fx.cracks(e.pos, 9, { color: CRACK, life: 2.2 });
          },
          onEnd: (p) => {
            fx.explosion({
              pos: p.clone(), radius: 10, color: 0x7dd3fc, colorB: WHITE,
              damage: atk * 7, source: player, stun: 2, knockback: 8, shake: 1,
            });
            fx.cracks(p, 9, { color: CRACK, life: 2.2 });
          },
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'spatial_shockwave',
      name: 'Spatial Shockwave',
      key: 'C',
      glyph: '💫',
      cd: 7,
      castTime: 0.9,
      anim: 'smash',
      sfx: 'boom',
      desc: 'Smash the ground: white shockwave, cracks and debris everywhere. Stuns 5s, knocks back 10m.',
      cast(ctx) {
        const { fx, player, world, combat, atk } = ctx;
        world.after(0.22, () => {
          const p = player.pos.clone(); p.y = 0.6;
          // cracks on both ground layers
          fx.cracks(p, 30, { color: CRACK, life: 3.4, count: 5 });
          // white semi-transparent expanding shockwave
          fx.shockwave(p, { radius: 38, duration: 0.75, color: WHITE, opacity: 0.95 });
          fx.shockwave(p, { radius: 62, duration: 1.1, color: 0xbfdbfe, opacity: 0.5 });
          fx.explosion({
            pos: p, radius: 26, color: 0x9fb6cc, colorB: WHITE, ringColor: WHITE,
            damage: atk * 9, source: player, stun: 5, knockback: 10, shake: 2.4, shakeDur: 1.2,
            debrisColor: 0x6b6154,
          });
          // debris blocks at both arms + a ring around the player
          const arms = armPositions(player);
          for (const a of arms) {
            fx.debris.spawn(a, { count: Math.round(8 * fx.pq), speed: 16, up: 1.1, scale: 0.8, color: 0x6b6154 });
            fx.impact(a, { color: WHITE, radius: 2, count: 12 });
          }
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * TAU;
            fx.debris.spawn(
              tmp.v1.set(p.x + Math.cos(ang) * 7, 0.6, p.z + Math.sin(ang) * 7),
              { count: Math.round(5 * fx.pq), speed: 22, up: 1.2, scale: 1.2, color: 0x7a6f60 },
            );
          }
          fx.pillar({ pos: p, height: 34, radius: 9, color: WHITE, duration: 0.8, rings: 5 });
          world.audio?.play('boom', { volume: 1.5, pitch: 0.6 });
        });
        return true;
      },
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'seaquake',
      name: 'Seaquake',
      key: 'V',
      glyph: '🌊',
      cd: 14.5,
      castTime: 1.0,
      anim: 'smash',
      sfx: 'boom',
      desc: 'Three rapid ground expansions, then 4 tsunamis crash in from every side (10% chance of 8).',
      cast(ctx) {
        const { fx, player, world, atk } = ctx;
        const center = player.pos.clone();

        // ground smash — expands 3 times with cracks along the floor
        world.every(0.3, 3, (i) => {
          const r = 22 + i * 22;
          fx.shockwave(center, { radius: r, duration: 0.6, color: WHITE, opacity: 0.85 });
          fx.cracks(center, r * 0.55, { color: CRACK, life: 2.6, count: 3 });
          fx.debris.spawn(center, { count: Math.round(10 * fx.pq), speed: 20 + i * 8, up: 1.1, scale: 1, color: 0x6b6154 });
          fx.shake(1.2 + i * 0.4, 0.7);
          world.audio?.play('boom', { volume: 1.1, pitch: 0.8 - i * 0.1 });
        });

        world.after(1.0, () => {
          const eight = chance(0.1);
          const n = eight ? 8 : 4;
          const pct = eight ? 0.125 : 0.25;
          const base = atk * 26;
          if (eight) world.ui?.toast('<b>MEGA SEAQUAKE — 8 TSUNAMIS</b>', 'good', 1600);

          for (let i = 0; i < n; i++) {
            const ang = (i / n) * TAU + Math.PI / 4;
            const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
            const origin = center.clone().addScaledVector(dir, -85);
            fx.tsunamis.spawn({
              origin, dir,
              width: eight ? 34 : 46,
              height: eight ? 15 : 18,
              speed: 46,
              distance: 170,
              curl: 6.5,
              color: 0x1d6fb8,
              foam: 0xdff3ff,
              onHit: (e) => {
                e.takeDamage(base * pct, {
                  source: player, stun: 1.2, knockback: 14, from: center, color: 0x7dd3fc,
                });
                fx.impact(e.pos.clone().setY(1.5), { color: 0xdff3ff, radius: 1.8, count: 8 });
              },
            });
          }
          fx.shake(2.4, 1.6);
          world.audio?.play('boom', { volume: 1.6, pitch: 0.5 });
        });
        return true;
      },
    },
  ],
};

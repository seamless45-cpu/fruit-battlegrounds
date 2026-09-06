// ============================================================
//  Pre-rendered VFX engine — pooled sprites, shared meshes.
// ============================================================
import * as THREE from 'three';
import { bakeVfxAtlas } from './prerender.js';
import { GEO } from './models.js';

class Pool {
  constructor(create, size) {
    this.create = create;
    this.free = [];
    this.busy = new Set();
    for (let i = 0; i < size; i++) this.free.push(create());
  }
  take() {
    const n = this.free.pop();
    if (!n) return null;
    n.visible = true;
    this.busy.add(n);
    return n;
  }
  give(n) {
    if (!n || this.free.includes(n)) return;
    n.visible = false;
    this.busy.delete(n);
    this.free.push(n);
  }
}

function spriteMat(map, additive = true) {
  return new THREE.SpriteMaterial({
    map, color: 0xffffff, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.updaters = [];
    this.shakeTrauma = 0;
    this.shakeMax = 2.2;
    this.shakeOffset = new THREE.Vector3();
    this._t = 0;
    this.particles = true;

    this.atlas = bakeVfxAtlas();
    const { glow, ring, bolt, slash, fire, spark, ice, water } = this.atlas;

    const mkSpritePool = (tex, n, additive = true) => new Pool(() => {
      const s = new THREE.Sprite(spriteMat(tex, additive));
      s.visible = false;
      scene.add(s);
      return s;
    }, n);

    this.glow = mkSpritePool(glow, 48);
    this.rings = mkSpritePool(ring, 18);
    this.bolts = mkSpritePool(bolt, 28);
    this.slashes = mkSpritePool(slash, 12);
    this.fires = mkSpritePool(fire, 16);
    this.sparks = mkSpritePool(spark, 40);
    this.ices = mkSpritePool(ice, 16, false);
    this.waters = mkSpritePool(water, 8);

    this.rocks = new Pool(() => {
      const m = new THREE.Mesh(GEO.ico, new THREE.MeshStandardMaterial({ color: 0x7a6a88, roughness: 1, flatShading: true }));
      m.visible = false; scene.add(m); return m;
    }, 14);

    this.orbs = new Pool(() => {
      const m = new THREE.Mesh(GEO.sphere, new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.35, metalness: 0.2, emissive: 0x111111, emissiveIntensity: 0.4,
      }));
      m.visible = false; scene.add(m); return m;
    }, 12);

    this.lines = new Pool(() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
      geo.setDrawRange(0, 18);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: true });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      return line;
    }, 36);

    this.waves = new Pool(() => {
      const m = new THREE.Mesh(GEO.box, new THREE.MeshStandardMaterial({
        color: 0x3aa0d8, roughness: 0.45, metalness: 0.2, transparent: true, opacity: 0.82,
      }));
      m.visible = false; scene.add(m); return m;
    }, 6);

    this.nums = [];
    for (let i = 0; i < 28; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const tex = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sprite.visible = false;
      sprite.scale.set(2.4, 1.2, 1);
      scene.add(sprite);
      this.nums.push({ canvas, ctx, tex, sprite, busy: false });
    }
  }

  add(upd) {
    if (this.updaters.length > 150) {
      try { upd.dispose && upd.dispose(); } catch (_) {}
      return;
    }
    this.updaters.push(upd);
  }

  shake(amount = 0.5, intensity = null) {
    if (intensity != null) this.shakeMax = intensity;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }
  updateShake(dt) {
    this._t += dt;
    if (this.shakeTrauma <= 0) { this.shakeOffset.set(0, 0, 0); return; }
    const s = this.shakeTrauma * this.shakeTrauma;
    const f = this._t * 47;
    const o = this.shakeMax * s;
    this.shakeOffset.set(
      Math.sin(f) * o * 0.7 + (Math.random() * 2 - 1) * o * 0.3,
      Math.sin(f * 1.3) * o * 0.5,
      Math.cos(f * 0.9) * o * 0.7,
    );
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.6);
  }
  shakeFor(seconds, perSecond = 0.6, intensity = null) {
    if (intensity != null) this.shakeMax = intensity;
    let left = seconds;
    this.add({
      update: (dt) => { left -= dt; this.shake(perSecond * dt, intensity); return left > 0; },
      dispose: () => {},
    });
  }

  update(dt) {
    this.updateShake(dt);
    for (let i = this.updaters.length - 1; i >= 0; i--) {
      const u = this.updaters[i];
      try {
        const alive = u.update(dt, this._t);
        if (!alive) { try { u.dispose && u.dispose(); } catch (e) { console.warn('fx dispose', e); } this.updaters.splice(i, 1); }
      } catch (e) {
        console.warn('fx updater error', e);
        try { u.dispose && u.dispose(); } catch (_) {}
        this.updaters.splice(i, 1);
      }
    }
  }

  _flash(pool, x, y, z, color, scale, life, grow = 1.8) {
    const s = pool.take();
    if (!s) return;
    s.position.set(x, y, z);
    s.material.color.setHex(color);
    s.material.opacity = 1;
    s.scale.setScalar(scale);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = t / life;
        s.material.opacity = 1 - k;
        const sc = scale * (1 + grow * k);
        s.scale.set(sc, sc, 1);
        return t < life;
      },
      dispose: () => pool.give(s),
    });
  }

  explosion(opts = {}) {
    const { x = 0, z = 0, radius = 8, color = 0xff7a2a, life = 0.55, debris = 8 } = opts;
    this._flash(this.rings, x, 0.12, z, color, Math.max(1.6, radius * 0.22), life * 1.15, 3.4);
    if (debris > 0 && this.particles) {
      this.debris(x, z, Math.min(debris, 12), color, radius * 0.55);
      this._chunks(x, z, Math.min(4, 1 + (debris / 4) | 0), color, radius * 0.35);
    }
  }

  debris(x, z, count, color = 0xffa040, spread = 6) {
    const n = Math.min(count, 10);
    for (let i = 0; i < n; i++) {
      const s = this.sparks.take();
      if (!s) return;
      s.position.set(x, 0.4 + Math.random() * 0.6, z);
      s.material.color.setHex(color);
      s.material.opacity = 1;
      s.scale.setScalar(0.45 + Math.random() * 0.55);
      const vel = new THREE.Vector3((Math.random() * 2 - 1) * spread, 6 + Math.random() * 10, (Math.random() * 2 - 1) * spread);
      let t = 0; const life = 0.55 + Math.random() * 0.5;
      this.add({
        update: (dt) => {
          t += dt;
          vel.y -= 38 * dt;
          vel.x *= (1 - 1.2 * dt);
          vel.z *= (1 - 1.2 * dt);
          s.position.addScaledVector(vel, dt);
          if (s.position.y < 0.08 && vel.y < 0) {
            s.position.y = 0.08;
            vel.y *= -0.38;
            vel.x *= 0.55;
            vel.z *= 0.55;
            if (Math.abs(vel.y) < 1.4) vel.y = 0;
          }
          s.material.opacity = Math.max(0, 1 - t / life);
          return t < life;
        },
        dispose: () => this.sparks.give(s),
      });
    }
  }

  _chunks(x, z, count, color, spread = 5) {
    for (let i = 0; i < count; i++) {
      const m = this.rocks.take();
      if (!m) return;
      m.material.color.setHex(color);
      m.scale.setScalar(0.35 + Math.random() * 0.55);
      m.position.set(x, 0.4, z);
      const vel = new THREE.Vector3((Math.random() * 2 - 1) * spread, 7 + Math.random() * 8, (Math.random() * 2 - 1) * spread);
      const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      let t = 0;
      this.add({
        update: (dt) => {
          t += dt;
          vel.y -= 42 * dt;
          m.position.addScaledVector(vel, dt);
          m.rotation.x += spin.x * dt;
          m.rotation.z += spin.z * dt;
          if (m.position.y < 0.12 && vel.y < 0) {
            m.position.y = 0.12;
            vel.y *= -0.32;
            vel.x *= 0.5;
            vel.z *= 0.5;
            if (Math.abs(vel.y) < 2) return false;
          }
          return t < 1.4;
        },
        dispose: () => this.rocks.give(m),
      });
    }
  }

  _jaggedLine(line, ax, ay, az, bx, by, bz, jag = 2.4) {
    const pos = line.geometry.attributes.position;
    const n = pos.count;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    let px = -dz, pz = dx;
    const plen = Math.hypot(px, pz) || 1;
    px /= plen; pz /= plen;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const fall = Math.sin(t * Math.PI);
      const j = (Math.random() * 2 - 1) * jag * fall;
      const k = (Math.random() * 2 - 1) * jag * 0.45 * fall;
      pos.setXYZ(i, ax + dx * t + px * j, ay + dy * t + k, az + dz * t + pz * j);
    }
    pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  _spawnBoltLine(ax, ay, az, bx, by, bz, color, life, jag) {
    const line = this.lines.take();
    if (!line) return;
    line.material.color.setHex(color);
    line.material.opacity = 1;
    this._jaggedLine(line, ax, ay, az, bx, by, bz, jag);
    let t = 0, flicker = 0;
    this.add({
      update: (dt) => {
        t += dt; flicker += dt;
        if (flicker > 0.04) {
          flicker = 0;
          this._jaggedLine(line, ax, ay, az, bx, by, bz, jag);
        }
        line.material.opacity = Math.max(0, 1 - t / life);
        return t < life;
      },
      dispose: () => this.lines.give(line),
    });
  }

  bolt(opts = {}) {
    const { x = 0, z = 0, height = 30, color = 0x9b30ff, life = 0.28, branches = 2 } = opts;
    const ox = (Math.random() * 2 - 1) * 1.2;
    const oz = (Math.random() * 2 - 1) * 1.2;
    this._spawnBoltLine(x + ox, height, z + oz, x, 0.05, z, color, life, Math.max(1.6, height * 0.07));
    const n = Math.min(4, branches | 0);
    for (let i = 0; i < n; i++) {
      const midY = height * (0.25 + Math.random() * 0.5);
      const bx = x + (Math.random() * 2 - 1) * 5;
      const bz = z + (Math.random() * 2 - 1) * 5;
      this._spawnBoltLine(x, midY, z, bx, 0.05, bz, color, life * 0.75, 2.2);
    }
    if (this.particles) this.debris(x, z, 4, color, 3.5);
  }

  boltLine(x, z, height, color, life = 0.18) {
    this.bolt({ x, z, height, color, life });
  }

  shockwave(opts = {}) {
    const { x = 0, z = 0, radius = 14, color = 0xbfe9ff, duration = 0.8, debrisCount = 8 } = opts;
    this._flash(this.rings, x, 0.1, z, color, radius * 0.18, duration, 4.2);
    if (debrisCount > 0 && this.particles) this.debris(x, z, Math.min(debrisCount, 8), color, radius * 0.28);
  }

  firepit(opts = {}, onTick) {
    const { x = 0, z = 0, radius = 8, color = 0xff5a1e, duration = 10, dps = 15 } = opts;
    const tick = onTick || opts.onTick;
    const s = this.fires.take();
    if (!s) return;
    s.position.set(x, 0.7, z);
    s.material.color.setHex(color);
    s.scale.setScalar(radius * 0.55);
    let t = 0, acc = 0, ember = 0;
    this.add({
      update: (dt) => {
        t += dt; acc += dt; ember += dt;
        const k = t / duration;
        s.material.opacity = 0.8 * (1 - k * 0.45) * (0.75 + Math.random() * 0.25);
        s.position.y = 0.55 + Math.sin(t * 9) * 0.12;
        s.scale.setScalar(radius * (0.5 + Math.sin(t * 6) * 0.08));
        if (ember > 0.12 && this.particles) {
          ember = 0;
          const sp = this.sparks.take();
          if (sp) {
            sp.position.set(x + (Math.random() * 2 - 1) * radius * 0.4, 0.6, z + (Math.random() * 2 - 1) * radius * 0.4);
            sp.material.color.setHex(color);
            sp.scale.setScalar(0.4);
            const vel = new THREE.Vector3((Math.random() - 0.5) * 2, 4 + Math.random() * 5, (Math.random() - 0.5) * 2);
            let et = 0;
            this.add({
              update: (dd) => {
                et += dd; vel.y -= 6 * dd;
                sp.position.addScaledVector(vel, dd);
                sp.material.opacity = 1 - et / 0.55;
                return et < 0.55;
              },
              dispose: () => this.sparks.give(sp),
            });
          }
        }
        if (acc >= 0.5) { acc -= 0.5; if (tick) tick(x, z, radius, dps * 0.5); }
        return t < duration;
      },
      dispose: () => this.fires.give(s),
    });
  }

  asteroid(opts = {}, onImpact) {
    const hit = onImpact || opts.onImpact;
    const { x = 0, z = 0, radius = 25, color = 0x6b4a8a, fallFrom = 70, fallTime = 1.0, explosionColor = 0x9b30ff } = opts;
    const rock = this.rocks.take();
    const ox = (Math.random() * 2 - 1) * 28, oz = (Math.random() * 2 - 1) * 28;
    if (rock) {
      rock.material.color.setHex(color);
      rock.scale.setScalar(2.4 + radius * 0.08);
      rock.position.set(x + ox, fallFrom, z + oz);
    }
    const vel = new THREE.Vector3(-ox / fallTime, 0, -oz / fallTime);
    vel.y = -(fallFrom + 4) / fallTime;
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        if (rock) {
          vel.y -= 38 * dt;
          rock.position.addScaledVector(vel, dt);
          rock.rotation.x += dt * 2.4;
          rock.rotation.z += dt * 1.6;
          if (this.particles && Math.random() < 0.4) {
            const sp = this.sparks.take();
            if (sp) {
              sp.position.copy(rock.position);
              sp.material.color.setHex(explosionColor);
              sp.scale.setScalar(0.7);
              let st = 0;
              this.add({
                update: (dd) => { st += dd; sp.material.opacity = 1 - st / 0.25; sp.position.y -= dd * 4; return st < 0.25; },
                dispose: () => this.sparks.give(sp),
              });
            }
          }
        }
        const y = rock ? rock.position.y : 0;
        if (t >= fallTime || y <= 0.2) {
          this.explosion({ x, z, radius, color: explosionColor, life: 0.7, debris: 12 });
          this.shake(0.7, Math.min(4, radius * 0.05));
          if (hit) hit(x, z, radius);
          return false;
        }
        return true;
      },
      dispose: () => this.rocks.give(rock),
    });
  }

  meteor(opts = {}, onImpact) {
    const hit = onImpact || opts.onImpact;
    const { x = 0, z = 0, radius = 5, color = 0x7a5a9a, fallFrom = 46, fallTime = 0.5, explosionColor = 0x9b30ff } = opts;
    const rock = this.rocks.take();
    const ox = (Math.random() * 2 - 1) * 18, oz = (Math.random() * 2 - 1) * 18;
    if (rock) { rock.material.color.setHex(color); rock.scale.setScalar(1.5); rock.position.set(x + ox, fallFrom, z + oz); }
    const vel = new THREE.Vector3(-ox / fallTime, -(fallFrom + 2) / fallTime, -oz / fallTime);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        if (rock) {
          vel.y -= 46 * dt;
          rock.position.addScaledVector(vel, dt);
          rock.rotation.x += dt * 4;
          rock.rotation.z += dt * 3;
        }
        if (t >= fallTime || (rock && rock.position.y <= 0.2)) {
          this.explosion({ x, z, radius, color: explosionColor, life: 0.45, debris: 6 });
          if (hit) hit(x, z, radius);
          return false;
        }
        return true;
      },
      dispose: () => this.rocks.give(rock),
    });
  }

  tsunami(opts = {}, onPass) {
    const hit = onPass || opts.onPass;
    const { x = 0, z = 0, dir = new THREE.Vector3(1, 0, 0), distance = 120, speed = 40, height = 10, width = 30, color = 0x3aa0ff } = opts;
    const s = this.waves.take();
    if (!s) return;
    const d = dir.clone();
    if (d.lengthSq() < 0.0001) d.set(1, 0, 0);
    d.normalize();
    const start = new THREE.Vector3(x, height * 0.45, z).addScaledVector(d, -distance / 2);
    s.material.color.setHex(color);
    s.scale.set(width * 0.9, height * 0.7, 4.5);
    s.rotation.y = Math.atan2(d.x, d.z);
    let traveled = 0;
    this.add({
      update: (dt) => {
        traveled += speed * dt;
        const bob = Math.sin(traveled * 0.12) * height * 0.12;
        s.position.copy(start).addScaledVector(d, traveled);
        s.position.y = height * 0.35 + bob;
        s.material.opacity = 0.78;
        if (hit) hit(s.position.x, s.position.z, 4);
        return traveled < distance;
      },
      dispose: () => this.waves.give(s),
    });
  }

  rockRise(opts = {}, onSlam) {
    const slam = onSlam || opts.onSlam;
    const { x = 0, z = 0, radius = 6, rise = 1.2, color = 0x8a8a96 } = opts;
    const rock = this.rocks.take();
    if (!rock) { if (slam) slam(x, z, radius); return; }
    rock.material.color.setHex(color);
    rock.scale.setScalar(radius * 0.55);
    rock.position.set(x, -radius, z);
    let t = 0, phase = 0;
    this.add({
      update: (dt) => {
        t += dt;
        if (phase === 0) {
          rock.position.y = -radius + (radius * 2.2) * Math.min(1, t / rise);
          if (t >= rise) { phase = 1; t = 0; }
          return true;
        }
        rock.position.y = Math.max(0.1, rock.position.y - 55 * dt);
        if (rock.position.y <= 0.12) {
          this.explosion({ x, z, radius: 10, color: 0x9b30ff, life: 0.55, debris: 6, intensity: 1.2 });
          this.shake(0.55, radius * 0.08);
          if (slam) slam(x, z, radius);
          return false;
        }
        return true;
      },
      dispose: () => this.rocks.give(rock),
    });
  }

  pillar(opts = {}) {
    const { x = 0, z = 0, height = 40, color = 0x9b30ff, duration = 2, rings = 6 } = opts;
    const col = this.glow.take();
    if (col) {
      col.position.set(x, height * 0.45, z);
      col.material.color.setHex(color);
      col.scale.set(6, height * 0.55, 1);
    }
    const ringSprites = [];
    const n = Math.min(rings, 5);
    for (let i = 0; i < n; i++) {
      const r = this.rings.take();
      if (!r) break;
      r.position.set(x, 2 + i * (height / n) * 0.35, z);
      r.material.color.setHex(color);
      r.scale.setScalar(3 + i * 0.6);
      ringSprites.push(r);
    }
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = t / duration;
        if (col) col.material.opacity = 0.7 * (1 - k);
        ringSprites.forEach((r, i) => { r.material.opacity = 0.8 * (1 - k); r.scale.setScalar((3 + i) * (1 + k * 0.4)); });
        if (k > 0.45 && Math.random() < 0.25) this.bolt({ x, z, height: height * 0.55, color, life: 0.18 });
        return t < duration;
      },
      dispose: () => { this.glow.give(col); ringSprites.forEach((r) => this.rings.give(r)); },
    });
  }

  slashFx(x, y, z, color = 0xffffff, facing = 0, reach = 6) {
    const s = this.slashes.take();
    if (!s) return;
    const push = Math.min(3.2, reach * 0.32);
    const fx = Math.sin(facing), fz = Math.cos(facing);
    s.position.set(x + fx * push, y, z + fz * push);
    s.material.color.setHex(color);
    s.material.rotation = -facing;
    s.material.opacity = 0.95;
    const sx = 3.4 + reach * 0.28;
    s.scale.set(sx, 2.2, 1);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        s.material.opacity = 0.95 * (1 - t / 0.16);
        s.scale.x = sx + t * 12;
        return t < 0.16;
      },
      dispose: () => this.slashes.give(s),
    });
    if (this.particles) {
      for (let i = 0; i < 3; i++) {
        const sp = this.sparks.take();
        if (!sp) break;
        sp.position.set(x + fx * (2 + i), y, z + fz * (2 + i));
        sp.material.color.setHex(color);
        sp.scale.setScalar(0.45);
        const vel = new THREE.Vector3(fx * 8 + (Math.random() - 0.5) * 4, 3 + Math.random() * 4, fz * 8 + (Math.random() - 0.5) * 4);
        let st = 0;
        this.add({
          update: (dt) => {
            st += dt; vel.y -= 22 * dt;
            sp.position.addScaledVector(vel, dt);
            sp.material.opacity = 1 - st / 0.28;
            return st < 0.28;
          },
          dispose: () => this.sparks.give(sp),
        });
      }
    }
  }

  launchOrb(from, dir, opts = {}) {
    const {
      speed = 40, range = 110, color = 0xffffff, radius = 1.3, hitRadius = 2.4, enemies, onExplode,
      gravity = 22, arc = 8, homing = 0, bounce = 1,
    } = opts;
    const m = this.orbs.take();
    if (!m) { if (onExplode) onExplode(from, false); return; }
    m.material.color.setHex(color);
    if (m.material.emissive) m.material.emissive.setHex(color);
    m.position.copy(from); m.position.y = (from.y || 0) + 1.5;
    m.scale.setScalar(radius * 2);
    const vel = dir.clone();
    if (vel.lengthSq() < 0.0001) vel.set(0, 0, 1);
    vel.normalize().multiplyScalar(speed);
    vel.y += arc;
    let traveled = 0, bounces = 0, trail = 0;
    this.add({
      update: (dt) => {
        if (homing && enemies) {
          const near = enemies.alive();
          let best = null, bestD = 18;
          for (const e of near) {
            const dd = e.position.distanceTo(m.position);
            if (dd < bestD) { bestD = dd; best = e; }
          }
          if (best) {
            const want = best.position.clone().sub(m.position); want.y += 1;
            if (want.lengthSq() > 0.01) {
              want.normalize().multiplyScalar(speed);
              vel.lerp(want, Math.min(1, homing * dt));
            }
          }
        }
        vel.y -= gravity * dt;
        vel.x *= (1 - 0.35 * dt);
        vel.z *= (1 - 0.35 * dt);
        const step = vel.length() * dt;
        traveled += step;
        m.position.addScaledVector(vel, dt);
        m.rotation.x += dt * 6;
        m.rotation.y += dt * 8;
        trail += dt;
        if (trail > 0.04 && this.particles) {
          trail = 0;
          const sp = this.sparks.take();
          if (sp) {
            sp.position.copy(m.position);
            sp.material.color.setHex(color);
            sp.scale.setScalar(radius * 0.7);
            let st = 0;
            this.add({
              update: (dd) => { st += dd; sp.material.opacity = 1 - st / 0.22; return st < 0.22; },
              dispose: () => this.sparks.give(sp),
            });
          }
        }
        let struck = false;
        if (enemies) struck = enemies.alive().some((e) => e.position.distanceTo(m.position) < hitRadius);
        if (m.position.y < 0.18 && vel.y < 0) {
          if (bounces < bounce) {
            bounces += 1;
            m.position.y = 0.18;
            vel.y *= -0.45;
            vel.x *= 0.7;
            vel.z *= 0.7;
          } else {
            m.position.y = 0.18;
            this.explosion({ x: m.position.x, z: m.position.z, radius: 6, color, life: 0.4, debris: 5 });
            if (onExplode) onExplode(m.position, struck);
            return false;
          }
        }
        if (struck || traveled >= range) {
          this.explosion({ x: m.position.x, z: m.position.z, radius: 6, color, life: 0.4, debris: 5 });
          if (onExplode) onExplode(m.position, struck);
          return false;
        }
        return true;
      },
      dispose: () => this.orbs.give(m),
    });
  }

  popup(x, y, z, amount, kind = 'hit') {
    const n = Math.round(amount);
    if (n < 1) return;
    const item = this.nums.find((o) => !o.busy);
    if (!item) return;
    item.busy = true;
    const { ctx, tex, sprite } = item;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const col = kind === 'hurt' ? '#ff5a7a' : kind === 'heal' ? '#7dffb0' : kind === 'crit' ? '#ffd24a' : '#fff6e0';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(8,6,18,0.88)';
    const label = n.toLocaleString();
    ctx.strokeText(label, 64, 32);
    ctx.fillStyle = col;
    ctx.fillText(label, 64, 32);
    tex.needsUpdate = true;
    sprite.position.set(x + (Math.random() - 0.5) * 0.7, y, z + (Math.random() - 0.5) * 0.7);
    sprite.material.opacity = 1;
    sprite.visible = true;
    sprite.scale.set(2.4, 1.2, 1);
    let t = 0; const life = 0.85; const oy = y;
    this.add({
      update: (dt) => {
        t += dt; const k = t / life;
        sprite.position.y = oy + k * 2.6;
        sprite.material.opacity = 1 - k;
        sprite.scale.set(2.4 * (1 + k * 0.25), 1.2 * (1 + k * 0.25), 1);
        return t < life;
      },
      dispose: () => { item.busy = false; sprite.visible = false; },
    });
  }

  frost(x, z, radius = 10, color = 0x9fe9ff) {
    this._flash(this.ices, x, 1.1, z, color, radius * 0.42, 0.5, 1.1);
    this.shockwave({ x, z, radius, color, duration: 0.55, debrisCount: 3 });
    if (!this.particles) return;
    for (let i = 0; i < 6; i++) {
      const s = this.ices.take();
      if (!s) break;
      const a = (i / 6) * Math.PI * 2;
      s.position.set(x + Math.cos(a) * radius * 0.35, 2.4 + Math.random(), z + Math.sin(a) * radius * 0.35);
      s.material.color.setHex(color);
      s.scale.setScalar(1.2);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3);
      let t = 0;
      this.add({
        update: (dt) => {
          t += dt; vel.y -= 28 * dt;
          s.position.addScaledVector(vel, dt);
          s.rotation.z += dt * 4;
          if (s.position.y < 0.1) { s.position.y = 0.1; vel.y = 0; }
          s.material.opacity = 1 - t / 0.7;
          return t < 0.7;
        },
        dispose: () => this.ices.give(s),
      });
    }
  }
}

export default FX;

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
      const m = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.visible = false; scene.add(m); return m;
    }, 12);

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
    const { x = 0, z = 0, radius = 8, color = 0xff7a2a, life = 0.55, debris = 8, intensity = 1 } = opts;
    this._flash(this.glow, x, 1.1, z, color, Math.max(2, radius * 0.55), life, 1.6 * intensity);
    this._flash(this.rings, x, 0.2, z, color, Math.max(2, radius * 0.35), life * 1.1, 2.4);
    if (debris > 0 && this.particles) this.debris(x, z, Math.min(debris, 10), color, radius * 0.45);
  }

  debris(x, z, count, color = 0xffa040, spread = 6) {
    const n = Math.min(count, 8);
    for (let i = 0; i < n; i++) {
      const s = this.sparks.take();
      if (!s) return;
      s.position.set(x, 1.2, z);
      s.material.color.setHex(color);
      s.material.opacity = 1;
      s.scale.setScalar(0.7 + Math.random() * 0.8);
      const vel = new THREE.Vector3((Math.random() * 2 - 1) * spread, 8 + Math.random() * 7, (Math.random() * 2 - 1) * spread);
      let t = 0; const life = 0.7 + Math.random() * 0.4;
      this.add({
        update: (dt) => {
          t += dt; vel.y -= 28 * dt;
          s.position.addScaledVector(vel, dt);
          s.material.opacity = 1 - t / life;
          return t < life && s.position.y > 0;
        },
        dispose: () => this.sparks.give(s),
      });
    }
  }

  bolt(opts = {}) {
    const { x = 0, z = 0, height = 30, color = 0x9b30ff, life = 0.32 } = opts;
    const s = this.bolts.take();
    if (!s) return;
    s.position.set(x, height * 0.5, z);
    s.material.color.setHex(color);
    s.material.opacity = 1;
    s.scale.set(3.2, height, 1);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        s.material.opacity = (1 - t / life) * (0.65 + Math.random() * 0.35);
        s.scale.x = 2.4 + Math.random() * 1.6;
        return t < life;
      },
      dispose: () => this.bolts.give(s),
    });
    this._flash(this.glow, x, 1.4, z, color, 3.5, life, 0.4);
  }

  boltLine(x, z, height, color, life = 0.18) {
    this.bolt({ x, z, height, color, life });
  }

  shockwave(opts = {}) {
    const { x = 0, z = 0, radius = 14, color = 0xbfe9ff, duration = 0.8, debrisCount = 8 } = opts;
    this._flash(this.rings, x, 0.18, z, color, radius * 0.25, duration, 3.2);
    if (debrisCount > 0 && this.particles) this.debris(x, z, Math.min(debrisCount, 8), color, radius * 0.3);
  }

  firepit(opts = {}, onTick) {
    const { x = 0, z = 0, radius = 8, color = 0xff5a1e, duration = 10, dps = 15 } = opts;
    const tick = onTick || opts.onTick;
    const s = this.fires.take();
    if (!s) return;
    s.position.set(x, 1.1, z);
    s.material.color.setHex(color);
    s.scale.setScalar(radius * 0.7);
    let t = 0, acc = 0;
    this.add({
      update: (dt) => {
        t += dt; acc += dt;
        const k = t / duration;
        s.material.opacity = 0.75 * (1 - k * 0.4) * (0.7 + Math.random() * 0.3);
        s.scale.setScalar(radius * (0.55 + Math.random() * 0.2));
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
    const glow = this.glow.take();
    if (rock) {
      rock.material.color.setHex(color);
      rock.scale.setScalar(2.4 + radius * 0.08);
      rock.position.set(x, fallFrom, z);
    }
    if (glow) { glow.position.set(x, fallFrom, z); glow.material.color.setHex(explosionColor); glow.scale.setScalar(6); }
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = Math.min(1, t / fallTime); const y = fallFrom * (1 - k * k);
        if (rock) { rock.position.y = y; rock.rotation.x += dt * 2; rock.rotation.z += dt * 1.4; }
        if (glow) { glow.position.y = y; glow.material.opacity = 0.7; }
        if (k >= 1) {
          this.explosion({ x, z, radius, color: explosionColor, life: 0.7, debris: 10, intensity: 1.3 });
          this.shake(0.7, Math.min(4, radius * 0.05));
          if (hit) hit(x, z, radius);
          return false;
        }
        return true;
      },
      dispose: () => { this.rocks.give(rock); this.glow.give(glow); },
    });
  }

  meteor(opts = {}, onImpact) {
    const hit = onImpact || opts.onImpact;
    const { x = 0, z = 0, radius = 5, color = 0x7a5a9a, fallFrom = 46, fallTime = 0.5, explosionColor = 0x9b30ff } = opts;
    const rock = this.rocks.take();
    if (rock) { rock.material.color.setHex(color); rock.scale.setScalar(1.5); rock.position.set(x, fallFrom, z); }
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = Math.min(1, t / fallTime);
        if (rock) rock.position.y = fallFrom * (1 - k * k);
        if (k >= 1) {
          this.explosion({ x, z, radius, color: explosionColor, life: 0.45, debris: 4, intensity: 1 });
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
    const pool = this.waters.free.length ? this.waters : this.glow;
    const s = pool.take();
    if (!s) return;
    const d = dir.clone();
    if (d.lengthSq() < 0.0001) d.set(1, 0, 0);
    d.normalize();
    const start = new THREE.Vector3(x, height * 0.35, z).addScaledVector(d, -distance / 2);
    s.position.copy(start);
    s.material.color.setHex(color);
    s.scale.set(width * 0.28, height * 0.22, 1);
    let traveled = 0;
    this.add({
      update: (dt) => {
        traveled += speed * dt;
        s.position.copy(start).addScaledVector(d, traveled);
        s.material.opacity = 0.75;
        if (hit) hit(s.position.x, s.position.z, 4);
        return traveled < distance;
      },
      dispose: () => pool.give(s),
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

  slashFx(x, y, z, color = 0xffffff, facing = 0) {
    const s = this.slashes.take();
    if (!s) return;
    s.position.set(x + Math.sin(facing) * 1.6, y, z + Math.cos(facing) * 1.6);
    s.material.color.setHex(color);
    s.material.rotation = -facing;
    s.material.opacity = 0.95;
    s.scale.set(4.2, 2.2, 1);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        s.material.opacity = 0.95 * (1 - t / 0.16);
        s.scale.x = 4.2 + t * 10;
        return t < 0.16;
      },
      dispose: () => this.slashes.give(s),
    });
  }

  launchOrb(from, dir, opts = {}) {
    const { speed = 40, range = 110, color = 0xffffff, radius = 1.3, hitRadius = 2.4, enemies, onExplode } = opts;
    const m = this.orbs.take();
    if (!m) { if (onExplode) onExplode(from, false); return; }
    m.material.color.setHex(color);
    m.position.copy(from); m.position.y = (from.y || 0) + 1.5;
    m.scale.setScalar(radius * 2);
    const d = dir.clone().normalize();
    let traveled = 0;
    this.add({
      update: (dt) => {
        traveled += speed * dt;
        m.position.addScaledVector(d, speed * dt);
        m.rotation.y += dt * 8;
        let struck = false;
        if (enemies) struck = enemies.alive().some((e) => e.position.distanceTo(m.position) < hitRadius);
        if (struck || traveled >= range) {
          this.explosion({ x: m.position.x, z: m.position.z, radius: 6, color, life: 0.4, debris: 3 });
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
    this._flash(this.ices, x, 1.4, z, color, radius * 0.5, 0.55, 1.4);
    this.shockwave({ x, z, radius, color, duration: 0.55, debrisCount: 4 });
  }
}

export default FX;

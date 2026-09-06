// ============================================================
//  Effects engine: explosions, debris, lightning, firepits,
//  asteroids, meteors, tsunamis, shockwaves, camera shake.
// ============================================================
import * as THREE from 'three';

const tmpV = new THREE.Vector3();

export class FX {
  constructor(scene, getTime) {
    this.scene = scene;
    this.updaters = [];          // {update(dt,t), dispose()} -> returns false when done
    this.shakeTrauma = 0;
    this.shakeMax = 2.2;         // max positional offset in world units
    this.shakeOffset = new THREE.Vector3();
    this._t = 0;
    this.particles = true;   // toggled by graphics settings
  }

  // ---- camera shake: POSITION ONLY (no rotation ever) ----
  shake(amount = 0.5, intensity = null) {
    if (intensity != null) this.shakeMax = intensity;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }
  // compute offset for this frame from the UN-shaken base position.
  updateShake(dt) {
    this._t += dt;
    if (this.shakeTrauma <= 0) { this.shakeOffset.set(0, 0, 0); return; }
    const s = this.shakeTrauma * this.shakeTrauma; // square falloff
    const f = this._t * 47;                         // high frequency
    const o = this.shakeMax * s;
    // pure positional, high-frequency random offsets on X,Y,Z only
    this.shakeOffset.set(
      Math.sin(f * 1.0 + 12.3) * (Math.random() * 2 - 1) * o +
        (Math.random() * 2 - 1) * o * 0.4,
      Math.sin(f * 1.3 + 4.7) * (Math.random() * 2 - 1) * o +
        (Math.random() * 2 - 1) * o * 0.4,
      Math.sin(f * 0.9 + 9.1) * (Math.random() * 2 - 1) * o +
        (Math.random() * 2 - 1) * o * 0.4
    );
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.6);
  }
  // add a sustained shake for N seconds (used by roar etc.)
  shakeFor(seconds, perSecond = 0.6, intensity = null) {
    if (intensity != null) this.shakeMax = intensity;
    let left = seconds;
    this.updaters.push({
      update: (dt) => {
        left -= dt;
        this.shake(perSecond * dt, intensity);
        return left > 0;
      },
      dispose: () => {},
    });
  }

  // generic add/remove
  add(upd) { this.updaters.push(upd); }
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

  // ----------------------------------------------------------
  //  LIGHTNING  — tall vertical jagged bolt
  // ----------------------------------------------------------
  bolt(opts) {
    const { x = 0, z = 0, height = 30, color = 0x9b30ff, life = 0.38,
            thickness = 0.35, jitter = 0.9, branches = 2, glow = 1.4 } = opts || {};
    const from = new THREE.Vector3(x, 0.2, z);
    const to = new THREE.Vector3(x, height, z);
    const group = new THREE.Group();
    const core = this._makeBoltMesh(from, to, color, thickness, jitter, 18);
    group.add(core);
    // outer glow
    const glowMesh = this._makeBoltMesh(from, to, color, thickness * 2.4, jitter * 1.3, 14);
    glowMesh.material.opacity = 0.35;
    glowMesh.material.transparent = true;
    group.add(glowMesh);
    // branches
    for (let b = 0; b < branches; b++) {
      const bx = x + (Math.random() * 2 - 1) * jitter * 2;
      const bz = z + (Math.random() * 2 - 1) * jitter * 2;
      const mid = new THREE.Vector3((x + bx) / 2 + (Math.random() * 2 - 1) * jitter, height * (0.4 + Math.random() * 0.3), (z + bz) / 2);
      const bto = new THREE.Vector3(bx, height * (0.5 + Math.random() * 0.4), bz);
      const pts = [from.clone(), mid, bto];
      group.add(this._makeBoltMeshFromPoints(pts, color, thickness * 0.6, jitter * 0.5));
    }
    this.scene.add(group);
    // brief light
    const light = new THREE.PointLight(color, 6 * glow, height * 1.6);
    light.position.set(x, height * 0.5, z);
    this.scene.add(light);

    let t = 0;
    this.add({
      update: (dt) => {
        t += dt;
        const k = 1 - t / life;
        group.children.forEach((c) => { if (c.material) c.material.opacity = Math.max(0, k) * (c === glowMesh ? 0.35 : 1) * (0.6 + Math.random() * 0.4); });
        light.intensity = 6 * glow * k;
        return t < life;
      },
      dispose: () => { this.scene.remove(group); this.scene.remove(light); }
    });
  }

  _jaggedPoints(from, to, segs, jitter) {
    const pts = [];
    const dir = to.clone().sub(from);
    const len = dir.length();
    // perpendicular basis on x/z plane
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const p = from.clone().lerp(to, f);
      if (i !== 0 && i !== segs) {
        p.x += (Math.random() * 2 - 1) * jitter * len * 0.04;
        p.z += (Math.random() * 2 - 1) * jitter * len * 0.04;
      }
      pts.push(p);
    }
    return pts;
  }
  _makeBoltMesh(from, to, color, thickness, jitter, segs) {
    return this._makeBoltMeshFromPoints(this._jaggedPoints(from, to, segs, jitter), color, thickness, jitter);
  }
  _makeBoltMeshFromPoints(pts, color, thickness, jitter) {
    jitter = jitter || 0.6;
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = Math.max(6, pts.length * 3);
    const geo = new THREE.TubeGeometry(curve, seg, thickness, 4, false);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    return new THREE.Mesh(geo, mat);
  }
  // mass/cheap bolts (for many at once) using lines
  boltLine(x, z, height, color, life = 0.3) {
    const pts = this._jaggedPoints(new THREE.Vector3(x, 0.2, z), new THREE.Vector3(x, height, z), 10, 1.0);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    let t = 0;
    this.add({ update: (dt) => { t += dt; mat.opacity = Math.max(0, 1 - t / life); return t < life; }, dispose: () => { this.scene.remove(line); geo.dispose(); } });
  }

  // ----------------------------------------------------------
  //  EXPLOSION  (sphere flash + ground ring + debris)
  // ----------------------------------------------------------
  explosion(opts) {
    const { x = 0, z = 0, radius = 8, color = 0xff7a2a, life = 0.6, debris = 10, intensity = 1 } = opts || {};
    const y = 0.4;
    // core sphere
    const sph = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sph.position.set(x, y, z);
    this.scene.add(sph);
    // ground ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.1, z);
    this.scene.add(ring);
    // light
    const light = new THREE.PointLight(color, 8 * intensity, radius * 3);
    light.position.set(x, 3, z); this.scene.add(light);

    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = t / life; const e = 1 - Math.pow(1 - k, 3);
        const r = radius * e;
        sph.scale.setScalar(Math.max(0.01, r));
        sph.material.opacity = 0.9 * (1 - k);
        ring.scale.setScalar(Math.max(0.01, r));
        ring.material.opacity = 0.8 * (1 - k);
        light.intensity = 8 * intensity * (1 - k);
        return t < life;
      },
      dispose: () => { this.scene.remove(sph); this.scene.remove(ring); this.scene.remove(light); }
    });
    if (debris > 0 && this.particles) this.debris(x, z, debris, color, radius);
  }

  // debris cubes with gravity
  debris(x, z, count, color = 0xffa040, spread = 6) {
    const group = new THREE.Group();
    const parts = [];
    for (let i = 0; i < count; i++) {
      const s = 0.3 + Math.random() * 0.6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.8 }));
      m.position.set(x + (Math.random() * 2 - 1) * 1.5, 1 + Math.random() * 2, z + (Math.random() * 2 - 1) * 1.5);
      const vel = new THREE.Vector3((Math.random() * 2 - 1) * spread, 6 + Math.random() * 8, (Math.random() * 2 - 1) * spread);
      parts.push({ m, vel }); group.add(m);
    }
    this.scene.add(group);
    const g = -22;
    let t = 0; const life = 2.2;
    this.add({
      update: (dt) => {
        t += dt;
        parts.forEach((p) => {
          p.vel.y += g * dt;
          p.m.position.addScaledVector(p.vel, dt);
          p.m.rotation.x += dt * 4; p.m.rotation.z += dt * 3;
          if (p.m.position.y < s_clamp(p.m)) {} // keep
          if (p.m.position.y < 0.2) { p.m.position.y = 0.2; p.vel.y *= -0.35; p.vel.x *= 0.6; p.vel.z *= 0.6; }
        });
        const k = 1 - t / life;
        group.children.forEach((c) => { if (c.material) c.material.opacity = k; });
        return t < life;
      },
      dispose: () => { this.scene.remove(group); }
    });
  }

  // ----------------------------------------------------------
  //  FIREPIT  (persistent ground hazard, tick damage)
  // ----------------------------------------------------------
  firepit(opts, onTick) {
    const { x = 0, z = 0, radius = 8, color = 0xff5a1e, duration = 10, dps = 15 } = opts || {};
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.85, 0.4, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.position.set(x, 0.2, z);
    this.scene.add(mesh);
    // flame particles
    const flames = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.12, radius * 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.position.set(x + (Math.random() * 2 - 1) * radius * 0.7, 1, z + (Math.random() * 2 - 1) * radius * 0.7);
      flames.add(f);
    }
    this.scene.add(flames);
    let t = 0, tickAcc = 0;
    this.add({
      update: (dt) => {
        t += dt; tickAcc += dt;
        const k = t / duration;
        mesh.material.opacity = 0.55 * (1 - k * 0.5) * (0.7 + Math.random() * 0.3);
        flames.children.forEach((c) => { c.scale.y = 0.6 + Math.random() * 0.8; c.position.y = 0.8 + Math.random() * 1.2; });
        if (tickAcc >= 0.5) { tickAcc -= 0.5; if (onTick) onTick(x, z, radius, dps * 0.5); }
        return t < duration;
      },
      dispose: () => { this.scene.remove(mesh); this.scene.remove(flames); }
    });
  }

  // ----------------------------------------------------------
  //  ASTEROID / METEOR  (falling rock that slams + explodes)
  // ----------------------------------------------------------
  asteroid(opts, onImpact) {
    const { x = 0, z = 0, radius = 25, color = 0x6b4a8a, fallFrom = 80, fallTime = 1.1, explosionColor = 0x9b30ff } = opts || {};
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4 + radius * 0.12, 1),
      new THREE.MeshStandardMaterial({ color, emissive: 0x2a1040, emissiveIntensity: 0.5, roughness: 1, flatShading: true })
    );
    rock.position.set(x, fallFrom, z);
    this.scene.add(rock);
    const glow = new THREE.PointLight(explosionColor, 4, 40); glow.position.set(x, fallFrom, z); this.scene.add(glow);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = Math.min(1, t / fallTime);
        const ease = k * k;
        rock.position.y = fallFrom * (1 - ease);
        rock.rotation.x += dt * 2; rock.rotation.y += dt * 1.5;
        glow.position.y = rock.position.y;
        if (k >= 1) {
          this.explosion({ x, z, radius, color: explosionColor, life: 0.8, debris: 16, intensity: 1.4 });
          this.shake(0.9, radius * 0.06);
          if (onImpact) onImpact(x, z, radius);
          this.scene.remove(rock); this.scene.remove(glow);
          return false;
        }
        return true;
      },
      dispose: () => {}
    });
  }

  meteor(opts, onImpact) {
    const { x = 0, z = 0, radius = 5, color = 0x7a5a9a, fallFrom = 50, fallTime = 0.5, explosionColor = 0x9b30ff } = opts || {};
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0),
      new THREE.MeshStandardMaterial({ color, emissive: 0x3a1060, emissiveIntensity: 0.7, roughness: 1, flatShading: true }));
    rock.position.set(x, fallFrom, z);
    this.scene.add(rock);
    const trail = new THREE.PointLight(explosionColor, 3, 20); trail.position.set(x, fallFrom, z); this.scene.add(trail);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = Math.min(1, t / fallTime);
        rock.position.y = fallFrom * (1 - k * k);
        trail.position.y = rock.position.y;
        if (k >= 1) {
          this.explosion({ x, z, radius, color: explosionColor, life: 0.5, debris: 5, intensity: 1 });
          if (onImpact) onImpact(x, z, radius);
          this.scene.remove(rock); this.scene.remove(trail);
          return false;
        }
        return true;
      },
      dispose: () => {}
    });
  }

  // ----------------------------------------------------------
  //  SHOCKWAVE  (white expanding ring + cracks + debris)
  // ----------------------------------------------------------
  shockwave(opts) {
    const { x = 0, z = 0, radius = 14, color = 0xbfe9ff, duration = 0.9, debrisCount = 12 } = opts || {};
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 1.4, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.15, z);
    this.scene.add(ring);
    // cracks (radial lines)
    const cracks = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const len = radius * (0.6 + Math.random() * 0.5);
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * len, 0, Math.sin(a) * len)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
      l.position.set(x, 0.12, z); cracks.add(l);
    }
    this.scene.add(cracks);
    if (debrisCount > 0 && this.particles) this.debris(x, z, debrisCount, 0xcfe8ff, radius * 0.4);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = t / duration; const e = 1 - Math.pow(1 - k, 2);
        const r = radius * e;
        ring.scale.setScalar(Math.max(0.01, r));
        ring.material.opacity = 0.7 * (1 - k);
        cracks.scale.setScalar(Math.max(0.01, r));
        cracks.children.forEach((c) => c.material.opacity = 0.5 * (1 - k));
        return t < duration;
      },
      dispose: () => { this.scene.remove(ring); this.scene.remove(cracks); }
    });
  }

  // ----------------------------------------------------------
  //  TSUNAMI  (a wall of water moving across the arena)
  // ----------------------------------------------------------
  tsunami(opts, onPass) {
    const { x = 0, z = 0, dir = new THREE.Vector3(1, 0, 0), distance = 120, speed = 40, height = 10, width = 30, damage = 125, color = 0x3aa0ff } = opts || {};
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 3),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6, emissive: 0x114a88, emissiveIntensity: 0.4, roughness: 0.3 })
    );
    const start = new THREE.Vector3(x, height / 2, z).addScaledVector(dir, -distance / 2);
    wall.position.copy(start);
    wall.lookAt(wall.position.clone().add(dir));
    this.scene.add(wall);
    const d = dir.clone().normalize();
    let traveled = 0;
    this.add({
      update: (dt) => {
        traveled += speed * dt;
        wall.position.copy(start).addScaledVector(d, traveled);
        wall.position.y = height / 2 + Math.sin(traveled * 0.3) * 0.6;
        if (onPass) onPass(wall.position.x, wall.position.z, 4); // damage band while passing
        if (traveled >= distance) { this.scene.remove(wall); return false; }
        return true;
      },
      dispose: () => {}
    });
  }

  // ----------------------------------------------------------
  //  ROCK PILLAR / PETRIFIED enemy visual
  // ----------------------------------------------------------
  rockRise(opts, onSlam) {
    const { x = 0, z = 0, radius = 6, rise = 1.5, color = 0x8a8a96 } = opts || {};
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    rock.position.set(x, -radius, z);
    this.scene.add(rock);
    let t = 0; let slammed = false;
    this.add({
      update: (dt) => {
        t += dt;
        if (t < rise) { rock.position.y = -radius + (radius * 2) * (t / rise); }
        else if (!slammed) {
          slammed = true;
          rock.position.y = radius * 2;
        } else {
          rock.position.y = Math.max(0, rock.position.y - 60 * dt);
          if (rock.position.y <= 0.1) {
            this.explosion({ x, z, radius: 10, color: 0x9b30ff, life: 0.7, debris: 10, intensity: 1.3 });
            this.shake(0.7, radius * 0.1);
            if (onSlam) onSlam(x, z, radius);
            this.scene.remove(rock);
            return false;
          }
        }
        return true;
      },
      dispose: () => {}
    });
  }

  // ----------------------------------------------------------
  //  PURPLE PILLAR (grav lightning summon)
  // ----------------------------------------------------------
  pillar(opts) {
    const { x = 0, z = 0, height = 40, color = 0x9b30ff, duration = 2, rings = 9 } = opts || {};
    const group = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, height, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    col.position.set(x, height / 2, z); group.add(col);
    const ringMeshes = [];
    for (let i = 0; i < rings; i++) {
      const r = 3 + i * 0.6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 8, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.set(x, 3 + i * (height / rings), z);
      ring.rotation.x = Math.PI / 2; group.add(ring); ringMeshes.push(ring);
    }
    this.scene.add(group);
    let t = 0;
    this.add({
      update: (dt) => {
        t += dt; const k = t / duration;
        group.children.forEach((c, i) => { if (c.material) c.material.opacity = (c === col ? 0.35 : 0.8) * (1 - k) * (0.7 + Math.random() * 0.3); });
        ringMeshes.forEach((r, i) => { r.rotation.z += dt * (1 + i * 0.1); });
        if (k > 0.6 && Math.random() < 0.4) this.bolt({ x, z, height: height * 0.6, color, life: 0.25, branches: 1 });
        return t < duration;
      },
      dispose: () => { this.scene.remove(group); }
    });
  }
}

function s_clamp() { return 0.2; }

export default FX;

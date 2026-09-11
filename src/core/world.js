/**
 * The arena: terrain, ocean, sky, lighting, props, enemy waves, timers
 * and global time scaling (used by Fatal Destruction's screen pause).
 */
import * as THREE from 'three';
import { Combat } from './combat.js';
import { Enemy } from './enemy.js';
import { Player } from './player.js';
import { rand, randInt, clamp, TAU, pick, damp, tmp } from './utils.js';
import { Settings } from './settings.js';

export const ARENA_RADIUS = 132;

/* ------------------------------------------------------------ procedural */
function arenaFloorTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6d6559';
  g.fillRect(0, 0, S, S);
  // speckle
  for (let i = 0; i < 2600; i++) {
    const v = rand(-22, 22) | 0;
    g.fillStyle = `rgba(${120 + v},${112 + v},${98 + v},0.5)`;
    g.fillRect(Math.random() * S, Math.random() * S, rand(1, 4), rand(1, 4));
  }
  // tiles
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    g.beginPath(); g.moveTo(i * S / 2, 0); g.lineTo(i * S / 2, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * S / 2); g.lineTo(S, i * S / 2); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * S / 4, 0); g.lineTo(i * S / 4, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * S / 4); g.lineTo(S, i * S / 4); g.stroke();
  }
  // cracks
  for (let i = 0; i < 14; i++) {
    let x = Math.random() * S, y = Math.random() * S, a = Math.random() * TAU;
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = rand(0.6, 1.8);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      a += rand(-0.6, 0.6);
      x += Math.cos(a) * rand(6, 22); y += Math.sin(a) * rand(6, 22);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 26);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const SKY_FRAG = /* glsl */`
varying vec3 vDir;
uniform vec3 uTop, uMid, uBottom, uSun;
uniform vec3 uSunDir;
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uBottom, uMid, smoothstep(0.35, 0.55, h));
  col = mix(col, uTop, smoothstep(0.55, 0.95, h));
  float sun = pow(max(dot(d, normalize(uSunDir)), 0.0), 220.0);
  float halo = pow(max(dot(d, normalize(uSunDir)), 0.0), 8.0);
  col += uSun * (sun * 2.2 + halo * 0.35);
  gl_FragColor = vec4(col, 1.0);
}`;

const OCEAN_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vW; varying float vDist;
uniform float uTime;
void main(){
  vUv = uv;
  vec3 p = position;
  float w = sin(p.x * 0.035 + uTime * 0.9) * 0.6 + sin(p.y * 0.045 - uTime * 1.1) * 0.5;
  p.z += w;
  vW = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const OCEAN_FRAG = /* glsl */`
varying vec2 vUv; varying vec3 vW; varying float vDist;
uniform float uTime; uniform vec3 uA, uB, uFog;
void main(){
  float n = sin(vW.x * 0.08 + uTime * 1.2) * 0.5 + sin(vW.y * 0.11 - uTime * 0.8) * 0.5;
  float foam = smoothstep(0.72, 1.0, n);
  vec3 col = mix(uA, uB, clamp(n * 0.5 + 0.5, 0.0, 1.0));
  col += foam * 0.25;
  float f = smoothstep(220.0, 1500.0, vDist);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, mix(0.92, 1.0, f));
}`;

export class World {
  constructor(scene, camera, rig) {
    this.scene = scene;
    this.camera = camera;
    this.rig = rig;
    this.arenaRadius = ARENA_RADIUS;
    this.enemies = [];
    this.timers = [];
    this.timeScale = 1;
    this._slowT = 0;
    this.wave = 1;
    this.spawnQueue = 0;
    this.spawnTimer = 1.2;
    this.targetEnemies = 12;
    this.aimPoint = new THREE.Vector3(0, 0, 20);
    this.time = 0;
    this.killCount = 0;

    this.scene.fog = new THREE.FogExp2(0x59406b, 0.0013);

    this._buildSky();
    this._buildLights();
    this._buildArena();
    this._buildOcean();
    this._buildProps();

    this.combat = new Combat(this);
    this.player = new Player(this, { pos: new THREE.Vector3(0, 0, 0) });
    this.fx?.setWorld?.(this);
  }

  /* ------------------------------------------------------------- build */
  _buildSky() {
    const geo = new THREE.SphereGeometry(2600, 32, 20);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x120a2e) },
        uMid: { value: new THREE.Color(0x3b2a6b) },
        uBottom: { value: new THREE.Color(0xc86a4f) },
        uSun: { value: new THREE.Color(0xffd1a3) },
        uSunDir: { value: new THREE.Vector3(-0.5, 0.22, -0.8) },
      },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.scene.add(this.sky);
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9ab6ff, 0x3a2b22, 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffd7a8, 1.55);
    this.sun.position.set(-120, 150, -160);
    this.sun.castShadow = true;
    const d = Settings.get('shadowDistance');
    const s = this.sun.shadow.camera;
    s.left = -d; s.right = d; s.top = d; s.bottom = -d;
    s.near = 1; s.far = 620;
    this.sun.shadow.mapSize.set(Settings.get('shadowQuality'), Settings.get('shadowQuality'));
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0x6f8cff, 0.35);
    this.fill.position.set(120, 80, 140);
    this.scene.add(this.fill);

    Settings.onChange((k) => {
      if (k === 'shadows' || k === '*') this.sun.castShadow = Settings.get('shadows');
      if (k === 'shadowDistance' || k === '*') {
        const dd = Settings.get('shadowDistance');
        s.left = -dd; s.right = dd; s.top = dd; s.bottom = -dd;
        this.sun.shadow.camera.updateProjectionMatrix();
      }
      if (k === 'shadowQuality' || k === '*') {
        const q = Settings.get('shadowQuality');
        this.sun.shadow.mapSize.set(q, q);
        if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      }
    });
  }

  _buildArena() {
    const tex = arenaFloorTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.02 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(this.arenaRadius, 96), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    // rim
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x4a4237, roughness: 1, flatShading: true });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(this.arenaRadius + 1.5, this.arenaRadius + 3.5, 7, 96, 1, true), rimMat);
    rim.position.y = -3.4;
    rim.receiveShadow = true;
    this.scene.add(rim);

    // central emblem (gravity skills drag enemies here)
    const emblem = new THREE.Mesh(
      new THREE.RingGeometry(11.5, 13, 64),
      new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.y = 0.06;
    this.scene.add(emblem);
    const emblem2 = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.8, 48),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    emblem2.rotation.x = -Math.PI / 2;
    emblem2.position.y = 0.06;
    this.scene.add(emblem2);
    this.emblem = emblem;
  }

  _buildOcean() {
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(0x0a2a4a) },
        uB: { value: new THREE.Color(0x1f6ea8) },
        uFog: { value: new THREE.Color(0x59406b) },
      },
      vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG,
      // the ocean fades itself by distance (uFog) — it must NOT opt into the
      // scene fog, or three refreshes fog uniforms this shader doesn't have.
      transparent: true, fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200, 90, 90), this.oceanMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -7;
    this.scene.add(mesh);
    this.ocean = mesh;
  }

  _buildProps() {
    // broken pillars + rocks around the arena
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6154, roughness: 1, flatShading: true });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a8073, roughness: 0.9, flatShading: true });

    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), rockMat, 90);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * TAU, r = rand(18, this.arenaRadius - 6);
      v.set(Math.cos(a) * r, rand(0.1, 0.5), Math.sin(a) * r);
      e.set(rand(0, 3), rand(0, 3), rand(0, 3));
      q.setFromEuler(e);
      const sc = rand(0.7, 3.4);
      s.set(sc, sc * rand(0.5, 0.9), sc);
      m.compose(v, q, s);
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.scene.add(rocks);

    const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.5, 1.9, 1, 7), pillarMat, 26);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + rand(-0.06, 0.06);
      const r = this.arenaRadius - rand(3, 12);
      const h = rand(4, 14);
      v.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      e.set(rand(-0.05, 0.05), rand(0, 3), rand(-0.06, 0.06));
      q.setFromEuler(e);
      s.set(rand(0.8, 1.4), h, rand(0.8, 1.4));
      m.compose(v, q, s);
      pillars.setMatrixAt(i, m);
    }
    pillars.castShadow = true;
    pillars.receiveShadow = true;
    this.scene.add(pillars);

    // distant islands for silhouette
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x3b3550, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * TAU, r = rand(360, 900);
      const h = rand(40, 150);
      const isle = new THREE.Mesh(new THREE.ConeGeometry(rand(50, 130), h, 6), islandMat);
      isle.position.set(Math.cos(a) * r, -6 + h / 2, Math.sin(a) * r);
      isle.rotation.y = Math.random() * TAU;
      this.scene.add(isle);
    }
  }

  /* ------------------------------------------------------------ prewarm */
  /** Temporary enemy so character materials compile during load, not mid-fight. */
  prewarmEnemy() {
    const e = this.spawnEnemy(1);
    e.pos.set(0, -4000, 0);
    e.mesh.position.copy(e.pos);
    e.update(0.016);
    e.mesh.traverse((o) => { o.userData._fc = o.frustumCulled; o.frustumCulled = false; });
    this._prewarmEnemy = e;
    return e;
  }
  prewarmCleanup() {
    const e = this._prewarmEnemy;
    if (!e) return;
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    e.destroy();
    this._prewarmEnemy = null;
  }

  /* ------------------------------------------------------------- timers */
  after(delay, fn) { this.timers.push({ t: delay, fn, interval: 0, count: 1, i: 0 }); return fn; }
  /** run `fn` `count` times, first after `interval`, then every `interval` (callback receives the index) */
  every(interval, count, fn) { this.timers.push({ t: interval, fn, interval, count, i: 0 }); return fn; }

  updateTimers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        tm.fn(tm.i++);
        tm.count--;
        if (tm.count <= 0) this.timers.splice(i, 1);
        else tm.t += tm.interval;
      }
    }
  }

  /** slow-motion / freeze: Fatal Destruction */
  slowmo(duration, scale = 0.06) {
    this._slowT = duration;
    this._slowScale = scale;
  }

  /* ------------------------------------------------------------- entity */
  groundHeight() { return 0; }

  clampCameraToArena(pos, target) {
    if (pos.y < 1.4) pos.y = 1.4;
    const r = Math.hypot(pos.x, pos.z);
    const maxR = this.arenaRadius + 70;
    if (r > maxR) { pos.x *= maxR / r; pos.z *= maxR / r; }
  }

  onEntityDeath(entity, opts = {}) {
    if (entity === this.player) { this.respawnPlayer(); return; }
    this.killCount++;
    const idx = this.enemies.indexOf(entity);
    if (idx >= 0) this.enemies.splice(idx, 1);
    if (opts.source === this.player || (opts.source && opts.source.faction === 'player')) {
      this.player.onKill(entity);
    }
    this.spawnQueue++;
  }

  spawnEnemy(level = null) {
    const lv = level !== null ? level : Math.max(1, Math.round(this.wave * rand(0.8, 1.4)));
    let pos;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * TAU, r = rand(32, this.arenaRadius * 0.82);
      pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (pos.distanceTo(this.player.pos) > 30) break;
    }
    const e = new Enemy(this, { pos, level: lv });
    this.enemies.push(e);
    // spawn flash
    this.fx?.ring(pos, { from: 0.5, to: 6, duration: 0.6, color: 0xa855f7, opacity: 0.7 });
    return e;
  }

  respawnPlayer() {
    const p = this.player;
    this.after(2.2, () => {
      p.alive = true;
      p.hp = p.maxHp;
      p.pos.set(0, 0, 0);
      p.vel.set(0, 0, 0);
      p.kb.set(0, 0, 0);
      p.mesh.visible = true;
      p.stunT = 0;
      this.ui?.toast('RESPAWNED', 'warn', 1200);
      this.fx?.ring(p.pos, { from: 1, to: 24, duration: 0.8, color: 0xa855f7, opacity: 0.9 });
    });
    p.mesh.visible = false;
    this.ui?.toast('YOU DIED', 'bad', 1800);
  }

  /* -------------------------------------------------------------- update */
  update(dt) {
    // ---- global time scale (screen pause) ----
    if (this._slowT > 0) {
      this._slowT -= dt;
      const k = clamp(this._slowT / 0.25, 0, 1);
      this.timeScale = damp(this.timeScale, this._slowScale, 14, dt);
      if (this._slowT <= 0) this.timeScale = 1;
    } else if (this.timeScale !== 1) {
      this.timeScale = damp(this.timeScale, 1, 6, dt);
      if (Math.abs(this.timeScale - 1) < 0.02) this.timeScale = 1;
    }

    const sdt = dt * this.timeScale;
    this.time += sdt;

    this.updateTimers(sdt);

    const roster = this.enemies.slice();      // entities can die mid-iteration
    for (const e of roster) e.update(sdt);
    this.player.update(sdt, this.input);

    // enemy wave management
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.55;
      const want = this.targetEnemies + Math.floor(this.wave * 0.6);
      if (this.enemies.length + this.spawnQueue < want && this.enemies.length < 40) this.spawnQueue++;
    }
    if (this.spawnQueue > 0 && this.enemies.length < 40) {
      this.spawnQueue--;
      this.spawnEnemy();
    }
    if (this.enemies.length === 0 && this.spawnQueue === 0) {
      this.wave++;
      this.ui?.toast(`WAVE ${this.wave} — enemies incoming`, 'warn', 1600);
      for (let i = 0; i < 5; i++) this.spawnQueue++;
    }

    // sun follows player for tighter shadow coverage
    this.sun.position.set(this.player.pos.x - 120, 150, this.player.pos.z - 160);
    this.sun.target.position.copy(this.player.pos);
    this.sun.target.updateMatrixWorld();

    this.oceanMat.uniforms.uTime.value += sdt;
    this.sky.position.copy(this.camera.position);
    this.emblem.material.opacity = 0.22 + Math.sin(this.time * 1.6) * 0.07;
  }
}

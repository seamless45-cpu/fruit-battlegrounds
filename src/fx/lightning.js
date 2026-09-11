/**
 * Jagged lightning bolts.
 *
 * Each bolt is a camera-facing ribbon (triangle strip) built from a jagged
 * polyline with recursive branches.  The default shape is a TALL VERTICAL
 * bolt (from high above down to the target) — the signature look of the
 * Gravity (purple) and Lightning (neon blue) fruits.
 */
import * as THREE from 'three';
import { clamp, rand, randSign, tmp } from '../core/utils.js';
import { Settings } from '../core/settings.js';

const MAX_LINE_POINTS = 48;        // points in a single channel / branch
const MAX_LINES = 12;              // main channel + up to 11 branches
const MAX_POINTS = MAX_LINE_POINTS * MAX_LINES;   // vertex budget per bolt
const MAX_VERTS = MAX_POINTS * 2;

const VERT = /* glsl */`
attribute vec2 buv;
varying vec2 vUv;
void main() {
  vUv = buv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  float e = 1.0 - abs(vUv.x * 2.0 - 1.0);       // 1 at core, 0 at edges
  float core = pow(e, 9.0);
  float glow = pow(e, 1.4);
  vec3 col = mix(uColor, vec3(1.0), core * 0.95 + glow * 0.25);
  float a = uIntensity * glow;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * (0.65 + glow * 0.9 + core * 2.0), a);
}`;

class Bolt {
  constructor() {
    this.pos = new Float32Array(MAX_VERTS * 3);
    this.uv = new Float32Array(MAX_VERTS * 2);
    const index = new Uint16Array(MAX_POINTS * 6);
    for (let i = 0; i < MAX_POINTS; i++) {
      const b = i * 2, o = i * 6;
      index[o] = b; index[o + 1] = b + 1; index[o + 2] = b + 2;
      index[o + 3] = b + 1; index[o + 4] = b + 3; index[o + 5] = b + 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('buv', new THREE.BufferAttribute(this.uv, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xa855f7) }, uIntensity: { value: 1 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.visible = false;

    // jagged polylines: this.lines = [Vector3[], ...]
    this.lines = [];
    for (let i = 0; i < MAX_LINES; i++) {
      const arr = [];
      for (let j = 0; j < MAX_LINE_POINTS; j++) arr.push(new THREE.Vector3());
      this.lines.push({ pts: arr, n: 0, width: 1 });
    }
    this.active = false;
    this.alive = 0;
    this.life = 1;
    this.width = 1;
    this.intensity = 1;
    this.flicker = 0;
  }
}

export class LightningSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.bolts = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this._resize(Settings.get('maxBolts'));
    Settings.onChange((k) => { if (k === 'maxBolts' || k === '*') this._resize(Settings.get('maxBolts')); });
    this._camX = 1e9; this._camY = 1e9; this._camZ = 1e9;
    this._v = new THREE.Vector3();
    this._toCam = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._side = new THREE.Vector3();
  }

  _resize(n) {
    n = clamp(Math.round(n), 8, 220);
    while (this.bolts.length < n) {
      const b = new Bolt();
      this.group.add(b.mesh);
      this.bolts.push(b);
    }
    this.maxBolts = n;
  }

  _get() {
    for (const b of this.bolts) if (!b.active) return b;
    // recycle: kill the oldest
    let oldest = this.bolts[0];
    for (const b of this.bolts) if (b.alive / b.life > oldest.alive / oldest.life) oldest = b;
    return oldest;
  }

  /**
   * Spawn a bolt.
   * @param {object} o
   *  from:Vector3, to:Vector3  (omit `to` for a vertical strike at `pos`)
   *  color, width, life, segments, branches, jitter, intensity, endFade
   */
  spawn(o) {
    const b = this._get();
    b.active = true;
    b.alive = 0;
    b.life = o.life !== undefined ? o.life : 0.34;
    b.width = o.width !== undefined ? o.width : 1.1;
    b.intensity = o.intensity !== undefined ? o.intensity : 1;
    b.flicker = o.flicker !== undefined ? o.flicker : 1;
    b.material.uniforms.uColor.value.set(o.color !== undefined ? o.color : 0xa855f7);
    b.material.uniforms.uIntensity.value = 0;
    b.mesh.visible = true;

    const from = o.from ? tmp.v1.copy(o.from) : tmp.v1.set(o.pos.x, o.pos.y + (o.height || 60), o.pos.z);
    const to = o.to ? tmp.v2.copy(o.to) : tmp.v2.copy(o.pos);
    const q = Settings.get('lightningQuality');
    const dist = from.distanceTo(to);
    const segs = clamp(Math.round((o.segments || (6 + dist * 0.35)) * q), 4, 46);
    const jitter = (o.jitter !== undefined ? o.jitter : Math.min(3.2, dist * 0.09)) * clamp(q, 0.6, 1.4);
    const branches = Math.round((o.branches !== undefined ? o.branches : 3) * q);

    this._buildPath(b.lines[0], from, to, segs, jitter, o.endFade !== false);
    b.lines[0].width = 1;
    let li = 1;
    for (let i = 0; i < branches && li < b.lines.length; i++) {
      const parent = b.lines[0];
      const idx = 1 + ((Math.random() * (parent.n - 2)) | 0);
      if (idx < 1) continue;
      const start = parent.pts[idx];
      const dirTo = this._v.copy(to).sub(from).normalize();
      const len = dist * rand(0.18, 0.5);
      const end = tmp.v3.copy(start)
        .addScaledVector(dirTo, len * 0.55)
        .add(new THREE.Vector3(rand(-1, 1), rand(-0.35, 0.25), rand(-1, 1)).normalize().multiplyScalar(len * 0.75));
      this._buildPath(b.lines[li], start, end, clamp(Math.round(segs * 0.45), 3, 16), jitter * 0.55, false);
      b.lines[li].width = 0.45;
      li++;
    }
    b.lineCount = li;
    this._updateGeometry(b);
    this._updateIntensity(b, 0);
    return b;
  }

  _buildPath(line, from, to, segs, jitter, taper) {
    const n = clamp(segs + 1, 2, MAX_LINE_POINTS);
    line.n = n;
    const dir = tmp.v4.copy(to).sub(from);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    // two perpendicular axes
    const up = Math.abs(dir.y) > 0.9 ? tmp.v5.set(1, 0, 0) : tmp.v5.set(0, 1, 0);
    const ax = new THREE.Vector3().crossVectors(dir, up).normalize();
    const ay = new THREE.Vector3().crossVectors(dir, ax).normalize();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = line.pts[i].copy(from).addScaledVector(dir, len * t);
      const env = taper ? Math.sin(Math.PI * clamp(t, 0, 1)) * 0.75 + 0.25 : 1;
      const j = jitter * env;
      p.addScaledVector(ax, rand(-j, j)).addScaledVector(ay, rand(-j, j));
    }
    line.pts[n - 1].copy(to);
  }

  _updateGeometry(b) {
    const cam = this.camera.position;
    let v = 0, idxCount = 0;
    const pos = b.pos, uv = b.uv;
    for (let l = 0; l < b.lineCount; l++) {
      const line = b.lines[l];
      const n = line.n;
      if (n < 2) continue;
      if (v + n * 2 > MAX_VERTS) break;      // stay inside the pre-allocated buffer
      const half = b.width * line.width * 0.5;
      for (let i = 0; i < n; i++) {
        const p = line.pts[i];
        const pa = line.pts[Math.max(0, i - 1)], pb = line.pts[Math.min(n - 1, i + 1)];
        this._dir.copy(pb).sub(pa);
        if (this._dir.lengthSq() < 1e-8) this._dir.set(0, 1, 0);
        this._dir.normalize();
        this._toCam.copy(cam).sub(p);
        this._side.crossVectors(this._dir, this._toCam);
        if (this._side.lengthSq() < 1e-8) this._side.set(1, 0, 0);
        this._side.normalize().multiplyScalar(half);
        const o = v * 3;
        pos[o] = p.x - this._side.x; pos[o + 1] = p.y - this._side.y; pos[o + 2] = p.z - this._side.z;
        pos[o + 3] = p.x + this._side.x; pos[o + 4] = p.y + this._side.y; pos[o + 5] = p.z + this._side.z;
        const uo = v * 2;
        const t = i / (n - 1);
        uv[uo] = 0; uv[uo + 1] = t;
        uv[uo + 2] = 1; uv[uo + 3] = t;
        v += 2;
        if (i < n - 1) idxCount += 6;
      }
    }
    b.geometry.setDrawRange(0, idxCount);
    b.built = true;
    if (v === 0) return;
    // upload only the slice we actually filled (a 40-segment bolt uses ~100 of
    // the 1152 reserved vertices) instead of the whole buffer every frame
    const pa = b.geometry.attributes.position;
    const ua = b.geometry.attributes.buv;
    pa.clearUpdateRanges(); pa.addUpdateRange(0, v * 3); pa.needsUpdate = true;
    ua.clearUpdateRanges(); ua.addUpdateRange(0, v * 2); ua.needsUpdate = true;
  }

  _updateIntensity(b, dt) {
    const t = b.alive / b.life;
    let v;
    if (t < 0.08) v = t / 0.08;                      // strike in
    else v = Math.pow(1 - (t - 0.08) / 0.92, 1.5);   // fade out
    if (b.flicker > 0) {
      v *= 1 - b.flicker * 0.35 * Math.abs(Math.sin(b.alive * 90 + b.width * 13));
    }
    b.material.uniforms.uIntensity.value = Math.max(0, v * b.intensity);
  }

  update(dt) {
    // the ribbon is camera-facing, so it only needs rebuilding when the camera
    // actually moves — standing still costs nothing
    const cp = this.camera.position;
    const camMoved = (cp.x - this._camX) ** 2 + (cp.y - this._camY) ** 2 + (cp.z - this._camZ) ** 2 > 1e-4;
    this._camX = cp.x; this._camY = cp.y; this._camZ = cp.z;

    for (const b of this.bolts) {
      if (!b.active) continue;
      b.alive += dt;
      if (b.alive >= b.life) {
        b.active = false;
        b.built = false;
        b.mesh.visible = false;
        b.geometry.setDrawRange(0, 0);
        continue;
      }
      if (camMoved || !b.built) this._updateGeometry(b);
      this._updateIntensity(b, dt);
    }
  }

  /** Convenience: a tall vertical strike onto a ground position. */
  strike(pos, opts = {}) {
    return this.spawn({
      pos, height: opts.height || 55, color: opts.color, width: opts.width,
      life: opts.life || 0.32, branches: opts.branches, jitter: opts.jitter,
      intensity: opts.intensity, endFade: opts.endFade,
    });
  }

  clear() {
    for (const b of this.bolts) { b.active = false; b.mesh.visible = false; b.geometry.setDrawRange(0, 0); }
  }

  get activeCount() { return this.bolts.reduce((a, b) => a + (b.active ? 1 : 0), 0); }
}

/**
 * Ground decals: scorch marks, quake cracks, expanding shockwave rings
 * and persistent fire pits (Gravity fruit asteroid aftermath).
 */
import * as THREE from 'three';
import { rand, TAU, clamp } from '../core/utils.js';
import { Settings } from '../core/settings.js';

/* ---------------------------------------------------------------- textures */
function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function makeCrackTexture(seed = 0) {
  const S = 512, c = makeCanvas(S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(255,255,255,0.95)';
  const cx = S / 2, cy = S / 2;

  const walk = (x, y, ang, len, w, depth) => {
    let px = x, py = y, a = ang;
    const steps = 6 + ((Math.random() * 6) | 0);
    const seg = len / steps;
    g.beginPath();
    g.moveTo(px, py);
    for (let i = 0; i < steps; i++) {
      a += rand(-0.5, 0.5);
      px += Math.cos(a) * seg;
      py += Math.sin(a) * seg;
      g.lineTo(px, py);
    }
    g.strokeStyle = 'rgba(255,255,255,' + (0.55 + depth * 0.12) + ')';
    g.lineWidth = w;
    g.shadowBlur = 14;
    g.stroke();
    // glow pass
    g.strokeStyle = 'rgba(255,255,255,' + (0.18 + depth * 0.05) + ')';
    g.lineWidth = w * 3.2;
    g.shadowBlur = 26;
    g.stroke();
    if (depth > 0) {
      const branches = 1 + ((Math.random() * 2) | 0);
      for (let b = 0; b < branches; b++) {
        const bi = 2 + ((Math.random() * (steps - 2)) | 0);
        const bx = px - Math.cos(a) * seg * (steps - bi), by = py - Math.sin(a) * seg * (steps - bi);
        walk(bx, by, a + rand(-1.1, 1.1), len * rand(0.35, 0.62), Math.max(0.7, w * 0.62), depth - 1);
      }
    }
  };

  const mains = 9 + ((Math.random() * 5) | 0);
  for (let i = 0; i < mains; i++) {
    const a = (i / mains) * TAU + rand(-0.25, 0.25);
    const r0 = rand(6, 30);
    walk(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, a, rand(120, 225), rand(2.2, 4.6), 2);
  }
  // bright epicentre
  const rg = g.createRadialGradient(cx, cy, 0, cx, cy, 70);
  rg.addColorStop(0, 'rgba(255,255,255,0.85)');
  rg.addColorStop(0.45, 'rgba(255,255,255,0.20)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.beginPath(); g.arc(cx, cy, 70, 0, TAU); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeScorchTexture() {
  const S = 512, c = makeCanvas(S), g = c.getContext('2d');
  const cx = S / 2, cy = S / 2;
  const rg = g.createRadialGradient(cx, cy, S * 0.06, cx, cy, S * 0.5);
  rg.addColorStop(0, 'rgba(6,5,4,0.95)');
  rg.addColorStop(0.45, 'rgba(12,9,7,0.72)');
  rg.addColorStop(0.8, 'rgba(20,15,11,0.32)');
  rg.addColorStop(1, 'rgba(20,15,11,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  // ragged speckles
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * TAU, r = Math.pow(Math.random(), 0.6) * S * 0.48;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    g.fillStyle = 'rgba(0,0,0,' + rand(0.05, 0.3) + ')';
    g.beginPath();
    g.arc(x, y, rand(1, 7), 0, TAU);
    g.fill();
  }
  // embers at the rim
  for (let i = 0; i < 220; i++) {
    const a = Math.random() * TAU, r = S * rand(0.3, 0.48);
    g.fillStyle = 'rgba(255,140,40,' + rand(0.05, 0.35) + ')';
    g.beginPath();
    g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rand(0.6, 2.6), 0, TAU);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------ fire shader */
const FIRE_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const FIRE_FRAG = /* glsl */`
varying vec2 vUv;
uniform float uTime, uLife, uSeed;
uniform vec3 uA, uB;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = vUv - 0.5;
  float r = length(uv) * 2.0;
  float t = uTime * 0.55 + uSeed;
  float n = fbm(uv * 6.0 + vec2(0.0, -t * 0.8));
  float n2 = fbm(uv * 12.0 - vec2(t * 0.4, t * 0.9));
  float heat = smoothstep(0.30, 0.95, n * 0.72 + n2 * 0.45);
  float rim = smoothstep(1.0, 0.62, r);
  float a = heat * rim * uLife;
  vec3 col = mix(uA, uB, clamp(heat, 0.0, 1.0));
  col += vec3(1.0, 0.75, 0.35) * pow(heat, 3.0) * 1.8;
  if(a < 0.01) discard;
  gl_FragColor = vec4(col, a * 0.9);
}`;

/* ------------------------------------------------------------------ system */
export class DecalSystem {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.crackTex = [makeCrackTexture(0), makeCrackTexture(1), makeCrackTexture(2), makeCrackTexture(3)];
    this.scorchTex = makeScorchTexture();

    this.geo = new THREE.PlaneGeometry(1, 1);
    this.ringGeo = new THREE.RingGeometry(0.82, 1.0, 72, 1);

    this.decals = [];
    this.rings = [];
    this.pits = [];
    this.yOffset = 0.05;
    this._y = 0.05;
  }

  /** stack decals a hair apart so they don't z-fight */
  _nextY() {
    this._stack = (this._stack || 0) + 1;
    return 0.05 + (this._stack % 40) * 0.0025;
  }

  _newDecal(tex, additive, color, opacity) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      color, depthWrite: false, side: THREE.FrontSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    this.group.add(m);
    return m;
  }

  _acquireDecal(tex, additive) {
    // find a free (invisible) decal with matching texture
    for (const d of this.decals) {
      if (!d.mesh.visible && d.tex === tex) return d;
    }
    if (this.decals.length > 90) {
      // recycle oldest visible
      let oldest = this.decals[0];
      for (const d of this.decals) if (d.t > oldest.t) oldest = d;
      oldest.mesh.material.map = tex;
      oldest.mesh.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      oldest.mesh.material.needsUpdate = true;
      oldest.tex = tex;
      return oldest;
    }
    const mesh = this._newDecal(tex, additive, 0xffffff, 1);
    const rec = { mesh, tex, t: 0, life: 0, fade: 0, active: false, scale: 1, targetScale: 1, grow: 0 };
    this.decals.push(rec);
    return rec;
  }

  /** dark scorch mark left by explosions */
  scorch(pos, radius, { life = 26, opacity = 0.9 } = {}) {
    if (!Settings.get('decals')) return;
    const d = this._acquireDecal(this.scorchTex, false);
    d.mesh.visible = true;
    d.mesh.position.set(pos.x, this._nextY(), pos.z);
    d.mesh.scale.setScalar(radius * 2);
    d.mesh.rotation.z = rand(0, TAU);
    d.mesh.material.color.set(0xffffff);
    d.t = 0; d.life = life * Settings.get('decalFade'); d.fade = opacity;
    d.active = true; d.grow = 0;
    return d;
  }

  /** neon quake/lightning cracks radiating across the ground */
  crack(pos, radius, { color = 0x38bdf8, life = 3.2, opacity = 1, spin = true } = {}) {
    if (!Settings.get('decals')) return;
    const tex = this.crackTex[(Math.random() * this.crackTex.length) | 0];
    const d = this._acquireDecal(tex, true);
    d.mesh.visible = true;
    d.mesh.position.set(pos.x, 0.09 + Math.random() * 0.02, pos.z);
    d.mesh.rotation.z = spin ? rand(0, TAU) : 0;
    d.mesh.scale.setScalar(radius * 2 * 0.98);
    d.mesh.material.color.set(color);
    d.t = 0; d.life = life * Settings.get('decalFade'); d.fade = opacity;
    d.active = true; d.grow = 1;
    d.targetScale = radius * 2;
    d.mesh.scale.setScalar(radius * 0.4);
    return d;
  }

  /** expanding shockwave ring (white semi-transparent or tinted) */
  ring(pos, { from = 1, to = 20, duration = 0.6, color = 0xffffff, opacity = 0.85, width = 1, y = 0.14, tilt = true } = {}) {
    let rec = this.rings.find(r => !r.active);
    if (!rec) {
      if (this.rings.length > 60) rec = this.rings[0];
      else {
        const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
          color, transparent: true, opacity, blending: THREE.AdditiveBlending,
          depthWrite: false, side: THREE.DoubleSide,
        }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 3;
        this.group.add(mesh);
        rec = { mesh, active: false };
        this.rings.push(rec);
      }
    }
    rec.active = true;
    rec.t = 0; rec.dur = duration; rec.from = from; rec.to = to; rec.op = opacity; rec.w = width;
    rec.mesh.visible = true;
    rec.mesh.position.set(pos.x, y, pos.z);
    rec.mesh.material.color.set(color);
    rec.mesh.material.opacity = opacity;
    rec.mesh.scale.setScalar(from);
    return rec;
  }

  /**
   * Persistent fire pit (asteroid aftermath).
   * @param {object} o position, radius, duration, color, tickInterval, onTick
   */
  firepit(pos, radius, { duration = 10, color = 0xff6a1a, tickInterval = 0.5, onTick = null } = {}) {
    let rec = this.pits.find(p => !p.active);
    if (!rec) {
      if (this.pits.length > 24) rec = this.pits[0];
      else {
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 }, uLife: { value: 1 }, uSeed: { value: Math.random() * 100 },
            uA: { value: new THREE.Color(0x5a1200) }, uB: { value: new THREE.Color(0xffb347) },
          },
          vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(this.geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.12;
        mesh.renderOrder = 4;
        this.group.add(mesh);
        rec = { mesh, active: false };
        this.pits.push(rec);
      }
    }
    rec.active = true;
    rec.t = 0; rec.dur = duration; rec.radius = radius; rec.tick = 0; rec.tickInterval = tickInterval; rec.onTick = onTick;
    rec.mesh.visible = true;
    rec.mesh.position.set(pos.x, 0.12, pos.z);
    rec.mesh.scale.setScalar(radius * 2);
    rec.mesh.material.uniforms.uTime.value = 0;
    rec.mesh.material.uniforms.uLife.value = 1;
    rec.mesh.material.uniforms.uSeed.value = Math.random() * 100;
    rec.mesh.material.uniforms.uA.value.set(color).multiplyScalar(0.35);
    rec.mesh.material.uniforms.uB.value.set(color).lerp(new THREE.Color(0xffffff), 0.45);
    return rec;
  }

  update(dt) {
    for (const d of this.decals) {
      if (!d.active) continue;
      d.t += dt;
      const k = d.t / d.life;
      if (k >= 1) { d.active = false; d.mesh.visible = false; continue; }
      if (d.grow) {
        const g = Math.min(1, d.t / 0.28);
        d.mesh.scale.setScalar(d.targetScale * (0.4 + 0.6 * (1 - Math.pow(1 - g, 3))));
      }
      d.mesh.material.opacity = d.fade * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 2.4);
      const s = r.from + (r.to - r.from) * e;
      r.mesh.scale.set(s, s, 1);
      r.mesh.material.opacity = r.op * (1 - k) * (1 - k);
    }

    for (const p of this.pits) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) { p.active = false; p.mesh.visible = false; continue; }
      p.mesh.material.uniforms.uTime.value += dt;
      p.mesh.material.uniforms.uLife.value = k > 0.85 ? (1 - k) / 0.15 : 1;
      p.tick += dt;
      if (p.tick >= p.tickInterval) { p.tick = 0; p.onTick?.(p); }
      // rising embers
      if (this.fx && Math.random() < dt * 26 * Settings.get('particleQuality')) {
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * p.radius;
        this.fx.glow.spawn({
          pos: { x: p.mesh.position.x + Math.cos(a) * r, y: 0.4, z: p.mesh.position.z + Math.sin(a) * r },
          vel: { x: rand(-0.6, 0.6), y: rand(2.6, 7), z: rand(-0.6, 0.6) },
          color: Math.random() < 0.35 ? 0xffe08a : 0xff7a1a,
          size: rand(1.4, 3.4), life: rand(0.7, 1.6), gravity: 1.6, drag: 0.35, grow: 0.7,
        });
      }
    }
  }

  clear() {
    for (const d of this.decals) { d.active = false; d.mesh.visible = false; }
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    for (const p of this.pits) { p.active = false; p.mesh.visible = false; }
  }
}

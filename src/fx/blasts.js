/**
 * Fireball / blast meshes + pooled flash lights.
 */
import * as THREE from 'three';
import { rand, TAU } from '../core/utils.js';

const NOISE_GLSL = /* glsl */`
float hash31(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i+vec3(0,0,0)), hash31(i+vec3(1,0,0)), f.x),
                 mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                 mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
}`;

const VERT = /* glsl */`
uniform float uTime, uAmp, uGrow;
varying float vN;
varying vec3 vLocal;
${NOISE_GLSL}
void main(){
  vec3 p = position;
  float n = noise3(normalize(position) * 2.2 + vec3(0.0, -uTime * 1.4, uTime * 0.6));
  float n2 = noise3(normalize(position) * 5.5 - vec3(uTime * 0.9));
  vN = n * 0.65 + n2 * 0.35;
  p += normal * (vN - 0.5) * uAmp;
  p *= uGrow;
  vLocal = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uA, uB, uC;
uniform float uLife, uHeat;
varying float vN;
varying vec3 vLocal;
void main(){
  float h = clamp(vN * uHeat, 0.0, 1.0);
  vec3 col = mix(uA, uB, smoothstep(0.25, 0.85, h));
  col = mix(col, uC, smoothstep(0.7, 1.0, h));
  float a = uLife * (0.35 + h * 0.9);
  if (a < 0.008) discard;
  gl_FragColor = vec4(col * (0.8 + h * 1.9), a);
}`;

class Blast {
  constructor(geo) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uAmp: { value: 0.5 }, uGrow: { value: 1 },
        uLife: { value: 1 }, uHeat: { value: 1 },
        uA: { value: new THREE.Color(0xff4d00) },
        uB: { value: new THREE.Color(0xffb703) },
        uC: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.active = false;
  }
}

export class BlastSystem {
  constructor(scene, { pool = 26 } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const geo = new THREE.IcosahedronGeometry(1, 3);
    this.blasts = [];
    for (let i = 0; i < pool; i++) {
      const b = new Blast(geo);
      this.group.add(b.mesh);
      this.blasts.push(b);
    }
    // ---- flash lights ----
    this.lights = [];
    for (let i = 0; i < 8; i++) {
      // lights stay visible with zero intensity: toggling visibility would
      // change the lights hash and force a shader recompile every flash.
      const l = new THREE.PointLight(0xffffff, 0, 90, 2);
      scene.add(l);
      this.lights.push({ light: l, t: 0, dur: 0.3, peak: 0, busy: false });
    }
  }

  spawn(pos, { radius = 8, life = 0.55, color = 0xff5a00, colorB = 0xffd166, amp = 0.55, heat = 1 } = {}) {
    let b = this.blasts.find(x => !x.active);
    if (!b) b = this.blasts[0];
    b.active = true;
    b.t = 0; b.life = life; b.radius = radius;
    b.mesh.visible = true;
    b.mesh.position.copy(pos);
    b.mesh.scale.setScalar(1);
    b.mesh.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    const u = b.material.uniforms;
    u.uTime.value = 0;
    u.uAmp.value = amp;
    u.uGrow.value = 0.35;
    u.uLife.value = 1.4;
    u.uHeat.value = heat;
    u.uA.value.set(color).multiplyScalar(0.55);
    u.uB.value.set(colorB);
    return b;
  }

  flash(pos, color = 0xffffff, peak = 900, dur = 0.32, distance = 120) {
    let rec = this.lights.find(l => !l.busy);
    if (!rec) rec = this.lights[0];
    rec.busy = true;
    rec.light.position.copy(pos);
    rec.light.color.set(color);
    rec.light.distance = distance;
    rec.t = 0; rec.dur = dur; rec.peak = peak;
  }

  update(dt) {
    for (const b of this.blasts) {
      if (!b.active) continue;
      b.t += dt;
      const k = b.t / b.life;
      if (k >= 1) { b.active = false; b.mesh.visible = false; continue; }
      const u = b.material.uniforms;
      u.uTime.value += dt;
      const e = 1 - Math.pow(1 - k, 2.2);
      u.uGrow.value = 0.35 + (b.radius - 0.35) * e;
      u.uLife.value = Math.pow(1 - k, 1.35) * 1.5;
      u.uAmp.value = 0.55 + k * 0.5;
      b.mesh.scale.setScalar(1);
    }
    for (const rec of this.lights) {
      if (!rec.busy) continue;
      rec.t += dt;
      const k = rec.t / rec.dur;
      if (k >= 1) { rec.busy = false; rec.light.intensity = 0; continue; }
      rec.light.intensity = rec.peak * Math.pow(1 - k, 2.2);
    }
  }

  clear() {
    for (const b of this.blasts) { b.active = false; b.mesh.visible = false; }
    for (const l of this.lights) { l.busy = false; l.light.intensity = 0; }
  }
}

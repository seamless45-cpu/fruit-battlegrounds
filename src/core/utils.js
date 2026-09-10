/** Small shared math + helper utilities. */
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);
/** frame-rate independent exponential approach */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;

/** random point on a circle (x,z) */
export function randOnCircle(radius, out = new THREE.Vector3()) {
  const a = Math.random() * TAU;
  const r = radius * Math.sqrt(Math.random());
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
}
export function randInCircle(radius, out = new THREE.Vector3()) { return randOnCircle(radius, out); }

/** random point inside a square of half-size `half` centered on `center` (XZ) */
export function randInSquare(half, center, out = new THREE.Vector3()) {
  return out.set(center.x + rand(-half, half), center.y, center.z + rand(-half, half));
}

/** deterministic-ish 1D value noise, good enough for camera shake */
export function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
export function valueNoise(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}

/** cheap object pool */
export class Pool {
  constructor(factory, reset, size = 0) {
    this.factory = factory; this.reset = reset; this.free = []; this.active = [];
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  acquire() {
    const o = this.free.pop() || this.factory();
    this.active.push(o);
    return o;
  }
  release(o) {
    const i = this.active.indexOf(o);
    if (i >= 0) this.active.splice(i, 1);
    this.reset?.(o);
    this.free.push(o);
  }
  releaseAll() {
    while (this.active.length) this.release(this.active[this.active.length - 1]);
  }
}

/** scratch vectors — avoids per-frame allocations */
export const tmp = {
  v1: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(),
  v4: new THREE.Vector3(), v5: new THREE.Vector3(),
  q1: new THREE.Quaternion(), m1: new THREE.Matrix4(), c1: new THREE.Color(),
};

export function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

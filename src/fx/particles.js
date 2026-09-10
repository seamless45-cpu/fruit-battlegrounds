/**
 * Pooled GPU point-sprite particle system (sparks, embers, smoke, dust).
 */
import * as THREE from 'three';

const VERT = /* glsl */`
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying vec3 vColor;
varying float vAlpha;
uniform float uScale;
void main() {
  vColor = pcolor;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.0, size * uScale / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
uniform int uSoft;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = uSoft == 1 ? pow(1.0 - r * 2.0, 1.6) : smoothstep(0.5, 0.12, r);
  gl_FragColor = vec4(vColor, a * vAlpha);
  if (gl_FragColor.a < 0.004) discard;
}`;

export class ParticleSystem {
  constructor(scene, { max = 4000, additive = true, soft = true, renderOrder = 5 } = {}) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);

    // CPU-side state
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.floorY = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 520 }, uSoft: { value: soft ? 1 : 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    scene.add(this.points);
    this.geometry = g;
    this._c = new THREE.Color();
  }

  setScale(v) { this.material.uniforms.uScale.value = v; }

  /**
   * @param {object} o
   *  pos:Vector3, vel:Vector3, color, size, life, gravity, drag, grow, alpha, floorY
   */
  spawn(o) {
    let i;
    if (this.count < this.max) i = this.count++;
    else i = (Math.random() * this.max) | 0;   // recycle oldest-ish

    const i3 = i * 3;
    this.pos[i3] = o.pos.x; this.pos[i3 + 1] = o.pos.y; this.pos[i3 + 2] = o.pos.z;
    this.vel[i3] = o.vel ? o.vel.x : 0; this.vel[i3 + 1] = o.vel ? o.vel.y : 0; this.vel[i3 + 2] = o.vel ? o.vel.z : 0;

    const c = this._c.set(o.color !== undefined ? o.color : 0xffffff);
    this.col[i3] = c.r; this.col[i3 + 1] = c.g; this.col[i3 + 2] = c.b;

    const s = o.size !== undefined ? o.size : 1;
    this.size[i] = s; this.size0[i] = s;
    const a = o.alpha !== undefined ? o.alpha : 1;
    this.alpha[i] = a; this.a0[i] = a;

    const l = o.life !== undefined ? o.life : 1;
    this.life[i] = l; this.maxLife[i] = l;
    this.grav[i] = o.gravity !== undefined ? o.gravity : 0;
    this.drag[i] = o.drag !== undefined ? o.drag : 0.6;
    this.grow[i] = o.grow !== undefined ? o.grow : 0;
    this.floorY[i] = o.floorY !== undefined ? o.floorY : -9999;
    return i;
  }

  update(dt) {
    const { pos, vel, life, maxLife, alpha, a0, size, size0, grav, drag, grow, floorY } = this;
    for (let i = this.count - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) { this._kill(i); continue; }
      const i3 = i * 3;
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= d; vel[i3 + 2] *= d;
      vel[i3 + 1] = vel[i3 + 1] * d + grav[i] * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      if (pos[i3 + 1] < floorY[i]) { pos[i3 + 1] = floorY[i]; vel[i3 + 1] *= -0.32; vel[i3] *= 0.7; vel[i3 + 2] *= 0.7; }
      const t = life[i] / maxLife[i];
      alpha[i] = a0[i] * (t > 0.75 ? (1 - t) * 4 : t / 0.75);   // quick in, long out
      size[i] = size0[i] * (1 + grow[i] * (1 - t));
    }
    const g = this.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.pcolor.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.setDrawRange(0, this.count);
  }

  _kill(i) {
    const last = --this.count;
    if (i !== last) {
      const i3 = i * 3, l3 = last * 3;
      for (let k = 0; k < 3; k++) {
        this.pos[i3 + k] = this.pos[l3 + k];
        this.col[i3 + k] = this.col[l3 + k];
        this.vel[i3 + k] = this.vel[l3 + k];
      }
      this.size[i] = this.size[last]; this.size0[i] = this.size0[last];
      this.alpha[i] = this.alpha[last]; this.a0[i] = this.a0[last];
      this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
      this.grav[i] = this.grav[last]; this.drag[i] = this.drag[last];
      this.grow[i] = this.grow[last]; this.floorY[i] = this.floorY[last];
    }
  }

  clear() { this.count = 0; this.geometry.setDrawRange(0, 0); }
}

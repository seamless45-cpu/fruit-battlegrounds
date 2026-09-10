/**
 * Physical debris chunks thrown out by explosions / ground smashes.
 * One InstancedMesh, CPU-simulated rigid bodies with ground bounce.
 */
import * as THREE from 'three';
import { rand, randSign, tmp } from '../core/utils.js';
import { Settings } from '../core/settings.js';

const MAX = 900;

export class DebrisSystem {
  constructor(scene) {
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    // squash the base shape so chunks look like broken rock
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) * rand(0.7, 1.4), p.getY(i) * rand(0.5, 1.3), p.getZ(i) * rand(0.7, 1.4));
    }
    geo.computeVertexNormals();

    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.92, metalness: 0.05, flatShading: true, vertexColors: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    this.count = 0;
    this.p = new Float32Array(MAX * 3);
    this.v = new Float32Array(MAX * 3);
    this.rot = new Float32Array(MAX * 3);
    this.rv = new Float32Array(MAX * 3);
    this.scale = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.sleep = new Float32Array(MAX);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.mesh.count = 0;
  }

  spawn(pos, opts = {}) {
    const n = Math.round((opts.count !== undefined ? opts.count : 12) * Settings.get('debrisScale'));
    if (!Settings.get('debris')) return;
    const speed = opts.speed !== undefined ? opts.speed : 16;
    const up = opts.up !== undefined ? opts.up : 0.85;
    const scale = opts.scale !== undefined ? opts.scale : 1;
    for (let k = 0; k < n; k++) {
      let i;
      if (this.count < MAX) i = this.count++;
      else i = (Math.random() * MAX) | 0;
      const i3 = i * 3;
      this.p[i3] = pos.x + rand(-1, 1) * 0.6;
      this.p[i3 + 1] = pos.y + rand(0, 1.2);
      this.p[i3 + 2] = pos.z + rand(-1, 1) * 0.6;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      const sp = speed * rand(0.35, 1.25);
      this.v[i3] = Math.cos(a) * r * sp;
      this.v[i3 + 1] = sp * up * rand(0.5, 1.5);
      this.v[i3 + 2] = Math.sin(a) * r * sp;
      if (opts.dir) { this.v[i3] += opts.dir.x * sp * 0.55; this.v[i3 + 2] += opts.dir.z * sp * 0.55; }
      this.rot[i3] = rand(0, 6.3); this.rot[i3 + 1] = rand(0, 6.3); this.rot[i3 + 2] = rand(0, 6.3);
      this.rv[i3] = rand(-9, 9); this.rv[i3 + 1] = rand(-9, 9); this.rv[i3 + 2] = rand(-9, 9);
      this.scale[i] = scale * rand(0.35, 1.3);
      const l = rand(2.6, 5.2);
      this.life[i] = l; this.maxLife[i] = l;
      this.sleep[i] = 0;
      this._c.set(opts.color !== undefined ? opts.color : 0x6b6558);
      this._c.offsetHSL(rand(-0.03, 0.03), rand(-0.1, 0.1), rand(-0.18, 0.12));
      this.mesh.instanceColor.setXYZ(i, this._c.r, this._c.g, this._c.b);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const { p, v, rot, rv, scale, life, maxLife } = this;
    for (let i = this.count - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) { this._kill(i); continue; }
      const i3 = i * 3;
      v[i3 + 1] -= 34 * dt;
      p[i3] += v[i3] * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += v[i3 + 2] * dt;
      if (p[i3 + 1] < 0.25) {
        p[i3 + 1] = 0.25;
        if (Math.abs(v[i3 + 1]) > 3.2) {
          v[i3 + 1] *= -0.34;
          v[i3] *= 0.62; v[i3 + 2] *= 0.62;
          rv[i3] *= 0.6; rv[i3 + 1] *= 0.6; rv[i3 + 2] *= 0.6;
        } else {
          v[i3 + 1] = 0;
          v[i3] *= 0.86; v[i3 + 2] *= 0.86;
          rv[i3] *= 0.9; rv[i3 + 1] *= 0.9; rv[i3 + 2] *= 0.9;
        }
      }
      rot[i3] += rv[i3] * dt; rot[i3 + 1] += rv[i3 + 1] * dt; rot[i3 + 2] += rv[i3 + 2] * dt;

      const t = life[i] / maxLife[i];
      const s = scale[i] * (t < 0.25 ? t / 0.25 : 1);
      this._e.set(rot[i3], rot[i3 + 1], rot[i3 + 2]);
      this._q.setFromEuler(this._e);
      this._s.set(s, s, s);
      this._m.compose(tmp.v1.set(p[i3], p[i3 + 1], p[i3 + 2]), this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _kill(i) {
    const last = --this.count;
    if (i !== last) {
      const i3 = i * 3, l3 = last * 3;
      for (let k = 0; k < 3; k++) {
        this.p[i3 + k] = this.p[l3 + k]; this.v[i3 + k] = this.v[l3 + k];
        this.rot[i3 + k] = this.rot[l3 + k]; this.rv[i3 + k] = this.rv[l3 + k];
      }
      this.scale[i] = this.scale[last]; this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
      const c = this.mesh.instanceColor;
      c.setXYZ(i, c.getX(last), c.getY(last), c.getZ(last));
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  clear() { this.count = 0; this.mesh.count = 0; }
}

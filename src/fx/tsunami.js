/**
 * Seaquake tsunamis — travelling walls of water with a curling crest.
 * Damages (and knocks back) every enemy the crest passes over, once.
 */
import * as THREE from 'three';
import { rand, TAU } from '../core/utils.js';
import { Settings } from '../core/settings.js';

const VERT = /* glsl */`
uniform float uTime, uCurl, uH;
varying vec2 vUv;
varying float vCrest;
void main(){
  vUv = uv;
  vec3 p = position;
  float h = uv.y;                       // 0 = base, 1 = crest
  vCrest = h;
  p.y *= uH;
  p.z += pow(h, 2.1) * uCurl;           // forward curl
  p.z += sin(uv.x * 16.0 + uTime * 3.4) * 0.35 * h;
  p.z += sin(uv.x * 31.0 - uTime * 5.1) * 0.14 * h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uDeep, uFoam;
uniform float uLife, uTime;
varying vec2 vUv;
varying float vCrest;
void main(){
  float h = vCrest;
  float foam = smoothstep(0.62, 1.0, h + sin(vUv.x * 40.0 + uTime * 6.0) * 0.06);
  vec3 col = mix(uDeep, uFoam, foam);
  float a = uLife * (0.30 + h * 0.62);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

export class TsunamiSystem {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.waves = [];
    this.pool = [];
    this.geo = new THREE.PlaneGeometry(1, 1, 48, 14);
  }

  /**
   * @param {object} o
   *  origin:Vector3, dir(Vector3 normalized, XZ), width, height, speed, distance,
   *  color, damage, knockback, onHit(enemy)
   */
  spawn(o) {
    // Pooled: disposing the material after every wave used to drop the last
    // reference to its GL program, so three deleted and recompiled the shader
    // on the next wave -> a visible stutter every single time.
    let w = this.pool.pop();
    if (!w) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uCurl: { value: o.curl !== undefined ? o.curl : 5.5 },
          uH: { value: o.height || 13 }, uLife: { value: 1 },
          uDeep: { value: new THREE.Color(o.color !== undefined ? o.color : 0x1d6fb8) },
          uFoam: { value: new THREE.Color(o.foam !== undefined ? o.foam : 0xdff3ff) },
        },
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.renderOrder = 5;
      this.group.add(mesh);
      w = { mesh, mat, hit: new Set() };
    }
    const mat = w.mat, mesh = w.mesh;
    mat.uniforms.uCurl.value = o.curl !== undefined ? o.curl : 5.5;
    mat.uniforms.uH.value = o.height || 13;
    mat.uniforms.uLife.value = 1;
    mat.uniforms.uDeep.value.set(o.color !== undefined ? o.color : 0x1d6fb8);
    mat.uniforms.uFoam.value.set(o.foam !== undefined ? o.foam : 0xdff3ff);
    mesh.visible = true;
    mesh.scale.set(o.width || 46, 1, 1);
    mesh.rotation.y = Math.atan2(o.dir.x, o.dir.z);
    mesh.position.set(o.origin.x, 0, o.origin.z);

    Object.assign(w, {
      mesh, mat,
      dir: o.dir.clone().setY(0).normalize(),
      pos: o.origin.clone(),
      speed: o.speed || 42,
      traveled: 0,
      distance: o.distance || 150,
      width: o.width || 46,
      height: o.height || 13,
      onHit: o.onHit || null,
      t: 0,
      foamT: 0,
    });
    w.hit.clear();
    this.waves.push(w);
    return w;
  }

  update(dt, world) {
    const pq = Settings.get('particleQuality');
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      w.mat.uniforms.uTime.value += dt;
      const step = w.speed * dt;
      w.traveled += step;
      w.mesh.position.addScaledVector(w.dir, step);
      w.mesh.position.y = 0;
      w.mat.uniforms.uLife.value = w.traveled > w.distance * 0.8
        ? Math.max(0, 1 - (w.traveled - w.distance * 0.8) / (w.distance * 0.2)) : 1;

      // foam spray
      w.foamT += dt;
      if (w.foamT > 0.03 && pq > 0) {
        w.foamT = 0;
        for (let k = 0; k < 2; k++) {
          const off = rand(-w.width * 0.5, w.width * 0.5);
          const px = w.mesh.position.x + w.dir.z * off * -1 + w.dir.x * -2;
          const pz = w.mesh.position.z + w.dir.x * off + w.dir.z * -2;
          this.fx.glow.spawn({
            pos: { x: px, y: rand(1, w.height * 0.9), z: pz },
            vel: { x: rand(-3, 3), y: rand(1, 7), z: rand(-3, 3) },
            color: 0xcbeaff, size: rand(1.6, 4.2), life: rand(0.4, 1.0), gravity: -6, drag: 0.8, alpha: 0.8,
          });
        }
      }

      // damage pass
      if (world && world.enemies) {
        for (const e of world.enemies.slice()) {
          if (!e.alive || w.hit.has(e.id)) continue;
          const dx = e.pos.x - w.pos.x, dz = e.pos.z - w.pos.z;
          const along = dx * w.dir.x + dz * w.dir.z;
          const lateral = Math.abs(dx * w.dir.z - dz * w.dir.x);
          if (along > -3 && along < w.traveled + 3 && lateral < w.width * 0.5 + e.radius) {
            w.hit.add(e.id);
            w.onHit?.(e, w);
          }
        }
      }

      if (w.traveled >= w.distance) {
        w.mesh.visible = false;
        this.pool.push(w);          // reuse the material, keep the shader warm
        this.waves.splice(i, 1);
      }
    }
  }

  clear() {
    for (const w of this.waves) { w.mesh.visible = false; this.pool.push(w); }
    this.waves.length = 0;
  }
}

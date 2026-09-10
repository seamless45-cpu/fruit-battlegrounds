/**
 * Generic projectile system: orbs, meteors, thunder balls, storm clouds and
 * the lightning beast. Handles motion, homing, trails, impacts.
 */
import * as THREE from 'three';
import { rand, TAU, tmp } from '../core/utils.js';
import { Settings } from '../core/settings.js';

function glowTexture() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ProjectileSystem {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.active = [];
    this.pools = {};
    this.glowTex = glowTexture();
    this._v = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }

  /* ------------------------------------------------------------ mesh shops */
  makeMesh(type, color) {
    switch (type) {
      case 'rock': {
        const g = new THREE.Group();
        const m = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 1),
          new THREE.MeshStandardMaterial({ color: 0x3b3230, roughness: 1, metalness: 0, emissive: 0xff4400, emissiveIntensity: 0.55, flatShading: true }),
        );
        g.add(m);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color: 0xff7b1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        halo.scale.setScalar(5);
        g.add(halo);
        g.userData.halo = halo;
        g.userData.core = m;
        return g;
      }
      case 'cloud': {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, roughness: 1, emissive: 0x6ea8ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.95 });
        for (let i = 0; i < 6; i++) {
          const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.55, 1.0), 2), mat);
          s.position.set(rand(-1.1, 1.1), rand(-0.35, 0.45), rand(-0.8, 0.8));
          g.add(s);
        }
        return g;
      }
      case 'ball': {
        const g = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(1, 24, 18),
          new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.35, metalness: 0.2, emissive: 0x2b1a55, emissiveIntensity: 0.8 }),
        );
        g.add(core);
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(1.18, 24, 18),
          new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }),
        );
        g.add(shell);
        g.userData.shell = shell;
        return g;
      }
      case 'beast': {
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.6, 6), mat);
        body.rotation.x = Math.PI / 2;
        g.add(body);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 5), mat);
        head.rotation.x = -Math.PI / 2;
        head.position.z = 1.5;
        g.add(head);
        for (let i = 0; i < 4; i++) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.15), mat);
          leg.position.set(i < 2 ? -0.45 : 0.45, -0.42, i % 2 === 0 ? 0.55 : -0.45);
          leg.rotation.x = 0.5;
          g.add(leg);
        }
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        halo.scale.setScalar(6);
        g.add(halo);
        return g;
      }
      case 'orb':
      default: {
        const g = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 2),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        g.add(core);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        halo.scale.setScalar(4.6);
        g.add(halo);
        g.userData.core = core;
        g.userData.halo = halo;
        return g;
      }
    }
  }

  acquire(type, color) {
    const pool = (this.pools[type] ||= []);
    let m = pool.pop();
    if (!m) m = this.makeMesh(type, color);
    m.visible = true;
    this.group.add(m);
    return m;
  }

  release(p) {
    p.mesh.visible = false;
    this.group.remove(p.mesh);
    (this.pools[p.type] ||= []).push(p.mesh);
  }

  /**
   * @param {object} o
   *  type, pos, dir(Vector3), speed, radius, color, life, gravity, homing(target Entity),
   *  turn, trail:{color,size,rate}, onHit(enemy), onEnd(pos), scale, spin
   */
  spawn(o) {
    const color = o.color !== undefined ? o.color : 0x38bdf8;
    const mesh = this.acquire(o.type || 'orb', color);
    const p = {
      type: o.type || 'orb',
      mesh,
      pos: new THREE.Vector3().copy(o.pos),
      vel: new THREE.Vector3().copy(o.dir).normalize().multiplyScalar(o.speed !== undefined ? o.speed : 40),
      radius: o.radius !== undefined ? o.radius : 1,
      color,
      life: o.life !== undefined ? o.life : 4,
      gravity: o.gravity !== undefined ? o.gravity : 0,
      target: o.target || null,
      turn: o.turn !== undefined ? o.turn : 0,
      trail: o.trail !== undefined ? o.trail : {},
      onHit: o.onHit || null,
      onEnd: o.onEnd || null,
      hitSet: new Set(),
      spin: o.spin !== undefined ? o.spin : 6,
      t: 0,
      scale: o.scale !== undefined ? o.scale : 1,
      pierce: o.pierce || false,
      dead: false,
    };
    mesh.position.copy(p.pos);
    mesh.scale.setScalar(p.radius * p.scale);
    if (o.type === 'rock') {
      mesh.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      if (mesh.userData.halo) mesh.userData.halo.scale.setScalar(3.4);
    }
    this.active.push(p);
    return p;
  }

  end(p) {
    if (p.dead) return;
    p.dead = true;
    p.onEnd?.(p.pos, p);
    this.release(p);
    const i = this.active.indexOf(p);
    if (i >= 0) this.active.splice(i, 1);
  }

  update(dt, world) {
    const pq = Settings.get('particleQuality');
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.t += dt;
      p.life -= dt;

      // homing
      if (p.target && p.target.alive && p.turn > 0) {
        this._v.copy(p.target.pos).add(tmp.v1.set(0, p.target.height * 0.5, 0)).sub(p.pos).normalize();
        const sp = p.vel.length();
        p.vel.normalize().lerp(this._v, Math.min(1, p.turn * dt)).normalize().multiplyScalar(sp);
      }
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // face travel direction
      if (p.type === 'beast' || p.type === 'rock' || p.type === 'ball') {
        const d = tmp.v1.copy(p.vel);
        if (d.lengthSq() > 1e-6) {
          d.normalize();
          p.mesh.rotation.y = Math.atan2(d.x, d.z);
          if (p.type === 'rock') {
            p.mesh.rotateX(dt * p.spin);
            p.mesh.rotateZ(dt * p.spin * 0.6);
          }
        }
      }

      // trail particles
      if (p.trail && Math.random() < dt * (p.trail.rate || 45) * pq) {
        const c = p.trail.color !== undefined ? p.trail.color : p.color;
        this.fx.glow.spawn({
          pos: p.pos,
          vel: { x: rand(-1.5, 1.5), y: rand(-0.6, 1.6), z: rand(-1.5, 1.5) },
          color: c, size: (p.trail.size || 2.4) * rand(0.6, 1.3),
          life: rand(0.22, 0.55), gravity: p.trail.gravity !== undefined ? p.trail.gravity : -1.2, drag: 1.4, grow: -0.4,
        });
        if (p.type === 'rock' && Math.random() < dt * 30 * pq) {
          this.fx.smoke.spawn({
            pos: p.pos, vel: { x: rand(-2, 2), y: rand(0.5, 3), z: rand(-2, 2) },
            color: 0x4b4340, size: rand(3, 6), life: rand(0.6, 1.3), gravity: 1.5, drag: 1.1, grow: 1.6, alpha: 0.42,
          });
        }
      }

      // ground / lifetime
      const groundY = world ? world.groundHeight(p.pos.x, p.pos.z) : 0;
      if (p.pos.y <= groundY + p.radius * 0.35 || p.life <= 0) { this.end(p); continue; }

      // enemy hits
      if (world && world.enemies) {
        for (const e of world.enemies) {
          if (!e.alive || p.hitSet.has(e.id)) continue;
          const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
          const dy = (e.pos.y + e.height * 0.5) - p.pos.y;
          const rr = p.radius + e.radius;
          if (dx * dx + dz * dz + dy * dy * 0.6 < rr * rr) {
            p.hitSet.add(e.id);
            p.onHit?.(e, p);
            if (!p.pierce) { this.end(p); break; }
          }
        }
      }
      if (p.dead) continue;
    }
  }

  clear() {
    for (const p of [...this.active]) { p.dead = true; this.release(p); }
    this.active.length = 0;
  }
}

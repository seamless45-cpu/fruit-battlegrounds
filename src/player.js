// ============================================================
//  Player
// ============================================================
import * as THREE from 'three';
import { PLAYER } from './config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.radius = PLAYER.radius;
    this.speed = PLAYER.speed;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.facing = 0;        // yaw
    this.group = new THREE.Group();

    // body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.4, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x2b3566, roughness: 0.6, metalness: 0.2 }));
    body.position.y = 1.6; body.castShadow = true;
    this.group.add(body);
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xf0c69a, roughness: 0.7 }));
    head.position.y = 3.0; head.castShadow = true;
    this.group.add(head);
    // fruit aura (color set by equipped fruit)
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x9b30ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.aura.position.y = 1.8; this.group.add(this.aura);
    // weapon arm anchor
    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0.9, 1.8, 0.3);
    this.group.add(this.weaponAnchor);
    this.weaponMesh = null;

    scene.add(this.group);
  }

  setFruitColor(hex) { this.aura.material.color.setHex(hex); }
  setWeaponMesh(mesh) {
    if (this.weaponMesh) this.weaponAnchor.remove(this.weaponMesh);
    this.weaponMesh = mesh;
    if (mesh) this.weaponAnchor.add(mesh);
  }

  equipVisual(color) { this.setFruitColor(color); }

  update(dt, moveDir) {
    // move
    const v = moveDir.clone().multiplyScalar(this.speed);
    this.position.addScaledVector(v, dt);
    // keep in arena
    const r = Math.hypot(this.position.x, this.position.z);
    if (r > 140) { this.position.x *= 140 / r; this.position.z *= 140 / r; }
    // face movement / aim
    if (moveDir.lengthSq() > 0.001) this.facing = Math.atan2(moveDir.x, moveDir.z);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;
    // bob
    this.group.position.y = Math.sin(performance.now() * 0.008) * 0.06;
  }

  damage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    return this.hp <= 0;
  }
  heal(dmg) { this.hp = Math.min(this.maxHp, this.hp + dmg); }
}

export default Player;

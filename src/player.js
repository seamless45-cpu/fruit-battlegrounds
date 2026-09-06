// ============================================================
//  Player — remodeled fighter, air jumps, swimming, boats.
// ============================================================
import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { createPlayerModel, createBoatMesh } from './models.js';

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.radius = PLAYER.radius;
    this.speed = PLAYER.speed;
    this.level = 1;
    this.damageBonus = 0;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.vy = 0;
    this.onGround = true;
    this.airJumps = PLAYER.maxAirJumps;
    this._jumpAt = 0;
    this.walk = 0;
    this.mountedBoat = null;
    this.boatMesh = null;

    const rig = createPlayerModel();
    this.group = rig.group;
    this.aura = rig.aura;
    this.auraRings = rig.auraRings;
    this.weaponAnchor = rig.weaponAnchor;
    this.leftArm = rig.leftArm;
    this.rightArm = rig.rightArm;
    this.leftLeg = rig.leftLeg;
    this.rightLeg = rig.rightLeg;
    this.head = rig.head;
    this.weaponMesh = null;
    scene.add(this.group);
  }

  setFruitColor(hex) {
    this.aura.material.color.setHex(hex);
    this.auraRings.forEach((ring) => ring.material.color.setHex(hex));
  }
  setWeaponMesh(mesh) {
    if (this.weaponMesh) this.weaponAnchor.remove(this.weaponMesh);
    this.weaponMesh = mesh;
    if (mesh) this.weaponAnchor.add(mesh);
  }
  equipVisual(color) { this.setFruitColor(color); }

  jump() {
    const now = performance.now();
    if (now - this._jumpAt < PLAYER.jumpCooldownMs) return false;
    if (this.mountedBoat) { this.dismountBoat(); return true; }
    if (this.onGround) {
      this.vy = PLAYER.jumpStrength;
      this.onGround = false;
      this.airJumps = PLAYER.maxAirJumps - 1;
      this._jumpAt = now;
      return true;
    }
    if (this.airJumps > 0) {
      this.vy = PLAYER.airJumpStrength;
      this.airJumps -= 1;
      this._jumpAt = now;
      return true;
    }
    return false;
  }

  mountBoat(def) {
    this.dismountBoat();
    this.mountedBoat = def;
    this.boatMesh = createBoatMesh(def);
    this.scene.add(this.boatMesh);
    this.onGround = true;
    this.vy = 0;
    this.position.y = 0.35;
    this.airJumps = PLAYER.maxAirJumps;
  }
  dismountBoat() {
    if (this.boatMesh) { this.scene.remove(this.boatMesh); this.boatMesh = null; }
    this.mountedBoat = null;
  }

  update(dt, moveDir) {
    const land = this.world ? this.world.isOnLand(this.position.x, this.position.z) : true;
    const spd = this.mountedBoat ? this.mountedBoat.speed : land ? this.speed : PLAYER.swimSpeed;
    const v = moveDir.clone().multiplyScalar(spd);
    this.position.addScaledVector(v, dt);

    const maxR = this.mountedBoat ? WORLD.oceanRadius : WORLD.oceanRadius * 0.72;
    const r = Math.hypot(this.position.x, this.position.z);
    if (r > maxR) { this.position.x *= maxR / r; this.position.z *= maxR / r; }

    if (!this.mountedBoat) {
      this.vy -= PLAYER.gravity * dt;
      this.position.y += this.vy * dt;
      const floor = land ? 0 : -0.22;
      if (this.position.y <= floor) {
        this.position.y = floor;
        this.vy = 0;
        if (!this.onGround) this.airJumps = PLAYER.maxAirJumps;
        this.onGround = true;
      } else {
        this.onGround = false;
      }
    } else {
      this.position.y = 0.35;
      this.onGround = true;
      this.airJumps = PLAYER.maxAirJumps;
    }

    if (moveDir.lengthSq() > 0.001) this.facing = Math.atan2(moveDir.x, moveDir.z);
    const bob = this.onGround && !this.mountedBoat ? Math.sin(performance.now() * 0.008) * 0.05 : 0;
    this.group.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.group.rotation.y = this.facing;

    const moving = moveDir.lengthSq() > 0.002 && this.onGround;
    this.walk += dt * (moving ? 11 : 0);
    const swing = moving ? Math.sin(this.walk) * 0.65 : 0;
    if (this.leftLeg) {
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.55;
      this.rightArm.rotation.x = swing * 0.55;
    }
    if (!this.onGround && this.leftLeg) {
      this.leftLeg.rotation.x = 0.35;
      this.rightLeg.rotation.x = 0.15;
    }

    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
    this.aura.scale.set(3.6 * pulse, 4.2 * pulse, 3.6 * pulse);
    this.auraRings.forEach((ring, i) => { ring.rotation.z += dt * (i ? -1.3 : 1.1); });

    if (this.boatMesh) {
      this.boatMesh.position.set(this.position.x, 0.05, this.position.z);
      this.boatMesh.rotation.y = this.facing;
    }
  }

  damage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    return this.hp <= 0;
  }
  heal(dmg) { this.hp = Math.min(this.maxHp, this.hp + dmg); }
}

export default Player;

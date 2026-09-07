// ============================================================
//  Player — remodeled fighter, air jumps, swimming, boats.
// ============================================================
import * as THREE from 'three';
import { PLAYER, WORLD, RACES } from './config.js';
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
    this.lunge = new THREE.Vector3();
    this.anim = { attack: 0, skill: 0, hurt: 0, jump: 0, combo: 0 };
    this._wasGround = true;
    this.raceId = 'human';
    this.race = RACES.human;
    this.faction = null;
    this.speedMod = 1;
    this.scaleMul = 1;
    this.growUntil = 0;

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
    this.hips = rig.hips || null;
    this.torso = rig.torso || null;
    this.coatMat = rig.coatMat || null;
    this.weaponMesh = null;
    scene.add(this.group);
  }

  playAttack() { this.anim.attack = 0.32; this.anim.combo = (this.anim.combo + 1) % 4; }
  playSkill() { this.anim.skill = 0.48; }
  playHurt() { this.anim.hurt = 0.24; }
  playJump() { this.anim.jump = 0.28; }

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

  setRace(id) {
    const def = RACES[id] || RACES.human;
    this.raceId = def.id;
    this.race = def;
  }

  setFaction(id) {
    this.faction = id === 'marine' ? 'marine' : 'pirate';
    if (this.coatMat) this.coatMat.color.setHex(this.faction === 'marine' ? 0x24356a : 0x6a1a22);
  }

  setGrow(seconds) {
    this.growUntil = performance.now() / 1000 + seconds;
  }

  jump() {
    const now = performance.now();
    if (now - this._jumpAt < PLAYER.jumpCooldownMs) return false;
    if (this.mountedBoat) { this.dismountBoat(); return true; }
    const j = this.race ? this.race.jump : 1;
    if (this.onGround) {
      this.vy = PLAYER.jumpStrength * j;
      this.onGround = false;
      this.airJumps = PLAYER.maxAirJumps - 1;
      this._jumpAt = now;
      this.playJump();
      if (this.sfxJump) this.sfxJump();
      return true;
    }
    if (this.airJumps > 0) {
      this.vy = PLAYER.airJumpStrength * j;
      this.airJumps -= 1;
      this._jumpAt = now;
      this.playJump();
      if (this.sfxJump) this.sfxJump();
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
    const race = this.race || RACES.human;
    const spd = this.mountedBoat
      ? this.mountedBoat.speed
      : land ? this.speed * race.speed : PLAYER.swimSpeed * race.swim;
    const v = moveDir.clone().multiplyScalar(spd);
    this.position.addScaledVector(v, dt);
    if (this.lunge.lengthSq() > 0.01) {
      this.position.addScaledVector(this.lunge, dt);
      this.lunge.multiplyScalar(Math.max(0, 1 - dt * 9));
      if (this.lunge.lengthSq() < 0.2) this.lunge.set(0, 0, 0);
    }

    const maxR = this.mountedBoat ? WORLD.oceanRadius : WORLD.oceanRadius * 0.72;
    const r = Math.hypot(this.position.x, this.position.z);
    if (r > maxR) { this.position.x *= maxR / r; this.position.z *= maxR / r; }

    if (!this.mountedBoat) {
      this.vy -= PLAYER.gravity * (race.fall || 1) * dt;
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
    this.walk += dt * (moving ? 13 : 0);
    const swing = moving ? Math.sin(this.walk) * 0.85 : 0;
    const a = this.anim;
    a.attack = Math.max(0, a.attack - dt);
    a.skill = Math.max(0, a.skill - dt);
    a.hurt = Math.max(0, a.hurt - dt);
    a.jump = Math.max(0, a.jump - dt);
    const atk = a.attack > 0 ? Math.sin((1 - a.attack / 0.32) * Math.PI) : 0;
    const sk = a.skill > 0 ? Math.sin((1 - a.skill / 0.48) * Math.PI) : 0;
    const ht = a.hurt > 0 ? Math.sin((1 - a.hurt / 0.24) * Math.PI) : 0;
    if (this.leftLeg) {
      if (!this.onGround) {
        this.leftLeg.rotation.x = 0.55 + a.jump * 0.8;
        this.rightLeg.rotation.x = 0.2;
        this.leftArm.rotation.x = -0.7;
        this.rightArm.rotation.x = 0.5;
        this.leftArm.rotation.z = 0.35;
        this.rightArm.rotation.z = -0.35;
      } else {
        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;
        this.leftArm.rotation.x = -swing * 0.7 - atk * 0.5 - sk * 0.9;
        this.rightArm.rotation.x = swing * 0.7 + atk * (a.combo % 2 ? 1.6 : -0.4) + sk * 0.4;
        this.leftArm.rotation.z = 0.08 + sk * 0.5;
        this.rightArm.rotation.z = -0.08 - atk * 0.4;
      }
    }
    if (this.head) this.head.rotation.x = -ht * 0.35 + (moving ? Math.sin(this.walk) * 0.05 : 0);
    if (this.hips) this.hips.rotation.y = swing * 0.12 + atk * 0.25;
    if (this._wasGround !== this.onGround && this.onGround && this.sfxLand) this.sfxLand();
    this._wasGround = this.onGround;

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
    this.playHurt();
    return this.hp <= 0;
  }
  heal(dmg) { this.hp = Math.min(this.maxHp, this.hp + dmg); }
}

export default Player;

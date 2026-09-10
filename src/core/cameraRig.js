/**
 * Third-person follow rig + CAMERA SHAKE.
 *
 * ── Camera Shake Effect Requirements (implemented here) ──────────────────────
 *  • Shake is applied using high-frequency random POSITIONAL offsets on X, Y, Z.
 *  • NO rotational shake is ever applied — no pitch, no yaw, no roll. Rotation is
 *    fully determined by lookAt() and is never touched afterwards.
 *    (Rotational shake feels disorienting, hurts aiming/target tracking, reduces
 *     clarity and creates excessive screen motion, so it is intentionally off.)
 *  • The rig therefore affects POSITION ONLY while rotation remains unchanged.
 * ────────────────────────────────────────────────────────────────────────────
 */
import * as THREE from 'three';
import { clamp, damp, valueNoise, tmp } from './utils.js';
import { Settings } from './settings.js';

export class CameraRig {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.yaw = 0;
    this.pitch = 0.28;
    this.distance = Settings.get('cameraDistance');
    this.targetDistance = this.distance;
    this.target = new THREE.Vector3(0, 2, 0);
    this.smoothTarget = new THREE.Vector3(0, 2, 0);

    // shake state
    this.shakes = [];        // {amp, t, dur, decay}
    this.shakeTime = 0;
    this.offset = new THREE.Vector3();
    this.enabled = true;

    // seeds so each axis shakes independently at high frequency
    this.seed = { x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 1000 };

    // ── FIXED: rotation is locked to lookAt output; only position is shaken ──
    this.rotationLocked = true;

    Settings.onChange((k) => {
      if (k === 'cameraDistance' || k === '*') this.targetDistance = Settings.get('cameraDistance');
    });
    window.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.targetDistance = clamp(this.targetDistance + Math.sign(e.deltaY) * 0.9, 5, 30);
    }, { passive: true });
  }

  /**
   * Add a positional shake event.
   * @param {number} amp     peak amplitude in metres
   * @param {number} dur     duration in seconds
   * @param {number} decay   1 = linear-ish, 2 = snappy
   */
  addShake(amp, dur = 0.45, decay = 2) {
    const mul = Settings.get('screenShake');
    if (mul <= 0 || amp <= 0) return;
    // keep the list bounded so huge storms can't stall the frame
    if (this.shakes.length > 48) this.shakes.shift();
    this.shakes.push({ amp: amp * mul, t: 0, dur: Math.max(0.05, dur), decay });
  }

  /** shake from a world position with distance falloff */
  addShakeAt(pos, amp, radius = 60, dur = 0.5) {
    const d = tmp.v1.copy(pos).distanceTo(this.camera.position);
    const f = clamp(1 - d / radius, 0, 1);
    if (f > 0.01) this.addShake(amp * f * f, dur);
  }

  get shakeAmplitude() {
    let a = 0;
    for (const s of this.shakes) a += s.amp * Math.pow(1 - clamp(s.t / s.dur, 0, 1), s.decay);
    return a;
  }

  update(dt, focus, world) {
    // ---- orbit control ----
    if (this.enabled && (this.input.locked || this.input.stick.active || this.input._lookId !== null)) {
      this.yaw -= this.input.mouse.dx;
      this.pitch += this.input.mouse.dy;
      this.pitch = clamp(this.pitch, -0.55, 1.15);
    }

    this.distance = damp(this.distance, this.targetDistance, 8, dt);

    // ---- target follow (smooth) ----
    this.target.set(focus.x, focus.y + 1.55, focus.z);
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 14, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 9, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, 14, dt);

    // desired orbit position (BEFORE shake)
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const px = this.smoothTarget.x + Math.sin(this.yaw) * cp * this.distance;
    const pz = this.smoothTarget.z + Math.cos(this.yaw) * cp * this.distance;
    const py = this.smoothTarget.y + sp * this.distance + 1.2;

    this.camera.position.set(px, Math.max(py, 1.6), pz);

    // ---- ROTATION: computed once, from the un-shaken position ----
    this.camera.lookAt(this.smoothTarget);
    // (never call lookAt/rotate after this point)

    // ---- POSITION-ONLY SHAKE (high frequency random offsets on X/Y/Z) ----
    this.shakeTime += dt;
    this.offset.set(0, 0, 0);
    if (this.shakes.length) {
      const t = this.shakeTime;
      // ~34 Hz base with a faster ~71 Hz layer = high frequency jitter
      for (let i = this.shakes.length - 1; i >= 0; i--) {
        const s = this.shakes[i];
        s.t += dt;
        if (s.t >= s.dur) { this.shakes.splice(i, 1); continue; }
        const k = Math.pow(1 - s.t / s.dur, s.decay);
        const a = s.amp * k;
        const f1 = t * 34, f2 = t * 71;
        this.offset.x += (valueNoise(f1 + this.seed.x) * 0.7 + valueNoise(f2 + this.seed.x * 1.7) * 0.3) * a;
        this.offset.y += (valueNoise(f1 + this.seed.y) * 0.7 + valueNoise(f2 + this.seed.y * 1.9) * 0.3) * a * 0.85;
        this.offset.z += (valueNoise(f1 + this.seed.z) * 0.7 + valueNoise(f2 + this.seed.z * 2.3) * 0.3) * a;
      }
      // hard clamp so stacked effects never rip the camera away
      const maxOff = 6;
      this.offset.clampLength(0, maxOff);
      this.camera.position.add(this.offset);
    }

    if (world && world.clampCameraToArena) world.clampCameraToArena(this.camera.position, this.smoothTarget);
  }

  /** Aim ray through the screen centre (or the free cursor when unlocked). */
  aimRay(raycaster, out = new THREE.Vector3()) {
    const origin = raycaster.ray.origin, dir = raycaster.ray.direction;
    // intersect ground plane y = 0
    if (Math.abs(dir.y) < 1e-5) return out.set(origin.x + dir.x * 100, 0, origin.z + dir.z * 100);
    const t = -origin.y / dir.y;
    if (t < 0) return out.set(origin.x + dir.x * 100, 0, origin.z + dir.z * 100);
    return out.copy(origin).addScaledVector(dir, t);
  }
}

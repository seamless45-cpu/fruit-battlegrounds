// ============================================================
//  Input: WASD, aim, skills, joystick, jump, sail.
// ============================================================
import * as THREE from 'three';
import { SKILL_KEYS } from './config.js';
import { HOLD_SKILLS } from './skills.js';

export class Input {
  constructor(game, canvas, camera) {
    this.game = game;
    this.canvas = canvas;
    this.camera = camera;
    this.keys = new Set();
    this.ndc = new THREE.Vector2(0, 0);
    this.held = {};
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._aim = new THREE.Vector3();
    this.isMobile = game.isMobile;
    this.joy = { x: 0, z: 0 };
    this.joyActive = false;

    this._bind();
    this._bindJoystick();
  }

  _bind() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.game.cancelHeldSkills();
      this.held = {};
    });

    if (!this.isMobile) {
      window.addEventListener('mousemove', (e) => this._setNDC(e.clientX, e.clientY));
      this.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this._setNDC(e.clientX, e.clientY); this.game.requestCastM1(); }
      });
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    } else {
      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0]; this._setNDC(t.clientX, t.clientY); this.game.requestCastM1();
      }, { passive: true });
      this.canvas.addEventListener('touchmove', (e) => {
        const t = e.touches[0]; this._setNDC(t.clientX, t.clientY);
      }, { passive: true });
    }
  }

  _bindJoystick() {
    const el = document.getElementById('joystick');
    const knob = document.getElementById('joyKnob');
    if (!el || !knob) return;
    const max = 46;
    const setFrom = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = clientX - cx, dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joy.x = dx / max;
      this.joy.z = dy / max;
    };
    const reset = () => {
      this.joyActive = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.joy.x = 0; this.joy.z = 0;
    };
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      this.joyActive = true;
      const p = e.touches ? e.touches[0] : e;
      setFrom(p.clientX, p.clientY);
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const move = (e) => {
      if (!this.joyActive) return;
      e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      setFrom(p.clientX, p.clientY);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', reset);
    el.addEventListener('pointercancel', reset);

    const jump = document.getElementById('jumpBtn');
    if (jump) {
      jump.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.game.player.jump(); });
    }
    const sail = document.getElementById('sailBtn');
    if (sail) {
      sail.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.game.toggleSail(); });
    }
  }

  _setNDC(x, y) {
    this.ndc.x = (x / window.innerWidth) * 2 - 1;
    this.ndc.y = -(y / window.innerHeight) * 2 + 1;
  }

  onKeyDown(e) {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (e.code === 'Space') { e.preventDefault(); this.game.player.jump(); return; }
    if (k === 'tab') { e.preventDefault(); this.game.toggleWeapon(); return; }
    if (k === 'e') { this.game.collectFruit(); return; }
    if (k === 'q') { this.game.toggleSail(); return; }
    if (k === 'escape') {
      document.getElementById('settingsPanel').classList.add('hidden');
      document.getElementById('helpPanel').classList.add('hidden');
    }

    const idx = SKILL_KEYS.indexOf(k);
    if (idx >= 0) {
      const id = this.game.skillIdForIndex(idx);
      if (!id) return;
      if (HOLD_SKILLS.has(id)) {
        if (!this.held[id]) { this.held[id] = true; this.game.held[id] = true; this.game.chargeT = 0; this.game.heldStart = performance.now(); }
      } else {
        this.game.requestCast(id);
      }
    }
  }

  onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    const idx = SKILL_KEYS.indexOf(k);
    if (idx >= 0) {
      const id = this.game.skillIdForIndex(idx);
      if (id && HOLD_SKILLS.has(id)) {
        this.held[id] = false; this.game.held[id] = false;
        this.game.releaseHeld(id);
      }
    }
  }

  moveVector() {
    let x = this.joy.x, z = this.joy.z;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const v = new THREE.Vector3(x, 0, z);
    if (v.lengthSq() > 1) v.normalize();
    else if (v.lengthSq() > 0) { /* analog stick keeps magnitude */ }
    return v;
  }

  aimPoint(out = this._aim) {
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, out);
    if (!hit) out.set(0, 0, 0);
    return out;
  }
}

export default Input;

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
    this.camYaw = 0;
    this.camPitch = 0.52;
    this.dragging = false;
    this.dragDist = 0;
    this._ptr = null;

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

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) return;
      this._setNDC(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this._ptr = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.dragging = false;
      this.dragDist = 0;
      this._setNDC(e.clientX, e.clientY);
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this._ptr || e.pointerId !== this._ptr.id) return;
      const dx = e.clientX - this._ptr.x;
      const dy = e.clientY - this._ptr.y;
      this.dragDist += Math.hypot(dx, dy);
      this._ptr.x = e.clientX; this._ptr.y = e.clientY;
      if (this.dragDist > 8) this.dragging = true;
      if (this.dragging) {
        const gfx = this.game.world.gfx;
        const sens = (gfx.lookSens || 1) * 0.0048;
        const ix = gfx.invertLookX ? -1 : 1;
        const iy = gfx.invertLookY ? -1 : 1;
        this.camYaw += dx * sens * ix;
        this.camPitch = Math.max(0.16, Math.min(1.18, this.camPitch + dy * sens * 0.82 * iy));
      }
      this._setNDC(e.clientX, e.clientY);
    });
    const endPtr = (e) => {
      if (!this._ptr || (e.pointerId != null && e.pointerId !== this._ptr.id)) return;
      const wasDrag = this.dragging;
      this._ptr = null;
      this.dragging = false;
      if (!wasDrag && this.game.playing) this.game.requestCastM1();
    };
    this.canvas.addEventListener('pointerup', endPtr);
    this.canvas.addEventListener('pointercancel', () => { this._ptr = null; this.dragging = false; });
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
    if (!this.game.playing && k !== 'escape') return;
    this.keys.add(k);
    if (e.code === 'Space') { e.preventDefault(); this.game.player.jump(); return; }
    if (k === 'tab') { e.preventDefault(); this.game.toggleWeapon(); return; }
    if (k === 'e') { this.game.interact(); return; }
    if (k === 'q') { this.game.toggleSail(); return; }
    if (k === 'escape') {
      ['settingsPanel', 'helpPanel', 'codesPanel', 'questPanel', 'dealerPanel', 'statsPanel', 'boatPanel', 'gachaPanel']
        .forEach((id) => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
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
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 0.0001) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const v = new THREE.Vector3().addScaledVector(fwd, -z).addScaledVector(right, x);
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  aimPoint(out = this._aim) {
    const gfx = this.game.world.gfx;
    const mix = gfx.freeAim == null ? 0.32 : gfx.freeAim;
    this._ndcAim = this._ndcAim || new THREE.Vector2();
    this._ndcAim.set(this.ndc.x * mix, this.ndc.y * mix);
    this.ray.setFromCamera(this._ndcAim, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, out);
    if (!hit) {
      const p = this.game.player.position;
      out.set(p.x, 0, p.z);
    }
    if (gfx.softLock !== false && this.game.enemies) {
      const list = this.game.enemies.alive();
      let best = null, bestScore = 12;
      const camFwd = new THREE.Vector3();
      this.camera.getWorldDirection(camFwd); camFwd.y = 0;
      if (camFwd.lengthSq() > 0.0001) camFwd.normalize();
      for (const e of list) {
        if (e.dying) continue;
        const to = e.position.clone().sub(this.game.player.position); to.y = 0;
        const d = to.length();
        if (d > 28 || d < 0.4) continue;
        to.normalize();
        const dot = to.dot(camFwd);
        if (dot < 0.38) continue;
        const aimDist = Math.hypot(e.position.x - out.x, e.position.z - out.z);
        const score = d * (1.5 - dot) + aimDist * 0.35;
        if (aimDist < 10 && score < bestScore) { bestScore = score; best = e; }
      }
      if (best) out.set(best.position.x, 0, best.position.z);
    }
    return out;
  }
}

export default Input;

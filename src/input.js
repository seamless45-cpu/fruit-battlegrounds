// ============================================================
//  Input: movement, aim (mouse/touch raycast), skill keys,
//  M1 attack, hold-to-charge skills, weapon toggle.
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
    this.held = {};            // skillId -> bool
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._aim = new THREE.Vector3();
    this.isMobile = game.isMobile;

    this._bind();
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
      // touch aim + attack handled via dedicated button + bar buttons
      this.canvas.addEventListener('touchstart', (e) => {
        const t = e.touches[0]; this._setNDC(t.clientX, t.clientY);
      }, { passive: true });
      this.canvas.addEventListener('touchmove', (e) => {
        const t = e.touches[0]; this._setNDC(t.clientX, t.clientY);
      }, { passive: true });
      this._addMobileAttackBtn();
    }
  }

  _addMobileAttackBtn() {
    const b = document.createElement('button');
    b.id = 'mobileAtk';
    b.textContent = '⚔ ATK';
    b.style.cssText = 'position:fixed;right:18px;bottom:120px;z-index:55;width:74px;height:74px;border-radius:50%;background:rgba(120,40,200,.85);color:#fff;border:2px solid #d8b6ff;font-size:13px;font-weight:700;';
    b.addEventListener('touchstart', (e) => { e.preventDefault(); this.game.requestCastM1(); }, { passive: false });
    document.getElementById('app').appendChild(b);
  }

  _setNDC(x, y) {
    this.ndc.x = (x / window.innerWidth) * 2 - 1;
    this.ndc.y = -(y / window.innerHeight) * 2 + 1;
  }

  onKeyDown(e) {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === 'tab') { e.preventDefault(); this.game.toggleWeapon(); return; }
    if (k === 'e') { this.game.collectFruit(); return; }
    if (k === 'c' && e.ctrlKey === false) { /* reserved */ }
    if (k === 'escape') { document.getElementById('settingsPanel').classList.add('hidden'); }

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
    let x = 0, z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const v = new THREE.Vector3(x, 0, z);
    if (v.lengthSq() > 0) v.normalize();
    return v;
  }

  // aim point on ground (computed from current camera + pointer)
  aimPoint(out = this._aim) {
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, out);
    if (!hit) out.set(0, 0, 0);
    return out;
  }
}

export default Input;

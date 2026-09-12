/**
 * Keyboard / mouse / touch input with pointer-lock camera control.
 * Also exposes a virtual stick + look-drag for touch devices.
 */
import * as THREE from 'three';
import { Settings } from './settings.js';
import { clamp } from './utils.js';

export const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();      // consumed once per frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, wheel: 0 };
    this.ndc = new THREE.Vector2(0, 0);     // pointer position when unlocked
    this.locked = false;
    this.lockBlocked = false;   // pointer lock refused (cross-origin iframe, …)
    this.stick = { x: 0, y: 0, active: false };
    this.enabled = true;

    this._touches = new Map();
    this._stickId = null;
    this._lookId = null;
    this._lastTouch = { x: 0, y: 0 };

    this.onPointerLockChange = null;
    this.onPress = null;   // (code) => void  — fires on any fresh key press

    window.addEventListener('keydown', (e) => this._keyDown(e));
    window.addEventListener('keyup', (e) => this._keyUp(e));
    // A blur used to drop held keys silently, so a hold-to-charge skill would
    // never see its keyup and the player stayed "charging" forever. Release
    // everything on the way out instead.
    window.addEventListener('blur', () => {
      for (const code of this.keys) this.released.add(code);
      this.keys.clear();
      if (this.mouse.left) this.released.add('Mouse0');
      if (this.mouse.right) this.released.add('Mouse2');
      this.mouse.left = this.mouse.right = false;
      this.stick.active = false; this.stick.x = this.stick.y = 0;
      this._stickId = null; this._lookId = null;
    });

    canvas.addEventListener('mousedown', (e) => {
      window.focus();          // pull keyboard focus into the game (iframes!)
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
      this.pressed.add('Mouse' + e.button);
      this.onPress?.('Mouse' + e.button);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
      this.released.add('Mouse' + e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        const s = 0.0022 * Settings.get('mouseSensitivity');
        this.mouse.dx += e.movementX * s;
        this.mouse.dy += e.movementY * s * (Settings.get('invertY') ? -1 : 1);
      } else {
        this.ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      }
    });

    window.addEventListener('wheel', (e) => {
      this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onPointerLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      if (document.pointerLockElement === this.canvas) return;   // already locked
      this.lockBlocked = true;
      this.locked = false;
      this.onPointerLockChange?.(false);
    });

    // ---------- touch ----------
    canvas.addEventListener('touchstart', (e) => this._touchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._touchMove(e), { passive: false });
    const endTouch = (e) => this._touchEnd(e);
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  _keyDown(e) {
    if (e.repeat) return;
    // don't swallow typing in inputs
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyO', 'KeyH'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    this.pressed.add(e.code);
    this.onPress?.(e.code);
  }
  _keyUp(e) { this.keys.delete(e.code); this.released.add(e.code); }

  _touchStart(e) {
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.45 && this._stickId === null) {
        this._stickId = t.identifier;
        this.stick.active = true;
        this._lastTouch.x = t.clientX; this._lastTouch.y = t.clientY;
      } else if (this._lookId === null) {
        this._lookId = t.identifier;
        this._lastTouch.x = t.clientX; this._lastTouch.y = t.clientY;
      }
    }
    e.preventDefault();
  }
  _touchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this._stickId) {
        const dx = t.clientX - this._lastTouch.x, dy = t.clientY - this._lastTouch.y;
        const len = 70;
        this.stick.x = clamp(dx / len, -1, 1);
        this.stick.y = clamp(dy / len, -1, 1);
      } else if (t.identifier === this._lookId) {
        const s = 0.0055 * Settings.get('mouseSensitivity');
        this.mouse.dx += (t.clientX - this._lastTouch.x) * s;
        this.mouse.dy += (t.clientY - this._lastTouch.y) * s * (Settings.get('invertY') ? -1 : 1);
        this._lastTouch.x = t.clientX; this._lastTouch.y = t.clientY;
      }
    }
    e.preventDefault();
  }
  _touchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this._stickId) { this._stickId = null; this.stick.active = false; this.stick.x = this.stick.y = 0; }
      if (t.identifier === this._lookId) this._lookId = null;
    }
  }

  requestLock() {
    if (IS_TOUCH || this.lockBlocked) return;
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { this.lockBlocked = true; this.onPointerLockChange?.(false); });
      } catch {
        this.lockBlocked = true;               // old browsers throw synchronously
        this.onPointerLockChange?.(false);
      }
    } else {
      this.lockBlocked = true;
      this.onPointerLockChange?.(false);
    }
  }
  releaseLock() { if (this.locked && document.exitPointerLock) document.exitPointerLock(); }

  isDown(code) { return this.enabled && this.keys.has(code); }
  justPressed(code) { return this.enabled && this.pressed.has(code); }
  justReleased(code) { return this.released.has(code); }
  /** clear per-frame state */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
  }

  /** movement in local space: x = strafe, y = forward */
  moveAxis(out = { x: 0, y: 0 }) {
    out.x = 0; out.y = 0;
    if (!this.enabled) return out;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) out.y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) out.y -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) out.x += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) out.x -= 1;
    if (this.stick.active) { out.x += this.stick.x; out.y -= this.stick.y; }
    const len = Math.hypot(out.x, out.y);
    if (len > 1) { out.x /= len; out.y /= len; }
    return out;
  }
}

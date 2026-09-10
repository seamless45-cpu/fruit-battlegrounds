/**
 * Fruit Battlegrounds — bootstrap + game loop.
 */
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input, IS_TOUCH } from './core/input.js';
import { CameraRig } from './core/cameraRig.js';
import { World } from './core/world.js';
import { FX } from './fx/index.js';
import { UI } from './ui/index.js';
import { AudioManager } from './core/audio.js';
import { Settings } from './core/settings.js';
import { FRUIT_KEYS, WEAPON_KEYS, FRUITS, WEAPONS } from './data/loadout.js';
import { tmp } from './core/utils.js';

const canvas = document.getElementById('scene');
const engine = new Engine(canvas);

const input = new Input(canvas);
const rig = new CameraRig(engine.camera, input);
const fx = new FX(engine.scene, engine.camera, rig);
const world = new World(engine.scene, engine.camera, rig);
const audio = new AudioManager();
const ui = new UI(world);

world.fx = fx;
world.input = input;
world.ui = ui;
world.audio = audio;
world.engine = engine;
fx.setWorld(world);
ui.world = world;

Object.defineProperty(world, 'fruitDef', { get() { return world.player.fruit ? FRUITS[world.player.fruit] : null; } });
Object.defineProperty(world, 'weaponDef', { get() { return world.player.weapon ? WEAPONS[world.player.weapon] : null; } });

document.body.classList.toggle('touch', IS_TOUCH);

// initial equipment + UI
world.player.setWeapon('gravityblade');
world.player.setFruit('gravity');
ui.skillbar.rebuild();
ui.inventory.build();

/* ------------------------------------------------------------------ aim */
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const centre = new THREE.Vector2(0, 0);

const aimScratch = new THREE.Vector3();
function updateAim() {
  const ndc = input.locked ? centre : input.ndc;
  raycaster.setFromCamera(ndc, engine.camera);
  // prefer an enemy under the crosshair
  const v = tmp.v1;
  let bestD = Infinity, found = false;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    v.set(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z).sub(raycaster.ray.origin);
    const along = v.dot(raycaster.ray.direction);
    if (along <= 0 || along >= bestD) continue;
    const perp = Math.sqrt(Math.max(0, v.lengthSq() - along * along));
    if (perp < e.radius + 1.6) {
      bestD = along; found = true;
      aimScratch.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, along);
    }
  }
  if (found) { world.aimPoint.copy(aimScratch); return; }
  const hit = raycaster.ray.intersectPlane(groundPlane, tmp.v2);
  if (hit) {
    const r = Math.hypot(hit.x, hit.z);
    const maxR = world.arenaRadius - 1;
    if (r > maxR) { hit.x *= maxR / r; hit.z *= maxR / r; }
    world.aimPoint.copy(hit);
  }
}

/* -------------------------------------------------- touch attack button */
let touchAttackHeld = false;
function makeTouchAttack() {
  const btn = document.createElement('button');
  btn.className = 'touch-attack';
  btn.innerHTML = '⚔<span>ATTACK</span>';
  const hold = (v) => (e) => { e.preventDefault(); e.stopPropagation(); touchAttackHeld = v; };
  btn.addEventListener('pointerdown', hold(true));
  btn.addEventListener('pointerup', hold(false));
  btn.addEventListener('pointerleave', hold(false));
  btn.addEventListener('pointercancel', hold(false));
  document.getElementById('hud').appendChild(btn);
}
if (IS_TOUCH) makeTouchAttack();

/* ------------------------------------------------------------ aim marker */
const aimMarker = new THREE.Group();
{
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.0, 40),
    new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  dot.rotation.x = -Math.PI / 2;
  aimMarker.add(ring, dot);
  aimMarker.renderOrder = 3;
  engine.scene.add(aimMarker);
}
function updateAimMarker(dt) {
  const f = world.fruitDef;
  const c = f ? f.color : 0xa855f7;
  aimMarker.children[0].material.color.setHex(c);
  aimMarker.position.set(world.aimPoint.x, 0.12, world.aimPoint.z);
  const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
  aimMarker.scale.setScalar(1.5 * pulse);
  aimMarker.visible = started;
}

/* -------------------------------------------------------------- controls */
function handleSkillInput() {
  const p = world.player;
  for (let i = 0; i < FRUIT_KEYS.length; i++) {
    if (input.justPressed(FRUIT_KEYS[i])) p.pressedSkill('fruit', i);
    if (input.justReleased(FRUIT_KEYS[i])) p.releasedSkill('fruit', i);
  }
  for (let i = 0; i < WEAPON_KEYS.length; i++) {
    if (input.justPressed(WEAPON_KEYS[i])) p.pressedSkill('weapon', i);
    if (input.justReleased(WEAPON_KEYS[i])) p.releasedSkill('weapon', i);
  }
  // M1 (left mouse on desktop, ATTACK button on touch)
  if (input.mouse.left || touchAttackHeld) p.m1();
}

input.onPress = (code) => {
  if (code === 'KeyO') ui.settings.open();
  if (code === 'KeyH') ui.toggleHelp();
  if (code === 'Escape') ui.toggleHelp(false);
};

/* ------------------------------------------------------- pointer locking */
const startOverlay = document.getElementById('startOverlay');
const unlockOverlay = document.getElementById('unlockOverlay');
let started = false;

// the arena stays alive behind the title card, but nothing can hurt you yet
world.player.invulnT = 1e9;

function startGame() {
  if (started) return;
  started = true;
  world.player.invulnT = 0;
  startOverlay.classList.add('gone');
  setTimeout(() => { startOverlay.style.display = 'none'; }, 450);
  audio.init();
  input.requestLock();
  ui.toast('Click a slot at the bottom to equip a fruit or sword', 'good', 2600);
}

document.getElementById('btnPlay').addEventListener('click', startGame);
startOverlay.addEventListener('pointerdown', startGame);

canvas.addEventListener('pointerdown', () => {
  if (!started) return;
  if (ui.blocking) return;
  if (!IS_TOUCH) input.requestLock();
});

input.onPointerLockChange = (locked) => {
  unlockOverlay.hidden = locked || IS_TOUCH || !started;
};
unlockOverlay.addEventListener('pointerdown', () => input.requestLock());

document.addEventListener('pointerdown', () => audio.init(), { once: true });

/* ------------------------------------------------------------- game loop */
let fpsAccum = 0;
let lastTime = performance.now();

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let realDt = (now - lastTime) / 1000;
  lastTime = now;
  if (realDt > 0.25) realDt = 0.25;

  // FPS cap
  const cap = Settings.get('fpsCap');
  if (cap > 0) {
    fpsAccum += realDt;
    if (fpsAccum < 1 / cap - 0.0015) return;
    fpsAccum = 0;
  }

  const dt = realDt;

  if (started) handleSkillInput();
  updateAim();
  updateAimMarker(realDt);

  world.update(dt);
  fx.update(dt * world.timeScale);
  rig.update(realDt, world.player.pos, world);
  ui.update(dt, realDt);

  // HUD hurts when the player takes damage
  if (world.player.hp < world.player._lastHp - 0.5) ui.hurtFlash();
  world.player._lastHp = world.player.hp;

  input.endFrame();
  engine.render();
}

document.getElementById('loading').classList.add('gone');
frame();

// expose for debugging
window.FB = { world, fx, engine, ui, input, rig, Settings, THREE };

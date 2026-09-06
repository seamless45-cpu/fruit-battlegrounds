// ============================================================
//  Fruit Battlegrounds 3D — main entry / game loop
// ============================================================
import * as THREE from 'three';
import { World, tryEnableBloom } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemy.js';
import { FX } from './effects.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { castSkill, castM1, tickHeld, releaseHeld, HOLD_SKILLS } from './skills.js';
import { FRUITS, SWORDS, INVENTORY_ITEMS, PLAYER } from './config.js';

const isMobile = window.matchMedia('(pointer: coarse)').matches;

// ---- loader ----
const loaderFill = document.getElementById('loaderFill');
const loaderStatus = document.getElementById('loaderStatus');
const setLoad = (p, msg) => { loaderFill.style.width = p + '%'; if (msg) loaderStatus.textContent = msg; };

setLoad(10, 'Creating renderer…');
const canvas = document.getElementById('game');
const world = new World(canvas);

setLoad(35, 'Building effects…');
const fx = new FX(world.scene);
fx.particles = world.gfx.particles;

setLoad(55, 'Spawning player & enemies…');
const player = new Player(world.scene);
const enemies = new EnemyManager(world.scene, () => player, (d) => onPlayerHit(d), (e) => onKill(e));

// ---- screen flash overlay (for Fatal Destruction red shift) ----
const flash = document.createElement('div');
flash.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;opacity:0;background:#000;';
document.getElementById('app').appendChild(flash);

// ------------------------------------------------------------
//  GAME STATE
// ------------------------------------------------------------
const game = {
  isMobile,
  world, fx, player, enemies, scene: world.scene,
  equippedFruit: null, equippedSword: null, activeWeapon: 'fruit',
  cooldowns: {},
  tokens: 0, kills: 0,
  dashCharges: 3, dashTimer: 0,
  held: {}, chargeT: 0, heldStart: 0,
  m1Combo: 0, endLag: 0,
  swordGlow: 0,
  upgrades: { gb_super: { charge: 0 }, gb_death: { level: 1 } },
  invItems: INVENTORY_ITEMS,
  // helpers used by skills.js
  after(sec, cb) { let t = 0; fx.add({ update: (dt) => { t += dt; if (t >= sec) { cb(); return false; } return true; }, dispose() {} }); },
  aimPoint() { return input.aimPoint(new THREE.Vector3()); },
  enemyPct(p) { return 0; }, // unused placeholder
  shade(hex, sec, deep = false) {
    flash.style.background = '#' + (hex >>> 0).toString(16).padStart(6, '0');
    flash.style.transition = 'none';
    flash.style.opacity = deep ? '0.85' : '0.4';
    requestAnimationFrame(() => { flash.style.transition = `opacity ${sec}s linear`; flash.style.opacity = '0'; });
  },
};

// ------------------------------------------------------------
//  Equip / weapon logic
// ------------------------------------------------------------
function makeSwordMesh(color) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.5),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
  blade.position.y = 1.6; g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.8, roughness: 0.4 }));
  guard.position.y = 0.1; g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
  hilt.position.y = -0.45; g.add(hilt);
  return g;
}

function activeWeaponDef() {
  if (game.activeWeapon === 'sword') return SWORDS[game.equippedSword] || null;
  return FRUITS[game.equippedFruit] || null;
}

function initCooldowns() {
  game.cooldowns = {};
  const w = activeWeaponDef();
  if (!w) return;
  if (w.m1) game.cooldowns[w.m1.id] = { cd: w.m1.cd, remaining: 0 };
  w.skills.forEach((s) => { game.cooldowns[s.id] = { cd: s.cd, remaining: 0 }; });
}

function applyEquipVisuals() {
  const f = FRUITS[game.equippedFruit];
  player.setFruitColor(f ? f.color : 0x444466);
  if (game.equippedSword) {
    const s = SWORDS[game.equippedSword];
    player.setWeaponMesh(makeSwordMesh(s.color));
  } else player.setWeaponMesh(null);
}

game.toggleEquip = (id) => {
  const item = INVENTORY_ITEMS.find((i) => i.id === id);
  if (!item) return;
  if (item.type === 'fruit') {
    if (game.equippedFruit === id) { game.equippedFruit = null; if (game.activeWeapon === 'fruit' && game.equippedSword) game.activeWeapon = 'sword'; }
    else { game.equippedFruit = id; game.activeWeapon = 'fruit'; }
  } else {
    if (game.equippedSword === id) { game.equippedSword = null; if (game.activeWeapon === 'sword' && game.equippedFruit) game.activeWeapon = 'fruit'; }
    else { game.equippedSword = id; game.activeWeapon = 'sword'; }
  }
  applyEquipVisuals();
  initCooldowns();
  ui.buildSkillBar();
  ui.refreshInventory();
  ui.toast(`Equipped: ${item.ref.name} (${item.type})`);
};

game.toggleWeapon = () => {
  if (game.equippedFruit && game.equippedSword) {
    game.activeWeapon = game.activeWeapon === 'fruit' ? 'sword' : 'fruit';
    initCooldowns(); ui.buildSkillBar(); ui.refreshInventory();
    const w = activeWeaponDef();
    ui.toast(`Active: ${w ? w.name : 'none'}`);
  } else ui.toast('Equip both a fruit and a sword to switch.');
};

game.skillIdForIndex = (idx) => {
  const w = activeWeaponDef();
  if (!w) return null;
  const s = w.skills[idx];
  return s ? s.id : null;
};

game.requestCast = (id) => {
  const cd = game.cooldowns[id];
  if (!cd || cd.remaining > 0) return;
  const weapon = activeWeaponDef();
  const def = (weapon.m1 && weapon.m1.id === id) ? weapon.m1 : weapon.skills.find((s) => s.id === id);
  const aim = game.aimPoint();
  const ok = castSkill(game, id, aim);
  if (ok !== false) cd.remaining = def ? def.cd : cd.cd;
};

game.requestCastM1 = () => {
  const weapon = activeWeaponDef();
  if (!weapon || !weapon.m1) return;
  const cd = game.cooldowns[weapon.m1.id];
  if (!cd || cd.remaining > 0 || game.endLag > 0) return;
  const aim = game.aimPoint();
  castM1(game, weapon.id);
  cd.remaining = weapon.m1.cd;
};

game.releaseHeld = (id) => {
  releaseHeld(game, id);
  const cd = game.cooldowns[id];
  if (cd) cd.remaining = cd.cd;
};

game.tryUpgradeDeath = () => {
  const up = game.upgrades.gb_death;
  const maxLevel = 11;
  if (up.level >= maxLevel) { ui.toast('Death Slash is MAXED (buffs +100%).'); return; }
  const cost = Math.round(1000 * Math.pow(1.75, up.level - 1));
  if (game.tokens < cost) { ui.toast(`Need ${cost} tokens (have ${Math.floor(game.tokens)}).`); return; }
  game.tokens -= cost; up.level += 1;
  ui.refreshDeathUpgrade(); ui.setTokens(game.tokens);
  ui.toast(`Death Slash → Lv${up.level} (cost ${Math.round(1000 * Math.pow(1.75, up.level - 1))} next)`);
};

// ------------------------------------------------------------
//  Player hit / kill handling
// ------------------------------------------------------------
function onPlayerHit(dmg) {
  if (dmg >= 0) player.damage(dmg);
  else player.heal(-dmg);
  if (player.hp <= 0) {
    player.hp = player.maxHp;
    ui.toast('You were knocked out — respawned at full HP.');
    fx.shake(1, 3);
  }
}
function onKill(e) {
  game.kills += 1;
  const tk = 10 + Math.floor(Math.random() * 91);
  game.tokens += tk;
  // gravity blade superforce charge
  if (game.equippedSword === 'gravityblade') game.upgrades.gb_super.charge = Math.min(1, game.upgrades.gb_super.charge + 0.1);
  ui.setKills(game.kills); ui.setTokens(game.tokens);
}

// ------------------------------------------------------------
//  Bloom toggle
// ------------------------------------------------------------
function applyBloom() {
  if (world.gfx.bloom && world.composer) world.render = () => world.composer.render();
  else world.render = () => world.renderer.render(world.scene, world.camera);
}
game.applyBloom = applyBloom;

// ------------------------------------------------------------
//  Camera follow — POSITION ONLY shake, rotation NEVER changes
// ------------------------------------------------------------
const camOffset = new THREE.Vector3(0, 18, 28);
const camTarget = new THREE.Vector3();
const _basePos = new THREE.Vector3();

function updateCamera(dt) {
  // base (unshaken) follow position
  _basePos.copy(player.position).add(camOffset);
  camera.position.copy(_basePos);
  camTarget.copy(player.position); camTarget.y += 2.2;
  camera.lookAt(camTarget);              // orientation set from UN-shaken position only
  // now apply shake to POSITION only -> rotation is left completely unchanged
  camera.position.add(fx.shakeOffset);
}
const camera = world.camera;

// ------------------------------------------------------------
//  Input + UI
// ------------------------------------------------------------
setLoad(70, 'Wiring UI & input…');
const input = new Input(game, canvas, camera);
const ui = new UI(game);
ui.buildInventory();
ui.buildSettings();

// auto-equip starter loadout
game.equippedFruit = 'gravity';
game.equippedSword = 'gravityblade';
game.activeWeapon = 'fruit';
applyEquipVisuals();
initCooldowns();
ui.buildSkillBar();
ui.refreshInventory();

// aim reticle on ground
const reticle = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
reticle.rotation.x = -Math.PI / 2; reticle.position.y = 0.05; world.scene.add(reticle);

ui.showGameUI();
setLoad(90, 'Enabling bloom…');
tryEnableBloom(world).then(() => { applyBloom(); setLoad(100, 'Ready!'); });
setTimeout(() => setLoad(100, 'Ready!'), 400);

ui.toast('WASD move • Mouse aim • LMB attack • Z X C V B F skills • Tab switch weapon', 4200);

// ------------------------------------------------------------
//  Game loop
// ------------------------------------------------------------
let last = performance.now();
let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;

function loop() {
  try { loopBody(); } catch (e) { console.warn('loop error', e); }
  requestAnimationFrame(loop);
}

function loopBody() {
  const now = performance.now();
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05; // clamp

  // movement (camera-relative world dirs)
  const move = input.moveVector();
  player.update(dt, move);

  // held (charge / continuous) skills
  for (const id in game.held) {
    if (game.held[id]) {
      game.chargeT = (now - game.heldStart) / 1000;
      tickHeld(game, id, dt, game.chargeT);
    }
  }
  // safety: drop a lingering charge ball if its key was released/blurred
  if (game._ball && !game.held['l_destru']) { world.scene.remove(game._ball); game._ball = null; }
  // end lag
  if (game.endLag > 0) game.endLag = Math.max(0, game.endLag - dt);
  // sword glow decay
  if (game.swordGlow > 0) {
    game.swordGlow = Math.max(0, game.swordGlow - dt);
    if (player.weaponMesh) player.weaponMesh.children[0].material.emissiveIntensity = 0.5 + game.swordGlow * 3;
  }

  // dash charge regen (+1 per 3s)
  game.dashTimer += dt;
  if (game.dashTimer >= 3 && game.dashCharges < 3) { game.dashCharges++; game.dashTimer = 0; }

  enemies.update(dt, now / 1000);
  fx.update(dt);
  updateCamera(dt);

  // reticle follows aim
  const aim = input.aimPoint(new THREE.Vector3());
  reticle.position.x = aim.x; reticle.position.z = aim.z;

  // UI
  ui.updateSkillBar(dt);
  ui.setHp(player.hp / player.maxHp);

  // fps
  fpsAcc += dt; fpsCount++; fpsTimer += dt;
  if (fpsTimer >= 0.5) { ui.setFps(fpsCount / fpsAcc); fpsAcc = 0; fpsCount = 0; fpsTimer = 0; }

  world.render();
}
requestAnimationFrame(loop);

// expose for debugging
window.__game = game;

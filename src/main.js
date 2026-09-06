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
import { castSkill, castM1, tickHeld, releaseHeld } from './skills.js';
import { FRUITS, SWORDS, FIGHTING_STYLES, INVENTORY_ITEMS, PLAYER, BOATS } from './config.js';
import { FruitDealer, FruitSpawner, BoatDealer, validateGameState } from './progression.js';
import { createSwordMesh } from './models.js';

const isMobile = window.matchMedia('(pointer: coarse)').matches;

const loaderFill = document.getElementById('loaderFill');
const loaderStatus = document.getElementById('loaderStatus');
const loaderPct = document.getElementById('loaderPct');
const setLoad = (p, msg) => {
  loaderFill.style.width = p + '%';
  if (loaderPct) loaderPct.textContent = Math.round(p) + '%';
  if (msg) loaderStatus.textContent = msg;
};

setLoad(8, 'Creating renderer…');
const canvas = document.getElementById('game');
const world = new World(canvas);

setLoad(28, 'Pre-rendering VFX atlas…');
const fx = new FX(world.scene);
fx.particles = world.gfx.particles;

setLoad(48, 'Sculpting fighters…');
const player = new Player(world.scene, world);
const enemies = new EnemyManager(world.scene, () => player, (d) => onPlayerHit(d), (e) => onKill(e), fx);
const dealer = new FruitDealer();
const shipwright = new BoatDealer();
const fruitSpawner = new FruitSpawner(world.scene, world.fruitSpawnPoints);

const flash = document.createElement('div');
flash.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;opacity:0;background:#000;';
document.getElementById('app').appendChild(flash);

const game = {
  isMobile,
  world, fx, player, enemies, dealer, shipwright, fruitSpawner, scene: world.scene,
  equippedFruit: null, equippedSword: null, equippedStyle: 'combat', activeWeapon: 'style',
  cooldowns: {},
  tokens: 0, kills: 0,
  level: 1, xp: 0, xpToNext: 100,
  statPoints: 0, stats: { health: 0, fruit: 0, sword: 0, fighting: 0 },
  ownedFruits: new Set(), ownedSwords: new Set(), ownedBoats: new Set(), selectedBoat: null,
  dashCharges: 3, dashTimer: 0,
  held: {}, chargeT: 0, heldStart: 0,
  m1Combo: 0, endLag: 0,
  swordGlow: 0,
  upgrades: { gb_super: { charge: 0 }, gb_death: { level: 1 } },
  invItems: INVENTORY_ITEMS,
  after(sec, cb) { let t = 0; fx.add({ update: (dt) => { t += dt; if (t >= sec) { cb(); return false; } return true; }, dispose() {} }); },
  aimPoint() { return input.aimPoint(new THREE.Vector3()); },
  enemyPct() { return 0; },
  shade(hex, sec, deep = false) {
    flash.style.background = '#' + (hex >>> 0).toString(16).padStart(6, '0');
    flash.style.transition = 'none';
    flash.style.opacity = deep ? '0.85' : '0.4';
    requestAnimationFrame(() => { flash.style.transition = `opacity ${sec}s linear`; flash.style.opacity = '0'; });
  },
};

game.allocateStat = (type, rawAmount) => {
  if (rawAmount == null) rawAmount = document.getElementById('statAmount')?.value;
  let amount = Math.floor(Number(rawAmount));
  if (!Number.isFinite(amount) || amount < 1) amount = 1;
  if (game.statPoints <= 0) return ui.toast('No stat points available.');
  if (amount > game.statPoints) amount = game.statPoints;
  game.statPoints -= amount; game.stats[type] += amount;
  if (type === 'health') {
    player.maxHp = PLAYER.maxHp + game.stats.health * 20 + (game.level - 1) * 45;
    player.hp = Math.min(player.maxHp, player.hp + amount * 20);
  }
  game.refreshCombatBonus();
  ui.refreshStats(); ui.toast(`${amount} ${type} point${amount === 1 ? '' : 's'} invested.`);
};

game.refreshCombatBonus = () => {
  const stat = game.activeWeapon === 'fruit' ? game.stats.fruit : game.activeWeapon === 'sword' ? game.stats.sword : game.stats.fighting;
  player.damageBonus = stat * 0.05;
};

game.collectFruit = () => {
  const id = fruitSpawner.collectNearby(player.position);
  if (!id) return ui.toast('No spawned fruit is close enough to collect.');
  if (game.ownedFruits.has(id)) return ui.toast(`${FRUITS[id].name} was already in your inventory.`);
  game.ownedFruits.add(id); ui.refreshInventory(); ui.toast(`Found ${FRUITS[id].emoji} ${FRUITS[id].name}!`);
};

game.toggleSail = () => {
  if (player.mountedBoat) {
    player.dismountBoat();
    ui.toast('You hop off the boat.');
    return;
  }
  const id = game.selectedBoat;
  if (!id) return ui.toast('Buy a boat from the Shipwright, then sail from the southern dock.');
  const onLand = world.isOnLand(player.position.x, player.position.z);
  if (onLand && !world.nearDock(player.position)) return ui.toast('Go to the southern dock to set sail.');
  player.mountBoat(game.shipwright && { ...null });
  const def = (awaitBoat(id));
  player.mountBoat(def);
  ui.toast(`Sailing the ${def.name}! Jump or press Q to hop off.`);
};

function awaitBoat(id) {
  return { raft: { id: 'raft', name: 'Raft', speed: 20, color: 0xc4a574 }, dinghy: { id: 'dinghy', name: 'Dinghy', speed: 28, color: 0xd8c8a0 }, sloop: { id: 'sloop', name: 'Sloop', speed: 38, color: 0x8ab4ff }, galleon: { id: 'galleon', name: 'Galleon', speed: 50, color: 0xc9a227 } }[id];
}

function activeWeaponDef() {
  if (game.activeWeapon === 'sword') return SWORDS[game.equippedSword] || null;
  if (game.activeWeapon === 'style') return FIGHTING_STYLES[game.equippedStyle] || null;
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
    player.setWeaponMesh(createSwordMesh(s.id, s.color));
  } else player.setWeaponMesh(null);
}

game.toggleEquip = (id) => {
  const item = INVENTORY_ITEMS.find((i) => i.id === id);
  if (!item) return;
  if (item.type === 'fruit' && !game.ownedFruits.has(id)) { ui.toast('Buy this fruit from the dealer or find it in the arena.'); return; }
  if (item.type === 'sword' && !game.ownedSwords.has(id)) { ui.toast('Buy this sword from the Shipwright armory.'); return; }
  if (item.type === 'style') { game.equippedStyle = id; game.activeWeapon = 'style'; game.refreshCombatBonus(); initCooldowns(); ui.buildSkillBar(); ui.refreshInventory(); return; }
  if (item.type === 'fruit') {
    if (game.equippedFruit === id) { game.equippedFruit = null; if (game.activeWeapon === 'fruit') game.activeWeapon = game.equippedSword ? 'sword' : 'style'; }
    else { game.equippedFruit = id; game.activeWeapon = 'fruit'; }
  } else {
    if (game.equippedSword === id) { game.equippedSword = null; if (game.activeWeapon === 'sword') game.activeWeapon = game.equippedFruit ? 'fruit' : 'style'; }
    else { game.equippedSword = id; game.activeWeapon = 'sword'; }
  }
  applyEquipVisuals();
  game.refreshCombatBonus();
  initCooldowns();
  ui.buildSkillBar();
  ui.refreshInventory();
  ui.toast(`Equipped: ${item.ref.name} (${item.type})`);
};

game.toggleWeapon = () => {
  const available = [game.equippedStyle && 'style', game.equippedFruit && 'fruit', game.equippedSword && 'sword'].filter(Boolean);
  if (available.length > 1) {
    game.activeWeapon = available[(available.indexOf(game.activeWeapon) + 1) % available.length];
    game.refreshCombatBonus();
    initCooldowns(); ui.buildSkillBar(); ui.refreshInventory();
    const w = activeWeaponDef();
    ui.toast(`Active: ${w ? w.name : 'none'}`);
  } else ui.toast('Buy a fruit or sword to unlock weapon switching.');
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
  castM1(game, weapon.id);
  cd.remaining = weapon.m1.cd;
};

game.cancelHeldSkills = () => {
  for (const id in game.held) {
    if (game.held[id]) game.releaseHeld(id);
  }
  game.held = {};
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

function onPlayerHit(dmg) {
  if (dmg >= 0) {
    player.damage(dmg);
    if (dmg >= 8) fx.popup(player.position.x, player.position.y + 3.2, player.position.z, dmg, 'hurt');
  } else {
    player.heal(-dmg);
    if (-dmg >= 8) fx.popup(player.position.x, player.position.y + 3.2, player.position.z, -dmg, 'heal');
  }
  if (player.hp <= 0) {
    player.hp = player.maxHp;
    player.position.set(0, 0, 0);
    player.dismountBoat();
    ui.toast('You were knocked out — respawned at the arena.');
    fx.shake(1, 3);
  }
}
function onKill(e) {
  game.kills += 1;
  const tk = (10 + Math.floor(Math.random() * 91)) * (e.tier || 1);
  game.tokens += tk;
  const xpGain = Math.round(22 + e.maxHp * 0.08);
  game.xp += xpGain;
  let leveled = false;
  while (game.xp >= game.xpToNext && game.level < PLAYER.maxLevel) {
    game.xp -= game.xpToNext;
    game.level += 1;
    game.xpToNext = Math.round(100 * Math.pow(1.08, game.level - 1));
    player.level = game.level;
    player.maxHp = PLAYER.maxHp + game.stats.health * 20 + (game.level - 1) * 45;
    player.hp = player.maxHp;
    game.statPoints += 3;
    leveled = true;
  }
  if (game.equippedSword === 'gravityblade') game.upgrades.gb_super.charge = Math.min(1, game.upgrades.gb_super.charge + 0.1);
  ui.setKills(game.kills); ui.setTokens(game.tokens);
  ui.setLevel(game.level, game.xp, game.xpToNext); ui.refreshStats();
  if (leveled) { fx.pillar({ x: player.position.x, z: player.position.z, height: 36, color: 0xffd56b, duration: 1.2, rings: 5 }); fx.shake(0.45, 1.6); ui.toast(`LEVEL UP! You are now Lv ${game.level}. Full HP restored.`, 3000); }
}

function applyBloom() {
  if (world.gfx.bloom && world.composer) world.render = () => world.composer.render();
  else world.render = () => world.renderer.render(world.scene, world.camera);
}
game.applyBloom = applyBloom;

const camOffset = new THREE.Vector3(0, 18, 28);
const camTarget = new THREE.Vector3();
const _basePos = new THREE.Vector3();

function updateCamera() {
  _basePos.copy(player.position).add(camOffset);
  camera.position.copy(_basePos);
  camTarget.copy(player.position); camTarget.y += 2.2;
  camera.lookAt(camTarget);
  camera.position.add(fx.shakeOffset);
}
const camera = world.camera;

setLoad(70, 'Wiring UI & input…');
const input = new Input(game, canvas, camera);
const ui = new UI(game);
ui.buildInventory();
ui.buildSettings();
ui.buildProgressionPanels();

game.equippedFruit = null;
game.equippedSword = null;
game.equippedStyle = 'combat';
game.activeWeapon = 'style';
game.refreshCombatBonus();
applyEquipVisuals();
initCooldowns();
ui.buildSkillBar();
ui.refreshInventory();
ui.setLevel(game.level, game.xp, game.xpToNext);

const reticle = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
reticle.rotation.x = -Math.PI / 2; reticle.position.y = 0.05; world.scene.add(reticle);

ui.showGameUI();
setLoad(92, 'Enabling bloom…');
tryEnableBloom(world).then(() => { applyBloom(); setLoad(100, 'Ready!'); });
setTimeout(() => setLoad(100, 'Ready!'), 400);

ui.toast('WASD or joystick • Space jump (20 air) • LMB attack • Z–F skills • Q sail • Tab swap', 4800);

let last = performance.now();
let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;

function loop() {
  try { loopBody(); } catch (e) { console.warn('loop error', e); }
  requestAnimationFrame(loop);
}

function loopBody() {
  const now = performance.now();
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;

  const move = input.moveVector();
  player.update(dt, move);

  for (const id in game.held) {
    if (game.held[id]) {
      game.chargeT = (now - game.heldStart) / 1000;
      tickHeld(game, id, dt, game.chargeT);
    }
  }
  if (game._ball && !game.held['l_destru']) { world.scene.remove(game._ball); game._ball = null; }
  if (game.endLag > 0) game.endLag = Math.max(0, game.endLag - dt);
  if (game.swordGlow > 0) {
    game.swordGlow = Math.max(0, game.swordGlow - dt);
    if (player.weaponMesh) player.weaponMesh.children[0].material.emissiveIntensity = 0.5 + game.swordGlow * 3;
  }

  game.dashTimer += dt;
  if (game.dashTimer >= 3 && game.dashCharges < 3) { game.dashCharges++; game.dashTimer = 0; }

  enemies.update(dt, now / 1000);
  fruitSpawner.update(dt);
  if (dealer.update(dt)) { ui.renderDealerStock(); ui.toast('Fruit Dealer stock has refreshed!', 3000); }
  ui.updateProgression();
  fx.particles = world.gfx.particles;
  fx.update(dt);
  world.update(dt, now / 1000);
  validateGameState(game);
  updateCamera();

  const aim = input.aimPoint(new THREE.Vector3());
  reticle.position.x = aim.x; reticle.position.z = aim.z;

  ui.updateSkillBar(dt);
  ui.setHp(player.hp / player.maxHp);
  ui.setJumps(player.airJumps, PLAYER.maxAirJumps, player.onGround);

  fpsAcc += dt; fpsCount++; fpsTimer += dt;
  if (fpsTimer >= 0.5) { ui.setFps(fpsCount / fpsAcc); fpsAcc = 0; fpsCount = 0; fpsTimer = 0; }

  world.render();
}
requestAnimationFrame(loop);

window.__game = game;

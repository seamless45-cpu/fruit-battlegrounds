/**
 * Headless UI + camera-rig test (jsdom, no WebGL).
 *
 *  • boots the real World/FX and the real UI against index.html's DOM
 *  • clicks inventory slots, skill USE buttons, panel close tabs,
 *    settings controls and the upgrade button
 *  • verifies the camera shake is POSITION ONLY
 *
 *   node tools/ui-test.mjs
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import * as THREE from 'three';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

// ---- canvas 2d stub (procedural textures) ----
const grad = { addColorStop() {} };
const ctx2d = new Proxy({ createRadialGradient: () => grad, createLinearGradient: () => grad, measureText: () => ({ width: 8 }) },
  { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => (t[k] = v, true) });
window.HTMLCanvasElement.prototype.getContext = function (type) { return type === '2d' ? ctx2d : null; };

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
// keep node's performance (jsdom's delegates to the global one)
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
window.devicePixelRatio = 1;

const errors = [];
window.addEventListener('error', e => errors.push('window error: ' + e.message));

const { World } = await import('../src/core/world.js');
const { FX } = await import('../src/fx/index.js');
const { UI } = await import('../src/ui/index.js');
const { CameraRig } = await import('../src/core/cameraRig.js');
const { Settings } = await import('../src/core/settings.js');
const { Input } = await import('../src/core/input.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 6000);

const input = new Input(window.document.getElementById('scene'));
const rig = new CameraRig(camera, input);
const fx = new FX(scene, camera, rig);
const world = new World(scene, camera, rig);
world.fx = fx; world.input = input; 
fx.setWorld(world);
world.audio = { play() {} };
const ui = new UI(world);
world.ui = ui;

const step = (dt = 1 / 60) => { world.update(dt); fx.update(dt * world.timeScale); rig.update(dt, world.player.pos, world); ui.update(dt, dt); };

for (let i = 0; i < 8; i++) world.spawnEnemy(2);
for (let i = 0; i < 30; i++) step();

const results = [];
const t = (name, fn) => {
  try { const r = fn(); results.push({ name, ok: r !== false, info: typeof r === 'string' ? r : '' }); }
  catch (e) { results.push({ name, ok: false, info: e.message }); errors.push(name + ': ' + e.message); }
};

/* ------------------------------------------------------------ UI checks */
t('skill rows built (6 fruit + 4 sword)', () => {
  const rows = document.querySelectorAll('#fruitSkills .skill').length;
  const wrows = document.querySelectorAll('#weaponSkills .skill').length;
  if (rows !== 6) throw new Error('fruit rows = ' + rows);
  if (wrows !== 4) throw new Error('weapon rows = ' + wrows);
  return `${rows} fruit / ${wrows} sword`;
});

t('cooldown wash shows real seconds, 100 → 0', () => {
  const p = world.player;
  p.cd.clear();
  p.pressedSkill('fruit', 0);                       // Asteroid, 2s
  const key = 'fruit:asteroid';
  const total = p.cdTotal(key);
  step();
  const row = document.querySelector('#fruitSkills .skill');
  const wash = row.querySelector('.cdwash');
  const num = row.querySelector('.cdnum');
  const w1 = parseFloat(wash.style.width);
  const n1 = parseFloat(num.textContent);
  for (let i = 0; i < 60; i++) step();              // 1 second
  const w2 = parseFloat(wash.style.width);
  const n2 = parseFloat(num.textContent);
  if (!(total === 2)) throw new Error('cd total ' + total);
  if (!(w1 > 90 && w1 <= 100)) throw new Error('wash start ' + w1);
  if (!(w2 < w1)) throw new Error('wash did not drain: ' + w1 + ' → ' + w2);
  if (!(n1 > n2)) throw new Error('seconds did not count down: ' + n1 + ' → ' + n2);
  if (Math.abs(n2 - 1) > 0.15) throw new Error('seconds wrong: ' + n2);
  return `${w1.toFixed(0)}% → ${w2.toFixed(0)}% , ${n1}s → ${n2}s`;
});

t('panel closes and re-opens from dock tab', () => {
  document.querySelector('[data-close="fruitPanel"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const hidden = document.getElementById('fruitPanel').hidden;
  const tab = document.querySelector('[data-open="fruitPanel"]');
  tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const shown = !document.getElementById('fruitPanel').hidden;
  if (!hidden) throw new Error('panel did not hide');
  if (!shown) throw new Error('panel did not restore');
  return 'ok';
});

t('inventory: equip/unequip fruit and sword independently', () => {
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const slots = () => [...document.querySelectorAll('#invSlots .inv-slot')];
  const p = world.player;

  p.setFruit('gravity'); p.setWeapon('gravityblade');
  ui.inventory.build();
  click(slots()[1]);                                   // gravity is equipped → unequip
  const afterUnequip = p.fruit;
  click(slots()[1]);                                   // equip it again
  const afterEquip = p.fruit;
  click(document.querySelector('[data-tab="sword"]'));
  click(slots()[1]);                                   // unequip the sword
  const swordOff = p.weapon;
  const fruitStillOn = p.fruit;
  click(slots()[3]);                                   // equip a different sword
  const swordOn = p.weapon;
  click(slots()[0]);                                   // NONE slot
  const swordNone = p.weapon;

  if (afterUnequip !== null) throw new Error('unequip fruit failed: ' + afterUnequip);
  if (afterEquip !== 'gravity') throw new Error('re-equip fruit failed: ' + afterEquip);
  if (swordOff !== null) throw new Error('unequip sword failed: ' + swordOff);
  if (fruitStillOn !== 'gravity') throw new Error('unequipping the sword touched the fruit slot');
  if (swordOn !== 'bisento') throw new Error('equip sword failed: ' + swordOn);
  if (swordNone !== null) throw new Error('NONE slot failed to unequip');
  return 'fruit and sword slots are independent, NONE slot works';
});

t('all three fruits + three swords equip cleanly', () => {
  document.querySelector('[data-tab="fruit"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const out = [];
  for (let i = 1; i <= 3; i++) {
    document.querySelectorAll('#invSlots .inv-slot')[i].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    out.push(world.player.fruit);
    step();
  }
  document.querySelector('[data-tab="sword"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  for (let i = 1; i <= 3; i++) {
    document.querySelectorAll('#invSlots .inv-slot')[i].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    out.push(world.player.weapon);
    step();
  }
  return out.join(', ');
});

t('USE button casts on touch devices', () => {
  const p = world.player;
  p.setFruit('gravity'); p.setWeapon('gravityblade');
  ui.rebuildSkillBars();
  p.cd.clear();
  const btn = document.querySelector('#fruitSkills .skill .use');
  btn.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
  const onCd = p.cdLeft('fruit:asteroid') > 0;
  btn.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }));
  if (!onCd) throw new Error('USE did not trigger the skill');
  return 'ok';
});

t('upgrade button spends kill tokens', () => {
  const p = world.player;
  p.setWeapon('gravityblade'); p.setFruit('gravity');
  ui.rebuildSkillBars();
  p.tokens = 5000;
  const before = p.upgrades.deathSlashes.level;
  const btn = [...document.querySelectorAll('#weaponSkills .upg')][0];
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const after = p.upgrades.deathSlashes.level;
  if (after !== before + 1) throw new Error('level did not rise: ' + before + ' → ' + after);
  if (p.tokens !== 4000) throw new Error('tokens not spent: ' + p.tokens);
  return `lv ${after}, ${p.tokens} tokens left`;
});

t('settings panel: toggles, ranges and presets', () => {
  ui.settings.open();
  const switches = document.querySelectorAll('#settingsGrid .switch');
  if (!switches.length) throw new Error('no toggles rendered');
  switches[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const ranges = document.querySelectorAll('#settingsGrid input[type=range]');
  ranges[0].value = String(Number(ranges[0].min) + Number(ranges[0].step));
  ranges[0].dispatchEvent(new window.Event('input', { bubbles: true }));
  const preset = document.querySelector('.preset[data-preset="Ultra"]');
  preset.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  if (Settings.get('preset') !== 'Ultra') throw new Error('preset not applied');
  if (Settings.get('shadowQuality') !== 4096) throw new Error('ultra shadow res not applied: ' + Settings.get('shadowQuality'));
  ui.settings.close();
  Settings.applyPreset('High');
  return `${switches.length} toggles, ${ranges.length} sliders`;
});

t('HUD tracks player state', () => {
  const p = world.player;
  p.hp = p.maxHp * 0.4; p.tokens = 4242; p.kills = 7;
  p.addXp(999999);
  for (let i = 0; i < 20; i++) step();
  const hpText = document.getElementById('pcHpText').textContent;
  const lvl = document.getElementById('pcLevel').textContent;
  const tokens = document.getElementById('pcTokens').textContent;
  if (!hpText.includes('/')) throw new Error('hp text missing: ' + hpText);
  if (tokens !== '4,242') throw new Error('tokens text = ' + tokens);
  return `hp "${hpText}", lvl ${lvl}, tokens ${tokens}`;
});

t('damage numbers appear', () => {
  const e = world.enemies[0];
  e.takeDamage(1234, { source: world.player });
  step();
  const n = document.querySelectorAll('#dmgLayer .dmg').length;
  if (!n) throw new Error('no damage number element');
  return n + ' floating';
});

/* -------------------------------------------------- camera shake checks */
t('camera shake is POSITION ONLY (no rotation change)', () => {
  const pos = new THREE.Vector3(0, 0, 0);
  // baseline: no shake
  rig.shakes.length = 0;
  for (let i = 0; i < 10; i++) rig.update(1 / 60, pos, null);
  const baseQuat = camera.quaternion.clone();
  const basePos = camera.position.clone();

  // now shake hard
  rig.addShake(3, 1.0);
  let maxRotDelta = 0, maxPosDelta = 0;
  for (let i = 0; i < 40; i++) {
    rig.update(1 / 60, pos, null);
    maxRotDelta = Math.max(maxRotDelta, camera.quaternion.angleTo(baseQuat));
    maxPosDelta = Math.max(maxPosDelta, camera.position.distanceTo(basePos));
  }
  if (maxRotDelta > 1e-6) throw new Error(`rotation changed by ${maxRotDelta} rad — rotational shake is forbidden`);
  if (maxPosDelta < 0.2) throw new Error('no positional shake: ' + maxPosDelta);
  rig.shakes.length = 0;
  return `rot Δ ${maxRotDelta.toExponential(1)} rad, pos Δ ${maxPosDelta.toFixed(2)}m`;
});

t('shake decays back to zero', () => {
  rig.addShake(2, 0.4);
  for (let i = 0; i < 60; i++) rig.update(1 / 60, new THREE.Vector3(), null);
  if (rig.shakeAmplitude > 1e-3) throw new Error('shake did not decay: ' + rig.shakeAmplitude);
  return 'ok';
});

t('screenShake setting scales amplitude', () => {
  Settings.set('screenShake', 0);
  rig.shakes.length = 0;
  rig.addShake(5, 1);
  if (rig.shakes.length !== 0) throw new Error('shake still queued at 0 intensity');
  Settings.set('screenShake', 1);
  return 'ok';
});

/* --------------------------------------------------------------- report */
let fails = 0;
for (const r of results) {
  if (!r.ok) fails++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? '  →  ' + r.info : ''}`);
}
console.log(`\n${results.length - fails}/${results.length} checks passed`);
if (errors.length) { console.log('\nERRORS:'); errors.forEach(e => console.log(' -', e)); }
process.exit(fails ? 1 : 0);

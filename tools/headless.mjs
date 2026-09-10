/**
 * Headless logic harness — runs the full simulation (world, AI, every skill)
 * in Node with a stubbed DOM so runtime errors surface without a browser.
 *
 *   node tools/headless.mjs
 */
import * as THREE from 'three';

/* ------------------------------------------------------------- DOM stubs */
function mockCtx2d() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return new Proxy({
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
    canvas: null,
  }, {
    get(t, k) {
      if (k in t) return t[k];
      return noop;                       // every drawing call is a no-op
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function mockCanvas() {
  const c = {
    width: 1, height: 1, style: {},
    getContext: () => mockCtx2d(),
    addEventListener() {}, removeEventListener() {},
    toDataURL: () => '',
  };
  return c;
}

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? mockCanvas() : { style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {} }),
  createElementNS: () => mockCanvas(),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: { classList: { add() {}, remove() {}, toggle() {} } },
};
globalThis.window = {
  addEventListener() {}, removeEventListener() {},
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  localStorage: globalThis.localStorage,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 16),
};
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = globalThis.window.matchMedia;


/* ---------------------------------------------------------- boot the sim */
const { World } = await import('../src/core/world.js');
const { FX } = await import('../src/fx/index.js');
const { Settings } = await import('../src/core/settings.js');
const { FRUITS, WEAPONS } = await import('../src/data/loadout.js');
const { doUpgrade, upgradeCost } = await import('../src/skills/weapons.js');

Settings.set('particleQuality', 0.6);   // keep the sim light

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 6000);
const rigStub = { yaw: 0, pitch: 0.3, distance: 13, addShake() {}, addShakeAt() {}, update() {} };
const world = new World(scene, camera, rigStub);
const fx = new FX(scene, camera, rigStub);
world.fx = fx;
fx.setWorld(world);

const fakeInput = {
  moveAxis: (o = {}) => { o.x = 0; o.y = 0; return o; },
  isDown: () => false,
  justPressed: () => false,
  locked: true,
  mouse: { dx: 0, dy: 0, left: false },
  endFrame() {},
};
world.input = fakeInput;

const errors = [];
function step(dt = 1 / 60) {
  try {
    world.update(dt);
    fx.update(dt * world.timeScale);
  } catch (e) {
    errors.push('STEP: ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n'));
    throw e;
  }
}

// warm up + spawn a crowd
for (let i = 0; i < 18; i++) world.spawnEnemy(3);
for (let i = 0; i < 60; i++) step();
console.log(`boot ok — enemies: ${world.enemies.length}, player hp: ${Math.round(world.player.hp)}`);

/* ------------------------------------------------- exercise every skill */
const results = [];
for (const [fid, fruit] of Object.entries(FRUITS)) {
  world.player.setFruit(fid);
  for (let i = 0; i < fruit.skills.length; i++) {
    const def = fruit.skills[i];
    world.player.cd.clear();
    world.player.charge = 100;
    let err = null;
    const before = world.killCount;
    try {
      if (def.hold) {
        world.player.pressedSkill('fruit', i);
        for (let k = 0; k < 90; k++) step();      // 1.5s of channelling
        world.player.releasedSkill('fruit', i);
        for (let k = 0; k < 420; k++) step();     // 7s of aftermath
      } else {
        world.player.pressedSkill('fruit', i);
        for (let k = 0; k < 480; k++) step();     // 8s
      }
    } catch (e) {
      err = e;
      errors.push(`${fid}/${def.id}: ${e.message}\n${(e.stack || '').split('\n')[1] || ''}`);
    }
    results.push({ slot: `fruit:${fid}:${def.id}`, ok: !err, kills: world.killCount - before });
    for (let k = 0; k < 30; k++) step();
  }
}

for (const [wid, weapon] of Object.entries(WEAPONS)) {
  world.player.setWeapon(wid);
  if (weapon.m1) {
    try {
      for (let c = 0; c < 10; c++) { world.player.m1Timer = 0; world.player.attackLock = 0; world.player.m1(); for (let k = 0; k < 8; k++) step(); }
    } catch (e) { errors.push(`${wid}/m1: ${e.message}`); results.push({ slot: `weapon:${wid}:m1`, ok: false }); }
    results.push({ slot: `weapon:${wid}:m1`, ok: true });
  }
  for (let i = 0; i < weapon.skills.length; i++) {
    const def = weapon.skills[i];
    world.player.cd.clear();
    world.player.tokens = 1_000_000;
    let err = null;
    try {
      if (def.hold) {
        world.player.pressedSkill('weapon', i);
        for (let k = 0; k < 60; k++) step();
        world.player.releasedSkill('weapon', i);
        for (let k = 0; k < 120; k++) step();
      } else {
        world.player.pressedSkill('weapon', i);
        for (let k = 0; k < 480; k++) step();
      }
    } catch (e) {
      err = e;
      errors.push(`${wid}/${def.id}: ${e.message}\n${(e.stack || '').split('\n')[1] || ''}`);
    }
    results.push({ slot: `weapon:${wid}:${def.id}`, ok: !err });
  }
}

/* -------------------------------------------------------- upgrade econ */
world.player.setWeapon('gravityblade');
const up = world.player.upgrades.deathSlashes;
world.player.tokens = 100_000_000;
let upgrades = 0;
while (doUpgrade(world.player) && upgrades < 40) upgrades++;
console.log(`upgrades applied: ${upgrades} → level ${up.level}, over ${up.over}, bonus ${up.bonus}, next cost ${upgradeCost(up)}`);

/* ------------------------------------------------------------ stress run */
world.player.setFruit('gravity');
world.player.setWeapon('gravityblade');
for (let round = 0; round < 3; round++) {
  for (let i = 0; i < 6; i++) { world.player.cd.clear(); world.player.pressedSkill('fruit', i); }
  for (let i = 0; i < 4; i++) { world.player.cd.clear(); world.player.pressedSkill('weapon', i); }
  for (let k = 0; k < 240; k++) step();
}
console.log(`stress ok — enemies ${world.enemies.length}, timers ${world.timers.length}, kills ${world.killCount}, level ${world.player.level}, tokens ${world.player.tokens}`);

// long idle run to shake out timer leaks
for (let k = 0; k < 1800; k++) step();
console.log(`idle 30s ok — enemies ${world.enemies.length}, timers ${world.timers.length}, particles ${fx.glow.count}, bolts ${fx.bolts.activeCount}, debris ${fx.debris.count}`);

/* ---------------------------------------------------------------- report */
const failed = results.filter(r => !r.ok);
console.log(`\nskills exercised: ${results.length}, failures: ${failed.length}`);
if (failed.length) failed.forEach(f => console.log('  FAIL', f.slot));
console.log(`\nerrors: ${errors.length}`);
errors.slice(0, 25).forEach(e => console.log('---\n' + e));
process.exit(errors.length ? 1 : 0);

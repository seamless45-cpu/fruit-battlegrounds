/**
 * Soak / drift test.
 *
 * Plays the game in a real browser for a while, continuously casting skills,
 * and reports how the frame time and the GPU/JS resource counts evolve.
 * The point is not the absolute fps (the sandbox has no GPU, so everything is
 * software-rasterised) but the TREND: a leak or a resource that grows without
 * bound shows up as medians that keep climbing window after window.
 *
 * Usage: node tools/soak-test.mjs [secondsPerWindow] [windows]
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { inflate } from '@sparticuz/chromium';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const WINDOW_MS = Number(process.argv[2] || 5000);
const WINDOWS = Number(process.argv[3] || 12);
const URL = 'http://localhost:8080/index.html';

// @sparticuz/chromium ships the browser as a brotli tarball; it must be
// inflated and its libs put on LD_LIBRARY_PATH before Chrome will start.
await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
process.env.LD_LIBRARY_PATH = join(tmpdir(), 'al2023', 'lib') + ':' + (process.env.LD_LIBRARY_PATH || '');
process.env.FONTCONFIG_PATH = join(tmpdir(), 'fonts');

const browser = await puppeteer.launch({
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  executablePath: await chromium.executablePath(),
  headless: 'shell',
  timeout: 180000,
});
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 440 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 4000));
await page.evaluate(() => window.FB.Settings.applyPreset('Low'));
await page.evaluate(() => document.getElementById('btnPlay').click());
await new Promise((r) => setTimeout(r, 4000));

// ---- in-page instrumentation ---------------------------------------------
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    window.__frames.push(now - last);
    if (window.__frames.length > 4000) window.__frames.shift();
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.__mark = () => { window.__frames.length = 0; };
  window.__read = () => {
    const f = window.__frames.slice().sort((a, b) => a - b);
    const info = window.FB.engine.renderer.info;
    const w = window.FB.world;
    const q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))] || 0;
    return {
      n: f.length,
      median: +q(0.5).toFixed(1),
      p90: +q(0.9).toFixed(1),
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs.length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1,
      enemies: w.enemies.length,
      scale: +(window.FB.Settings.get('dynamicScale') || 1).toFixed(2),
      toasts: document.querySelectorAll('.toast').length,
      dmgNums: document.querySelectorAll('.dmgnum').length,
    };
  };

  // keep the fight busy without any CDP round-trip per cast
  const fruits = ['gravity', 'lightning', 'quake'];
  const weapons = ['gravityblade', 'pole', 'bisento'];
  window.__autoplay = setInterval(() => {
    const p = window.FB.world.player;
    if (!p || !p.alive) return;
    if (Math.random() < 0.25) p.setFruit(fruits[(Math.random() * fruits.length) | 0]);
    if (Math.random() < 0.25) p.setWeapon(weapons[(Math.random() * weapons.length) | 0]);
    p.cd.clear();
    const slot = Math.random() < 0.6 ? 'fruit' : 'weapon';
    const i = (Math.random() * (slot === 'fruit' ? 6 : 4)) | 0;
    p.pressedSkill(slot, i);
    setTimeout(() => p.releasedSkill(slot, i), 120);
    if (Math.random() < 0.3) p.m1?.();
  }, 700);
});

const rows = [];
for (let i = 0; i < WINDOWS; i++) {
  await page.evaluate(() => window.__mark());
  await new Promise((r) => setTimeout(r, WINDOW_MS));
  const r = await page.evaluate(() => window.__read());
  rows.push(r);
  console.log(
    `w${String(i + 1).padStart(2)}  median ${String(r.median).padStart(7)}ms  p90 ${String(r.p90).padStart(7)}ms` +
    `  geo ${String(r.geometries).padStart(4)}  tex ${String(r.textures).padStart(3)}  prog ${String(r.programs).padStart(3)}` +
    `  heap ${String(r.heapMB).padStart(6)}MB  enemies ${String(r.enemies).padStart(2)}  scale ${r.scale}  dom ${r.dmgNums}`,
  );
}
await page.evaluate(() => clearInterval(window.__autoplay));

// ---- verdict ---------------------------------------------------------------
const first = rows[0], last = rows[rows.length - 1];
const med = rows.map((r) => r.median);
const warm = med.slice(2);                                   // ignore warm-up
const trend = (warm[warm.length - 1] - warm[0]) / Math.max(1, warm.length - 1);
console.log('\n--- drift over the run (window 3 onward) ---');
console.log(`  median frame: ${warm[0]}ms -> ${warm[warm.length - 1]}ms  (${trend >= 0 ? '+' : ''}${trend.toFixed(2)}ms per window)`);
console.log(`  geometries:   ${first.geometries} -> ${last.geometries}`);
console.log(`  textures:     ${first.textures} -> ${last.textures}`);
console.log(`  programs:     ${first.programs} -> ${last.programs}`);
console.log(`  js heap:      ${first.heapMB}MB -> ${last.heapMB}MB`);
console.log(`  dom nodes:    dmgNums ${first.dmgNums} -> ${last.dmgNums}, toasts ${first.toasts} -> ${last.toasts}`);
console.log(`  console errors: ${errors.length}`);
[...new Set(errors)].slice(0, 10).forEach((e) => console.log('   -', e));

// Pools are allowed to grow - they fill up to the peak number of effects on
// screen at once. What must NOT happen is growth that never stops: compare the
// last few windows against the ones before them.
const k = Math.max(3, Math.floor(rows.length / 3));
const late = rows.slice(-k), early = rows.slice(-2 * k, -k);
const geoLate = late[late.length - 1].geometries - late[0].geometries;
const geoEarly = early[early.length - 1].geometries - early[0].geometries;
const heapLate = late[late.length - 1].heapMB - late[0].heapMB;

const problems = [];
if (geoLate > 10) problems.push(`geometries still climbing at the end of the run (+${geoLate} over the last ${k} windows; +${geoEarly} over the ${k} before that)`);
if (last.geometries > 400) problems.push(`geometries reached ${last.geometries}`);
if (last.textures > first.textures + 12) problems.push(`textures grew ${first.textures} -> ${last.textures}`);
if (last.programs > first.programs + 12) problems.push(`shader programs grew ${first.programs} -> ${last.programs}`);
if (last.heapMB > 0 && heapLate > 25) problems.push(`js heap still climbing (+${heapLate.toFixed(1)}MB over the last ${k} windows)`);
if (trend > 40) problems.push(`frame time is climbing (+${trend.toFixed(1)}ms per window)`);
if (errors.length) problems.push(`${errors.length} console errors`);
console.log(`\n  geometries: +${geoEarly} early, +${geoLate} late  (pools filling, then flat)`);

console.log(problems.length ? `\nFAIL:\n  ${problems.join('\n  ')}` : '\nPASS: no drift, no leak, no errors.');
await browser.close();
process.exit(problems.length ? 1 : 0);

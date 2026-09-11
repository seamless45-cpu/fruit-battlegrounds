/**
 * Browser smoke + performance test.
 *
 * Loads the real game in headless Chrome (SwiftShader WebGL2), records every
 * console error / page error, samples frame times while idle and while every
 * skill fires, and watches for GPU resource growth (leaks).
 *
 *   node tools/browser-test.mjs            # expects a server on :8080
 *   URL=http://localhost:8080/index.html OUT=/tmp/shots node tools/browser-test.mjs
 *
 * Requires: npm i -D puppeteer-core @sparticuz/chromium   (no Chrome download
 * needed — the binary ships inside the npm package).
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { inflate } from '@sparticuz/chromium';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || '/tmp/shots';
const W = Number(process.env.W || 900), H = Number(process.env.H || 560);
fs.mkdirSync(OUT, { recursive: true });

// the package only extracts its bundled libs on Amazon Linux — do it by hand
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
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const errors = [];
const warnings = [];
page.on('console', (m) => {
  const t = m.type();
  const text = m.text();
  if (t === 'error') errors.push(text);
  else if (t === 'warning' || t === 'warn') warnings.push(text);
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

console.log('loading', URL);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise(r => setTimeout(r, 4000));

// ---- instrumentation -----------------------------------------------------
await page.evaluate(() => {
  window.__frames = [];
  window.__rec = false;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    if (window.__rec) window.__frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.__sample = async (ms) => {
    window.__frames.length = 0;
    window.__rec = true;
    await new Promise(r => setTimeout(r, ms));
    window.__rec = false;
    const f = window.__frames.slice();
    f.sort((a, b) => a - b);
    const info = window.FB.engine.renderer.info;
    return {
      n: f.length,
      median: f[Math.floor(f.length * 0.5)] || 0,
      p95: f[Math.floor(f.length * 0.95)] || 0,
      max: f[f.length - 1] || 0,
      over100: f.filter(x => x > 100).length,
      over250: f.filter(x => x > 250).length,
      calls: info.render.calls,
      tris: info.render.triangles,
      programs: info.programs.length,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  };
});

// ---- pixel probe: proves the scene actually renders something -------------
await page.evaluate(() => {
  window.__pixels = () => {
    const r = window.FB.engine.renderer;
    r.render(window.FB.world.scene, window.FB.engine.camera);
    const gl = r.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0, sr = 0, sg = 0, sb = 0, dark = 0;
    const buckets = new Set();
    const top = { r: 0, g: 0, b: 0, n: 0 }, bottom = { r: 0, g: 0, b: 0, n: 0 };
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const i = (y * w + x) * 4;
        const R = px[i], G = px[i + 1], B = px[i + 2];
        n++; sr += R; sg += G; sb += B;
        if (R + G + B < 24) dark++;
        buckets.add((R >> 4) << 8 | (G >> 4) << 4 | (B >> 4));
        const side = y > h / 2 ? top : bottom;      // readPixels is bottom-up
        side.r += R; side.g += G; side.b += B; side.n++;
      }
    }
    const lum = [];
    for (let i = 0; i < px.length; i += 4 * 37) lum.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
    const std = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length);
    const band = (o) => [Math.round(o.r / o.n), Math.round(o.g / o.n), Math.round(o.b / o.n)];
    return {
      w, h, mean: +mean.toFixed(1), std: +std.toFixed(1),
      avg: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
      darkPct: +(100 * dark / n).toFixed(1),
      colors: buckets.size,
      upperHalf: band(top), lowerHalf: band(bottom),
    };
  };
});

// rAF cadence in a headless, GPU-less sandbox is throttled and noisy, so also
// measure the true cost of a frame by timing real renders with gl.finish().
await page.evaluate(() => {
  window.__cost = () => {
    const gl = window.FB.engine.renderer.getContext();
    const time = (fn, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); gl.finish(); return (performance.now() - t0) / n; };
    time(() => window.FB.engine.render(), 3);                       // warm
    return {
      drawBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      renderMs: +time(() => window.FB.engine.render(), 8).toFixed(2),
      logicMs: +time(() => window.FB.world.update(0.0001), 20).toFixed(2),
    };
  };
});

const started = await page.evaluate(() => !!window.FB);
console.log('bootstrapped:', started);
if (!started) { console.log('ERRORS:', errors.slice(0, 10)); await browser.close(); process.exit(1); }

// use the low preset so the software rasteriser keeps up
await page.evaluate(() => window.FB.Settings.applyPreset('Low'));
await page.evaluate(() => document.getElementById('btnPlay').click());
await new Promise(r => setTimeout(r, 2500));

// NOTE: screenshots force a full readPixels + PNG encode, which stalls the
// renderer for up to a second. They are all taken AFTER the measurements so
// they cannot be mistaken for game hitches.
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); await new Promise(r => setTimeout(r, 700)); };

const report = {};
report.idle = await page.evaluate(() => window.__sample(4000));
console.log('idle      ', JSON.stringify(report.idle));

// ---- fire every skill, measuring while the screen is busy -----------------
const combos = [['gravity', 'gravityblade'], ['lightning', 'pole'], ['quake', 'bisento']];
for (const [fruit, weapon] of combos) {
  await page.evaluate((f, w) => {
    const p = window.FB.world.player;
    p.setFruit(f); p.setWeapon(w);
    window.FB.ui.skillbar.rebuild();
  }, fruit, weapon);
  const counts = await page.evaluate(() => ({
    fruit: window.FB.world.player.fruitSkills.length,
    weapon: window.FB.world.player.weaponSkills.length,
  }));
  for (let i = 0; i < counts.fruit; i++) {
    await page.evaluate((i) => { const p = window.FB.world.player; p.cd.clear(); p.pressedSkill('fruit', i); }, i);
    const s = await page.evaluate(() => window.__sample(1200));
    await page.evaluate((i) => window.FB.world.player.releasedSkill('fruit', i), i);
    report[`${fruit}-${i}`] = s;
    console.log(`${fruit} #${i}`.padEnd(16), JSON.stringify(s));
  }
  for (let i = 0; i < counts.weapon; i++) {
    await page.evaluate((i) => { const p = window.FB.world.player; p.cd.clear(); p.pressedSkill('weapon', i); }, i);
    const s = await page.evaluate(() => window.__sample(1200));
    await page.evaluate((i) => window.FB.world.player.releasedSkill('weapon', i), i);
    report[`${weapon}-${i}`] = s;
    console.log(`${weapon} #${i}`.padEnd(16), JSON.stringify(s));
  }
}

// ---- everything at once ---------------------------------------------------
await page.evaluate(() => {
  const p = window.FB.world.player;
  p.setFruit('gravity'); p.setWeapon('gravityblade');
  p.charge = 100;
  p.cd.clear();
  for (let i = 0; i < 6; i++) p.pressedSkill('fruit', i);
  for (let i = 0; i < 4; i++) p.pressedSkill('weapon', i);
});
report.storm = await page.evaluate(() => window.__sample(6000));
console.log('storm     ', JSON.stringify(report.storm));

// ---- leak check: idle after the storm -------------------------------------
await new Promise(r => setTimeout(r, 4000));
report.after = await page.evaluate(() => window.__sample(3000));
console.log('after     ', JSON.stringify(report.after));

// ---- visuals (measured above, so readback stalls cannot pollute the fps) ---
const px = await page.evaluate(() => window.__pixels());
console.log('pixels    ', JSON.stringify(px));
if (px.std < 4 || px.darkPct > 60) errors.push(`SCREEN LOOKS BLANK: ${JSON.stringify(px)}`);
if (px.colors < 12) errors.push(`SCREEN HAS ALMOST NO COLOUR VARIATION: ${JSON.stringify(px)}`);
await shot('01-scene');

// ---- UI shots -------------------------------------------------------------
await page.evaluate(() => window.FB.ui.settings.open());
await new Promise(r => setTimeout(r, 500));
await shot('04-settings');
await page.evaluate(() => { window.FB.ui.settings.close(); });

const cost = await page.evaluate(() => window.__cost());
console.log('raw cost  ', JSON.stringify(cost), '  (rAF cadence above is throttled by the headless sandbox)');

const worst = Object.entries(report).sort((a, b) => b[1].max - a[1].max).slice(0, 5);
console.log('\nworst single frames:');
for (const [k, v] of worst) console.log(`  ${k.padEnd(22)} max ${v.max.toFixed(0)}ms  p95 ${v.p95.toFixed(0)}ms  >250ms: ${v.over250}`);

console.log(`\n=== console errors: ${errors.length} ===`);
[...new Set(errors)].slice(0, 30).forEach(e => console.log(' -', e.slice(0, 400)));
// ReadPixels comes from this harness's own pixel probe; the AudioContext note
// is unavoidable in a scripted run that never performs a real user gesture.
const interestingWarnings = [...new Set(warnings)].filter(w => !/DevTools|Deprecat|ReadPixels|AudioContext/i.test(w));
console.log(`=== warnings: ${interestingWarnings.length} ===`);
if (interestingWarnings.length) console.log(interestingWarnings.map(w => '  - ' + w.slice(0, 220)).join('\n'));

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, errors, warnings }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);

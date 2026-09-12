/**
 * Touch / mobile test — emulates a phone, then plays with the on-screen
 * controls only: virtual stick to move, USE buttons to cast, ATTACK to hit.
 *
 * Usage: node tools/touch-test.mjs
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { inflate } from '@sparticuz/chromium';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const URL = 'http://localhost:8080/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
await page.setViewport({ width: 420, height: 780, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
// force the game's touch detection (matchMedia + ontouchstart)
await page.evaluateOnNewDocument(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.includes('hover: none') ? { matches: true, addEventListener() {}, addListener() {} } : real(q));
  window.ontouchstart = null;
});

const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: 'networkidle2' });
await sleep(4000);
await page.evaluate(() => window.FB.Settings.applyPreset('Low'));
await page.click('#btnPlay');
await sleep(3000);

let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};
const tap = async (sel) => {
  const el = await page.$(sel);
  const b = await el.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};

const ui = await page.evaluate(() => ({
  touchClass: document.body.classList.contains('touch'),
  useVisible: [...document.querySelectorAll('.skill .use')].filter((x) => getComputedStyle(x).display !== 'none').length,
  keysHidden: [...document.querySelectorAll('.skill .key')].filter((x) => getComputedStyle(x).display !== 'none').length,
  attackVisible: (() => {
    const b = document.querySelector('.touch-attack');
    return !!b && getComputedStyle(b).display !== 'none';
  })(),
}));
check('touch layout: USE buttons shown, key badges hidden, ATTACK present',
  ui.touchClass && ui.useVisible > 0 && ui.keysHidden === 0 && ui.attackVisible, JSON.stringify(ui));

// the ATTACK button must actually receive the tap (it lives directly in #hud,
// and #hud > * sets pointer-events:none)
const hit = await page.evaluate(() => {
  const b = document.querySelector('.touch-attack').getBoundingClientRect();
  const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  return el ? String(el.className || el.tagName) : 'none';
});
check('ATTACK button is on top (receives taps)', hit.includes('touch-attack'), hit);

// attack
const startHp = await page.evaluate(() => {
  const w = window.FB.world, p = w.player, e = w.enemies[0], a = w.aimPoint;
  let dx = a.x - p.pos.x, dz = a.z - p.pos.z; const l = Math.hypot(dx, dz) || 1;
  e.pos.set(p.pos.x + (dx / l) * 2.6, 0, p.pos.z + (dz / l) * 2.6);
  e.mesh.position.copy(e.pos);
  window.__e = e;
  const o = p.m1.bind(p);
  window.__m1 = 0;
  p.m1 = function () { const r = o(); if (r) window.__m1++; return r; };
  return Math.round(e.hp);
});
for (let i = 0; i < 5; i++) { await tap('.touch-attack'); await sleep(350); }
const atk = await page.evaluate(() => ({ fired: window.__m1, hp: Math.round(window.__e.hp) }));
check('ATTACK button lands hits', atk.fired > 0 && atk.hp < startHp, `m1 x${atk.fired}, hp ${startHp} -> ${atk.hp}`);

// cast from a USE button
await page.evaluate(() => window.FB.world.player.cd.clear());
await tap('.skill .use');
await sleep(700);
const cds = await page.evaluate(() => [...window.FB.world.player.cd.keys()].length);
check('USE button casts', cds > 0, `${cds} cooldown(s)`);

// virtual stick
const p0 = await page.evaluate(() => [+window.FB.world.player.pos.x.toFixed(1), +window.FB.world.player.pos.z.toFixed(1)]);
await page.touchscreen.touchStart(80, 600);
await page.touchscreen.touchMove(80, 500);
await sleep(1200);
await page.touchscreen.touchEnd();
const p1 = await page.evaluate(() => [+window.FB.world.player.pos.x.toFixed(1), +window.FB.world.player.pos.z.toFixed(1)]);
check('virtual stick moves the player', p0[0] !== p1[0] || p0[1] !== p1[1], `${JSON.stringify(p0)} -> ${JSON.stringify(p1)}`);

if (errs.length) { failures++; console.log(`FAIL  console clean — ${[...new Set(errs)].slice(0, 3).join(' | ')}`); }
await browser.close();
console.log(failures ? `\nFAIL — ${failures} check(s)` : '\nPASS — touch controls work');
process.exit(failures ? 1 : 0);

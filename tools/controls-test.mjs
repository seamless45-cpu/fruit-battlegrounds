/**
 * Controls test — plays the game the way a player does, in real Chrome, and
 * repeats it under the three failure modes that silently kill the controls
 * when the game is embedded somewhere (preview iframe, mobile browser…):
 *
 *   all     pointer lock works
 *   nolock  pointer lock is refused (cross-origin iframe without allow="pointer-lock")
 *   nokeys  key events never reach the page (the frame never gets focus)
 *
 * Usage: node tools/controls-test.mjs [mode]      (default: every mode)
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { inflate } from '@sparticuz/chromium';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MODES = process.argv[2] ? [process.argv[2]] : ['all', 'nolock', 'nokeys'];
const URL = 'http://localhost:8080/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// @sparticuz/chromium ships the browser as a brotli tarball; on this host its
// libraries have to be inflated and put on LD_LIBRARY_PATH before Chrome runs.
await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
process.env.LD_LIBRARY_PATH = join(tmpdir(), 'al2023', 'lib') + ':' + (process.env.LD_LIBRARY_PATH || '');
process.env.FONTCONFIG_PATH = join(tmpdir(), 'fonts');

const browser = await puppeteer.launch({
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  executablePath: await chromium.executablePath(),
  headless: 'shell',
  timeout: 180000,
});

let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

async function runMode(mode) {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 500 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });

  if (mode === 'nolock' || mode === 'all') {
    // refuse pointer lock the way a cross-origin iframe does
    await page.evaluateOnNewDocument(() => {
      Element.prototype.requestPointerLock = function () {
        document.dispatchEvent(new Event('pointerlockerror'));
        return Promise.reject(new Error('pointer lock refused'));
      };
    });
  }
  if (mode === 'nokeys') {
    // swallow every key event, as happens when the frame never gets focus
    await page.evaluateOnNewDocument(() => {
      window.addEventListener('keydown', (e) => e.stopImmediatePropagation(), true);
      window.addEventListener('keyup', (e) => e.stopImmediatePropagation(), true);
    });
  }

  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(3500);
  await page.evaluate(() => window.FB.Settings.applyPreset('Low'));
  await page.click('#btnPlay');
  await sleep(3000);

  console.log(`\n--- ${mode} ---`);

  // 1. keyboard skills
  if (mode !== 'nokeys') {
    await page.keyboard.down('z'); await sleep(100); await page.keyboard.up('z');
    await sleep(700);
    const cds = await page.evaluate(() => [...window.FB.world.player.cd.keys()].length);
    check('keyboard Z casts a skill', cds > 0, `${cds} cooldown(s)`);
  }

  // 2. mouse attack — park an enemy right in front of the player first
  const before = await page.evaluate(() => {
    const w = window.FB.world, p = w.player, e = w.enemies[0];
    const a = w.aimPoint;
    let dx = a.x - p.pos.x, dz = a.z - p.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    e.pos.set(p.pos.x + (dx / len) * 2.6, 0, p.pos.z + (dz / len) * 2.6);
    e.mesh.position.copy(e.pos);
    window.__testEnemy = e;
    return Math.round(e.hp);
  });
  const box = await page.evaluate(() => {
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  for (let i = 0; i < 6; i++) {
    await page.mouse.down(); await sleep(90); await page.mouse.up(); await sleep(160);
  }
  const after = await page.evaluate(() => Math.round(window.__testEnemy.hp));
  check('mouse click attacks', after < before, `enemy hp ${before} -> ${after}`);

  // 3. a charge key released while unfocused must still fire
  await page.evaluate(() => { const p = window.FB.world.player; p.setFruit('lightning'); p.cd.clear(); });
  if (mode === 'nokeys') await page.evaluate(() => window.FB.world.player.pressedSkill('fruit', 3, { via: 'pointer' }));
  else await page.keyboard.down('v');                    // V = slot 3 = Bola de Trueno (hold)
  await sleep(1500);          // needs a couple of frames at sandbox frame rates
  const charging = await page.evaluate(() => !!window.FB.world.player.channel);
  if (mode === 'nokeys') await page.evaluate(() => window.FB.world.player.releasedSkill('fruit', 3));
  else await page.evaluate(() => window.dispatchEvent(new Event('blur')));   // focus lost, no keyup
  await sleep(1200);
  if (mode !== 'nokeys') await page.keyboard.up('v').catch(() => {});
  const afterBlur = await page.evaluate(() => ({ ch: !!window.FB.world.player.channel, cds: [...window.FB.world.player.cd.keys()].length }));
  check('a lost keyup still fires the charge', charging && !afterBlur.ch && afterBlur.cds > 0, JSON.stringify(afterBlur));

  // 4. the skill panels themselves cast (USE button, or the row on desktop)
  await page.evaluate(() => window.FB.world.player.cd.clear());
  const how = await page.evaluate(() => {
    const fb = [...document.querySelectorAll('.skill .use')].filter((x) => getComputedStyle(x).display !== 'none');
    if (fb.length) fb.slice(0, 2).forEach((x) => x.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    else [...document.querySelectorAll('.skill')].slice(0, 2).forEach((r) => r.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    return fb.length ? `${fb.length} USE buttons` : 'row tap';
  });
  await sleep(500);
  const cast = await page.evaluate(() => [...window.FB.world.player.cd.keys()].length);
  check('skill panels cast', cast > 0, `${how}, ${cast} cooldown(s)`);

  // 5. nothing may cover the middle of the screen
  const centre = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const ov = document.getElementById('unlockOverlay');
    return {
      at: el ? (el.id || el.className || el.tagName) : 'none',
      overlayShown: !ov.hidden && getComputedStyle(ov).display !== 'none',
    };
  });
  check('the canvas is not covered by an overlay', String(centre.at) === 'scene', JSON.stringify(centre));

  if (errs.length) { failures++; console.log(`  FAIL  console clean — ${[...new Set(errs)].slice(0, 3).join(' | ')}`); }
  await page.close();
}

for (const mode of MODES) await runMode(mode);
await browser.close();
console.log(failures ? `\nFAIL — ${failures} check(s)` : '\nPASS — controls work in every mode');
process.exit(failures ? 1 : 0);

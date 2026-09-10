/**
 * Headless smoke test: loads the game, plays a bit, fires every skill and
 * reports console errors / FPS.  Run:  node tools/smoke.js
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:8123/index.html';
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1440,900',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const errors = [];
const logs = [];
page.on('console', m => {
  const t = m.type();
  logs.push(`[${t}] ${m.text()}`);
  if (t === 'error') errors.push(m.text());
});
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + r.failure()?.errorText));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 3500));

// start the game
await page.evaluate(() => document.getElementById('btnPlay')?.click());
await new Promise(r => setTimeout(r, 1500));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

await shot('01-start');

const stats = await page.evaluate(() => ({
  hasFB: !!window.FB,
  enemies: window.FB?.world.enemies.length,
  hp: window.FB?.world.player.hp,
  gl: (() => { try { return window.FB.engine.renderer.getContext().getParameter(0x1F01); } catch (e) { return 'n/a'; } })(),
}));
console.log('stats', stats);

// ---- fire every fruit skill for each fruit, and every weapon skill ----
const combos = [
  ['gravity', 'gravityblade'],
  ['lightning', 'pole'],
  ['quake', 'bisento'],
];

for (const [fruit, weapon] of combos) {
  await page.evaluate((f, w) => {
    const p = window.FB.world.player;
    p.setFruit(f); p.setWeapon(w);
    window.FB.ui.skillbar.rebuild();
  }, fruit, weapon);
  await new Promise(r => setTimeout(r, 400));

  const counts = await page.evaluate(() => ({
    fruit: window.FB.world.player.fruitSkills.length,
    weapon: window.FB.world.player.weaponSkills.length,
  }));

  for (let i = 0; i < counts.fruit; i++) {
    await page.evaluate((i) => {
      const p = window.FB.world.player;
      p.cd.clear();
      p.pressedSkill('fruit', i);
    }, i);
    await new Promise(r => setTimeout(r, 700));
    await shot(`fruit-${fruit}-${i}`);
    await page.evaluate((i) => window.FB.world.player.releasedSkill('fruit', i), i);
    await new Promise(r => setTimeout(r, 600));
    await shot(`fruit-${fruit}-${i}-release`);
  }
  for (let i = 0; i < counts.weapon; i++) {
    await page.evaluate((i) => {
      const p = window.FB.world.player;
      p.cd.clear();
      p.pressedSkill('weapon', i);
    }, i);
    await new Promise(r => setTimeout(r, 900));
    await shot(`weapon-${weapon}-${i}`);
    await page.evaluate((i) => window.FB.world.player.releasedSkill('weapon', i), i);
    await new Promise(r => setTimeout(r, 700));
  }
  // M1 spam
  await page.evaluate(() => { for (let i = 0; i < 12; i++) { window.FB.world.player.m1Timer = 0; window.FB.world.player.m1(); } });
  await new Promise(r => setTimeout(r, 600));
  await shot(`m1-${weapon}`);
}

// stress: everything at once
await page.evaluate(() => {
  const p = window.FB.world.player;
  p.setFruit('gravity'); p.setWeapon('gravityblade');
  p.cd.clear();
  for (let i = 0; i < 6; i++) p.pressedSkill('fruit', i);
  for (let i = 0; i < 4; i++) p.pressedSkill('weapon', i);
  p.charge = 100;
  p.tokens = 100000;
});
await new Promise(r => setTimeout(r, 2500));
await shot('02-stress');

const perf = await page.evaluate(async () => {
  let frames = 0;
  const t0 = performance.now();
  await new Promise(res => {
    const tick = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(); };
    requestAnimationFrame(tick);
  });
  return { fps: frames / ((performance.now() - t0) / 1000), drawCalls: window.FB.engine.renderer.info.render.calls, tris: window.FB.engine.renderer.info.render.triangles };
});
console.log('perf', perf);

// settings panel screenshot
await page.evaluate(() => window.FB.ui.settings.open());
await new Promise(r => setTimeout(r, 400));
await shot('03-settings');
await page.evaluate(() => { window.FB.ui.settings.close(); window.FB.ui.toggleHelp(true); });
await new Promise(r => setTimeout(r, 300));
await shot('04-help');
await page.evaluate(() => window.FB.ui.toggleHelp(false));

// inventory weapon tab
await page.evaluate(() => {
  document.querySelector('[data-tab="sword"]').click();
});
await new Promise(r => setTimeout(r, 300));
await shot('05-inventory-sword');

console.log('\n=== ERRORS (' + errors.length + ') ===');
errors.slice(0, 40).forEach(e => console.log(' -', e));
fs.writeFileSync('/tmp/shots/console.log', logs.join('\n'));

await browser.close();
process.exit(errors.length ? 1 : 0);

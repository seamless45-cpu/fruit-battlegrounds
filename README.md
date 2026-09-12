# fruit-battlegrounds

Welcome to Fruit Battlegrounds, a fast-paced PvP arena where powerful fruits grant incredible abilities and every battle is a chance to grow stronger. Fight against players from around the world, unlock devastating abilities, discover powerful fruits, and level up to become the strongest warrior possible.

🏆 **BECOME THE STRONGEST**
Battle skilled opponents, unlock stronger abilities, hunt for fruits across the islands, and continue growing stronger with every level. Master Gravity, Lightning, and Quake, develop powerful combos, and climb your way toward Level 100,000.

🛡️ **ANTI-EXPLOIT SYSTEM**
Fair gameplay is a top priority. Fruit Battlegrounds includes multiple anti-exploit systems designed to keep battles competitive and enjoyable.

- Automatic detection of suspicious movement and teleport exploits
- Protection against speed, fly, and noclip exploits
- Invalid damage and combat manipulation detection
- Auto-kick and auto-ban systems for severe violations
- Regular security updates to patch newly discovered exploits
- Server-side validation to reduce exploit abuse
- Reporting system for players who break the rules

Players who attempt to exploit the game risk losing access to their accounts. Train your skills, master your fruit, and earn your victories through fair gameplay.

The battlegrounds await. Which fruit will you master on your journey to becoming the strongest fighter alive?

---

## The build: a playable 3D Fruit Battlegrounds

This repository is a **full 3D browser implementation** of the arena brawler described above — third-person combat, three fruits with six skills each, three swords, physical debris explosions, jagged lightning, tsunamis, fire pits, kill-token upgrades and an advanced graphics menu.

Runs in the browser with **no build step** — Three.js is vendored in `vendor/` and wired through an import map.

```bash
npm start          # serve on http://localhost:8080  (any static server works)
# or
npx serve .
```

Then click **PLAY**. (Chrome/Edge/Firefox with WebGL2.)

---

## Controls

| Action | PC | Touch |
| --- | --- | --- |
| Move | `W A S D` | left-half virtual stick |
| Look / aim | mouse — pointer lock is used when the browser allows it and is never required | right-half drag |
| Sprint / Jump | `Shift` / `Space` | — |
| Weapon M1 combo | `Left Mouse` (or `J`) | **ATTACK** button |
| Fruit skills | `Z` `X` `C` `V` `B` `F` (or the **USE** button / click the row) | **USE** button on each row |
| Sword skills | `1` `2` `3` `4` (or the **USE** button / click the row) | **USE** button on each row |
| Charge a skill | hold the key | hold **USE** |
| Graphics settings | `O` | ⚙ |
| Controls panel | `H` | ? |
| Release mouse | `Esc` | — |

---

## Combat catalogue

### 🟣 Gravity fruit — purple (`#a855f7`)

| Key | Skill | Behaviour |
| --- | --- | --- |
| `Z` | **Asteroid** | Giant asteroid slams onto the cursor, explodes at 25 m and leaves a fire pit as large as the blast for 10 s dealing 3 % tick damage. CD 2 s. |
| `X` | **Gravitational Pressure** | Every enemy is sucked into the middle of the arena and detonated. +2 % damage **and** radius per enemy sucked, capped at +60 %. CD 4 s. |
| `C` | **Gravitational Lightning** | A purple ring-stacked pillar erupts and fires **8 bursts** of overlapped bolts at enemies within **17 m**; burst interval **0.25 s**; each burst has a **12 %** chance to drop **1–5** small meteors nearby. CD 6.5 s. |
| `V` | **Hiauna** | Enemies within **29 m** turn into giant rocks, rise for **1.5 s**, then slam down at high speed and explode at **22 m** (individual slam interval **0.2 s**). With no enemies detected, **4** healing lightning bursts strike instead (interval **0.5 s**). CD 8 s. |
| `B` | **Asteroid Rain** | **8** giant asteroids at random positions, drop interval **0.3 s**, 25 m explosions, 10 s fire pits dealing 5 % tick damage. CD 10 s. |
| `F` | **Gravitational Punch** | Pulls enemies in, then a charged punch knocks them **10 m** and calls **4 bursts** of overlapped lightning as they land (interval **0.5 s**) with intense camera shake. CD 10 s. |

### ⚡ Lightning fruit — neon blue (`#38bdf8`)

| Key | Skill | Behaviour |
| --- | --- | --- |
| `Z` | **Bestia Relámpago** | A beast of lightning that auto-aims and explodes on impact (3 m). Launch speed 20 m/s. CD 5 s. |
| `X` | **Tormenta** | **17** showers of overlapped bolts on random areas (4.5 m blast each), strike interval **0.22 s**. CD 8 s. |
| `C` | **Juicio Celestial** | Numerous overlapping bolts on one spot (7 m) — enemies hit are lifted and stunned for **3 s**. CD 12 s. |
| `V` | **Destrucción de Bola de Trueno** | *Hold*: thunderclouds grow a black ball, **+3 % per 0.05 s**, max **120 %**. Release: it crashes onto the cursor at **50 m/s** and the blast keeps expanding at **15 m/s** for **5 s**. CD 20 s. |
| `B` | **Destello Eléctrico** | Lightning dash, **10 m** at **240 m/s**, damages what you pass through. **3** charges, **+1 per 3 s**, dash interval **0.2 s**. CD 1 s. |
| `F` | **Más Allá del Trueno** | **120** thunderclouds hammer random areas with **16 m** blasts, stun **3 s**, strike interval **0.1 s**. CD 30 s. |

### 💥 Quake fruit — cracks reuse the neon-blue lightning material

| Key | Skill | Behaviour |
| --- | --- | --- |
| `Z` | **Fatal Destruction** | Grabs an enemy in front; the screen **pauses** and shifts red, then deeper red for **1 s** before a huge quake punch with massive knockback. Nothing happens if the grab misses. CD 5 s. |
| `X` | **Air Crusher** | Large forward quake orb, stuns **2 s**; cracks tear out of the caster's hand as it is thrown. CD 7 s. |
| `C` | **Spatial Shockwave** | Ground smash: white semi-transparent expanding shockwave, cracks on the ground, debris blocks around **and at both arms**; stuns **5 s**, knocks back **10 m**. CD 7 s. |
| `V` | **Seaquake** | Ground expands **3 times** with cracks, then **4** tsunamis crash in from all four sides and pass straight through the player, **25 %** damage each — with a **10 %** chance of **8** tsunamis at **12.5 %** each. CD 14.5 s. |

### 🗡 Gravity Blade (sword)

- **M1** — 0.2 s CD; every **4th** slash spawns **1–12** lightning bolts in one area near the sword; **0.4 s** end-lag on the finisher.
- **1 Superforce Lightning Gravitational of Force** (CD 3 s) — the blade glows for **1 s**, then a strike whose roar carries up to **22 km**. Damage scales with the roar's range, and the roar shakes the camera for a duration derived from that range (intensity scales too). Blinded enemies wander and cannot attack for **10 s**. Charge rises **+10 %** per kill (damage also builds it) and each strike consumes **10 %**; at **max charge** there is a **30 %** chance of **×20** damage, while at **0 % charge** the strike is weakest but the cooldown runs **2.5× faster**.
- **2 343g** (CD 5 s) — a rain of small meteors at high speed, spawn interval **0.06 s**.
- **3 Pilmae** (CD 7 s) — **72** boulders erupt inside a square AoE over **1.2 s**, then slam down one by one every **0.06 s** for **8 m** explosions. The area follows the player instead of being fixed.
- **4 Death Gravity Slashes** (CD 3 s) — **20** diagonal curved slashes that auto-aim at distinct enemies and always crit (**+25000 %** crit damage), exploding to stun, calling lightning and burning for **27 %** of the slash damage over **10 s**. Normal slashes travel **186 m/s**; the enhanced version travels **372 m/s**.

  Upgrade chances: **Lv1 15 % → Lv2 21 % → Lv3 30 % → Lv4 48 % → Lv5 72 %** for an explosion **2500 % bigger**, **200 %** more intense camera shake, **2×** travel speed and **2500 %** more damage. **Lv5** also grants **CD −24 %**, **+10 slashes** and **+×120** crit damage.
  Upgrades cost **1 000 kill tokens**, rising **+75 %** each purchase; past Lv 5 each purchase adds **+10 %** to the buffs up to **+100 %**. Kills drop **10–100** tokens, wallet caps at **1 000 000**.

### 🥢 Pole (sword)

- **M1** — 3-hit combo with **0.1 s** interval and no end-lag; reaching the **4th** hit strikes a small lightning bolt.
- **1 Asalto Atronador** (CD 3 s) — a cloud flies forward and detonates after **1 s** (2 m).
- **2 Juicio Continuo** (CD 10 s, hold) — continuous overlapping lightning at the cursor: costs **1 % HP/s**, gains **+5 %** radius per second up to **+50 %**, drags enemies within **9 m** into the AoE, and stops if health drops to **50 %**.

### 🔱 Bisento (sword)

- **1 Quake Slam** (CD 2 s) — shockwave + cracks, **2.5 s** stun, huge knockback.
- **2 Quake Ball** (CD 3 s) — small quake orbs that explode on contact.
- **3 Mini Seaquake** (CD 5 s) — two small tsunamis from both sides sweeping through the player.

---

## Interface

**Skill panels (middle right, compact, closable).** Each row is `USE | icon | name | cooldown track | seconds`.
- The **USE** button sits on the **left** of every row and is the control on **mobile/tablets**; on **PC** it is replaced by the key badge (`Z X C V B F` for fruits, `1–4` for swords).
- The cooldown is a **100 → 0 wash across the entire bar** that drains over the real cooldown, and the number is always the **actual seconds remaining** (`6.5` … `0.0`), never a 0–100 counter.
- Hold-to-charge skills show a **HOLD** tag plus a channel bar; the Gravity Blade shows a **SUPERFORCE CHARGE** meter.
- Either panel can be closed with **×** and restored from the little **FRUIT ▸ / SWORD ▸** tabs.

**Inventory (bottom, square horizontal slots).** Fruit and sword are **separate slots** — equip one of each, click an equipped slot (or the **NONE** slot) to unequip. Tabs switch between the fruit row and the sword row.

**Advanced graphics settings (`O`).** Presets Low → Ultra plus granular control of render scale, FPS cap, exposure, bloom (strength / radius / threshold), FXAA, shadow resolution and distance, particle quality, debris amount, lightning detail, max simultaneous bolts, ground decals, camera-shake intensity, damage numbers, camera distance, mouse sensitivity and SFX volume. Everything is saved to `localStorage` and applied live.

**Adaptive performance.** Shadow maps redraw every Nth frame (**Shadow interval**), bloom renders at half resolution, and when **Adaptive** is on the game watches its own median frame time and scales internal resolution plus the particle budget between 55 % and 100 % (`dynamicScale`, a runtime-only value that is never written to your saved settings).

**Controls that always work.** Skills fire from **Z X C V B F** (fruit) and **1–4** (sword), or from the **USE** button / the row itself if no key events ever reach the page (an embedded preview frame often never gets keyboard focus). Attack with the **left mouse button**, the **ATTACK** button on touch, or **J** as a keyboard fallback. Pointer lock is optional, never required: if the browser refuses it — cross-origin iframes do — the game keeps the click-through overlay hidden so it can never block your clicks.

**Camera shake.** Shake is applied as high-frequency random positional offsets on X, Y and Z only. Pitch, yaw and roll are never touched — rotation is set once by `lookAt()` and left completely unchanged, because rotational shake feels disorienting, hurts aiming and target tracking, reduces visual clarity and creates excessive screen motion. (`tools/ui-test.mjs` asserts a rotation delta of ~0 while the position moves.)

---

## Effects

- **Explosions** — expanding noise-displaced fireball, ground shockwave rings, flash light, sparks, smoke, tumbling physical debris that bounces off the arena floor, and a persistent scorch decal.
- **Lightning** — tall vertical jagged bolts built as camera-facing ribbons with recursive branches; purple for Gravity, neon blue for Lightning and quake cracks.
- **Fire pits** — animated procedural fire with per-second tick damage.
- **Cracks / shockwaves / tsunamis** — canvas-generated crack decals, expanding rings, and curling water walls that damage everything they pass over.
- **Screen pause** — Fatal Destruction freezes world time and drives the red → deeper red shift.

Every effect is **pooled**: geometries and materials are created once and reused, so nothing is allocated or — more importantly — disposed mid-fight. Disposing a material drops the last reference to its shader program, which makes three.js delete and then **recompile** it the next time the effect is used; that was the original source of the stutter, so pooled objects are now hidden and recycled instead.

---

## Layout

```
index.html            canvas + HUD markup + import map
style.css             HUD, skill panels, inventory, settings, overlays
vendor/               three.js r186 (module + postprocessing addons)
src/
  main.js             bootstrap, aim ray, input routing, game loop
  core/
    engine.js         renderer + bloom/FXAA/output post stack
    settings.js       graphics schema, presets, persistence
    input.js          keyboard / mouse / pointer lock / touch stick
    cameraRig.js      third-person orbit + POSITION-ONLY camera shake
    world.js          arena, ocean, sky, lighting, waves, timers, slow-mo
    entity.js         health, stun, burn, knockback, lift, petrify, HP bar
    player.js         equipment slots, cooldowns, M1 combos, charges, tokens
    enemy.js          bot AI (chase, orbit, melee, react to every status)
    combat.js         damage routing, radius/cone queries, pull, feedback
    character.js      humanoid rig + sword / pole / bisento meshes
    audio.js          procedural WebAudio SFX (no assets)
  fx/
    index.js          FX manager: explosion, strike, firepit, meteors, slashes…
    lightning.js      jagged bolt ribbons
    particles.js      pooled GPU point sprites (sparks + smoke)
    debris.js         instanced physical chunks
    decals.js         scorch, cracks, rings, fire pits
    blasts.js         fireballs + flash lights
    projectiles.js    orbs, meteors, thunder balls, clouds, lightning beast
    tsunami.js        travelling water walls
  skills/
    gravity.js  lightning.js  quake.js  weapons.js  util.js
  data/loadout.js     fruit + weapon catalogue
  ui/
    index.js  hud.js  skillbar.js  inventory.js  settings.js
tools/                test harnesses (see below)
```

---

## Tests

No GPU required for the logic suites:

```bash
npm test              # shaders + full-skill simulation + UI/camera checks
npm run test:skills   # casts every skill of every fruit & weapon, upgrade economy, 30 s idle leak check
npm run test:ui       # jsdom: skill rows, cooldown wash, inventory equip/unequip, settings, POSITION-ONLY shake
npm run test:shaders  # parses every GLSL source with a real GLSL grammar
npm run test:browser  # real Chrome: fires every skill, samples frame times, checks the screen is not blank
npm run test:soak     # real Chrome: 1+ min of continuous combat, fails on any leak or drift
npm run test:controls # real Chrome: plays with keyboard + mouse, touch, refused pointer lock, no keyboard
npm run test:smoke    # puppeteer smoke run + screenshots (needs a local Chrome and a server on :8123)
```

Current status: **15/15 shaders parse, 27/27 skills run clean, 13/13 UI + camera checks pass, controls verified in real Chrome on desktop and touch, 0 console errors.**

### Performance work

Measured in a real (software-rasterised, GPU-less) Chrome:

| | before | after |
|---|---|---|
| geometries during a 5-minute fight | 209 → **1 731** and climbing | flat at **~113** |
| shader programs compiled mid-fight | 7 per storm | **0** |
| JS heap over 80 s of combat | growing | flat at 20.7 MB |

What caused the hitches, and what fixed it:

1. **Shader recompiles.** Materials were disposed every time an effect ended (tsunami waves, gravity pillars, petrified-enemy rocks). Disposal drops the last reference to the GL program, so the next cast recompiled it — a stall on every single skill. All three are now pooled and recycled.
2. **First-use compiles.** three.js only links a shader on its first *draw*, so `renderer.compile()` at load achieved nothing. The game now builds every pool, leaves one of each effect on screen, renders **one real warm-up frame** behind the loading overlay, then clears; a storm of every fruit and weapon skill afterwards compiles zero new programs.
3. **Geometry churn.** Characters, weapons, projectiles and storm clouds each allocated fresh geometries per instance. They now share cached ones (marked `userData.shared` so the disposer skips them).
4. **Per-frame cost.** Partial buffer uploads for bolts and particles, shadow-map throttling, half-res bloom, and a pixel-ratio/particle-budget scaler driven by the median frame time.

Frame cost itself is small — **0.6 ms of JS logic and 4.4 ms of rendering per frame** at 489×308 with no GPU at all — so on real hardware the budget is dominated by the settings you choose, not by the simulation.

---

MIT licensed — see [LICENSE](./LICENSE). Three.js is © the three.js authors (MIT).

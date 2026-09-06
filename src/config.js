// ============================================================
//  Fruit Battlegrounds 3D — Content / Balance Configuration
// ============================================================

// PC keybinds for skills 1..6 (Z X C V B F), M1 = basic attack (click / tap)
export const SKILL_KEYS = ['z', 'x', 'c', 'v', 'b', 'f'];

// ---- Colors ----
export const COLORS = {
  gravity: 0x9b30ff,      // purple
  lightning: 0x39c0ff,    // neon blue
  quake: 0x39c0ff,        // neon blue (reused crack look)
  bladeGrav: 0xb05cff,
  pole: 0x39c0ff,
  bisento: 0xcfd6e6,
};

// ============================================================
//  FRUITS
// ============================================================
export const FRUITS = {
  gravity: {
    id: 'gravity', name: 'Gravity', emoji: '🪐', color: COLORS.gravity,
    blurb: 'Purple gravity powers — pull, slam, and crush.',
    skills: [
      { id: 'g_asteroid',    label: 'Asteroid',      cd: 2,    desc: 'Giant asteroid slams at cursor. 25m blast + firepit 10s.' },
      { id: 'g_pressure',    label: 'Grav Pressure', cd: 4,    desc: 'Suck all enemies to center, then explode (+2%/unit).' },
      { id: 'g_lightning',   label: 'Grav Lightning',cd: 6.5,  desc: 'Purple pillar + 8 lightning bursts (17m).' },
      { id: 'g_hiauna',      label: 'Hiauna',        cd: 8,    desc: 'Petrify nearby, lift & slam. 22m blast. Heals if none.' },
      { id: 'g_rain',        label: 'Asteroid Rain', cd: 10,   desc: '8 asteroids at random spots. 25m blast + firepit.' },
      { id: 'g_punch',       label: 'Grav Punch',    cd: 10,   desc: 'Pull + charged punch, 4 lightning bursts on land.' },
    ],
  },
  lightning: {
    id: 'lightning', name: 'Lightning', emoji: '⚡', color: COLORS.lightning,
    blurb: 'Neon-blue speed and thunder.',
    skills: [
      { id: 'l_bestia',   label: 'Bestia',        cd: 5,  desc: 'Auto-aim lightning beast, 3m blast.' },
      { id: 'l_tormenta', label: 'Tormenta',      cd: 8,  desc: '17 overlapping bolts in random area.' },
      { id: 'l_juicio',   label: 'Juicio',        cd: 12, desc: 'Many bolts, lift+stun 3s (7m).' },
      { id: 'l_destru',   label: 'Destrucción',   cd: 20, desc: 'Charge a black ball, crash & expanding blast.' },
      { id: 'l_destello', label: 'Destello',      cd: 1,  desc: 'Lightning dash, 3 charges.' },
      { id: 'l_masalla',  label: 'Más Allá',      cd: 30, desc: '120 thunderclouds, 16m blasts, stun 3s.' },
    ],
  },
  quake: {
    id: 'quake', name: 'Quake', emoji: '🌊', color: COLORS.quake,
    blurb: 'Tremor, tsunamis and shockwaves.',
    skills: [
      { id: 'q_fatal',   label: 'Fatal Dest.',  cd: 5,    desc: 'Grab > screen reddens > quake punch knockback.' },
      { id: 'q_air',     label: 'Air Crusher',  cd: 7,    desc: 'Forward quake orb, stun 2s.' },
      { id: 'q_spatial', label: 'Spatial Shock',cd: 7,    desc: 'Shockwave + debris, stun 5s, knock 10m.' },
      { id: 'q_sea',     label: 'Seaquake',     cd: 14.5, desc: '3x shock + 4 tsunamis (25% each).' },
    ],
  },
};

export const FRUIT_DEALER = {
  refreshSeconds: 600,
  slots: 3,
  prices: { gravity: 2400, lightning: 1800, quake: 1400 },
};
export const FRUIT_SPAWNS = { intervalSeconds: 1800, lifetimeSeconds: 900, maxActive: 3 };

// ============================================================
//  SWORDS
// ============================================================
export const SWORDS = {
  gravityblade: {
    id: 'gravityblade', name: 'Gravity Blade', emoji: '🗡️', color: COLORS.bladeGrav, isSword: true,
    blurb: 'Charged lightning greatsword.',
    m1: { id: 'gb_m1', label: 'Slash', cd: 0.2, desc: 'Every 4 slashes: 1-12 bolts near sword. 0.4s end-lag.' },
    skills: [
      { id: 'gb_super',  label: 'Superforce',  cd: 3,   desc: 'Charge lightning, roar dmg by range, blind enemies 10s.' },
      { id: 'gb_343',    label: '343G',        cd: 5,   desc: 'Rain small meteors (0.06s interval).' },
      { id: 'gb_pilmae', label: 'Pilmae',      cd: 7,   desc: '72 rocks erupt then slam (8m). Follows player.' },
      { id: 'gb_death',  label: 'Death Slash', cd: 3,   desc: '20 auto-aim curved slashes, crit, burning. (Upgradable)' },
    ],
  },
  pole: {
    id: 'pole', name: 'Pole', emoji: '🔱', color: COLORS.pole, isSword: true,
    blurb: 'Long reach, lightning-follow.',
    m1: { id: 'p_m1', label: '3-Combo', cd: 0.1, desc: '3-combo slash; combo 4 strikes small bolt. No end-lag.' },
    skills: [
      { id: 'p_asalto', label: 'Asalto',    cd: 3,  desc: 'Cloud forward, explodes after 1s (2m).' },
      { id: 'p_juicio', label: 'Juicio Cont.', cd: 10, desc: 'Hold lightning at cursor, drags enemies, +radius/s.' },
    ],
  },
  bisento: {
    id: 'bisento', name: 'Bisento', emoji: '🔱', color: COLORS.bisento, isSword: true,
    blurb: 'Heavy cleaver, ground smasher.',
    skills: [
      { id: 'bi_slam',  label: 'Quake Slam',  cd: 2, desc: 'Slam: shockwave + debris, stun 2.5s, knockback.' },
      { id: 'bi_ball',  label: 'Quake Ball',  cd: 3, desc: 'Small quake orbs that explode on hit.' },
      { id: 'bi_mini',  label: 'Mini Seaquake', cd: 5, desc: '2 small tsunamis pass through player.' },
    ],
  },
};

// All items for the inventory (kept fruit & sword SEPARATE).
export const INVENTORY_ITEMS = [
  { id: 'gravity',      type: 'fruit', ref: FRUITS.gravity,  emoji: FRUITS.gravity.emoji,  color: COLORS.gravity },
  { id: 'lightning',    type: 'fruit', ref: FRUITS.lightning,emoji: FRUITS.lightning.emoji,color: COLORS.lightning },
  { id: 'quake',        type: 'fruit', ref: FRUITS.quake,    emoji: FRUITS.quake.emoji,    color: COLORS.quake },
  { id: 'gravityblade', type: 'sword', ref: SWORDS.gravityblade, emoji: SWORDS.gravityblade.emoji, color: COLORS.bladeGrav },
  { id: 'pole',         type: 'sword', ref: SWORDS.pole,     emoji: SWORDS.pole.emoji,     color: COLORS.pole },
  { id: 'bisento',      type: 'sword', ref: SWORDS.bisento,  emoji: SWORDS.bisento.emoji,  color: COLORS.bisento },
];

export const PLAYER = { maxHp: 2000, speed: 14, radius: 1.2, maxLevel: 100000 };
export const ENEMY = { maxHp: 500, speed: 6, radius: 1.0, touchDamage: 8, spawnEvery: 1.6, maxAlive: 24 };

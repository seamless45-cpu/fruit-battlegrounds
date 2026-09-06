// ============================================================
//  Fruit Battlegrounds 3D — Content / Balance Configuration
// ============================================================

export const SKILL_KEYS = ['z', 'x', 'c', 'v', 'b', 'f'];

export const COLORS = {
  gravity: 0x9b30ff,
  lightning: 0x39c0ff,
  quake: 0x4aa8ff,
  ice: 0x9fe9ff,
  flame: 0xff6a2e,
  light: 0xfff1a8,
  magma: 0xff3b1a,
  bladeGrav: 0xb05cff,
  pole: 0x39c0ff,
  bisento: 0xcfd6e6,
  cutlass: 0xd4af70,
  katana: 0xe8eefc,
  trident: 0x5ad0c8,
  darkblade: 0x5b2bff,
};

export const FRUITS = {
  gravity: {
    id: 'gravity', name: 'Gravity', emoji: '🪐', color: COLORS.gravity,
    blurb: 'Purple gravity powers — pull, slam, and crush.',
    skills: [
      { id: 'g_asteroid',    label: 'Asteroid',       cd: 2,    desc: 'Giant asteroid slams at cursor. 25m blast + firepit 10s.' },
      { id: 'g_pressure',    label: 'Grav Pressure',  cd: 4,    desc: 'Suck all enemies to center, then explode (+2%/unit).' },
      { id: 'g_lightning',   label: 'Grav Lightning', cd: 6.5,  desc: 'Purple pillar + 8 lightning bursts (17m).' },
      { id: 'g_hiauna',      label: 'Hiauna',         cd: 8,    desc: 'Petrify nearby, lift & slam. 22m blast. Heals if none.' },
      { id: 'g_rain',        label: 'Asteroid Rain',  cd: 10,   desc: '8 asteroids at random spots. 25m blast + firepit.' },
      { id: 'g_punch',       label: 'Grav Punch',     cd: 10,   desc: 'Pull + charged punch, 4 lightning bursts on land.' },
    ],
  },
  lightning: {
    id: 'lightning', name: 'Lightning', emoji: '⚡', color: COLORS.lightning,
    blurb: 'Neon-blue speed and thunder.',
    skills: [
      { id: 'l_bestia',   label: 'Bestia',      cd: 5,  desc: 'Auto-aim lightning beast, 3m blast.' },
      { id: 'l_tormenta', label: 'Tormenta',    cd: 8,  desc: '17 overlapping bolts in random area.' },
      { id: 'l_juicio',   label: 'Juicio',      cd: 12, desc: 'Many bolts, lift+stun 3s (7m).' },
      { id: 'l_destru',   label: 'Destrucción', cd: 20, desc: 'Charge a black ball, crash & expanding blast.' },
      { id: 'l_destello', label: 'Destello',    cd: 1,  desc: 'Lightning dash, 3 charges.' },
      { id: 'l_masalla',  label: 'Más Allá',    cd: 30, desc: '120 thunderclouds, 16m blasts, stun 3s.' },
    ],
  },
  quake: {
    id: 'quake', name: 'Quake', emoji: '🌊', color: COLORS.quake,
    blurb: 'Tremor, tsunamis and shockwaves.',
    skills: [
      { id: 'q_fatal',   label: 'Fatal Dest.',   cd: 5,    desc: 'Grab > screen reddens > quake punch knockback.' },
      { id: 'q_air',     label: 'Air Crusher',   cd: 7,    desc: 'Forward quake orb, stun 2s.' },
      { id: 'q_spatial', label: 'Spatial Shock', cd: 7,    desc: 'Shockwave + debris, stun 5s, knock 10m.' },
      { id: 'q_sea',     label: 'Seaquake',      cd: 14.5, desc: '3x shock + 4 tsunamis (25% each).' },
    ],
  },
  ice: {
    id: 'ice', name: 'Ice', emoji: '❄️', color: COLORS.ice,
    blurb: 'Lock the battlefield in rime and glaciers.',
    skills: [
      { id: 'ice_spear',   label: 'Ice Spear',  cd: 3,  desc: 'Hurl a freezing spear that shatters on impact.' },
      { id: 'ice_age',     label: 'Ice Age',    cd: 8,  desc: 'Flash-freeze everyone nearby.' },
      { id: 'ice_path',    label: 'Shard Path', cd: 6,  desc: 'A line of exploding ice crystals.' },
      { id: 'ice_glacier', label: 'Glacier',    cd: 14, desc: 'Raise a glacier that detonates in a wide freeze.' },
    ],
  },
  flame: {
    id: 'flame', name: 'Flame', emoji: '🔥', color: COLORS.flame,
    blurb: 'Fist of fire — punches, pillars and meteors.',
    skills: [
      { id: 'fl_fist',   label: 'Fire Fist',    cd: 3,  desc: 'A blazing haymaker that ignites the ground.' },
      { id: 'fl_ball',   label: 'Fireball',     cd: 5,  desc: 'Lob a fireball that bursts on contact.' },
      { id: 'fl_pillar', label: 'Flame Pillar', cd: 8,  desc: 'Columns of fire erupt around you.' },
      { id: 'fl_meteor', label: 'Flame Meteor', cd: 12, desc: 'Call a burning meteor onto the cursor.' },
    ],
  },
  light: {
    id: 'light', name: 'Light', emoji: '✨', color: COLORS.light,
    blurb: 'Blinding speed, sacred beams and jewel rain.',
    skills: [
      { id: 'li_kick',   label: 'Light Kick',    cd: 2,  desc: 'Dash-kick at light speed.' },
      { id: 'li_beam',   label: 'Sacred Beam',   cd: 7,  desc: 'A piercing beam of sunlight.' },
      { id: 'li_jewels', label: 'Light Jewels',  cd: 10, desc: 'Rain glittering light shards.' },
      { id: 'li_flash',  label: 'Divine Flash',  cd: 12, desc: 'Blind and burn everything nearby.' },
    ],
  },
  magma: {
    id: 'magma', name: 'Magma', emoji: '🌋', color: COLORS.magma,
    blurb: 'Molten fists, lava pools and volcanic rain.',
    skills: [
      { id: 'mg_fist',    label: 'Magma Fist', cd: 3.5, desc: 'A heavy molten punch with lingering lava.' },
      { id: 'mg_pool',    label: 'Lava Pool',  cd: 7,   desc: 'Open a lava pit at the cursor.' },
      { id: 'mg_volcano', label: 'Volcano',    cd: 11,  desc: 'Erupt a volcano under your feet.' },
      { id: 'mg_rain',    label: 'Magma Rain', cd: 15,  desc: 'Magma bombs fall across the arena.' },
    ],
  },
};

export const FRUIT_DEALER = {
  refreshSeconds: 600,
  slots: 4,
  prices: {
    gravity: 2400, lightning: 1800, quake: 1400,
    ice: 2000, flame: 2200, light: 3000, magma: 2600,
  },
};
export const FRUIT_SPAWNS = { intervalSeconds: 1800, lifetimeSeconds: 900, maxActive: 3 };

export const FIGHTING_STYLES = {
  combat: {
    id: 'combat', name: 'Combat', emoji: '🥊', color: 0xf0b36a, isStyle: true,
    blurb: 'A reliable hand-to-hand fighting style.',
    m1: { id: 'c_m1', label: 'Combat Combo', cd: 0.22, desc: 'A quick close-range four-hit combo.' },
    skills: [],
  },
};

export const SWORDS = {
  gravityblade: {
    id: 'gravityblade', name: 'Gravity Blade', emoji: '🗡️', color: COLORS.bladeGrav, isSword: true,
    blurb: 'Charged lightning greatsword.',
    m1: { id: 'gb_m1', label: 'Slash', cd: 0.2, desc: 'Every 4 slashes: 1-12 bolts near sword. 0.4s end-lag.' },
    skills: [
      { id: 'gb_super',  label: 'Superforce',  cd: 3, desc: 'Charge lightning, roar dmg by range, blind enemies 10s.' },
      { id: 'gb_343',    label: '343G',        cd: 5, desc: 'Rain small meteors (0.06s interval).' },
      { id: 'gb_pilmae', label: 'Pilmae',      cd: 7, desc: 'Rocks erupt then slam. Follows player.' },
      { id: 'gb_death',  label: 'Death Slash', cd: 3, desc: '20 auto-aim curved slashes, crit, burning. (Upgradable)' },
    ],
  },
  pole: {
    id: 'pole', name: 'Pole', emoji: '🔱', color: COLORS.pole, isSword: true,
    blurb: 'Long reach, lightning-follow.',
    m1: { id: 'p_m1', label: '3-Combo', cd: 0.1, desc: '3-combo slash; combo 4 strikes small bolt. No end-lag.' },
    skills: [
      { id: 'p_asalto', label: 'Asalto',       cd: 3,  desc: 'Cloud forward, explodes after 1s (2m).' },
      { id: 'p_juicio', label: 'Juicio Cont.', cd: 10, desc: 'Hold lightning at cursor, drags enemies, +radius/s.' },
    ],
  },
  bisento: {
    id: 'bisento', name: 'Bisento', emoji: '🪓', color: COLORS.bisento, isSword: true,
    blurb: 'Heavy cleaver, ground smasher.',
    m1: { id: 'bi_m1', label: 'Cleave', cd: 0.26, desc: 'Wide heavy chops with a generous hitbox.' },
    skills: [
      { id: 'bi_slam', label: 'Quake Slam',    cd: 2, desc: 'Slam: shockwave + debris, stun 2.5s, knockback.' },
      { id: 'bi_ball', label: 'Quake Ball',    cd: 3, desc: 'Small quake orbs that explode on hit.' },
      { id: 'bi_mini', label: 'Mini Seaquake', cd: 5, desc: '2 small tsunamis pass through player.' },
    ],
  },
  cutlass: {
    id: 'cutlass', name: 'Cutlass', emoji: '⚔️', color: COLORS.cutlass, isSword: true,
    blurb: 'A pirate’s curved slashing blade.',
    m1: { id: 'ct_m1', label: 'Cut', cd: 0.18, desc: 'Swift curved slashes.' },
    skills: [
      { id: 'ct_wave',   label: 'Slash Wave', cd: 3, desc: 'A crescent of steel races forward.' },
      { id: 'ct_flurry', label: 'Flurry',     cd: 6, desc: 'A burst of spinning cuts.' },
    ],
  },
  katana: {
    id: 'katana', name: 'Katana', emoji: '🗾', color: COLORS.katana, isSword: true,
    blurb: 'Iai draws and petal-fast cuts.',
    m1: { id: 'ka_m1', label: 'Draw Cut', cd: 0.16, desc: 'Razor iaido strikes.' },
    skills: [
      { id: 'ka_iai',   label: 'Iai Dash',     cd: 4, desc: 'Blink-cut through everything in a line.' },
      { id: 'ka_petal', label: 'Petal Dance',  cd: 7, desc: 'A ring of slashes around you.' },
      { id: 'ka_storm', label: 'Blade Storm',  cd: 11, desc: 'A whirlwind of cuts that pulls foes in.' },
    ],
  },
  trident: {
    id: 'trident', name: 'Trident', emoji: '🔱', color: COLORS.trident, isSword: true,
    blurb: 'Tidal thrusts and whirlpools.',
    m1: { id: 'tr_m1', label: 'Thrust', cd: 0.2, desc: 'Long-reach pokes.' },
    skills: [
      { id: 'tr_pierce', label: 'Tide Pierce', cd: 3.5, desc: 'A water lance that knocks back.' },
      { id: 'tr_tide',   label: 'Sea Spears',  cd: 7,   desc: 'Three tidal javelins.' },
      { id: 'tr_whirl',  label: 'Whirlpool',   cd: 10,  desc: 'A pulling vortex of water.' },
    ],
  },
  darkblade: {
    id: 'darkblade', name: 'Dark Blade', emoji: '🌑', color: COLORS.darkblade, isSword: true,
    blurb: 'A cursed slab of night-steel.',
    m1: { id: 'dk_m1', label: 'Night Cut', cd: 0.24, desc: 'Heavy dark slashes.' },
    skills: [
      { id: 'dk_slash', label: 'Night Slash', cd: 4,  desc: 'A huge dark crescent.' },
      { id: 'dk_void',  label: 'Void Pull',   cd: 8,  desc: 'Yank enemies into a dark burst.' },
      { id: 'dk_night', label: 'Eclipse',     cd: 14, desc: 'Drown the arena in nightfire.' },
    ],
  },
};

export const SWORD_PRICES = {
  gravityblade: 4500, pole: 900, bisento: 1500,
  cutlass: 700, katana: 1800, trident: 2200, darkblade: 5200,
};

export const BOATS = {
  raft:     { id: 'raft',     name: 'Raft',     emoji: '🛶', price: 400,  speed: 20, color: 0xc4a574, blurb: 'Lashed planks. Gets you there.' },
  dinghy:   { id: 'dinghy',   name: 'Dinghy',   emoji: '⛵', price: 1200, speed: 28, color: 0xd8c8a0, blurb: 'A small sailboat for island hops.' },
  sloop:    { id: 'sloop',    name: 'Sloop',    emoji: '🚤', price: 3600, speed: 38, color: 0x8ab4ff, blurb: 'Fast single-masted runner.' },
  galleon:  { id: 'galleon',  name: 'Galleon',  emoji: '🚢', price: 9000, speed: 50, color: 0xc9a227, blurb: 'A warship. The sea is yours.' },
};

export const INVENTORY_ITEMS = [
  { id: 'combat',       type: 'style', ref: FIGHTING_STYLES.combat, emoji: FIGHTING_STYLES.combat.emoji, color: FIGHTING_STYLES.combat.color },
  { id: 'gravity',      type: 'fruit', ref: FRUITS.gravity,   emoji: FRUITS.gravity.emoji,   color: COLORS.gravity },
  { id: 'lightning',    type: 'fruit', ref: FRUITS.lightning, emoji: FRUITS.lightning.emoji, color: COLORS.lightning },
  { id: 'quake',        type: 'fruit', ref: FRUITS.quake,     emoji: FRUITS.quake.emoji,     color: COLORS.quake },
  { id: 'ice',          type: 'fruit', ref: FRUITS.ice,       emoji: FRUITS.ice.emoji,       color: COLORS.ice },
  { id: 'flame',        type: 'fruit', ref: FRUITS.flame,     emoji: FRUITS.flame.emoji,     color: COLORS.flame },
  { id: 'light',        type: 'fruit', ref: FRUITS.light,     emoji: FRUITS.light.emoji,     color: COLORS.light },
  { id: 'magma',        type: 'fruit', ref: FRUITS.magma,     emoji: FRUITS.magma.emoji,     color: COLORS.magma },
  { id: 'gravityblade', type: 'sword', ref: SWORDS.gravityblade, emoji: SWORDS.gravityblade.emoji, color: COLORS.bladeGrav },
  { id: 'pole',         type: 'sword', ref: SWORDS.pole,     emoji: SWORDS.pole.emoji,     color: COLORS.pole },
  { id: 'bisento',      type: 'sword', ref: SWORDS.bisento,  emoji: SWORDS.bisento.emoji,  color: COLORS.bisento },
  { id: 'cutlass',      type: 'sword', ref: SWORDS.cutlass,  emoji: SWORDS.cutlass.emoji,  color: COLORS.cutlass },
  { id: 'katana',       type: 'sword', ref: SWORDS.katana,   emoji: SWORDS.katana.emoji,   color: COLORS.katana },
  { id: 'trident',      type: 'sword', ref: SWORDS.trident,  emoji: SWORDS.trident.emoji,  color: COLORS.trident },
  { id: 'darkblade',    type: 'sword', ref: SWORDS.darkblade,emoji: SWORDS.darkblade.emoji,color: COLORS.darkblade },
];

export const PLAYER = {
  maxHp: 2000, speed: 14, radius: 1.2, maxLevel: 100000,
  jumpStrength: 16.5, airJumpStrength: 13.5, gravity: 44,
  maxAirJumps: 20, swimSpeed: 5.5, jumpCooldownMs: 130,
};
export const ENEMY = { maxHp: 500, speed: 6, radius: 1.0, touchDamage: 8, spawnEvery: 2.0, maxAlive: 16 };

export const MELEE = {
  combat:        { reach: 6.2, width: 3.6, height: 4.8, dmg: 0.16 },
  gravityblade:  { reach: 8.6, width: 4.2, height: 5.2, dmg: 0.22 },
  pole:          { reach: 9.8, width: 3.0, height: 5.0, dmg: 0.18 },
  bisento:       { reach: 8.4, width: 4.6, height: 5.2, dmg: 0.24 },
  cutlass:       { reach: 7.0, width: 3.8, height: 4.8, dmg: 0.18 },
  katana:        { reach: 7.4, width: 3.4, height: 4.8, dmg: 0.19 },
  trident:       { reach: 9.4, width: 2.8, height: 5.0, dmg: 0.20 },
  darkblade:     { reach: 8.8, width: 4.4, height: 5.2, dmg: 0.24 },
};

export const WORLD = {
  islandRadius: 86,
  oceanRadius: 280,
  dock: { x: 0, z: 90, radius: 14 },
  questNpc: { x: 16, z: 22, radius: 4.2 },
};

export const GIFT_CODES = {
  WELCOME:      { tokens: 1000, xp: 0, message: 'Welcome bounty: 1,000 money.' },
  BERRY:        { tokens: 5000, xp: 0, message: 'Berry crate opened: 5,000 money.' },
  FRUITBATTLES: { tokens: 2000, xp: 150, message: 'Arena stipend: 2,000 money and 150 XP.' },
  SKYHIGH:      { tokens: 400, xp: 80, message: 'Sky-high bonus: 400 money and 80 XP.' },
  DOCKHAND:     { tokens: 0, xp: 0, boat: 'raft', message: 'The shipwright left you a Raft.' },
  LEVELUP:      { tokens: 0, xp: 400, message: 'Training manual: 400 XP.' },
};

export const QUESTS = [
  { id: 'kills5', title: 'First Blood', desc: 'Defeat 5 pirates in the arena.', stat: 'kills', need: 5, reward: { tokens: 400, xp: 80 } },
  { id: 'kills25', title: 'Arena Heat', desc: 'Defeat 25 pirates.', stat: 'kills', need: 25, reward: { tokens: 1800, xp: 320 } },
  { id: 'fruit1', title: 'Fruit Hunt', desc: 'Collect or buy any fruit.', stat: 'fruits', need: 1, reward: { tokens: 700, xp: 120 } },
  { id: 'boat1', title: 'Sea Legs', desc: 'Purchase any boat from the Shipwright.', stat: 'boats', need: 1, reward: { tokens: 900, xp: 150 } },
];

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
  storm: 0x8ec8ff,
  shadow: 0x5b3aa0,
  venom: 0x7dff6a,
  sand: 0xe8c07a,
  string: 0xf2d6ea,
  rubber: 0xff8aa8,
  soul: 0xc9b6ff,
  dragon: 0x3ecf7a,
  magnet: 0xff5a6a,
  phoenix: 0xffb070,
  soulscythe: 0x8a6cff,
  sunspear: 0xffc14a,
  frostfang: 0xa8e8ff,
  thunderdrum: 0xffe066,
  bloomblade: 0xff9ac8,
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
  storm: {
    id: 'storm', name: 'Storm', emoji: '🌪️', color: 0x8ec8ff,
    blurb: 'Gale blades and a climbing tornado.',
    rarity: 'rare',
    skills: [
      { id: 'st_cut',   label: 'Gale Cut',   cd: 3,  desc: 'A slicing wind crescent with knockback.' },
      { id: 'st_burst', label: 'Pressure',   cd: 6,  desc: 'A burst of air that launches foes.' },
      { id: 'st_spin',  label: 'Cyclone',    cd: 9,  desc: 'A pulling tornado that lifts and shreds.' },
      { id: 'st_bolt',  label: 'Sky Spear',  cd: 12, desc: 'A diving wind lance from above.' },
    ],
  },
  shadow: {
    id: 'shadow', name: 'Shadow', emoji: '👤', color: 0x2a1a44,
    blurb: 'Tendrils, blinks and a night bind.',
    rarity: 'epic',
    skills: [
      { id: 'sh_lash',  label: 'Tendril',    cd: 3,  desc: 'A homing shadow lash.' },
      { id: 'sh_step',  label: 'Umbral Step',cd: 5,  desc: 'Blink through enemies and cut them.' },
      { id: 'sh_bind',  label: 'Night Bind', cd: 9,  desc: 'Root everyone nearby in darkness.' },
      { id: 'sh_nova',  label: 'Eclipse',    cd: 14, desc: 'A collapsing dark star.' },
    ],
  },
  venom: {
    id: 'venom', name: 'Venom', emoji: '☠️', color: 0x7dff6a,
    blurb: 'Acid spit, poison clouds and a toxic bloom.',
    rarity: 'rare',
    skills: [
      { id: 'vn_spit',  label: 'Acid Spit',  cd: 3,  desc: 'Arcing venom that burns on impact.' },
      { id: 'vn_cloud', label: 'Miasma',     cd: 7,  desc: 'A lingering poison cloud.' },
      { id: 'vn_fang',  label: 'Fang Rush',  cd: 6,  desc: 'Lunge and inject a heavy toxin.' },
      { id: 'vn_bloom', label: 'Toxic Bloom',cd: 13, desc: 'A wide venom detonation.' },
    ],
  },
  sand: {
    id: 'sand', name: 'Sand', emoji: '🏜️', color: 0xe8c07a,
    blurb: 'Bury, scour and sand-blade the arena.',
    rarity: 'rare',
    skills: [
      { id: 'sd_blade', label: 'Sand Blade', cd: 3,  desc: 'A grinding crescent of grit.' },
      { id: 'sd_bury',  label: 'Bury',       cd: 7,  desc: 'Sink foes into the dune.' },
      { id: 'sd_storm', label: 'Haboob',     cd: 10, desc: 'A blinding sandstorm.' },
      { id: 'sd_tomb',  label: 'Tomb',       cd: 14, desc: 'A collapsing sand pyramid.' },
    ],
  },
  string: {
    id: 'string', name: 'String', emoji: '🧵', color: 0xf2d6ea,
    blurb: 'Bind, snip and marionette the field.',
    rarity: 'epic',
    skills: [
      { id: 'sg_bind',  label: 'Bind',       cd: 4,  desc: 'Threads snap foes toward you.' },
      { id: 'sg_snip',  label: 'Snip',       cd: 3,  desc: 'A razor-thread slash.' },
      { id: 'sg_pup',   label: 'Marionette', cd: 9,  desc: 'Lift and slam on strings.' },
      { id: 'sg_cage',  label: 'Web Cage',   cd: 13, desc: 'A cutting cage of wires.' },
    ],
  },
  rubber: {
    id: 'rubber', name: 'Rubber', emoji: '🫧', color: 0xff8aa8,
    blurb: 'Stretch punches, bounce and gatling fists.',
    rarity: 'rare',
    skills: [
      { id: 'rb_pistol', label: 'Pistol',    cd: 2.5, desc: 'A stretching haymaker.' },
      { id: 'rb_gat',    label: 'Gatling',   cd: 7,   desc: 'A storm of bouncing fists.' },
      { id: 'rb_bounce', label: 'Bounce',    cd: 6,   desc: 'Spring into the air and slam.' },
      { id: 'rb_whip',   label: 'Whip',      cd: 10,  desc: 'A long-range rubber lash.' },
    ],
  },
  soul: {
    id: 'soul', name: 'Soul', emoji: '👻', color: 0xc9b6ff,
    blurb: 'Drain, scream and burst the spirit.',
    rarity: 'legendary',
    skills: [
      { id: 'so_drain',  label: 'Drain',     cd: 4,  desc: 'Siphon health from nearby foes.' },
      { id: 'so_scream', label: 'Wail',      cd: 7,  desc: 'A stunning spirit scream.' },
      { id: 'so_chain',  label: 'Chain',     cd: 9,  desc: 'Soul tethers yank everyone in.' },
      { id: 'so_burst',  label: 'Requiem',   cd: 16, desc: 'A massive spirit detonation.' },
    ],
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉', color: 0x3ecf7a,
    blurb: 'Roar, dive and breathe a river of fire.',
    rarity: 'legendary',
    skills: [
      { id: 'dr_breath', label: 'Breath',    cd: 4,  desc: 'A cone of dragonfire.' },
      { id: 'dr_dash',   label: 'Dive',      cd: 6,  desc: 'A winged dash that burns the line.' },
      { id: 'dr_roar',   label: 'Roar',      cd: 9,  desc: 'A fear-stun shockwave.' },
      { id: 'dr_sky',    label: 'Skyfall',   cd: 15, desc: 'Rain of burning meteors.' },
    ],
  },
  magnet: {
    id: 'magnet', name: 'Magnet', emoji: '🧲', color: 0xff5a6a,
    blurb: 'Polar slam, field crush and iron rain.',
    rarity: 'epic',
    skills: [
      { id: 'ma_pull',  label: 'Attract',    cd: 4,  desc: 'Yank every foe into a crush.' },
      { id: 'ma_push',  label: 'Repel',      cd: 5,  desc: 'A polar blast that knocks back.' },
      { id: 'ma_rail',  label: 'Rail',       cd: 8,  desc: 'A magnetic lance.' },
      { id: 'ma_field', label: 'Field',      cd: 13, desc: 'A growing crush field.' },
    ],
  },
  phoenix: {
    id: 'phoenix', name: 'Phoenix', emoji: '🕊️', color: 0xffb070,
    blurb: 'Healing fire, a diving star and rebirth.',
    rarity: 'legendary',
    skills: [
      { id: 'ph_heal', label: 'Ember Heal',  cd: 6,  desc: 'Blue flames restore you.' },
      { id: 'ph_dive', label: 'Star Dive',   cd: 7,  desc: 'A flaming plunge at the aim.' },
      { id: 'ph_wing', label: 'Wing Burst',  cd: 9,  desc: 'A ring of sacred fire.' },
      { id: 'ph_nova', label: 'Rebirth',     cd: 18, desc: 'Heal and detonate in gold fire.' },
    ],
  },
};

export const FRUIT_DEALER = {
  refreshSeconds: 600,
  slots: 4,
  prices: {
    gravity: 2400, lightning: 1800, quake: 1400,
    ice: 2000, flame: 2200, light: 3000, magma: 2600,
    storm: 1600, shadow: 2800, venom: 1700, sand: 1500, string: 2600,
    rubber: 1900, soul: 3400, dragon: 3600, magnet: 2500, phoenix: 3800,
  },
};
export const FRUIT_SPAWNS = { intervalSeconds: 1800, lifetimeSeconds: 900, maxActive: 3 };

export const FIGHTING_STYLES = {
  combat: {
    id: 'combat', name: 'Combat', emoji: '🥊', color: 0xf0b36a, isStyle: true,
    blurb: 'A reliable hand-to-hand fighting style.',
    rarity: 'common',
    m1: { id: 'c_m1', label: 'Combat Combo', cd: 0.22, desc: 'A quick close-range four-hit combo.' },
    skills: [],
  },
  blackleg: {
    id: 'blackleg', name: 'Black Leg', emoji: '🦵', color: 0x1a1a22, isStyle: true,
    blurb: 'Brutal kicks with a long snap and aerial axe.',
    rarity: 'rare',
    m1: { id: 'bl_m1', label: 'Kick Combo', cd: 0.2, desc: 'Snapping roundhouse chain.' },
    skills: [
      { id: 'bl_dash', label: 'Collier',  cd: 4, desc: 'A dash kick through the line.' },
      { id: 'bl_spin', label: 'Party',    cd: 7, desc: 'A spinning kick storm.' },
      { id: 'bl_axe',  label: 'Axe Kick', cd: 9, desc: 'Leap and slam a crushing heel.' },
    ],
  },
  ironfist: {
    id: 'ironfist', name: 'Iron Fist', emoji: '✊', color: 0xb0b8c8, isStyle: true,
    blurb: 'Heavy punches that crater the ground.',
    rarity: 'rare',
    m1: { id: 'if_m1', label: 'Haymaker', cd: 0.28, desc: 'Slow, brutal hooks.' },
    skills: [
      { id: 'if_blow',    label: 'Impact',  cd: 4, desc: 'A lunge punch with huge knockback.' },
      { id: 'if_barrage', label: 'Barrage', cd: 7, desc: 'A flurry of iron fists.' },
      { id: 'if_upper',   label: 'Upper',   cd: 9, desc: 'Launch everyone nearby.' },
    ],
  },
  electro: {
    id: 'electro', name: 'Electro', emoji: '⚡', color: 0xffe066, isStyle: true,
    blurb: 'Charged strikes that chain lightning.',
    rarity: 'epic',
    m1: { id: 'el_m1', label: 'Spark Jab', cd: 0.18, desc: 'Jabs that snap with current.' },
    skills: [
      { id: 'el_jab',   label: 'Arc',    cd: 3.5, desc: 'A chaining spark punch.' },
      { id: 'el_surge', label: 'Surge',  cd: 7,   desc: 'Electrify the ground around you.' },
      { id: 'el_cage',  label: 'Cage',   cd: 11,  desc: 'A stunning lightning prison.' },
    ],
  },
  fishman: {
    id: 'fishman', name: 'Tide Fist', emoji: '🌊', color: 0x3aa0d8, isStyle: true,
    blurb: 'Water-packed punches that hit like the sea.',
    rarity: 'epic',
    m1: { id: 'fk_m1', label: 'Tide Jab', cd: 0.2, desc: 'Water-packed strikes.' },
    skills: [
      { id: 'fk_pistol', label: 'Water Gun', cd: 3.5, desc: 'A pressurized water lance.' },
      { id: 'fk_tide',   label: 'Karate',    cd: 7,   desc: 'A shockwave through the air itself.' },
      { id: 'fk_shock',  label: 'Sea Quake', cd: 11,  desc: 'A watery uppercut nova.' },
    ],
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
  soulscythe: {
    id: 'soulscythe', name: 'Soul Scythe', emoji: '⚰️', color: COLORS.soulscythe, isSword: true,
    blurb: 'A crescent that harvests spirit.',
    rarity: 'legendary',
    m1: { id: 'ss_m1', label: 'Reap', cd: 0.24, desc: 'Wide harvesting cuts.' },
    skills: [
      { id: 'ss_reap',    label: 'Harvest',  cd: 4,  desc: 'A draining crescent.' },
      { id: 'ss_harvest', label: 'Soul Cut', cd: 8,  desc: 'Pull then reap the cluster.' },
      { id: 'ss_void',    label: 'Grave',    cd: 13, desc: 'A void well under the aim.' },
    ],
  },
  sunspear: {
    id: 'sunspear', name: 'Sun Spear', emoji: '☀️', color: COLORS.sunspear, isSword: true,
    blurb: 'A radiant lance of noon.',
    rarity: 'epic',
    m1: { id: 'su_m1', label: 'Pierce', cd: 0.2, desc: 'Long golden thrusts.' },
    skills: [
      { id: 'su_pierce', label: 'Solar Lance', cd: 3.5, desc: 'A piercing beam of sun.' },
      { id: 'su_solar',  label: 'Flare',       cd: 7,   desc: 'Blind and burn in a cone.' },
      { id: 'su_nova',   label: 'Noon',        cd: 12,  desc: 'A solar nova at the cursor.' },
    ],
  },
  frostfang: {
    id: 'frostfang', name: 'Frost Fang', emoji: '🧊', color: COLORS.frostfang, isSword: true,
    blurb: 'A wolf-tooth of living ice.',
    rarity: 'epic',
    m1: { id: 'ff_m1', label: 'Bite', cd: 0.18, desc: 'Icy snapping cuts.' },
    skills: [
      { id: 'ff_bite',     label: 'Fang',      cd: 3.5, desc: 'A freezing lunge.' },
      { id: 'ff_howl',     label: 'Howl',      cd: 7,   desc: 'A frost shockwave.' },
      { id: 'ff_blizzard', label: 'Blizzard',  cd: 12,  desc: 'A swirling freeze field.' },
    ],
  },
  thunderdrum: {
    id: 'thunderdrum', name: 'Thunder Drum', emoji: '🥁', color: COLORS.thunderdrum, isSword: true,
    blurb: 'A war-hammer that beats the sky.',
    rarity: 'rare',
    m1: { id: 'td_m1', label: 'Beat', cd: 0.3, desc: 'Heavy drumming smashes.' },
    skills: [
      { id: 'td_smash', label: 'Crash',  cd: 4,  desc: 'A ground-shaking smash.' },
      { id: 'td_quake', label: 'Rhythm', cd: 7,  desc: 'Three sequential shockwaves.' },
      { id: 'td_storm', label: 'Skybeat',cd: 12, desc: 'Call thunder onto the beat.' },
    ],
  },
  bloomblade: {
    id: 'bloomblade', name: 'Bloom Blade', emoji: '🌸', color: COLORS.bloomblade, isSword: true,
    blurb: 'Petal-fast cuts that bloom on the wind.',
    rarity: 'rare',
    m1: { id: 'bb_m1', label: 'Petal', cd: 0.16, desc: 'Soft, lethal draws.' },
    skills: [
      { id: 'bb_petal',  label: 'Petal Cut', cd: 3.5, desc: 'A fan of blooming slashes.' },
      { id: 'bb_garden', label: 'Garden',    cd: 8,   desc: 'A ring of exploding blossoms.' },
      { id: 'bb_sakura', label: 'Sakura',    cd: 12,  desc: 'A storm of cutting petals.' },
    ],
  },
};

export const SWORD_PRICES = {
  gravityblade: 4500, pole: 900, bisento: 1500,
  cutlass: 700, katana: 1800, trident: 2200, darkblade: 5200,
  soulscythe: 6400, sunspear: 3100, frostfang: 2800, thunderdrum: 2100, bloomblade: 2400,
};

export const STYLE_PRICES = {
  blackleg: 1400, ironfist: 1600, electro: 2400, fishman: 2600,
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
  { id: 'storm',        type: 'fruit', ref: FRUITS.storm,     emoji: FRUITS.storm.emoji,     color: COLORS.storm },
  { id: 'shadow',       type: 'fruit', ref: FRUITS.shadow,    emoji: FRUITS.shadow.emoji,    color: COLORS.shadow },
  { id: 'venom',        type: 'fruit', ref: FRUITS.venom,     emoji: FRUITS.venom.emoji,     color: COLORS.venom },
  { id: 'sand',         type: 'fruit', ref: FRUITS.sand,      emoji: FRUITS.sand.emoji,      color: COLORS.sand },
  { id: 'string',       type: 'fruit', ref: FRUITS.string,    emoji: FRUITS.string.emoji,    color: COLORS.string },
  { id: 'rubber',       type: 'fruit', ref: FRUITS.rubber,    emoji: FRUITS.rubber.emoji,    color: COLORS.rubber },
  { id: 'soul',         type: 'fruit', ref: FRUITS.soul,      emoji: FRUITS.soul.emoji,      color: COLORS.soul },
  { id: 'dragon',       type: 'fruit', ref: FRUITS.dragon,    emoji: FRUITS.dragon.emoji,    color: COLORS.dragon },
  { id: 'magnet',       type: 'fruit', ref: FRUITS.magnet,    emoji: FRUITS.magnet.emoji,    color: COLORS.magnet },
  { id: 'phoenix',      type: 'fruit', ref: FRUITS.phoenix,   emoji: FRUITS.phoenix.emoji,   color: COLORS.phoenix },
  { id: 'soulscythe',   type: 'sword', ref: SWORDS.soulscythe, emoji: SWORDS.soulscythe.emoji, color: COLORS.soulscythe },
  { id: 'sunspear',     type: 'sword', ref: SWORDS.sunspear,   emoji: SWORDS.sunspear.emoji,   color: COLORS.sunspear },
  { id: 'frostfang',    type: 'sword', ref: SWORDS.frostfang,  emoji: SWORDS.frostfang.emoji,  color: COLORS.frostfang },
  { id: 'thunderdrum',  type: 'sword', ref: SWORDS.thunderdrum,emoji: SWORDS.thunderdrum.emoji,color: COLORS.thunderdrum },
  { id: 'bloomblade',   type: 'sword', ref: SWORDS.bloomblade, emoji: SWORDS.bloomblade.emoji, color: COLORS.bloomblade },
  { id: 'blackleg',     type: 'style', ref: FIGHTING_STYLES.blackleg, emoji: FIGHTING_STYLES.blackleg.emoji, color: FIGHTING_STYLES.blackleg.color },
  { id: 'ironfist',     type: 'style', ref: FIGHTING_STYLES.ironfist, emoji: FIGHTING_STYLES.ironfist.emoji, color: FIGHTING_STYLES.ironfist.color },
  { id: 'electro',      type: 'style', ref: FIGHTING_STYLES.electro,  emoji: FIGHTING_STYLES.electro.emoji,  color: FIGHTING_STYLES.electro.color },
  { id: 'fishman',      type: 'style', ref: FIGHTING_STYLES.fishman,  emoji: FIGHTING_STYLES.fishman.emoji,  color: FIGHTING_STYLES.fishman.color },
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
  blackleg:      { reach: 7.4, width: 3.4, height: 5.0, dmg: 0.20 },
  ironfist:      { reach: 6.0, width: 3.8, height: 4.8, dmg: 0.26 },
  electro:       { reach: 6.6, width: 3.5, height: 4.8, dmg: 0.18 },
  fishman:       { reach: 7.0, width: 3.8, height: 4.8, dmg: 0.21 },
  soulscythe:    { reach: 9.2, width: 4.8, height: 5.2, dmg: 0.23 },
  sunspear:      { reach: 9.6, width: 2.6, height: 5.0, dmg: 0.20 },
  frostfang:     { reach: 7.2, width: 3.6, height: 4.8, dmg: 0.19 },
  thunderdrum:   { reach: 6.4, width: 4.4, height: 5.0, dmg: 0.27 },
  bloomblade:    { reach: 7.6, width: 3.4, height: 4.8, dmg: 0.18 },
};

export const GACHA = {
  cost: 800,
  tenCost: 7200,
  legendaryPity: 75,
  epicPity: 12,
  softPityStart: 50,
  rates: { common: 0.55, rare: 0.27, epic: 0.13, legendary: 0.05 },
  dupeRefund: { common: 0.35, rare: 0.5, epic: 0.7, legendary: 0.92 },
};

const FALLBACK_RARITY = {
  gravity: 'epic', lightning: 'rare', quake: 'rare', ice: 'rare', flame: 'rare', light: 'legendary', magma: 'epic',
  gravityblade: 'legendary', pole: 'common', bisento: 'rare', cutlass: 'common', katana: 'rare', trident: 'epic', darkblade: 'legendary',
};

export const GACHA_POOL = INVENTORY_ITEMS
  .filter((i) => i.id !== 'combat')
  .map((i) => ({ ...i, rarity: i.ref.rarity || FALLBACK_RARITY[i.id] || 'rare' }));

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

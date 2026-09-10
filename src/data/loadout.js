/**
 * Loadout catalogue — fruits and weapons are separate equipment slots.
 */
import { GRAVITY } from '../skills/gravity.js';
import { LIGHTNING } from '../skills/lightning.js';
import { QUAKE } from '../skills/quake.js';
import { GRAVITY_BLADE, POLE, BISENTO } from '../skills/weapons.js';

export const FRUITS = {
  gravity: GRAVITY,
  lightning: LIGHTNING,
  quake: QUAKE,
};

export const WEAPONS = {
  gravityblade: GRAVITY_BLADE,
  pole: POLE,
  bisento: BISENTO,
};

export const FRUIT_COLORS = {
  gravity: 0xa855f7,   // purple
  lightning: 0x38bdf8, // neon blue
  quake: 0xcbd5e1,
};

/** PC keyboard mapping for fruit skills (mobile/tablet uses the USE button). */
export const FRUIT_KEYS = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyF'];
export const FRUIT_KEY_LABELS = ['Z', 'X', 'C', 'V', 'B', 'F'];
export const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
export const WEAPON_KEY_LABELS = ['1', '2', '3', '4'];

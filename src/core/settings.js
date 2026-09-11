/**
 * Advanced Graphics Settings
 * -----------------------------------------------------------------------------
 * Single source of truth for every graphics knob. The settings panel UI is
 * generated from SCHEMA so adding a new option is a one-line change.
 * Values are persisted in localStorage.
 */

const KEY = 'fruitbg.settings.v1';

export const DEFAULTS = {
  preset: 'High',

  // ---- display ----
  resolutionScale: 1.0,   // render scale multiplier
  fpsCap: 0,              // 0 = uncapped
  showFPS: true,
  exposure: 1.05,

  // ---- post processing ----
  bloom: true,
  bloomStrength: 0.95,
  bloomRadius: 0.55,
  bloomThreshold: 0.72,
  fxaa: true,

  // ---- lighting / shadows ----
  shadows: true,
  shadowQuality: 2048,
  shadowDistance: 160,
  shadowInterval: 2,      // re-render the shadow map every Nth frame

  // ---- effects ----
  particleQuality: 1.0,   // multiplies every particle / debris budget
  debris: true,
  debrisScale: 1.0,
  lightningQuality: 1.0,  // segments + branch count multiplier
  maxBolts: 90,
  decals: true,
  decalFade: 1.0,
  screenShake: 1.0,
  damageNumbers: true,
  motionBlur: false,

  // ---- camera / input ----
  cameraDistance: 13,
  mouseSensitivity: 1.0,
  invertY: false,

  // ---- adaptive performance ----
  adaptive: true,         // auto-drop render scale when frames get long
  dynamicScale: 1,        // runtime multiplier (never persisted as a user choice)

  // ---- audio ----
  sfx: true,
  sfxVolume: 0.6,
};

export const PRESETS = {
  Low: {
    resolutionScale: 0.7, fxaa: false, bloom: true, bloomStrength: 0.7, bloomRadius: 0.35, bloomThreshold: 0.8,
    shadows: false, shadowQuality: 512, shadowDistance: 70, shadowInterval: 3,
    particleQuality: 0.35, debris: true, debrisScale: 0.3, lightningQuality: 0.55, maxBolts: 34,
    decals: true, exposure: 1.05, motionBlur: false,
  },
  Medium: {
    resolutionScale: 0.85, fxaa: true, bloom: true, bloomStrength: 0.85, bloomRadius: 0.45, bloomThreshold: 0.75,
    shadows: true, shadowQuality: 1024, shadowDistance: 110, shadowInterval: 2,
    particleQuality: 0.7, debris: true, debrisScale: 0.7, lightningQuality: 0.8, maxBolts: 60,
    decals: true, exposure: 1.05, motionBlur: false,
  },
  High: {
    resolutionScale: 1.0, fxaa: true, bloom: true, bloomStrength: 0.95, bloomRadius: 0.55, bloomThreshold: 0.72,
    shadows: true, shadowQuality: 2048, shadowDistance: 160, shadowInterval: 2,
    particleQuality: 1.0, debris: true, debrisScale: 1.0, lightningQuality: 1.0, maxBolts: 90,
    decals: true, exposure: 1.05, motionBlur: false,
  },
  Ultra: {
    resolutionScale: 1.0, fxaa: true, bloom: true, bloomStrength: 1.15, bloomRadius: 0.7, bloomThreshold: 0.62,
    shadows: true, shadowQuality: 4096, shadowDistance: 260, shadowInterval: 1,
    particleQuality: 1.6, debris: true, debrisScale: 1.6, lightningQuality: 1.5, maxBolts: 150,
    decals: true, exposure: 1.1, motionBlur: false,
  },
};

/** UI schema: { key, label, sub, type:'toggle'|'range'|'select', min,max,step, options, group, affects } */
export const SCHEMA = [
  { group: 'Display' },
  { key: 'resolutionScale', label: 'Render Scale', sub: 'Lower = faster, blurrier', type: 'range', min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { key: 'fpsCap', label: 'FPS Limit', type: 'select', options: [['0', 'Uncapped'], ['30', '30'], ['60', '60'], ['120', '120'], ['144', '144']] },
  { key: 'exposure', label: 'Exposure', sub: 'Tone mapping brightness', type: 'range', min: 0.4, max: 2, step: 0.05 },
  { key: 'showFPS', label: 'Show FPS counter', type: 'toggle' },

  { group: 'Post Processing' },
  { key: 'bloom', label: 'Bloom glow', sub: 'Lightning / explosion glow', type: 'toggle' },
  { key: 'bloomStrength', label: 'Bloom strength', type: 'range', min: 0, max: 3, step: 0.05 },
  { key: 'bloomRadius', label: 'Bloom radius', type: 'range', min: 0, max: 1.5, step: 0.05 },
  { key: 'bloomThreshold', label: 'Bloom threshold', sub: 'Brightness needed to glow', type: 'range', min: 0, max: 1, step: 0.02 },
  { key: 'fxaa', label: 'Anti-aliasing (FXAA)', type: 'toggle' },

  { group: 'Lighting & Shadows' },
  { key: 'shadows', label: 'Shadows', type: 'toggle' },
  { key: 'shadowQuality', label: 'Shadow resolution', type: 'select', options: [['512', '512'], ['1024', '1024'], ['2048', '2048'], ['4096', '4096']] },
  { key: 'shadowDistance', label: 'Shadow distance', type: 'range', min: 40, max: 300, step: 10, fmt: v => v + 'm' },
  { key: 'shadowInterval', label: 'Shadow update rate', sub: 'Redraw the shadow map every Nth frame', type: 'select', options: [['1', 'Every frame'], ['2', 'Every 2nd frame'], ['3', 'Every 3rd frame']] },

  { group: 'Effects' },
  { key: 'particleQuality', label: 'Particle quality', sub: 'Global particle budget', type: 'range', min: 0.2, max: 2, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
  { key: 'debris', label: 'Explosion debris', sub: 'Physical chunks thrown by blasts', type: 'toggle' },
  { key: 'debrisScale', label: 'Debris amount', type: 'range', min: 0.1, max: 2, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
  { key: 'lightningQuality', label: 'Lightning detail', sub: 'Segments + branches per bolt', type: 'range', min: 0.4, max: 2, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
  { key: 'maxBolts', label: 'Max simultaneous bolts', type: 'range', min: 10, max: 200, step: 5 },
  { key: 'decals', label: 'Ground decals', sub: 'Scorch marks, cracks, fire pits', type: 'toggle' },
  { key: 'screenShake', label: 'Camera shake intensity', type: 'range', min: 0, max: 2, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { key: 'damageNumbers', label: 'Damage numbers', type: 'toggle' },

  { key: 'adaptive', label: 'Adaptive performance', sub: 'Auto-lowers render scale & particles when FPS drops', type: 'toggle' },

  { group: 'Camera & Input' },
  { key: 'cameraDistance', label: 'Camera distance', type: 'range', min: 6, max: 22, step: 0.5, fmt: v => v + 'm' },
  { key: 'mouseSensitivity', label: 'Mouse sensitivity', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: v => v.toFixed(2) + 'x' },
  { key: 'invertY', label: 'Invert vertical look', type: 'toggle' },

  { group: 'Audio' },
  { key: 'sfx', label: 'Sound effects', type: 'toggle' },
  { key: 'sfxVolume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
];

class SettingsManager {
  constructor() {
    this.values = { ...DEFAULTS };
    this.listeners = new Set();
    this.load();
  }

  get(k) { return this.values[k]; }

  set(k, v) {
    if (this.values[k] === v) return;
    this.values[k] = v;
    if (k !== 'preset') this.values.preset = 'Custom';
    this.save();
    this.emit(k, v);
  }

  /** Runtime-only change (adaptive scaling) — does not mark the preset Custom. */
  setRuntime(k, v) {
    if (this.values[k] === v) return false;
    this.values[k] = v;
    this.emit(k, v);
    return true;
  }

  /** Bulk apply (used by presets) */
  patch(obj, { preset = null } = {}) {
    Object.assign(this.values, obj);
    if (preset) this.values.preset = preset;
    this.save();
    this.emit('*', obj);
  }

  applyPreset(name) {
    if (!PRESETS[name]) return;
    this.patch({ ...DEFAULTS, ...PRESETS[name] }, { preset: name });
  }

  reset() {
    this.values = { ...DEFAULTS };
    this.save();
    this.emit('*', this.values);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(k, v) { for (const fn of this.listeners) fn(k, v); }

  save() {
    try {
      const { dynamicScale, ...persisted } = this.values;   // never persist the adaptive scale
      localStorage.setItem(KEY, JSON.stringify(persisted));
    } catch (e) { /* ignore */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const k of Object.keys(DEFAULTS)) {
        if (data[k] !== undefined && typeof data[k] === typeof DEFAULTS[k]) this.values[k] = data[k];
      }
      this.values.dynamicScale = 1;              // always boot at full quality
    } catch (e) { /* ignore */ }
  }
}

export const Settings = new SettingsManager();

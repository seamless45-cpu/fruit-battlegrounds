/**
 * Procedural WebAudio SFX — no assets, everything synthesised.
 */
import { Settings } from './settings.js';
import { rand, clamp } from './utils.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = Settings.get('sfxVolume');
    this.master.connect(this.ctx.destination);
    // noise buffer
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    Settings.onChange((k) => {
      if (k === 'sfxVolume' || k === '*') this.master.gain.value = Settings.get('sfxVolume');
      if (k === 'sfx' || k === '*') this.enabled = Settings.get('sfx');
    });
    this.enabled = Settings.get('sfx');
  }

  get t() { return this.ctx.currentTime; }

  _noise(dur, { volume = 1, type = 'lowpass', freq = 800, q = 1, sweep = 0, delay = 0 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = this.ctx.createGain();
    const t0 = this.t + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    if (sweep) filt.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t0 + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  _tone(freq, dur, { type = 'sine', volume = 0.4, sweepTo = null, delay = 0 } = {}) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    const t0 = this.t + delay;
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  play(name, { volume = 1, pitch = 1 } = {}) {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const v = clamp(volume, 0, 3) * 0.5;

    switch (name) {
      case 'boom':
        this._noise(clamp(1.4 / pitch, 0.3, 3), { volume: v, freq: 900 * pitch, sweep: 0.12, type: 'lowpass' });
        this._tone(90 * pitch, 0.8 / pitch, { type: 'sine', volume: v * 0.8, sweepTo: 28 });
        this._tone(150 * pitch, 0.35, { type: 'square', volume: v * 0.18, sweepTo: 40 });
        break;
      case 'thunder':
        this._noise(clamp(0.9 / pitch, 0.25, 2), { volume: v * 0.9, freq: 2600 * pitch, sweep: 0.1, type: 'bandpass', q: 0.7 });
        this._noise(0.6, { volume: v * 0.35, freq: 220, sweep: 0.3, type: 'lowpass', delay: 0.05 });
        this._tone(60, 0.5, { type: 'sine', volume: v * 0.5, sweepTo: 30, delay: 0.04 });
        break;
      case 'zap':
        this._noise(0.16, { volume: v * 0.7, freq: 5200 * pitch, sweep: 0.2, type: 'bandpass', q: 2 });
        this._tone(1400 * pitch, 0.12, { type: 'sawtooth', volume: v * 0.25, sweepTo: 300 });
        break;
      case 'slash':
        this._noise(0.2, { volume: v * 0.6, freq: 1800 * pitch, sweep: 0.25, type: 'bandpass', q: 1.4 });
        break;
      case 'whoosh':
        this._noise(0.45, { volume: v * 0.5, freq: 420 * pitch, sweep: 2.6, type: 'bandpass', q: 0.9 });
        break;
      case 'charge':
        this._tone(120 * pitch, 1.1, { type: 'sawtooth', volume: v * 0.20, sweepTo: 900 * pitch });
        this._noise(1.1, { volume: v * 0.2, freq: 300, sweep: 4, type: 'bandpass', q: 3 });
        break;
      case 'hit':
        this._noise(0.12, { volume: v * 0.5, freq: 1400, sweep: 0.3, type: 'bandpass', q: 1.2 });
        this._tone(220, 0.1, { type: 'square', volume: v * 0.18, sweepTo: 80 });
        break;
      case 'rumble':
        this._tone(48, 1.4, { type: 'sine', volume: v * 0.6, sweepTo: 26 });
        this._noise(1.4, { volume: v * 0.3, freq: 180, sweep: 0.4 });
        break;
      case 'roar':
        this._tone(70, 2.6, { type: 'sawtooth', volume: v * 0.32, sweepTo: 34 });
        this._noise(2.8, { volume: v * 0.5, freq: 700, sweep: 0.08, type: 'lowpass' });
        this._noise(2.4, { volume: v * 0.22, freq: 2200, sweep: 0.15, type: 'bandpass', q: 0.6, delay: 0.1 });
        break;
      case 'heartbeat':
        this._tone(58, 0.3, { type: 'sine', volume: v * 0.7, sweepTo: 34 });
        this._tone(58, 0.34, { type: 'sine', volume: v * 0.6, sweepTo: 32, delay: 0.36 });
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.28, { type: 'triangle', volume: v * 0.3, delay: i * 0.07 }));
        break;
      case 'ui':
        this._tone(880, 0.06, { type: 'square', volume: v * 0.12 });
        break;
      default:
        this._noise(0.2, { volume: v * 0.4, freq: 900 });
    }
  }
}

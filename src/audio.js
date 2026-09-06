// ============================================================
//  Analog-style SFX — filtered noise, sine stacks, long tails.
//  No square/saw beeps, no 8-bit stabs.
// ============================================================

function pinkBuffer(ctx, seconds = 1.8) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.enabled = true;
    this.volume = 0.82;
    this.ambientVol = 0.16;
    this._pad = null;
    this._ready = false;
  }

  unlock() {
    if (this._ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.noise = pinkBuffer(this.ctx);
    this._ready = true;
    this._startPad();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }
  setAmbient(v) {
    this.ambientVol = Math.max(0, Math.min(1, v));
    if (this._pad) this._pad.gain.gain.value = this.ambientVol * 0.045;
  }

  _now() { return this.ctx.currentTime; }

  _noise(duration, cutoff, gain, q = 0.7) {
    if (!this._ready) return;
    const t = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(cutoff, t);
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + duration + 0.02);
    return { src, filt, g, t };
  }

  _sine(freq, duration, gain, slideTo = null) {
    if (!this._ready) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + duration + 0.02);
  }

  _startPad() {
    if (!this._ready || this._pad) return;
    const t = this._now();
    const g = this.ctx.createGain();
    g.gain.value = this.ambientVol * 0.045;
    g.connect(this.master);
    [110, 164.8, 220.2].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * (i === 1 ? 1.003 : 1);
      const og = this.ctx.createGain();
      og.gain.value = i === 0 ? 0.55 : 0.22;
      o.connect(og); og.connect(g);
      o.start(t);
    });
    this._pad = { gain: g };
  }

  play(name) {
    if (!this.enabled || !this._ready) return;
    const fn = this[name];
    if (typeof fn === 'function') fn.call(this);
  }

  slash() {
    this._noise(0.16, 2400, 0.22, 0.9);
    this._sine(720, 0.14, 0.07, 280);
  }
  punch() {
    this._sine(92, 0.16, 0.22, 48);
    this._noise(0.12, 900, 0.18, 0.6);
  }
  whoosh() {
    const n = this._noise(0.28, 1400, 0.16, 0.5);
    if (n) n.filt.frequency.exponentialRampToValueAtTime(280, n.t + 0.26);
    this._sine(240, 0.22, 0.05, 90);
  }
  impact() {
    this._sine(68, 0.28, 0.28, 32);
    this._sine(140, 0.18, 0.1, 70);
    this._noise(0.22, 700, 0.28, 0.5);
  }
  explosion() {
    this._sine(46, 0.55, 0.32, 22);
    this._sine(88, 0.4, 0.14, 40);
    this._noise(0.5, 600, 0.34, 0.4);
  }
  thunder() {
    this._noise(0.9, 420, 0.3, 0.35);
    this._sine(55, 0.7, 0.18, 28);
  }
  fire() {
    this._noise(0.35, 1100, 0.16, 0.8);
    this._sine(210, 0.3, 0.05, 90);
  }
  ice() {
    this._sine(920, 0.22, 0.08, 1400);
    this._sine(1480, 0.18, 0.05, 2100);
    this._noise(0.2, 3200, 0.1, 1.4);
  }
  jump() {
    this._sine(210, 0.16, 0.1, 140);
    this._noise(0.1, 1800, 0.08, 0.7);
  }
  land() {
    this._sine(78, 0.14, 0.14, 40);
    this._noise(0.1, 500, 0.12, 0.5);
  }
  hit() {
    this._sine(74, 0.12, 0.16, 40);
    this._noise(0.08, 1600, 0.12, 0.8);
  }
  crit() {
    this._sine(98, 0.2, 0.2, 50);
    this._sine(392, 0.22, 0.08, 520);
    this._noise(0.16, 900, 0.2, 0.6);
  }
  hurt() {
    this._sine(160, 0.2, 0.12, 70);
    this._noise(0.14, 800, 0.14, 0.7);
  }
  ui() {
    this._sine(520, 0.09, 0.06, 640);
  }
  gacha() {
    this._sine(392, 0.35, 0.09, 392);
    this._sine(494, 0.4, 0.07, 494);
    this._sine(587, 0.5, 0.06, 740);
  }
  legendary() {
    this._sine(261.6, 0.7, 0.1, 261.6);
    this._sine(329.6, 0.8, 0.08, 329.6);
    this._sine(392, 0.9, 0.08, 523);
    this._noise(0.4, 2000, 0.08, 0.4);
  }
  levelup() {
    this._sine(261, 0.35, 0.09, 330);
    this._sine(330, 0.4, 0.08, 392);
    this._sine(392, 0.5, 0.07, 523);
  }
  water() {
    this._noise(0.28, 900, 0.14, 0.5);
    this._sine(180, 0.24, 0.06, 70);
  }
  skill() { this.whoosh(); }
}

export const sfx = new SFX();
export default sfx;

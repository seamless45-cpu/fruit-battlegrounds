/**
 * HUD: player card, floating damage numbers, toasts, screen effects,
 * charge / channel meters, FPS.
 */
import * as THREE from 'three';
import { clamp, fmt, tmp } from '../core/utils.js';
import { Settings } from '../core/settings.js';

export class HUD {
  constructor(world) {
    this.world = world;
    this.root = document.getElementById('hud');
    this.dmgLayer = document.getElementById('dmgLayer');
    this.toastLayer = document.getElementById('toastLayer');
    this.screenTint = document.getElementById('screenTint');
    this.vignette = document.getElementById('damageVignette');
    this.flashLayer = document.getElementById('flashLayer');
    this.crosshair = document.getElementById('crosshair');

    this.el = {
      avatar: document.getElementById('pcAvatar'),
      name: document.getElementById('pcName'),
      level: document.getElementById('pcLevel'),
      hpFill: document.getElementById('pcHpFill'),
      hpText: document.getElementById('pcHpText'),
      xpFill: document.getElementById('pcXpFill'),
      xpText: document.getElementById('pcXpText'),
      tokens: document.getElementById('pcTokens'),
      kills: document.getElementById('pcKills'),
      enemies: document.getElementById('pcEnemies'),
      fps: document.getElementById('fpsText'),
      perf: document.getElementById('perfBox'),
      charge: document.getElementById('chargeMeter'),
      chargeFill: document.getElementById('cmFill'),
      chargeVal: document.getElementById('cmVal'),
      channel: document.getElementById('channelBar'),
      channelFill: document.getElementById('chFill'),
      channelVal: document.getElementById('chVal'),
      channelLabel: document.getElementById('chLabel'),
    };

    this.numbers = [];
    this.numberPool = [];
    this.fpsAcc = 0; this.fpsFrames = 0; this.fpsTimer = 0;
    this.redT = 0; this.redDur = 0;
    this.flashT = 0; this.flashDur = 0; this.flashPeak = 0;
    this.vigT = 0;
    this._v = new THREE.Vector3();
    this._textAcc = 0;
  }

  /* ------------------------------------------------------------ numbers */
  damageNumber(pos, amount, { crit = false, color = null, player = false, heal = false } = {}) {
    if (!Settings.get('damageNumbers') || amount < 1) return;
    let el = this.numberPool.pop();
    if (!el) { el = document.createElement('div'); this.dmgLayer.appendChild(el); }
    el.className = 'dmg' + (crit ? ' crit' : '') + (heal ? ' heal' : '') + (player ? ' player' : '');
    el.textContent = (heal ? '+' : '') + (amount >= 10000 ? fmt(amount) : Math.round(amount).toLocaleString());
    if (color !== null && !crit) el.style.color = '#' + new THREE.Color(color).getHexString();
    else if (!crit) el.style.color = '';
    el.style.opacity = '1';
    el.style.display = 'block';
    this.numbers.push({
      el,
      pos: pos.clone(),
      t: 0,
      life: crit ? 1.25 : 0.95,
      vy: crit ? 3.4 : 2.6,
      vx: (Math.random() - 0.5) * 1.6,
      scale: crit ? 1 : 0.9 + Math.min(1, amount / 4000) * 0.35,
    });
    if (this.numbers.length > 40) {
      const old = this.numbers.shift();
      old.el.style.display = 'none';
      this.numberPool.push(old.el);
    }
  }

  toast(html, kind = '', ms = 1400) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = html;
    this.toastLayer.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, ms);
    while (this.toastLayer.children.length > 5) this.toastLayer.firstChild.remove();
  }

  /** Fatal Destruction: screen shifts red, then deeper red for `dur` seconds. */
  redShift(dur = 1) { this.redDur = dur; this.redT = 0; }
  flashWhite(strength = 0.5) { this.flashDur = 0.35; this.flashT = 0; this.flashPeak = strength; }
  hurtFlash() { this.vigT = 0.6; }

  showCharge(v) {
    this.el.charge.hidden = false;
    this.el.chargeFill.style.width = clamp(v, 0, 100) + '%';
    this.el.chargeVal.textContent = Math.round(v);
  }
  hideCharge() { this.el.charge.hidden = true; }

  showChannel(label, ratio) {
    this.el.channel.hidden = false;
    this.el.channelLabel.textContent = label.toUpperCase();
    this.el.channelFill.style.width = clamp(ratio * 100, 0, 100) + '%';
    this.el.channelVal.textContent = Math.round(clamp(ratio * 100, 0, 120));
  }
  hideChannel() { this.el.channel.hidden = true; }

  /* ------------------------------------------------------------- update */
  update(dt, realDt) {
    const w = this.world;
    const p = w.player;

    // ---- fps ----
    this.fpsFrames++;
    this.fpsTimer += realDt;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.el.fps.textContent = fps;
      this.el.perf.style.display = Settings.get('showFPS') ? '' : 'none';
      this.fpsFrames = 0; this.fpsTimer = 0;
    }

    // ---- player card ----
    this._textAcc += realDt;
    const hpRatio = clamp(p.hp / p.maxHp, 0, 1);
    this.el.hpFill.style.width = (hpRatio * 100).toFixed(1) + '%';
    this.el.xpFill.style.width = clamp((p.xp / p.xpNeeded) * 100, 0, 100).toFixed(1) + '%';
    if (this._textAcc > 0.12) {
      this._textAcc = 0;
      this.el.hpText.textContent = `${Math.ceil(p.hp).toLocaleString()} / ${Math.round(p.maxHp).toLocaleString()}`;
      this.el.xpText.textContent = `${p.level < 100000 ? Math.round((p.xp / p.xpNeeded) * 100) + '%' : 'MAX'}`;
      this.el.level.textContent = p.level.toLocaleString();
      this.el.tokens.textContent = fmt(p.tokens);
      this.el.kills.textContent = p.kills;
      this.el.enemies.textContent = w.enemies.length;
      const f = w.fruitDef;
      if (f) {
        this.el.avatar.textContent = f.name[0].toUpperCase();
        this.el.avatar.style.background = `linear-gradient(150deg, #${new THREE.Color(f.color).getHexString()}, #312e81)`;
      } else {
        this.el.avatar.textContent = '—';
      }
    }

    // ---- charge meter (gravity blade superforce) ----
    if (w.weaponDef?.id === 'gravityblade') {
      this.showCharge(p.charge);
    } else this.hideCharge();

    // ---- crosshair state ----
    const aimEnemy = w.combat.nearest(w.aimPoint, 4);
    this.crosshair.classList.toggle('hit', !!aimEnemy);

    // ---- damage numbers ----
    const cam = w.camera;
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += realDt;
      const k = n.t / n.life;
      if (k >= 1) {
        n.el.style.display = 'none';
        this.numberPool.push(n.el);
        this.numbers.splice(i, 1);
        continue;
      }
      n.pos.y += n.vy * realDt;
      n.pos.x += n.vx * realDt;
      n.vy -= 2.6 * realDt;
      this._v.copy(n.pos).project(cam);
      if (this._v.z > 1) { n.el.style.opacity = '0'; continue; }
      const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
      const s = n.scale * (1 + (1 - k) * 0.25);
      n.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(2)})`;
      n.el.style.opacity = String(clamp(1 - Math.pow(k, 2.4), 0, 1));
    }

    // ---- red shift (Fatal Destruction) ----
    if (this.redDur > 0) {
      this.redT += realDt;
      const k = clamp(this.redT / this.redDur, 0, 1);
      this.screenTint.style.opacity = String(0.18 + k * 0.5);          // red → deeper red
      if (k >= 1) { this.redDur = 0; this.screenTint.style.opacity = '0'; }
    }

    // ---- white flash ----
    if (this.flashDur > 0) {
      this.flashT += realDt;
      const k = clamp(this.flashT / this.flashDur, 0, 1);
      this.flashLayer.style.opacity = String(this.flashPeak * Math.pow(1 - k, 2));
      if (k >= 1) { this.flashDur = 0; this.flashLayer.style.opacity = '0'; }
    }

    // ---- damage vignette ----
    if (this.vigT > 0) {
      this.vigT -= realDt;
      this.vignette.style.opacity = String(clamp(this.vigT / 0.6, 0, 1) * 0.85);
    } else if (this.vignette.style.opacity !== '0') {
      // low-health pulse
      const lowHp = p.alive ? clamp(1 - hpRatio / 0.3, 0, 1) : 0;
      this.vignette.style.opacity = String(lowHp * 0.35 * (0.6 + 0.4 * Math.sin(performance.now() / 260)));
    }
  }
}

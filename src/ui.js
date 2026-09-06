// ============================================================
//  UI: inventory slots, compact skill bar, graphics settings,
//  HUD (hp / tokens / kills / fps), toast.
// ============================================================
import { INVENTORY_ITEMS, FRUITS, SWORDS, SKILL_KEYS } from './config.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.skillRows = {}; // id -> {row, cd, cdText, useBtn}
    this.onScreen = !game.isMobile;
  }

  showGameUI() {
    document.getElementById('topbar').classList.remove('hidden');
    document.getElementById('inventory').classList.remove('hidden');
    document.getElementById('skillbar').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    document.getElementById('settingsBtn').classList.remove('hidden');
    document.getElementById('loader').classList.add('hidden');
  }

  // ---------------- Inventory (bottom horizontal square slots) ----------------
  buildInventory() {
    const wrap = document.getElementById('invSlots');
    wrap.innerHTML = '';
    INVENTORY_ITEMS.forEach((item) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.id = item.id;
      slot.innerHTML = `
        <span class="slot-type ${item.type}">${item.type}</span>
        <span class="slot-emoji">${item.emoji}</span>
        <span class="slot-name">${item.ref.name}</span>
        <span class="equipped-mark"></span>`;
      slot.title = item.ref.blurb || '';
      slot.addEventListener('click', () => this.game.toggleEquip(item.id));
      wrap.appendChild(slot);
    });
    this.refreshInventory();
  }

  refreshInventory() {
    const g = this.game;
    document.querySelectorAll('#invSlots .slot').forEach((slot) => {
      const id = slot.dataset.id;
      const isFruit = g.equippedFruit === id;
      const isSword = g.equippedSword === id;
      const equipped = isFruit || isSword;
      slot.classList.toggle('equipped', equipped);
      const mark = slot.querySelector('.equipped-mark');
      if (equipped) mark.textContent = (isFruit && g.activeWeapon === 'fruit') || (isSword && g.activeWeapon === 'sword') ? '●' : '○';
      else mark.textContent = '';
    });
  }

  // ---------------- Skill bar (middle right, compact, closable) ----------------
  buildSkillBar() {
    const list = document.getElementById('skillList');
    list.innerHTML = '';
    this.skillRows = {};
    const g = this.game;
    const weapon = g.activeWeapon === 'sword' ? SWORDS[g.equippedSword] : FRUITS[g.equippedFruit];
    if (!weapon) {
      document.getElementById('skillbarTitle').textContent = 'NO WEAPON';
      return;
    }
    document.getElementById('skillbarTitle').textContent = weapon.name.toUpperCase() + ' SKILLS';

    // M1 (basic attack) for swords
    if (weapon.m1) this._addSkillRow(weapon.m1, 'LMB', true);
    weapon.skills.forEach((sk, i) => this._addSkillRow(sk, (SKILL_KEYS[i] || '?').toUpperCase(), false));
  }

  _addSkillRow(sk, keyLabel, isM1) {
    const list = document.getElementById('skillList');
    const row = document.createElement('div');
    row.className = 'skill-row' + (isM1 ? '' : ' skill-ready');
    row.dataset.id = sk.id;
    const metaExtra = sk.id === 'gb_death' ? `<div class="skill-upg" style="font-size:9px;color:#ffd56b;cursor:pointer;">▲ Upg Lv${this.game.upgrades.gb_death.level}</div>` : '';
    row.innerHTML = `
      <span class="skill-key">${keyLabel}</span>
      <button class="skill-use">${isM1 ? '⚔' : '▶'}</button>
      <div class="skill-info">
        <div class="skill-name">${sk.label}</div>
        <div class="skill-meta">CD ${sk.cd}s ${metaExtra}</div>
      </div>
      <div class="skill-cd"></div>
      <div class="skill-cd-text"></div>`;
    list.appendChild(row);

    const useBtn = row.querySelector('.skill-use');
    const upg = row.querySelector('.skill-upg');
    useBtn.addEventListener('click', () => this.game.requestCast(sk.id));
    if (upg) upg.addEventListener('click', (e) => { e.stopPropagation(); this.game.tryUpgradeDeath(); });

    this.skillRows[sk.id] = {
      row, cd: row.querySelector('.skill-cd'), cdText: row.querySelector('.skill-cd-text'),
      cdMax: sk.cd, isM1, upg,
    };
  }

  updateSkillBar(dt) {
    const g = this.game;
    for (const id in this.skillRows) {
      const r = this.skillRows[id];
      const cd = g.cooldowns[id];
      if (!cd) continue;
      if (cd.remaining > 0) {
        cd.remaining = Math.max(0, cd.remaining - dt);
        const frac = cd.remaining / r.cdMax;
        r.cd.style.transform = `scaleX(${frac})`;
        r.cdText.textContent = cd.remaining.toFixed(1) + 's';
        r.row.classList.remove('skill-ready');
      } else {
        r.cd.style.transform = 'scaleX(0)';
        r.cdText.textContent = '';
        r.row.classList.add('skill-ready');
      }
    }
  }

  refreshDeathUpgrade() {
    const r = this.skillRows['gb_death'];
    if (r && r.upg) r.upg.textContent = `▲ Upg Lv${this.game.upgrades.gb_death.level}`;
  }

  // ---------------- Settings (advanced graphics) ----------------
  buildSettings() {
    const body = document.getElementById('setBody');
    const gfx = this.game.world.gfx;
    const seg = (label, key, opts) => {
      const wrap = document.createElement('div'); wrap.className = 'set-row';
      const segEl = document.createElement('div'); segEl.className = 'seg';
      opts.forEach((o) => {
        const b = document.createElement('button'); b.textContent = o;
        if (String(gfx[key]).toLowerCase() === o.toLowerCase()) b.classList.add('active');
        b.addEventListener('click', () => {
          this.game.world.setGfx(key, o);
          segEl.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
        });
        segEl.appendChild(b);
      });
      wrap.innerHTML = `<span>${label}</span>`; wrap.appendChild(segEl);
      return wrap;
    };
    const toggle = (label, key) => {
      const wrap = document.createElement('div'); wrap.className = 'set-row';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!gfx[key];
      cb.addEventListener('change', () => { this.game.world.setGfx(key, cb.checked); if (key === 'bloom') this.game.applyBloom(); });
      wrap.innerHTML = `<span>${label}</span>`; wrap.appendChild(cb);
      return wrap;
    };
    const slider = (label, key, min, max, step) => {
      const wrap = document.createElement('div'); wrap.className = 'set-row';
      const s = document.createElement('input'); s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = gfx[key];
      const val = document.createElement('span'); val.textContent = gfx[key];
      s.addEventListener('input', () => { this.game.world.setGfx(key, parseFloat(s.value)); val.textContent = s.value; });
      wrap.innerHTML = `<span>${label}</span>`; wrap.appendChild(s); wrap.appendChild(val);
      return wrap;
    };

    body.appendChild(seg('Quality', 'quality', ['Low', 'Medium', 'High', 'Ultra']));
    body.appendChild(toggle('Shadows', 'shadows'));
    body.appendChild(toggle('Bloom / Glow', 'bloom'));
    body.appendChild(toggle('Fog', 'fog'));
    body.appendChild(toggle('Particles', 'particles'));
    body.appendChild(slider('Resolution Scale', 'pixelRatioScale', 0.5, 1.5, 0.05));

    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.getElementById('settingsPanel').classList.toggle('hidden');
    });
    document.getElementById('setClose').addEventListener('click', () => {
      document.getElementById('settingsPanel').classList.add('hidden');
    });

    // skill bar close / reopen
    document.getElementById('skillClose').addEventListener('click', () => this.closeSkillBar());
    document.getElementById('skillReopen').addEventListener('click', () => this.openSkillBar());
  }

  closeSkillBar() {
    document.getElementById('skillbar').classList.add('hidden');
    document.getElementById('skillReopen').classList.remove('hidden');
  }
  openSkillBar() {
    document.getElementById('skillbar').classList.remove('hidden');
    document.getElementById('skillReopen').classList.add('hidden');
  }

  // ---------------- HUD ----------------
  setHp(frac) { document.getElementById('hpFill').style.width = Math.max(0, frac * 100) + '%'; }
  setTokens(n) { document.getElementById('tokenCount').textContent = Math.floor(n); }
  setKills(n) { document.getElementById('killCount').textContent = n; }
  setFps(n) { document.getElementById('fpsCount').textContent = Math.round(n); }

  toast(msg, ms = 2200) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.remove('hidden'); t.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, ms);
  }
}

/**
 * Compact skill panels (middle-right).
 *
 *  • Each row: USE button on the LEFT, then icon, name, cooldown track and
 *    the remaining-seconds readout.
 *  • The whole bar is washed by a 100 → 0 sweep that drains over the REAL
 *    cooldown in seconds (the number shows seconds, never a 0-100 counter).
 *  • Panels are closable; a dock tab re-opens them.
 *  • On PC the key badge (Z X C V B F / 1-4) replaces the USE button;
 *    on mobile and tablets the USE button is the control.
 */
import { clamp, fmt } from '../core/utils.js';
import { FRUIT_KEY_LABELS, WEAPON_KEY_LABELS, FRUITS, WEAPONS } from '../data/loadout.js';
import { upgradeCost, canUpgrade, doUpgrade } from '../skills/weapons.js';

export class SkillBar {
  constructor(world) {
    this.world = world;
    this.rows = [];
    this.fruitPanel = document.getElementById('fruitPanel');
    this.weaponPanel = document.getElementById('weaponPanel');
    this.fruitSkills = document.getElementById('fruitSkills');
    this.weaponSkills = document.getElementById('weaponSkills');
    this.dockTabs = document.getElementById('dockTabs');

    // panel close / restore
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.close;
        document.getElementById(id).hidden = true;
        const tab = this.dockTabs.querySelector(`[data-open="${id}"]`);
        if (tab) tab.hidden = false;
      });
    });
    document.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.open;
        document.getElementById(id).hidden = false;
        btn.hidden = true;
      });
    });

    this.rebuild();
  }

  rebuild() {
    this.rows = [];
    this.fruitSkills.innerHTML = '';
    this.weaponSkills.innerHTML = '';

    const p = this.world.player;
    const fruit = p.fruit ? FRUITS[p.fruit] : null;
    const weapon = p.weapon ? WEAPONS[p.weapon] : null;

    // ---- panel headers ----
    const fTitle = document.getElementById('fruitTitle');
    const fDot = document.getElementById('fruitDot');
    fTitle.textContent = fruit ? fruit.name.toUpperCase() : 'NO FRUIT';
    fTitle.style.color = fruit ? '#' + fruit.color.toString(16).padStart(6, '0') : '';
    fDot.style.background = fruit ? '#' + fruit.color.toString(16).padStart(6, '0') : '#555';
    fDot.style.boxShadow = fruit ? '0 0 10px #' + fruit.color.toString(16).padStart(6, '0') : 'none';

    const wTitle = document.getElementById('weaponTitle');
    const wDot = document.getElementById('weaponDot');
    wTitle.textContent = weapon ? weapon.name.toUpperCase() : 'NO SWORD';
    wDot.style.background = weapon ? '#' + weapon.color.toString(16).padStart(6, '0') : '#555';

    if (fruit) fruit.skills.forEach((def, i) => this._addRow('fruit', i, def, FRUIT_KEY_LABELS[i], fruit.color));
    if (weapon) weapon.skills.forEach((def, i) => this._addRow('weapon', i, def, WEAPON_KEY_LABELS[i], weapon.color));
  }

  _addRow(kind, index, def, keyLabel, color) {
    const hex = '#' + (color || 0xffffff).toString(16).padStart(6, '0');
    const row = document.createElement('div');
    row.className = 'skill';
    row.title = `${def.name} — ${def.desc || ''}`;

    const wash = document.createElement('div');
    wash.className = 'cdwash';
    wash.style.display = 'none';
    row.appendChild(wash);

    const use = document.createElement('button');
    use.className = 'use';
    use.textContent = 'USE';
    row.appendChild(use);

    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = keyLabel || '?';
    row.appendChild(key);

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.style.setProperty('--c', hex);
    icon.textContent = def.glyph || '✦';
    row.appendChild(icon);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = def.name;
    const track = document.createElement('div');
    track.className = 'cdtrack';
    const fill = document.createElement('i');
    fill.style.background = hex;
    track.appendChild(fill);
    meta.appendChild(name);
    meta.appendChild(track);
    row.appendChild(meta);

    const num = document.createElement('div');
    num.className = 'cdnum';
    row.appendChild(num);

    if (def.hold) {
      const hint = document.createElement('span');
      hint.className = 'holdhint';
      hint.textContent = 'HOLD';
      row.appendChild(hint);
    }

    let upg = null;
    if (def.upgradable) {
      upg = document.createElement('button');
      upg.className = 'upg';
      upg.textContent = '⬆ 1.0K';
      upg.title = 'Upgrade with kill tokens';
      upg.addEventListener('click', (e) => {
        e.stopPropagation();
        if (doUpgrade(this.world.player)) this.rebuild();
      });
      row.appendChild(upg);
    }

    // ---- input ----
    const press = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.world.player.pressedSkill(kind, index, { via: 'pointer' });
    };
    const release = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.world.player.releasedSkill(kind, index);
    };
    use.addEventListener('pointerdown', press);
    use.addEventListener('pointerup', release);
    use.addEventListener('pointerleave', release);
    use.addEventListener('pointercancel', release);
    row.addEventListener('pointerdown', (e) => {
      if (e.target === row || e.target === icon || e.target === name || e.target === meta) press(e);
    });
    row.addEventListener('pointerup', (e) => {
      if (e.target === row || e.target === icon || e.target === name || e.target === meta) release(e);
    });

    (kind === 'fruit' ? this.fruitSkills : this.weaponSkills).appendChild(row);
    this.rows.push({ kind, index, def, row, wash, num, fill, upg, key: kind + ':' + def.id });
  }

  flash(kind, index) {
    const r = this.rows.find(r => r.kind === kind && r.index === index);
    if (!r) return;
    r.row.classList.remove('flash');
    void r.row.offsetWidth;
    r.row.classList.add('flash');
  }

  update(dt) {
    const p = this.world.player;
    for (const r of this.rows) {
      const left = p.cdLeft(r.key);
      const total = p.cdTotal(r.key);
      if (left > 0 && total > 0) {
        const k = left / total;                  // 1 → 0 over the real cooldown
        r.wash.style.display = 'block';
        r.wash.style.width = (k * 100).toFixed(1) + '%';
        r.num.textContent = left.toFixed(1);     // actual seconds, not 100→0
        r.fill.style.width = ((1 - k) * 100).toFixed(1) + '%';
        r.row.classList.add('cooling');
        r.row.classList.remove('ready');
      } else {
        r.wash.style.display = 'none';
        r.num.textContent = '';
        r.fill.style.width = '100%';
        r.row.classList.remove('cooling');
        r.row.classList.add('ready');
      }
      if (r.def.hold && p.channel && p.channel.key === r.key) r.row.classList.add('active');
      else r.row.classList.remove('active');

      if (r.upg) {
        const up = p.upgrades.deathSlashes;
        const maxed = up.level >= 5 && up.over >= 10;
        const cost = upgradeCost(up);
        r.upg.textContent = maxed ? 'MAX' : '⬆ ' + fmt(cost);
        r.upg.disabled = maxed || !canUpgrade(p);
        r.upg.title = maxed
          ? 'Fully upgraded'
          : `Upgrade — ${fmt(cost)} kill tokens (you have ${fmt(p.tokens)})`;
      }
    }
  }
}

/**
 * Inventory — square horizontal slots along the bottom.
 * FRUIT and SWORD are independent slots: click to equip, click again (or hit
 * the NONE slot) to unequip.
 */
import { FRUITS, WEAPONS } from '../data/loadout.js';

export class InventoryBar {
  constructor(world) {
    this.world = world;
    this.root = document.getElementById('inventory');
    this.slotsEl = document.getElementById('invSlots');
    this.tabs = document.querySelectorAll('.inv-tab');
    this.eqFruit = document.getElementById('eqFruit');
    this.eqSword = document.getElementById('eqSword');
    this.tab = 'fruit';
    this.slots = [];

    this.tabs.forEach(t => {
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        this.tab = t.dataset.tab;
        this.build();
      });
    });
    this.build();
  }

  build() {
    this.slotsEl.innerHTML = '';
    this.slots = [];
    const p = this.world.player;

    // ---- NONE slot (unequip) ----
    this._addSlot({
      id: null,
      glyph: '⊘',
      label: 'NONE',
      color: 0x64748b,
      equipped: this.tab === 'fruit' ? !p.fruit : !p.weapon,
    });

    if (this.tab === 'fruit') {
      for (const id of p.owned.fruits) {
        const f = FRUITS[id];
        if (!f) continue;
        this._addSlot({ id, glyph: f.glyph, label: f.name, color: f.color, equipped: p.fruit === id, kind: 'fruit' });
      }
    } else {
      for (const id of p.owned.weapons) {
        const w = WEAPONS[id];
        if (!w) continue;
        this._addSlot({ id, glyph: w.glyph, label: w.short || w.name, color: w.color, equipped: p.weapon === id, kind: 'weapon' });
      }
    }
    this.refresh();
  }

  _addSlot({ id, glyph, label, color, equipped, kind }) {
    const el = document.createElement('div');
    el.className = 'inv-slot' + (equipped ? ' equipped' : '');
    el.style.setProperty('--c', '#' + color.toString(16).padStart(6, '0'));
    el.innerHTML = `<div class="glyph">${glyph}</div><div class="tag">${label}</div>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = this.world.player;
      if (kind === 'fruit') {
        p.setFruit(p.fruit === id ? null : id);
      } else if (kind === 'weapon') {
        p.setWeapon(p.weapon === id ? null : id);
      } else {
        if (this.tab === 'fruit') p.setFruit(null); else p.setWeapon(null);
      }
      this.build();
      this.world.ui?.rebuildSkillBars();
    });
    this.slotsEl.appendChild(el);
    this.slots.push({ el, id, kind });
  }

  refresh() {
    const p = this.world.player;
    const f = p.fruit ? FRUITS[p.fruit] : null;
    const w = p.weapon ? WEAPONS[p.weapon] : null;
    this.eqFruit.innerHTML = 'Fruit: <b>' + (f ? f.name : '—') + '</b>';
    this.eqSword.innerHTML = 'Sword: <b>' + (w ? w.name : '—') + '</b>';
    for (const s of this.slots) {
      const eq = s.kind === 'fruit' ? p.fruit === s.id : s.kind === 'weapon' ? p.weapon === s.id : (this.tab === 'fruit' ? !p.fruit : !p.weapon);
      s.el.classList.toggle('equipped', !!eq);
    }
  }
}

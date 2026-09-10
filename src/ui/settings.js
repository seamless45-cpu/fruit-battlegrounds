/**
 * Advanced Graphics Settings panel — generated from the settings SCHEMA.
 */
import { Settings, SCHEMA, PRESETS } from '../core/settings.js';

export class SettingsPanel {
  constructor() {
    this.modal = document.getElementById('settingsModal');
    this.grid = document.getElementById('settingsGrid');
    this.controls = new Map();
    this.build();

    document.getElementById('btnSettings').addEventListener('click', () => this.open());
    document.getElementById('btnCloseSettings').addEventListener('click', () => this.close());
    document.getElementById('btnDoneSettings').addEventListener('click', () => this.close());
    document.getElementById('btnResetSettings').addEventListener('click', () => {
      Settings.reset();
      this.build();
    });
    this.modal.addEventListener('pointerdown', (e) => { if (e.target === this.modal) this.close(); });
    Settings.onChange((k, v) => { if (k !== '*') this.syncControl(k, v); else this.build(); });
  }

  open() { this.modal.hidden = false; this.syncAll(); }
  close() { this.modal.hidden = true; }
  get isOpen() { return !this.modal.hidden; }

  build() {
    this.grid.innerHTML = '';
    this.controls.clear();
    for (const item of SCHEMA) {
      if (item.group) {
        const h = document.createElement('div');
        h.className = 'sgroup';
        h.textContent = item.group.toUpperCase();
        this.grid.appendChild(h);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'srow';
      const label = document.createElement('label');
      label.innerHTML = item.label + (item.sub ? `<span class="sub">${item.sub}</span>` : '');
      row.appendChild(label);

      let control, val = null;
      if (item.type === 'toggle') {
        control = document.createElement('div');
        control.className = 'switch';
        control.addEventListener('click', () => {
          const v = !Settings.get(item.key);
          Settings.set(item.key, v);
          control.classList.toggle('on', v);
        });
      } else if (item.type === 'range') {
        control = document.createElement('input');
        control.type = 'range';
        control.min = item.min; control.max = item.max; control.step = item.step;
        val = document.createElement('span');
        val.className = 'val';
        control.addEventListener('input', () => {
          const v = parseFloat(control.value);
          Settings.set(item.key, v);
          val.textContent = item.fmt ? item.fmt(v) : v.toFixed(2);
        });
      } else if (item.type === 'select') {
        control = document.createElement('select');
        for (const [value, text] of item.options) {
          const o = document.createElement('option');
          o.value = value; o.textContent = text;
          control.appendChild(o);
        }
        control.addEventListener('change', () => {
          const v = isNaN(parseFloat(control.value)) ? control.value : parseFloat(control.value);
          Settings.set(item.key, v);
        });
      }
      row.appendChild(control);
      if (val) row.appendChild(val);
      this.grid.appendChild(row);
      this.controls.set(item.key, { item, control, val });
    }
    this.syncAll();
    this.syncPresets();
  }

  syncControl(key, value) {
    const c = this.controls.get(key);
    if (!c) return;
    const { item, control, val } = c;
    if (item.type === 'toggle') control.classList.toggle('on', !!value);
    else if (item.type === 'range') {
      control.value = value;
      if (val) val.textContent = item.fmt ? item.fmt(value) : Number(value).toFixed(2);
    } else if (item.type === 'select') control.value = String(value);
    this.syncPresets();
  }

  syncAll() {
    for (const [key] of this.controls) this.syncControl(key, Settings.get(key));
    this.syncPresets();
  }

  syncPresets() {
    document.querySelectorAll('.preset').forEach(b => {
      b.classList.toggle('active', b.dataset.preset === Settings.get('preset'));
    });
  }
}

export function initPresetButtons() {
  document.querySelectorAll('.preset').forEach(b => {
    b.addEventListener('click', () => Settings.applyPreset(b.dataset.preset));
  });
}

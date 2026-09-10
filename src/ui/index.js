/**
 * UI facade — everything DOM-facing goes through here so the game code can
 * stay declarative.
 */
import { HUD } from './hud.js';
import { SkillBar } from './skillbar.js';
import { InventoryBar } from './inventory.js';
import { SettingsPanel, initPresetButtons } from './settings.js';
import * as THREE from 'three';

export class UI {
  constructor(world) {
    this.world = world;
    this.hud = new HUD(world);
    this.skillbar = new SkillBar(world);
    this.inventory = new InventoryBar(world);
    this.settings = new SettingsPanel();
    initPresetButtons();

    this.helpModal = document.getElementById('helpModal');
    document.getElementById('btnHelp').addEventListener('click', () => this.toggleHelp());
    document.getElementById('btnCloseHelp').addEventListener('click', () => this.toggleHelp(false));
    this.helpModal.addEventListener('pointerdown', (e) => { if (e.target === this.helpModal) this.toggleHelp(false); });
  }

  toggleHelp(force) {
    const show = force !== undefined ? force : this.helpModal.hidden;
    this.helpModal.hidden = !show;
    if (show) this.world.input?.releaseLock();
  }

  get blocking() { return !this.settings.modal.hidden || !this.helpModal.hidden; }

  /* ------------------------------------------------------------ passthru */
  update(dt, realDt) {
    this.hud.update(dt, realDt);
    this.skillbar.update(dt);
  }

  damageNumber(pos, amount, opts) { this.hud.damageNumber(pos, amount, opts); }
  toast(html, kind, ms) { this.hud.toast(html, kind, ms); }
  redShift(d) { this.hud.redShift(d); }
  flashWhite(s) { this.hud.flashWhite(s); }
  hurtFlash() { this.hud.hurtFlash(); }
  showChannel(label, ratio) { this.hud.showChannel(label, ratio); }
  hideChannel() { this.hud.hideChannel(); }
  flashSkill(kind, index) { this.skillbar.flash(kind, index); }
  flashM1() { /* reserved */ }

  rebuildSkillBars() {
    this.skillbar.rebuild();
    this.inventory.refresh();
  }
}

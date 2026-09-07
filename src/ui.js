// ============================================================
//  Reworked HUD, dealers, menu, gifts, quests, motion.
// ============================================================
import { INVENTORY_ITEMS, FRUITS, SWORDS, FIGHTING_STYLES, SKILL_KEYS, FRUIT_DEALER, BOATS, SWORD_PRICES, STYLE_PRICES, QUESTS, SECRET_QUESTS, ELITE_QUESTS, GACHA, RACES, AWAKEN, ACCESSORIES, SIDES } from './config.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.skillRows = {};
    this.onScreen = !game.isMobile;
  }

  showMainMenu() {
    const loader = document.getElementById('loader');
    loader.classList.add('is-menu');
    document.getElementById('loaderActions').classList.remove('hidden');
    document.getElementById('menuStats').classList.remove('hidden');
    this.setTokens(this.game.tokens);
    this.setLevel(this.game.level, this.game.xp, this.game.xpToNext);
  }

  showGameUI() {
    ['topbar', 'hpHud', 'inventory', 'skillbar', 'crosshair', 'settingsBtn', 'helpBtn', 'utilityBar', 'joyWrap', 'jumpBtn', 'sailBtn']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); });
    const loader = document.getElementById('loader');
    loader.classList.add('is-launch');
    document.body.classList.add('in-game');
    setTimeout(() => loader.classList.add('hidden'), 720);
  }

  togglePanel(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains('hidden')) this.openPanel(id);
    else this.closePanel(id);
  }
  openPanel(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
  }
  closePanel(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

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
      const item = INVENTORY_ITEMS.find((entry) => entry.id === id);
      const unlocked = item.type === 'style' ? g.ownedStyles.has(id) : (item.type === 'fruit' ? g.ownedFruits.has(id) : g.ownedSwords.has(id));
      slot.classList.toggle('locked', !unlocked);
      const isFruit = unlocked && g.equippedFruit === id;
      const isSword = unlocked && g.equippedSword === id;
      const isStyle = g.equippedStyle === id;
      const equipped = isFruit || isSword || isStyle;
      slot.classList.toggle('equipped', equipped);
      const mark = slot.querySelector('.equipped-mark');
      if (equipped) mark.textContent = (isFruit && g.activeWeapon === 'fruit') || (isSword && g.activeWeapon === 'sword') || (isStyle && g.activeWeapon === 'style') ? '●' : '○';
      else mark.textContent = '';
    });
  }

  buildSkillBar() {
    const list = document.getElementById('skillList');
    list.innerHTML = '';
    this.skillRows = {};
    const g = this.game;
    const weapon = g.activeWeapon === 'sword' ? SWORDS[g.equippedSword] : g.activeWeapon === 'style' ? FIGHTING_STYLES[g.equippedStyle] : FRUITS[g.equippedFruit];
    if (!weapon) {
      document.getElementById('skillbarTitle').textContent = 'NO WEAPON';
      return;
    }
    const awake = g.activeWeapon === 'fruit' && g.awakened && g.awakened.has(g.equippedFruit);
    document.getElementById('skillbarTitle').textContent = weapon.name.toUpperCase() + (awake ? ' ☾' : '');
    const awakenBtn = document.getElementById('awakenBtn');
    if (awakenBtn) {
      awakenBtn.classList.toggle('hidden', g.activeWeapon !== 'fruit' || !g.equippedFruit);
      if (g.equippedFruit) {
        const kills = g.fruitKills[g.equippedFruit] || 0;
        awakenBtn.textContent = awake ? 'Awakened' : `Awaken ${kills}/${AWAKEN.killNeed}`;
        awakenBtn.disabled = !!awake;
      }
    }
    if (weapon.m1) this._addSkillRow(weapon.m1, 'LMB', true);
    weapon.skills.forEach((sk, i) => this._addSkillRow(sk, (SKILL_KEYS[i] || '?').toUpperCase(), false));
  }

  _addSkillRow(sk, keyLabel, isM1) {
    const list = document.getElementById('skillList');
    const row = document.createElement('div');
    row.className = 'skill-row' + (isM1 ? '' : ' skill-ready');
    row.dataset.id = sk.id;
    const metaExtra = sk.id === 'gb_death' ? `<div class="skill-upg">▲ Lv${this.game.upgrades.gb_death.level}</div>` : '';
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
    useBtn.addEventListener('click', () => {
      if (isM1) this.game.requestCastM1();
      else this.game.requestCast(sk.id);
    });
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
    if (r && r.upg) r.upg.textContent = `▲ Lv${this.game.upgrades.gb_death.level}`;
  }

  buildSettings() {
    const body = document.getElementById('setBody');
    const gfx = this.game.world.gfx;
    const block = (label, hint, control) => {
      const wrap = document.createElement('div'); wrap.className = 'set-row';
      const copy = document.createElement('div'); copy.className = 'set-copy';
      copy.innerHTML = `<b>${label}</b><small>${hint}</small>`;
      wrap.appendChild(copy); wrap.appendChild(control);
      return wrap;
    };
    const seg = (label, hint, key, opts) => {
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
      return block(label, hint, segEl);
    };
    const toggle = (label, hint, key) => {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!gfx[key];
      cb.addEventListener('change', () => { this.game.world.setGfx(key, cb.checked); if (key === 'bloom' || key === 'fastMode') this.game.applyBloom(); });
      return block(label, hint, cb);
    };
    const slider = (label, hint, key, min, max, step) => {
      const hold = document.createElement('div'); hold.className = 'set-slide';
      const s = document.createElement('input'); s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = gfx[key];
      const val = document.createElement('span'); val.textContent = gfx[key];
      s.addEventListener('input', () => { this.game.world.setGfx(key, parseFloat(s.value)); val.textContent = s.value; });
      hold.appendChild(s); hold.appendChild(val);
      return block(label, hint, hold);
    };

    body.appendChild(seg('Quality', 'Overall 3D detail. Low is fastest; Ultra sharpens shadows and pixels.', 'quality', ['Low', 'Medium', 'High', 'Ultra']));
    body.appendChild(toggle('Shadows', 'Sun shadows on fighters and the island. Turn off on slow devices.', 'shadows'));
    body.appendChild(toggle('Bloom / Glow', 'Soft light bloom on explosions and gold. Heavy on some GPUs.', 'bloom'));
    body.appendChild(toggle('Fog', 'Distance haze that fades the horizon. Off makes the sea razor-sharp.', 'fog'));
    body.appendChild(toggle('Particles', 'Sparks, debris, and ember trails. Off cuts the busiest skill VFX.', 'particles'));
    body.appendChild(toggle('Clouds', 'Daytime cloud puffs drifting over the arena.', 'clouds'));
    body.appendChild(toggle('Fast Mode', 'Caps resolution, kills bloom and particles for max FPS on weak GPUs.', 'fastMode'));
    body.appendChild(toggle('Reduce Motion', 'Cuts camera shake, extra VFX, and UI animation. Easier on the eyes.', 'reduceMotion'));
    body.appendChild(toggle('Soft-lock Aim', 'Skills snap toward the pirate nearest screen center.', 'softLock'));
    body.appendChild(toggle('Invert Look X', 'Swap left/right when you drag to look.', 'invertLookX'));
    body.appendChild(toggle('Invert Look Y', 'Swap up/down when you drag to look.', 'invertLookY'));
    body.appendChild(slider('Look Sensitivity', 'How far the camera turns per drag. Higher is snappier.', 'lookSens', 0.4, 2.2, 0.05));
    body.appendChild(slider('Field of View', 'Camera zoom. Higher sees more of the island at once.', 'fov', 45, 85, 1));
    body.appendChild(slider('Free Aim Mix', '0 = always screen-center aim. 1 = aim follows the cursor.', 'freeAim', 0, 1, 0.05));
    body.appendChild(slider('Exposure', 'Overall scene brightness after tone-mapping.', 'exposure', 0.7, 1.8, 0.02));
    body.appendChild(slider('Resolution Scale', 'Internal render scale. Lower values raise FPS.', 'pixelRatioScale', 0.5, 1.5, 0.05));

    const sfxCb = document.createElement('input'); sfxCb.type = 'checkbox'; sfxCb.checked = this.game.sfx.enabled;
    sfxCb.addEventListener('change', () => { this.game.sfx.enabled = sfxCb.checked; if (sfxCb.checked) this.game.sfx.unlock(); });
    body.appendChild(block('Sound FX', 'Analog combat sounds. No 8-bit beeps. Needs a tap to unlock audio.', sfxCb));

    const volHold = document.createElement('div'); volHold.className = 'set-slide';
    const vol = document.createElement('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = this.game.sfx.volume;
    const volVal = document.createElement('span'); volVal.textContent = this.game.sfx.volume;
    vol.addEventListener('input', () => { this.game.sfx.setVolume(parseFloat(vol.value)); volVal.textContent = vol.value; this.game.sfx.unlock(); });
    volHold.appendChild(vol); volHold.appendChild(volVal);
    body.appendChild(block('SFX Volume', 'Master volume for slashes, impacts, gacha, and jumps.', volHold));

    const openSettings = () => this.togglePanel('settingsPanel');
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('menuSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('setClose').addEventListener('click', () => this.closePanel('settingsPanel'));
    document.getElementById('helpBtn').addEventListener('click', () => this.togglePanel('helpPanel'));
    document.getElementById('helpClose').addEventListener('click', () => this.closePanel('helpPanel'));
    document.getElementById('skillClose').addEventListener('click', () => this.closeSkillBar());
    document.getElementById('skillReopen').addEventListener('click', () => this.openSkillBar());
    const awakenBtn = document.getElementById('awakenBtn');
    if (awakenBtn && !awakenBtn.dataset.bound) {
      awakenBtn.dataset.bound = '1';
      awakenBtn.addEventListener('click', () => this.game.tryAwaken && this.game.tryAwaken());
    }
    document.getElementById('playBtn').addEventListener('click', () => {
      if (!this.game.faction) this.showSidePick();
      else this.game.startPlay();
    });
    const pirate = document.getElementById('pickPirate');
    const marine = document.getElementById('pickMarine');
    if (pirate) pirate.addEventListener('click', () => this.game.pickSide('pirate'));
    if (marine) marine.addEventListener('click', () => this.game.pickSide('marine'));
  }

  showSidePick() {
    const el = document.getElementById('sidePick');
    if (el) el.classList.remove('hidden');
  }
  closeSidePick() {
    const el = document.getElementById('sidePick');
    if (el) el.classList.add('hidden');
  }
  setFaction(id) {
    const def = SIDES[id];
    const el = document.getElementById('sideCount');
    if (el) el.textContent = def ? `${def.emoji} ${def.name}` : '—';
  }

  buildProgressionPanels() {
    document.getElementById('dealerBtn').addEventListener('click', () => { this.togglePanel('dealerPanel'); this.renderDealerStock(); });
    document.getElementById('dealerClose').addEventListener('click', () => this.closePanel('dealerPanel'));
    const shopBtn = document.getElementById('shopBtn');
    if (shopBtn) shopBtn.addEventListener('click', () => { this.togglePanel('shopPanel'); this.renderShop(); });
    const shopClose = document.getElementById('shopClose');
    if (shopClose) shopClose.addEventListener('click', () => this.closePanel('shopPanel'));
    document.getElementById('statsBtn').addEventListener('click', () => { this.togglePanel('statsPanel'); this.refreshStats(); });
    document.getElementById('statsClose').addEventListener('click', () => this.closePanel('statsPanel'));
    document.getElementById('boatBtn').addEventListener('click', () => { this.togglePanel('boatPanel'); this.renderBoatShop(); });
    document.getElementById('boatClose').addEventListener('click', () => this.closePanel('boatPanel'));
    document.getElementById('codesBtn').addEventListener('click', () => this.togglePanel('codesPanel'));
    document.getElementById('menuCodesBtn').addEventListener('click', () => this.togglePanel('codesPanel'));
    document.getElementById('codesClose').addEventListener('click', () => this.closePanel('codesPanel'));
    document.getElementById('codesForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('codeInput');
      const result = this.game.redeemCode(input.value);
      this.toast(result.message);
      if (result.ok) input.value = '';
    });
    document.getElementById('questBtn').addEventListener('click', () => { this.togglePanel('questPanel'); this.renderQuests(); });
    document.getElementById('questClose').addEventListener('click', () => this.closePanel('questPanel'));
    document.getElementById('gachaBtn').addEventListener('click', () => { this.togglePanel('gachaPanel'); this.renderGacha(); });
    document.getElementById('gachaClose').addEventListener('click', () => this.closePanel('gachaPanel'));
    document.getElementById('gachaSpin').addEventListener('click', () => this.game.spinGacha(1));
    document.getElementById('gachaSpin10').addEventListener('click', () => this.game.spinGacha(10));
    const talkBtn = document.getElementById('talkBtn');
    if (talkBtn) {
      talkBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.game.talkToNpc();
      });
    }
    ['health', 'fruit', 'sword', 'fighting'].forEach((type) => {
      document.getElementById(`${type}StatBuy`).addEventListener('click', () => this.game.allocateStat(type));
    });
    this.renderDealerStock(); this.renderBoatShop(); this.refreshStats(); this.renderQuests(); this.renderGacha(); this.renderRaces(); this.renderShop();
  }

  renderDealerStock() {
    const stock = document.getElementById('dealerStock');
    if (!stock) return;
    stock.innerHTML = '';
    (this.game.dealer.stock || []).forEach((id) => {
      const fruit = FRUITS[id];
      if (!fruit) return;
      const price = FRUIT_DEALER.prices[id] || 2000;
      const card = document.createElement('button'); card.className = 'dealer-card'; card.disabled = this.game.ownedFruits.has(id);
      card.innerHTML = `<span>${fruit.emoji}</span><b>${fruit.name}</b><small>${card.disabled ? 'Owned' : `${Number(price).toLocaleString()} money`}</small>`;
      card.addEventListener('click', () => { const result = this.game.dealer.buy(id, this.game); this.setTokens(this.game.tokens); this.refreshInventory(); this.renderDealerStock(); this.renderQuests(); this.toast(result.message); });
      stock.appendChild(card);
    });
  }

  renderShop() {
    const wrap = document.getElementById('shopStock');
    if (!wrap) return;
    wrap.innerHTML = '';
    const g = this.game;
    Object.values(ACCESSORIES).forEach((a) => {
      const owned = g.ownedAccessories && g.ownedAccessories.has(a.id);
      const on = g.equippedAccessory === a.id;
      const card = document.createElement('button');
      card.className = 'dealer-card' + (on ? ' selected' : '');
      card.type = 'button';
      card.innerHTML = `<span>${a.emoji}</span><b>${a.name}</b><small>${on ? 'Equipped' : owned ? 'Owned — equip' : `${a.price.toLocaleString()} money`}</small>`;
      card.title = a.blurb || '';
      card.addEventListener('click', () => {
        const result = g.accessoryShop.buy(a.id, g);
        this.setTokens(g.tokens);
        this.renderShop();
        this.toast(result.message);
      });
      wrap.appendChild(card);
    });
  }

  renderBoatShop() {
    const boats = document.getElementById('boatStock'); boats.innerHTML = '';
    Object.values(BOATS).forEach((b) => {
      const owned = this.game.ownedBoats.has(b.id);
      const selected = this.game.selectedBoat === b.id;
      const card = document.createElement('button');
      card.className = 'dealer-card' + (selected ? ' selected' : '');
      card.innerHTML = `<span>${b.emoji}</span><b>${b.name}</b><small>${owned ? (selected ? 'Selected' : 'Owned — select') : `${b.price.toLocaleString()} money`}</small>`;
      card.addEventListener('click', () => {
        const result = this.game.shipwright.buyBoat(b.id, this.game);
        this.setTokens(this.game.tokens); this.renderBoatShop(); this.renderQuests(); this.toast(result.message);
      });
      boats.appendChild(card);
    });
    const swords = document.getElementById('swordStock'); swords.innerHTML = '';
    Object.values(SWORDS).forEach((s) => {
      const owned = this.game.ownedSwords.has(s.id);
      const card = document.createElement('button'); card.className = 'dealer-card'; card.disabled = owned;
      card.innerHTML = `<span>${s.emoji}</span><b>${s.name}</b><small>${owned ? 'Owned' : `${SWORD_PRICES[s.id].toLocaleString()} money`}</small>`;
      card.addEventListener('click', () => {
        const result = this.game.shipwright.buySword(s.id, this.game);
        this.setTokens(this.game.tokens); this.refreshInventory(); this.renderBoatShop(); this.toast(result.message);
      });
      swords.appendChild(card);
    });
    const styles = document.getElementById('styleStock');
    if (styles) {
      styles.innerHTML = '';
      Object.values(FIGHTING_STYLES).forEach((s) => {
        if (s.id === 'combat') return;
        const owned = this.game.ownedStyles.has(s.id);
        const card = document.createElement('button'); card.className = 'dealer-card'; card.disabled = owned;
        card.innerHTML = `<span>${s.emoji}</span><b>${s.name}</b><small>${owned ? 'Owned' : `${STYLE_PRICES[s.id].toLocaleString()} money`}</small>`;
        card.addEventListener('click', () => {
          const result = this.game.shipwright.buyStyle(s.id, this.game);
          this.setTokens(this.game.tokens); this.refreshInventory(); this.renderBoatShop(); this.toast(result.message);
        });
        styles.appendChild(card);
      });
    }
  }

  renderGacha(last) {
    const g = this.game.gacha;
    const feat = document.getElementById('gachaFeatured');
    if (feat) feat.textContent = g.featured
      ? `Featured legendary today: ${g.featured.emoji} ${g.featured.ref.name} (50% of legendary hits).`
      : 'No featured legendary today.';
    const rates = document.getElementById('gachaRates');
    if (rates) {
      const r = GACHA.rates;
      rates.innerHTML = `<span>Common ${(r.common * 100).toFixed(0)}%</span><span>Rare ${(r.rare * 100).toFixed(0)}%</span><span>Epic ${(r.epic * 100).toFixed(0)}%</span><span>Legendary ${(r.legendary * 100).toFixed(0)}%</span>`;
    }
    const lFill = document.getElementById('pityLFill');
    const eFill = document.getElementById('pityEFill');
    if (lFill) lFill.style.width = `${Math.min(100, (g.pityL / GACHA.legendaryPity) * 100)}%`;
    if (eFill) eFill.style.width = `${Math.min(100, (g.pityE / GACHA.epicPity) * 100)}%`;
    const lText = document.getElementById('pityLText');
    const eText = document.getElementById('pityEText');
    if (lText) lText.textContent = `${g.pityL}/${GACHA.legendaryPity}`;
    if (eText) eText.textContent = `${g.pityE}/${GACHA.epicPity}`;
    const cost = document.getElementById('gachaCost');
    if (cost) cost.textContent = GACHA.cost.toLocaleString();
    const ten = document.getElementById('gachaTenCost');
    if (ten) ten.textContent = GACHA.tenCost.toLocaleString();
    const hist = document.getElementById('gachaHistory');
    if (hist) {
      hist.innerHTML = g.history.slice(0, 10).map((h) =>
        `<div class="gacha-chip ${h.rarity}" title="${h.name}">${h.emoji}</div>`
      ).join('') || '<small>No pulls yet.</small>';
    }
    const result = document.getElementById('gachaResult');
    if (!result) return;
    if (!last || !last.ok) {
      if (!result.innerHTML) result.innerHTML = '<small>Pull to reveal fruit, steel, or style.</small>';
      return;
    }
    const pulls = last.pulls && last.pulls.length ? last.pulls : [{ item: last.item, rarity: last.rarity, dupe: last.dupe }];
    result.className = 'gacha-result ' + last.rarity;
    result.innerHTML = pulls.map((p) =>
      `<div class="gacha-card ${p.rarity}"><span>${p.item.emoji}</span><b>${p.item.ref.name}</b><small>${p.rarity}${p.dupe ? ' · dupe' : ''}</small></div>`
    ).join('');
  }

  renderQuests() {
    const list = document.getElementById('questList');
    if (!list) return;
    list.innerHTML = '';
    const g = this.game;
    QUESTS.forEach((q) => {
      const have = g.questStats[q.stat] || 0;
      const claimed = g.claimedQuests.has(q.id);
      const ready = !claimed && have >= q.need;
      const card = document.createElement('div');
      card.className = 'quest-card' + (claimed ? ' claimed' : ready ? ' done' : '');
      const pct = Math.min(100, (have / q.need) * 100);
      card.innerHTML = `
        <h4>${q.title}</h4>
        <p>${q.desc}</p>
        <div class="quest-prog"><i style="width:${pct}%"></i></div>
        <p>${Math.min(have, q.need)} / ${q.need} · Reward ${q.reward.tokens ? q.reward.tokens.toLocaleString() + ' money' : ''}${q.reward.tokens && q.reward.xp ? ' + ' : ''}${q.reward.xp ? q.reward.xp + ' XP' : ''}</p>
        <button class="quest-claim" type="button" ${ready ? '' : 'disabled'}>${claimed ? 'Claimed' : ready ? 'Claim' : 'In progress'}</button>`;
      const btn = card.querySelector('.quest-claim');
      btn.addEventListener('click', () => {
        const result = this.game.claimQuest(q.id);
        this.toast(result.message);
        this.renderQuests();
      });
      list.appendChild(card);
    });
    const secret = document.getElementById('secretQuestList') || list;
    if (secret !== list) secret.innerHTML = '';
    SECRET_QUESTS.forEach((q) => {
      const have = g.questStats[q.stat] || 0;
      const claimed = g.claimedQuests.has(q.id);
      const ready = !claimed && have >= q.need;
      const card = document.createElement('div');
      card.className = 'quest-card secret' + (claimed ? ' claimed' : ready ? ' done' : '');
      const pct = Math.min(100, (have / q.need) * 100);
      card.innerHTML = `
        <h4>${q.title}</h4>
        <p>${q.desc}</p>
        <div class="quest-prog"><i style="width:${pct}%"></i></div>
        <p>${Math.min(have, q.need)} / ${q.need} · Reward +${q.reward.levels} levels</p>
        <button class="quest-claim" type="button" ${ready ? '' : 'disabled'}>${claimed ? 'Claimed' : ready ? 'Claim' : 'Hidden bounty'}</button>`;
      card.querySelector('.quest-claim').addEventListener('click', () => {
        const result = this.game.claimQuest(q.id);
        this.toast(result.message);
        this.renderQuests();
      });
      secret.appendChild(card);
    });
  }

  renderRaces() {
    const wrap = document.getElementById('raceStock');
    if (!wrap) return;
    wrap.innerHTML = '';
    const g = this.game;
    Object.values(RACES).forEach((r) => {
      const card = document.createElement('button');
      card.className = 'dealer-card' + (g.raceId === r.id ? ' selected' : '');
      card.type = 'button';
      card.innerHTML = `<span>${r.emoji}</span><b>${r.name}</b><small>${g.raceId === r.id ? 'Active' : r.blurb}</small>`;
      card.addEventListener('click', () => g.setRace(r.id));
      wrap.appendChild(card);
    });
  }

  setPrompt(text) {
    const el = document.getElementById('prompt');
    const talk = document.getElementById('talkBtn');
    if (!text) {
      el.classList.add('hidden'); el.textContent = '';
      if (talk) talk.classList.add('hidden');
      return;
    }
    el.textContent = text;
    el.classList.remove('hidden');
    if (talk && /quest|talk|shop/i.test(text)) talk.classList.remove('hidden');
    else if (talk) talk.classList.add('hidden');
  }

  refreshStats() {
    const g = this.game;
    document.getElementById('statPoints').textContent = g.statPoints.toLocaleString();
    document.getElementById('healthStatValue').textContent = g.stats.health.toLocaleString();
    document.getElementById('fruitStatValue').textContent = g.stats.fruit.toLocaleString();
    document.getElementById('swordStatValue').textContent = g.stats.sword.toLocaleString();
    document.getElementById('fightingStatValue').textContent = g.stats.fighting.toLocaleString();
  }

  updateProgression() {
    const seconds = Math.max(0, Math.ceil(this.game.dealer.remaining));
    document.getElementById('stockTimer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  closeSkillBar() {
    document.getElementById('skillbar').classList.add('hidden');
    document.getElementById('skillReopen').classList.remove('hidden');
  }
  openSkillBar() {
    document.getElementById('skillbar').classList.remove('hidden');
    document.getElementById('skillReopen').classList.add('hidden');
  }

  setHp(frac) {
    const bounded = Math.max(0, Math.min(1, frac));
    document.getElementById('hpFill').style.width = bounded * 100 + '%';
    const current = Math.round(this.game.player.hp).toLocaleString();
    const maximum = Math.round(this.game.player.maxHp).toLocaleString();
    document.getElementById('hpCount').textContent = `${current} / ${maximum}`;
  }
  setLevel(level, xp, needed) {
    document.getElementById('levelCount').textContent = level.toLocaleString();
    document.getElementById('xpFill').style.width = Math.max(0, Math.min(1, xp / needed)) * 100 + '%';
    const label = `${Math.floor(xp).toLocaleString()} / ${Math.floor(needed).toLocaleString()}`;
    document.getElementById('xpCount').textContent = label;
    const menu = document.getElementById('menuXp');
    if (menu) menu.textContent = label;
  }
  setTokens(n) {
    const v = Math.floor(n).toLocaleString();
    document.getElementById('tokenCount').textContent = v;
    const money = document.getElementById('moneyCount');
    if (money) money.textContent = v;
    const menu = document.getElementById('menuMoney');
    if (menu) menu.textContent = v;
  }
  setKills(n) { document.getElementById('killCount').textContent = n; }
  setFps(n) { const el = document.getElementById('fpsCount'); if (el) el.textContent = Math.round(n); }
  setGpu(name) {
    const v = name || 'gpu: unknown';
    const chip = document.getElementById('gpuCount');
    if (chip) chip.textContent = v;
    const loader = document.getElementById('loaderGpu');
    if (loader) loader.textContent = v;
  }
  setJumps(n, max, onGround) {
    const left = onGround ? max : n;
    const el = document.getElementById('jumpsCount');
    if (el) el.textContent = `${left}/${max}`;
    const btn = document.getElementById('jumpBtnCount');
    if (btn) btn.textContent = String(left);
  }

  toast(msg, ms = 2200) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.remove('hidden'); t.style.opacity = '1';
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, ms);
  }
}

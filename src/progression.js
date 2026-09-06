// ============================================================
// Fruit dealer, boat / armory shop, world spawns, local guard.
// ============================================================
import * as THREE from 'three';
import { FRUITS, FRUIT_DEALER, FRUIT_SPAWNS, BOATS, SWORD_PRICES, SWORDS, FIGHTING_STYLES, STYLE_PRICES, GACHA, GACHA_POOL } from './config.js';

const fruitIds = Object.keys(FRUITS);

export class FruitDealer {
  constructor() { this.stock = []; this.remaining = 0; this.refresh(); }
  refresh() {
    const bag = [...fruitIds].sort(() => Math.random() - 0.5);
    this.stock = bag.slice(0, FRUIT_DEALER.slots);
    this.remaining = FRUIT_DEALER.refreshSeconds;
  }
  update(dt) { this.remaining -= dt; if (this.remaining <= 0) { this.refresh(); return true; } return false; }
  buy(id, game) {
    if (!this.stock.includes(id)) return { ok: false, message: 'That fruit is no longer in stock.' };
    if (game.ownedFruits.has(id)) return { ok: false, message: `You already own ${FRUITS[id].name}.` };
    const price = FRUIT_DEALER.prices[id];
    if (game.tokens < price) return { ok: false, message: `Need ${price.toLocaleString()} tokens.` };
    game.tokens -= price; game.ownedFruits.add(id); return { ok: true, message: `${FRUITS[id].name} acquired!` };
  }
}

export class BoatDealer {
  buyBoat(id, game) {
    const def = BOATS[id];
    if (!def) return { ok: false, message: 'Unknown vessel.' };
    if (game.ownedBoats.has(id)) {
      game.selectedBoat = id;
      return { ok: true, message: `${def.name} selected. Sail from the southern dock.` };
    }
    if (game.tokens < def.price) return { ok: false, message: `Need ${def.price.toLocaleString()} tokens.` };
    game.tokens -= def.price;
    game.ownedBoats.add(id);
    game.selectedBoat = id;
    if (game.noteQuest) game.noteQuest('boats');
    return { ok: true, message: `${def.name} is yours! Head to the dock and press Sail.` };
  }
  buySword(id, game) {
    const def = SWORDS[id];
    if (!def) return { ok: false, message: 'Unknown blade.' };
    if (game.ownedSwords.has(id)) return { ok: false, message: `You already own ${def.name}.` };
    const price = SWORD_PRICES[id];
    if (game.tokens < price) return { ok: false, message: `Need ${price.toLocaleString()} tokens.` };
    game.tokens -= price;
    game.ownedSwords.add(id);
    return { ok: true, message: `${def.name} purchased — equip it from inventory.` };
  }
  buyStyle(id, game) {
    const def = FIGHTING_STYLES[id];
    if (!def || id === 'combat') return { ok: false, message: 'Unknown fighting style.' };
    if (game.ownedStyles.has(id)) return { ok: false, message: `You already know ${def.name}.` };
    const price = STYLE_PRICES[id];
    if (game.tokens < price) return { ok: false, message: `Need ${price.toLocaleString()} tokens.` };
    game.tokens -= price;
    game.ownedStyles.add(id);
    return { ok: true, message: `${def.name} learned — equip it from inventory.` };
  }
}

export class Gacha {
  constructor() {
    this.pityL = 0;
    this.pityE = 0;
    this.history = [];
    this.featured = this._dailyFeatured();
    this._load();
  }
  _dailyFeatured() {
    const legends = GACHA_POOL.filter((p) => p.rarity === 'legendary');
    const day = Math.floor(Date.now() / 86400000);
    return legends.length ? legends[day % legends.length] : null;
  }
  _load() {
    try {
      const raw = JSON.parse(localStorage.getItem('fb_gacha') || 'null');
      if (!raw) return;
      this.pityL = raw.pityL || 0;
      this.pityE = raw.pityE || 0;
      this.history = Array.isArray(raw.history) ? raw.history.slice(0, 20) : [];
    } catch (_) {}
  }
  _save() {
    try { localStorage.setItem('fb_gacha', JSON.stringify({ pityL: this.pityL, pityE: this.pityE, history: this.history.slice(0, 20) })); } catch (_) {}
  }
  _owned(game, item) {
    if (item.type === 'fruit') return game.ownedFruits.has(item.id);
    if (item.type === 'sword') return game.ownedSwords.has(item.id);
    return game.ownedStyles.has(item.id);
  }
  _grant(game, item) {
    if (item.type === 'fruit') game.ownedFruits.add(item.id);
    else if (item.type === 'sword') game.ownedSwords.add(item.id);
    else game.ownedStyles.add(item.id);
  }
  _pick(game, rarity) {
    let pool = GACHA_POOL.filter((p) => p.rarity === rarity);
    if (!pool.length) pool = GACHA_POOL;
    if (rarity === 'legendary' && this.featured && Math.random() < 0.5) {
      const f = pool.find((p) => p.id === this.featured.id);
      if (f) return f;
    }
    const fresh = pool.filter((p) => !this._owned(game, p));
    const use = fresh.length ? fresh : pool;
    return use[(Math.random() * use.length) | 0];
  }
  _rollOne(game) {
    this.pityL += 1;
    this.pityE += 1;
    let rarity;
    if (this.pityL >= GACHA.legendaryPity) rarity = 'legendary';
    else if (this.pityE >= GACHA.epicPity) rarity = 'epic';
    else {
      let r = Math.random();
      if (this.pityL >= GACHA.softPityStart) r -= (this.pityL - GACHA.softPityStart) * 0.018;
      const rates = GACHA.rates;
      if (r < rates.legendary) rarity = 'legendary';
      else if (r < rates.legendary + rates.epic) rarity = 'epic';
      else if (r < rates.legendary + rates.epic + rates.rare) rarity = 'rare';
      else rarity = 'common';
    }
    if (rarity === 'legendary') this.pityL = 0;
    if (rarity === 'epic' || rarity === 'legendary') this.pityE = 0;
    const pick = this._pick(game, rarity);
    const dupe = this._owned(game, pick);
    let refund = 0;
    if (dupe) {
      refund = Math.floor(GACHA.cost * (GACHA.dupeRefund[rarity] || 0.4));
      game.tokens += refund;
    } else this._grant(game, pick);
    const entry = { id: pick.id, name: pick.ref.name, emoji: pick.emoji, type: pick.type, rarity, dupe, refund };
    this.history.unshift(entry);
    if (this.history.length > 20) this.history.length = 20;
    return { item: pick, rarity, dupe, refund };
  }
  roll(game, count = 1) {
    count = count === 10 ? 10 : 1;
    const cost = count === 10 ? GACHA.tenCost : GACHA.cost;
    if (game.tokens < cost) return { ok: false, message: `Need ${cost.toLocaleString()} money to ${count === 10 ? 'do a 10-pull' : 'spin'}.`, pulls: [] };
    game.tokens -= cost;
    const pulls = [];
    for (let i = 0; i < count; i++) pulls.push(this._rollOne(game));
    if (count === 10 && !pulls.some((p) => p.rarity !== 'common')) {
      const last = pulls[pulls.length - 1];
      if (last.dupe) game.tokens -= last.refund;
      const rare = this._pick(game, 'rare');
      const dupe = this._owned(game, rare);
      let refund = 0;
      if (dupe) { refund = Math.floor(GACHA.cost * GACHA.dupeRefund.rare); game.tokens += refund; }
      else this._grant(game, rare);
      pulls[pulls.length - 1] = { item: rare, rarity: 'rare', dupe, refund };
      this.history[0] = { id: rare.id, name: rare.ref.name, emoji: rare.emoji, type: rare.type, rarity: 'rare', dupe, refund };
    }
    this._save();
    const best = pulls.reduce((a, b) => {
      const rank = { common: 0, rare: 1, epic: 2, legendary: 3 };
      return rank[b.rarity] > rank[a.rarity] ? b : a;
    }, pulls[0]);
    const news = pulls.filter((p) => !p.dupe).length;
    const dupes = pulls.length - news;
    const msg = count === 1
      ? (best.dupe
        ? `${best.rarity.toUpperCase()} duplicate ${best.item.ref.name} — refunded ${best.refund.toLocaleString()} money.`
        : `${best.rarity.toUpperCase()}! You pulled ${best.item.emoji} ${best.item.ref.name}.`)
      : `10-pull: ${news} new · ${dupes} dupes · best ${best.rarity.toUpperCase()} ${best.item.ref.name}.`;
    return { ok: true, pulls, item: best.item, rarity: best.rarity, dupe: best.dupe, pityL: this.pityL, pityE: this.pityE, message: msg };
  }
}

export class FruitSpawner {
  constructor(scene, treePoints = []) { this.scene = scene; this.treePoints = treePoints; this.active = []; this.nextSpawn = FRUIT_SPAWNS.intervalSeconds; }
  update(dt) {
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) { this.nextSpawn += FRUIT_SPAWNS.intervalSeconds; this.spawn(); }
    for (const fruit of this.active) { fruit.life -= dt; fruit.mesh.rotation.y += dt * 1.7; fruit.mesh.position.y = 1.25 + Math.sin(fruit.life * 3) * 0.22; }
    this.active.filter((fruit) => fruit.life <= 0).forEach((fruit) => this.remove(fruit));
  }
  spawn() {
    if (this.active.length >= FRUIT_SPAWNS.maxActive) return;
    const id = fruitIds[(Math.random() * fruitIds.length) | 0];
    const tree = this.treePoints[(Math.random() * this.treePoints.length) | 0];
    const angle = Math.random() * Math.PI * 2, radius = tree ? 1.5 + Math.random() * 3 : 12 + Math.random() * 40;
    const mesh = new THREE.Group();
    const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), new THREE.MeshStandardMaterial({ color: FRUITS[id].color, emissive: FRUITS[id].color, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.25 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: FRUITS[id].color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    ring.rotation.x = Math.PI / 2; mesh.add(fruit, ring); mesh.position.set((tree?.x || 0) + Math.cos(angle) * radius, 1.25, (tree?.z || 0) + Math.sin(angle) * radius);
    this.scene.add(mesh); this.active.push({ id, mesh, life: FRUIT_SPAWNS.lifetimeSeconds });
  }
  nearFruit(position, distance = 3.4) {
    return this.active.some((item) => item.mesh.position.distanceTo(position) <= distance);
  }
  collectNearby(position, distance = 3.4) {
    const fruit = this.active.find((item) => item.mesh.position.distanceTo(position) <= distance);
    if (!fruit) return null;
    this.remove(fruit); return fruit.id;
  }
  remove(fruit) { this.scene.remove(fruit.mesh); this.active = this.active.filter((item) => item !== fruit); }
}

export function validateGameState(game) {
  if (!Number.isFinite(game.tokens) || game.tokens < 0) game.tokens = 0;
  if (!Number.isFinite(game.xp) || game.xp < 0) game.xp = 0;
  game.level = Math.max(1, Math.min(100000, Math.floor(game.level) || 1));
  game.player.hp = Math.max(0, Math.min(game.player.maxHp, game.player.hp));
  if (!Number.isFinite(game.player.position.x) || !Number.isFinite(game.player.position.z)) game.player.position.set(0, 0, 0);
  if (game.player.airJumps < 0 || game.player.airJumps > 20) game.player.airJumps = Math.max(0, Math.min(20, game.player.airJumps || 0));
}

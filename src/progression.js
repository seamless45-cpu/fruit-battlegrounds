// ============================================================
// Fruit dealer, physical world spawns, and local state guard.
// Authoritative validation belongs on a server in a multiplayer build;
// this guard keeps this standalone browser demo recoverable and stable.
// ============================================================
import * as THREE from 'three';
import { FRUITS, FRUIT_DEALER, FRUIT_SPAWNS } from './config.js';

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

export class FruitSpawner {
  constructor(scene) { this.scene = scene; this.active = []; this.nextSpawn = FRUIT_SPAWNS.intervalSeconds; }
  update(dt) {
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) { this.nextSpawn += FRUIT_SPAWNS.intervalSeconds; this.spawn(); }
    for (const fruit of this.active) { fruit.life -= dt; fruit.mesh.rotation.y += dt * 1.7; fruit.mesh.position.y = 1.25 + Math.sin(fruit.life * 3) * 0.22; }
    this.active.filter((fruit) => fruit.life <= 0).forEach((fruit) => this.remove(fruit));
  }
  spawn() {
    if (this.active.length >= FRUIT_SPAWNS.maxActive) return;
    const id = fruitIds[(Math.random() * fruitIds.length) | 0];
    const angle = Math.random() * Math.PI * 2, radius = 25 + Math.random() * 105;
    const mesh = new THREE.Group();
    const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 2), new THREE.MeshStandardMaterial({ color: FRUITS[id].color, emissive: FRUITS[id].color, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.25 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: FRUITS[id].color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    ring.rotation.x = Math.PI / 2; mesh.add(fruit, ring); mesh.position.set(Math.cos(angle) * radius, 1.25, Math.sin(angle) * radius);
    this.scene.add(mesh); this.active.push({ id, mesh, life: FRUIT_SPAWNS.lifetimeSeconds });
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
}

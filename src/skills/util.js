/** Shared helpers for skill implementations. */
import * as THREE from 'three';
import { rand, randInt, clamp, TAU, tmp } from '../core/utils.js';

/** random ground point within `radius` of `center`, kept inside the arena */
export function randNear(center, radius, out = new THREE.Vector3()) {
  const a = Math.random() * TAU;
  const r = radius * Math.sqrt(Math.random());
  out.set(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
  return out;
}

/** random ground point anywhere in the arena (optionally near a center) */
export function randArena(world, center = null, radius = 90, out = new THREE.Vector3()) {
  if (center) return randNear(center, radius, out);
  const a = Math.random() * TAU;
  const r = Math.sqrt(Math.random()) * world.arenaRadius * 0.8;
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
}

/** unit XZ direction from → to */
export function dirTo(from, to, out = new THREE.Vector3()) {
  out.set(to.x - from.x, 0, to.z - from.z);
  const l = out.length();
  if (l < 0.001) out.set(Math.sin(0), 0, 1);
  else out.divideScalar(l);
  return out;
}

const ROCK_GEO = new THREE.IcosahedronGeometry(1, 1);

/** Turn an enemy into a giant rock for `duration` seconds. */
export function rockify(entity, duration, { scale = 2.2, color = 0x6b6154 } = {}) {
  if (entity._rock) return entity._rock;
  const mesh = new THREE.Mesh(ROCK_GEO, new THREE.MeshStandardMaterial({
    color, roughness: 1, flatShading: true, emissive: 0x2a1206, emissiveIntensity: 0.6,
  }));
  mesh.scale.setScalar(scale);
  mesh.position.y = scale * 0.85;
  mesh.castShadow = true;
  entity.mesh.add(mesh);
  entity.rig.group.visible = false;
  entity.bar.visible = false;
  entity._rock = mesh;
  entity._rockT = duration;
  return mesh;
}

export function unrockify(entity) {
  if (!entity._rock) return;
  entity.mesh.remove(entity._rock);
  entity._rock.geometry = ROCK_GEO;
  entity._rock.material.dispose();
  entity._rock = null;
  entity.rig.group.visible = true;
  entity.bar.visible = true;
}

/** Pick N distinct random enemies, reusing targets only if there aren't enough. */
export function pickTargets(list, n) {
  const pool = list.filter(e => e.alive);
  const out = [];
  if (!pool.length) return out;
  for (let i = 0; i < n; i++) {
    if (!pool.length) pool.push(...list.filter(e => e.alive));
    if (!pool.length) break;
    const idx = (Math.random() * pool.length) | 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** Hand / sword world position of a player (approx). */
export function handPos(player, out = new THREE.Vector3()) {
  const hand = player.rig.parts.armR.hand;
  hand.getWorldPosition(out);
  return out;
}

/** Both arm world positions (for debris spawns). */
export function armPositions(player) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  player.rig.parts.armR.hand.getWorldPosition(a);
  player.rig.parts.armL.hand.getWorldPosition(b);
  return [a, b];
}

export { rand, randInt, clamp, TAU };

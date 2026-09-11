/**
 * Low-poly humanoid rig shared by the player and enemies, with a tiny
 * procedural animation system (idle bob, run cycle, attack poses, casts).
 */
import * as THREE from 'three';

/**
 * Geometry cache. Every character shares the same unit-scale boxes, so
 * spawning a wave costs materials + Object3Ds instead of 20 new GPU buffers.
 * Cached geometries are flagged `shared` so Entity.destroy() never frees them.
 */
const GEO_CACHE = new Map();
function cached(key, make) {
  let g = GEO_CACHE.get(key);
  if (!g) { g = make(); g.userData.shared = true; GEO_CACHE.set(key, g); }
  return g;
}
const box = (w, h, d) => cached(`box:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.75, metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: opts.flat ?? true,
  });
}

/**
 * @returns {{group:THREE.Group, parts:Object, update:Function}}
 */
export function makeHumanoid({
  skin = 0xf1c27d, shirt = 0x3b82f6, pants = 0x1f2937, accent = 0xffffff,
  scale = 1, hair = 0x2b1b12, eye = 0x9ef1ff, cape = null,
} = {}) {
  const group = new THREE.Group();
  const S = 1;                    // unit scale — group.scale carries the size
  group.scale.setScalar(scale);

  const bodyMat = mat(shirt);
  const skinMat = mat(skin);
  const pantsMat = mat(pants);
  const hairMat = mat(hair, { roughness: 0.9 });

  // ---- hips / torso ----
  const hips = new THREE.Group();
  hips.position.y = 0.92 * S;
  group.add(hips);

  const torso = new THREE.Mesh(box(0.62 * S, 0.78 * S, 0.36 * S), bodyMat);
  torso.position.y = 0.39 * S;
  torso.castShadow = true;
  hips.add(torso);

  const belt = new THREE.Mesh(box(0.66 * S, 0.12 * S, 0.4 * S), mat(accent, { roughness: 0.5 }));
  belt.position.y = 0.02 * S;
  hips.add(belt);

  // ---- head ----
  const neck = new THREE.Group();
  neck.position.y = 0.82 * S;
  hips.add(neck);
  const head = new THREE.Mesh(box(0.42 * S, 0.42 * S, 0.4 * S), skinMat);
  head.position.y = 0.22 * S;
  head.castShadow = true;
  neck.add(head);
  const hairMesh = new THREE.Mesh(box(0.46 * S, 0.16 * S, 0.44 * S), hairMat);
  hairMesh.position.y = 0.42 * S;
  neck.add(hairMesh);

  // eyes (glowing)
  const eyeMat = new THREE.MeshBasicMaterial({ color: eye });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(box(0.07 * S, 0.07 * S, 0.02 * S), eyeMat);
    e.position.set(sx * 0.1 * S, 0.25 * S, 0.2 * S);
    neck.add(e);
  }

  // ---- arms ----
  const mkArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.4 * S, 0.72 * S, 0);
    hips.add(shoulder);
    const upper = new THREE.Mesh(box(0.19 * S, 0.42 * S, 0.19 * S), skinMat);
    upper.position.y = -0.21 * S;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42 * S;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(box(0.17 * S, 0.4 * S, 0.17 * S), skinMat);
    fore.position.y = -0.2 * S;
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -0.4 * S;
    elbow.add(hand);
    return { shoulder, elbow, hand };
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // ---- legs ----
  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17 * S, 0, 0);
    hips.add(hip);
    const thigh = new THREE.Mesh(box(0.23 * S, 0.46 * S, 0.23 * S), pantsMat);
    thigh.position.y = -0.23 * S;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46 * S;
    hip.add(knee);
    const shin = new THREE.Mesh(box(0.21 * S, 0.44 * S, 0.21 * S), pantsMat);
    shin.position.y = -0.22 * S;
    knee.add(shin);
    const foot = new THREE.Mesh(box(0.24 * S, 0.12 * S, 0.34 * S), mat(0x111827));
    foot.position.set(0, -0.44 * S, 0.06 * S);
    knee.add(foot);
    return { hip, knee, foot };
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // optional cape
  let capeMesh = null;
  if (cape) {
    capeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7 * S, 1.1 * S, 1, 4),
      new THREE.MeshStandardMaterial({ color: cape, roughness: 0.9, side: THREE.DoubleSide }),
    );
    capeMesh.position.set(0, 0.3 * S, -0.22 * S);
    hips.add(capeMesh);
  }

  const parts = { hips, torso, neck, head, armL, armR, legL, legR, cape: capeMesh, eyeMat };

  /**
   * @param {number} dt
   * @param {object} s { speed, moveSpeed, grounded, attack:{t,dur,kind}, cast, t, stunned, lifted, frozen }
   */
  function update(dt, s = {}) {
    const t = s.t || 0;
    const speed = s.speed || 0;
    const moving = speed > 0.4;
    const cycle = t * (5.2 + Math.min(speed, 12) * 0.42);

    // ---- legs ----
    if (moving) {
      const sw = Math.sin(cycle) * Math.min(0.95, 0.28 + speed * 0.055);
      legL.hip.rotation.x = sw;
      legR.hip.rotation.x = -sw;
      legL.knee.rotation.x = Math.max(0, -sw) * 0.9 + 0.12;
      legR.knee.rotation.x = Math.max(0, sw) * 0.9 + 0.12;
      hips.position.y = (0.92 + Math.abs(Math.sin(cycle)) * 0.055) * S;
      hips.rotation.z = Math.sin(cycle) * 0.03;
    } else {
      legL.hip.rotation.x *= 1 - Math.min(1, dt * 10);
      legR.hip.rotation.x *= 1 - Math.min(1, dt * 10);
      legL.knee.rotation.x = 0.08; legR.knee.rotation.x = 0.08;
      hips.position.y = (0.92 + Math.sin(t * 1.9) * 0.022) * S;
      hips.rotation.z *= 1 - Math.min(1, dt * 8);
    }

    // ---- arms ----
    const atk = s.attack;
    if (atk && atk.t < atk.dur) {
      // swing: windup then slash
      const k = atk.t / atk.dur;
      const swing = Math.sin(Math.min(1, k * 1.35) * Math.PI);
      if (atk.kind === 'slash') {
        armR.shoulder.rotation.x = -2.4 * swing + 0.2;
        armR.shoulder.rotation.z = -0.5 * swing;
        armL.shoulder.rotation.x = -0.6 * swing;
        armR.elbow.rotation.x = -0.5 * (1 - swing);
        hips.rotation.y = -0.6 * swing * (atk.dir || 1);
      } else if (atk.kind === 'punch') {
        armR.shoulder.rotation.x = -1.55 * swing;
        armR.elbow.rotation.x = -1.2 * (1 - swing);
        armL.shoulder.rotation.x = 0.5 * swing;
        hips.rotation.y = -0.35 * swing;
      } else if (atk.kind === 'smash') {
        armR.shoulder.rotation.x = -2.8 * swing;
        armL.shoulder.rotation.x = -2.8 * swing;
        hips.rotation.x = 0.35 * swing;
      }
    } else if (s.cast) {
      const k = s.cast.t / s.cast.dur;
      const raise = Math.sin(Math.min(1, k) * Math.PI);
      armR.shoulder.rotation.x = -2.5 * raise;
      armL.shoulder.rotation.x = -2.3 * raise;
      armR.shoulder.rotation.z = -0.25 * raise;
      armL.shoulder.rotation.z = 0.25 * raise;
      hips.rotation.y = 0;
    } else {
      const sw = moving ? Math.sin(cycle) * 0.5 : Math.sin(t * 1.7) * 0.05;
      armL.shoulder.rotation.x = sw;
      armR.shoulder.rotation.x = -sw;
      armL.shoulder.rotation.z = 0.1;
      armR.shoulder.rotation.z = -0.1;
      armR.elbow.rotation.x = -0.15 - (moving ? 0.35 : 0);
      armL.elbow.rotation.x = -0.15 - (moving ? 0.35 : 0);
      hips.rotation.y *= 1 - Math.min(1, dt * 9);
      if (!atk) hips.rotation.x = 0;
    }

    if (s.stunned) {
      neck.rotation.z = Math.sin(t * 22) * 0.22;
      hips.rotation.z = Math.sin(t * 18) * 0.14;
    } else {
      neck.rotation.z *= 1 - Math.min(1, dt * 8);
    }
    if (s.lifted) {
      armL.shoulder.rotation.x = -2.6; armR.shoulder.rotation.x = -2.6;
      legL.hip.rotation.x = -0.5; legR.hip.rotation.x = 0.4;
    }
  }

  return { group, parts, update, S };
}

/* --------------------------------------------------------------- weapons */
export function makeSword({ color = 0xa855f7, blade = 0xd8b4fe, length = 1.9, width = 0.16, glow = 0.9 } = {}) {
  const g = new THREE.Group();
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 1 }),
  );
  g.add(grip);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.07, 0.12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6, emissive: color, emissiveIntensity: glow * 0.5 }),
  );
  guard.position.y = 0.2;
  g.add(guard);
  const bladeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, length, 0.05),
    new THREE.MeshStandardMaterial({
      color: blade, roughness: 0.18, metalness: 0.85,
      emissive: color, emissiveIntensity: glow,
    }),
  );
  bladeMesh.position.y = 0.24 + length / 2;
  g.add(bladeMesh);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.72, 0.34, 4),
    new THREE.MeshStandardMaterial({ color: blade, roughness: 0.2, metalness: 0.9, emissive: color, emissiveIntensity: glow }),
  );
  tip.position.y = 0.24 + length + 0.15;
  g.add(tip);
  g.userData.blade = bladeMesh;
  g.userData.guard = guard;
  g.userData.tip = tip;
  return g;
}

export function makePole({ color = 0x38bdf8, length = 2.6, radius = 0.055 } = {}) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 }),
  );
  shaft.position.y = length / 2 - 0.3;
  g.add(shaft);
  for (const y of [-0.25, length - 0.55]) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.09, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.7 }),
    );
    ring.position.y = y;
    g.add(ring);
  }
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 2.1, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: color, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.8 }),
  );
  tip.position.y = length - 0.3;
  g.add(tip);
  g.userData.tip = tip;
  return g;
}

export function makeBisento({ color = 0x94a3b8, accent = 0x38bdf8 } = {}) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 0.9 }),
  );
  shaft.position.y = 0.95;
  g.add(shaft);
  // curved blade
  const curve = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.045, 8, 22, Math.PI * 0.85),
    new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.95, emissive: accent, emissiveIntensity: 0.7 }),
  );
  curve.position.set(0, 2.2, 0);
  curve.rotation.set(0, 0, -0.4);
  g.add(curve);
  const wrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9, roughness: 0.4 }),
  );
  wrap.position.y = 1.75;
  g.add(wrap);
  g.userData.blade = curve;
  return g;
}

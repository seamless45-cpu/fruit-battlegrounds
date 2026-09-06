// ============================================================
//  Shared low-poly character / weapon / boat builders.
//  One Box / Sphere / Cylinder is reused and scaled.
// ============================================================
import * as THREE from 'three';

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

function mesh(geo, mat, w, h, d, x, y, z, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.x = rx; m.rotation.z = rz;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.12, ...extra });
}

export function createPlayerModel() {
  const group = new THREE.Group();
  const skin = std(0xf0c69a);
  const hair = std(0x2a1c14);
  const coat = std(0x24356a, { metalness: 0.2 });
  const shirt = std(0xefe6d4);
  const sash = std(0xc9a227, { metalness: 0.45, roughness: 0.4 });
  const pants = std(0x1a2238);
  const boot = std(0x2b1a12, { roughness: 0.9 });
  const gold = std(0xe6c35c, { metalness: 0.7, roughness: 0.35 });

  const hips = new THREE.Group(); hips.position.y = 1.15; group.add(hips);
  const torso = mesh(GEO.box, coat, 1.15, 1.25, 0.62, 0, 0.55, 0);
  const chest = mesh(GEO.box, shirt, 0.85, 0.55, 0.5, 0, 0.62, 0.12);
  const belt = mesh(GEO.box, sash, 1.2, 0.16, 0.68, 0, -0.08, 0);
  hips.add(torso, chest, belt);

  const head = new THREE.Group(); head.position.set(0, 2.55, 0); group.add(head);
  head.add(mesh(GEO.sphere, skin, 1.1, 1.2, 1.1, 0, 0, 0));
  head.add(mesh(GEO.sphere, hair, 1.18, 0.7, 1.2, 0, 0.28, -0.05));
  const eyeL = mesh(GEO.sphere, std(0x1a1020), 0.16, 0.16, 0.12, -0.22, 0.05, 0.46);
  const eyeR = mesh(GEO.sphere, std(0x1a1020), 0.16, 0.16, 0.12, 0.22, 0.05, 0.46);
  head.add(eyeL, eyeR);
  head.add(mesh(GEO.box, gold, 0.55, 0.08, 0.08, 0, 0.38, 0.42));

  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.32, 1.15, 0); group.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.32, 1.15, 0); group.add(rightLeg);
  leftLeg.add(mesh(GEO.box, pants, 0.38, 0.7, 0.4, 0, -0.4, 0));
  leftLeg.add(mesh(GEO.box, boot, 0.42, 0.38, 0.52, 0, -0.92, 0.04));
  rightLeg.add(mesh(GEO.box, pants, 0.38, 0.7, 0.4, 0, -0.4, 0));
  rightLeg.add(mesh(GEO.box, boot, 0.42, 0.38, 0.52, 0, -0.92, 0.04));

  const leftArm = new THREE.Group(); leftArm.position.set(-0.78, 2.05, 0); group.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.78, 2.05, 0); group.add(rightArm);
  leftArm.add(mesh(GEO.box, coat, 0.32, 0.85, 0.32, 0, -0.4, 0));
  leftArm.add(mesh(GEO.sphere, skin, 0.34, 0.34, 0.34, 0, -0.9, 0));
  rightArm.add(mesh(GEO.box, coat, 0.32, 0.85, 0.32, 0, -0.4, 0));
  rightArm.add(mesh(GEO.sphere, skin, 0.34, 0.34, 0.34, 0, -0.9, 0));

  const weaponAnchor = new THREE.Group();
  weaponAnchor.position.set(0.15, -0.85, 0.15);
  rightArm.add(weaponAnchor);

  const aura = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({
    color: 0x9b30ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  aura.scale.set(3.6, 4.2, 3.6); aura.position.y = 1.7; group.add(aura);
  const auraRings = [];
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15 + i * 0.2, 0.03, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xa06bff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18 + i * 0.16;
    group.add(ring); auraRings.push(ring);
  }

  return { group, aura, auraRings, weaponAnchor, leftArm, rightArm, leftLeg, rightLeg, head, torso };
}

export function createEnemyModel(tier = 1) {
  const group = new THREE.Group();
  const skin = std(tier === 3 ? 0xd8b090 : 0xc9a090);
  const cloth = std(tier === 3 ? 0x4a1020 : tier === 2 ? 0x6a2230 : 0x8a2f3a);
  const dark = std(0x1a1014);
  const metal = std(0xb0b8c8, { metalness: 0.7, roughness: 0.35 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff526c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

  const torso = mesh(GEO.box, cloth, 1.2, 1.2, 0.6, 0, 1.7, 0);
  group.add(torso);
  const head = mesh(GEO.sphere, skin, 1.05, 1.15, 1.05, 0, 2.55, 0);
  group.add(head);
  group.add(mesh(GEO.sphere, glow, 0.28, 0.16, 0.18, -0.2, 2.58, 0.42));
  group.add(mesh(GEO.sphere, glow, 0.28, 0.16, 0.18, 0.2, 2.58, 0.42));
  group.add(mesh(GEO.box, dark, 1.15, 0.22, 1.15, 0, 2.82, -0.05));

  if (tier >= 2) {
    group.add(mesh(GEO.box, metal, 0.55, 0.28, 0.7, -0.7, 2.1, 0));
    group.add(mesh(GEO.box, metal, 0.55, 0.28, 0.7, 0.7, 2.1, 0));
  }
  if (tier >= 3) {
    const hat = mesh(GEO.cyl, dark, 1.5, 0.18, 1.5, 0, 3.05, 0);
    group.add(hat);
    group.add(mesh(GEO.box, dark, 1.6, 0.08, 0.5, 0, 3.05, 0.55));
    group.add(mesh(GEO.cone, cloth, 0.5, 0.7, 0.5, -0.55, 3.35, 0, 0, -0.4));
    group.add(mesh(GEO.cone, cloth, 0.5, 0.7, 0.5, 0.55, 3.35, 0, 0, 0.4));
  }

  const leftArm = new THREE.Group(); leftArm.position.set(-0.78, 2.05, 0); group.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.78, 2.05, 0); group.add(rightArm);
  leftArm.add(mesh(GEO.box, cloth, 0.3, 0.8, 0.3, 0, -0.4, 0));
  rightArm.add(mesh(GEO.box, cloth, 0.3, 0.8, 0.3, 0, -0.4, 0));
  rightArm.add(mesh(GEO.box, metal, 0.16, 1.4, 0.32, 0.1, -1.1, 0.2));

  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.3, 1.15, 0); group.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.3, 1.15, 0); group.add(rightLeg);
  leftLeg.add(mesh(GEO.box, dark, 0.36, 1.05, 0.38, 0, -0.55, 0));
  rightLeg.add(mesh(GEO.box, dark, 0.36, 1.05, 0.38, 0, -0.55, 0));

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.08, 20),
    new THREE.MeshBasicMaterial({ color: 0xff3f64, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.08; group.add(aura);

  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.22), new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.85 }));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.22), new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
  bar.position.z = 0.01;
  const barGroup = new THREE.Group(); barGroup.add(barBg); barGroup.add(bar);
  barGroup.position.y = 3.55;
  group.add(barGroup);

  const hp = makeHpLabel();
  hp.sprite.position.set(0, 0.48, 0);
  barGroup.add(hp.sprite);

  return { group, body: torso, head, bar, barGroup, aura, leftArm, rightArm, leftLeg, rightLeg, hp };
}

export function makeHpLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sprite.scale.set(2.3, 0.58, 1);
  return { canvas, ctx, tex, sprite, last: '' };
}

export function drawHpLabel(hpLabel, hp, max) {
  const text = `${Math.max(0, Math.ceil(hp)).toLocaleString()} / ${Math.ceil(max).toLocaleString()}`;
  if (hpLabel.last === text) return;
  hpLabel.last = text;
  const { ctx, tex } = hpLabel;
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(8,6,16,0.85)';
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = hp / max < 0.28 ? '#ff7a8a' : '#fff4d2';
  ctx.fillText(text, 128, 32);
  tex.needsUpdate = true;
}

export function createSwordMesh(id, color) {
  const g = new THREE.Group();
  const blade = std(color, { emissive: color, emissiveIntensity: 0.5, metalness: 0.65, roughness: 0.28 });
  const dark = std(0x1c1524, { metalness: 0.75, roughness: 0.4 });
  const wood = std(0x4a321c, { roughness: 1 });

  if (id === 'katana') {
    g.add(mesh(GEO.box, blade, 0.1, 3.5, 0.28, 0, 1.75, 0));
    g.add(mesh(GEO.box, dark, 0.7, 0.08, 0.18, 0, 0.12, 0));
    g.add(mesh(GEO.cyl, wood, 0.2, 0.85, 0.2, 0, -0.38, 0));
  } else if (id === 'cutlass') {
    g.add(mesh(GEO.box, blade, 0.14, 2.4, 0.42, 0.08, 1.35, 0, 0, 0.18));
    g.add(mesh(GEO.box, dark, 0.7, 0.14, 0.16, 0, 0.15, 0));
    g.add(mesh(GEO.cyl, wood, 0.22, 0.7, 0.22, 0, -0.3, 0));
  } else if (id === 'trident') {
    g.add(mesh(GEO.cyl, wood, 0.16, 3.2, 0.16, 0, 1.3, 0));
    g.add(mesh(GEO.box, blade, 0.12, 1.1, 0.12, 0, 3.0, 0));
    g.add(mesh(GEO.box, blade, 0.12, 0.9, 0.12, -0.28, 2.9, 0));
    g.add(mesh(GEO.box, blade, 0.12, 0.9, 0.12, 0.28, 2.9, 0));
  } else if (id === 'darkblade') {
    g.add(mesh(GEO.box, blade, 0.22, 3.6, 0.7, 0, 1.8, 0));
    g.add(mesh(GEO.box, dark, 1.15, 0.2, 0.22, 0, 0.12, 0));
    g.add(mesh(GEO.cyl, dark, 0.26, 0.9, 0.26, 0, -0.42, 0));
  } else if (id === 'pole') {
    g.add(mesh(GEO.cyl, wood, 0.16, 3.8, 0.16, 0, 1.5, 0));
    g.add(mesh(GEO.sphere, blade, 0.4, 0.4, 0.4, 0, 3.4, 0));
  } else if (id === 'bisento') {
    g.add(mesh(GEO.cyl, wood, 0.18, 2.6, 0.18, 0, 1.1, 0));
    g.add(mesh(GEO.box, blade, 0.16, 1.6, 0.9, 0, 2.6, 0));
  } else {
    g.add(mesh(GEO.box, blade, 0.18, 3.2, 0.5, 0, 1.6, 0));
    g.add(mesh(GEO.box, dark, 1.0, 0.18, 0.18, 0, 0.1, 0));
    g.add(mesh(GEO.cyl, wood, 0.24, 0.9, 0.24, 0, -0.45, 0));
  }
  return g;
}

export function createBoatMesh(def) {
  const g = new THREE.Group();
  const hull = std(def.color, { roughness: 0.85 });
  const dark = std(0x3a2a18);
  const sail = std(0xf2efe4, { roughness: 0.9 });
  const id = def.id;
  if (id === 'raft') {
    g.add(mesh(GEO.box, hull, 3.2, 0.28, 5.2, 0, 0.2, 0));
    for (let i = -1; i <= 1; i++) g.add(mesh(GEO.cyl, dark, 0.18, 5.2, 0.18, i * 1.1, 0.22, 0, Math.PI / 2, 0));
  } else if (id === 'dinghy') {
    g.add(mesh(GEO.box, hull, 2.4, 0.6, 5.4, 0, 0.35, 0));
    g.add(mesh(GEO.cyl, dark, 0.16, 3.4, 0.16, 0, 2.1, 0.4));
    g.add(mesh(GEO.box, sail, 0.08, 2.2, 2.4, 0.6, 2.2, 0.2));
  } else if (id === 'sloop') {
    g.add(mesh(GEO.box, hull, 3.2, 0.9, 8.2, 0, 0.4, 0));
    g.add(mesh(GEO.cyl, dark, 0.2, 5.4, 0.2, 0, 3.1, 0.6));
    g.add(mesh(GEO.box, sail, 0.1, 3.6, 3.4, 0.8, 3.0, 0.3));
  } else {
    g.add(mesh(GEO.box, hull, 4.6, 1.3, 12, 0, 0.5, 0));
    g.add(mesh(GEO.cyl, dark, 0.24, 6.2, 0.24, 0, 3.6, 2.2));
    g.add(mesh(GEO.cyl, dark, 0.22, 5.2, 0.22, 0, 3.2, -2.4));
    g.add(mesh(GEO.box, sail, 0.1, 4.0, 3.6, 0.9, 3.5, 2.0));
    g.add(mesh(GEO.box, sail, 0.1, 3.2, 3.0, 0.9, 3.1, -2.5));
    g.add(mesh(GEO.box, std(0xc9a227, { metalness: 0.6 }), 0.3, 0.3, 0.3, 0, 6.8, 2.2));
  }
  g.position.y = 0.1;
  return g;
}

export function createQuestNpc() {
  const group = new THREE.Group();
  const skin = std(0xf3c8a4);
  const robe = std(0xd4a017, { metalness: 0.35, roughness: 0.45 });
  const cream = std(0xf4ead0);
  const dark = std(0x3a2414);
  const sash = std(0x2f6d4a);

  group.add(mesh(GEO.box, robe, 1.25, 1.55, 0.72, 0, 1.65, 0));
  group.add(mesh(GEO.box, cream, 0.9, 0.5, 0.5, 0, 1.85, 0.16));
  group.add(mesh(GEO.box, sash, 1.28, 0.16, 0.76, 0, 1.12, 0));
  group.add(mesh(GEO.sphere, skin, 1.12, 1.18, 1.12, 0, 2.62, 0));
  group.add(mesh(GEO.sphere, dark, 1.22, 0.55, 1.22, 0, 2.95, -0.04));
  group.add(mesh(GEO.cyl, dark, 1.7, 0.12, 1.7, 0, 3.12, 0));
  group.add(mesh(GEO.box, cream, 1.8, 0.08, 0.55, 0, 3.12, 0.7));
  group.add(mesh(GEO.sphere, std(0x1a1020), 0.16, 0.16, 0.12, -0.22, 2.64, 0.48));
  group.add(mesh(GEO.sphere, std(0x1a1020), 0.16, 0.16, 0.12, 0.22, 2.64, 0.48));
  group.add(mesh(GEO.box, robe, 0.34, 0.95, 0.34, -0.82, 1.7, 0));
  group.add(mesh(GEO.box, robe, 0.34, 0.95, 0.34, 0.82, 1.7, 0));
  group.add(mesh(GEO.box, dark, 0.4, 1.05, 0.42, -0.32, 0.55, 0));
  group.add(mesh(GEO.box, dark, 0.4, 1.05, 0.42, 0.32, 0.55, 0));

  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0c36a';
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1204'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = '#1a1204';
  ctx.font = '900 78px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 72);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  bang.scale.set(1.4, 1.4, 1);
  bang.position.y = 4.15;
  group.add(bang);

  return { group, bang };
}

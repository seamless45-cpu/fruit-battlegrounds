// ============================================================
//  World: ocean, main island, fruit isles, dock, lights, gfx.
// ============================================================
import * as THREE from 'three';
import { WORLD } from './config.js';
import { bakeWaterTex, bakeSandTex } from './prerender.js';
import { GEO } from './models.js';

const GFX = {
  quality: 'High',
  shadows: true,
  bloom: true,
  fog: true,
  particles: true,
  pixelRatioScale: 1,
};

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.gfx = GFX;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = GFX.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071018);
    this.scene.fog = new THREE.Fog(0x071018, 90, 380);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1100);
    this.camera.position.set(0, 18, 28);

    this.islandCenters = [];
    this.fruitSpawnPoints = [];

    this._buildLights();
    this._buildOcean();
    this._buildArena();
    this._buildIslands();
    this._buildDock();
    this._buildAtmosphere();

    this._applyGfx();
    window.addEventListener('resize', () => this.onResize());
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9fb4ff, 0x1a1026, 0.65);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.55);
    this.sun.position.set(40, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 300;
    this.sun.shadow.camera.left = -110; this.sun.shadow.camera.right = 110;
    this.sun.shadow.camera.top = 110; this.sun.shadow.camera.bottom = -110;
    this.scene.add(this.sun);
    this.fill = new THREE.PointLight(0xa06bff, 0.55, 220);
    this.fill.position.set(-30, 30, -30);
    this.scene.add(this.fill);
  }

  _buildOcean() {
    const waterTex = bakeWaterTex();
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900, 1, 1),
      new THREE.MeshStandardMaterial({ map: waterTex, color: 0x1a6a96, metalness: 0.55, roughness: 0.28 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.4;
    ocean.receiveShadow = true;
    this.scene.add(ocean);
    this.ocean = ocean;
    this.waterTex = waterTex;
  }

  _buildArena() {
    const sand = bakeSandTex();
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius + 6, 2.8, 40),
      new THREE.MeshStandardMaterial({ map: sand, color: 0x2a3d2e, roughness: 0.95 }),
    );
    ground.position.y = -1.4; ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(WORLD.islandRadius * 2, 32, 0x3a4a7a, 0x232c47);
    grid.position.y = 0.02; grid.material.opacity = 0.28; grid.material.transparent = true;
    this.scene.add(grid);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(WORLD.islandRadius, 1.05, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x6a4aff, emissive: 0x3a1f8a, emissiveIntensity: 0.8, roughness: 0.5 }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35; this.scene.add(ring);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b2238, roughness: 0.9, metalness: 0.1 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(GEO.cyl, pillarMat);
      p.scale.set(4.4, 22, 4.4);
      p.position.set(Math.cos(a) * (WORLD.islandRadius - 8), 11, Math.sin(a) * (WORLD.islandRadius - 8));
      p.castShadow = true; this.scene.add(p);
    }
    this.arenaRadius = WORLD.islandRadius;
    this.islandCenters.push({ x: 0, z: 0, r: WORLD.islandRadius });
  }

  _buildAtmosphere() {
    const stars = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const radius = 200 + Math.random() * 160;
      const theta = Math.random() * Math.PI * 2;
      const y = 20 + Math.random() * 180;
      stars[i * 3] = Math.cos(theta) * radius;
      stars[i * 3 + 1] = y;
      stars[i * 3 + 2] = Math.sin(theta) * radius;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x91bfff, size: 1.2, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.scene.add(this.stars);

    this.obelisks = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.18;
      const group = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({
        color: 0x4d5eff, emissive: 0x243ccf, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.45,
      }));
      crystal.position.y = 12; group.add(crystal);
      group.position.set(Math.cos(angle) * (WORLD.islandRadius - 14), 0, Math.sin(angle) * (WORLD.islandRadius - 14));
      this.scene.add(group); this.obelisks.push({ group, crystal, phase: i * 0.78 });
    }
  }

  _buildIslands() {
    const trunkGeo = GEO.cyl;
    const islands = [
      [-132, -96, 0x356943],
      [138, -78, 0x72553d],
      [36, 148, 0x426e85],
    ];
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7d4a, roughness: 0.85 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3823, roughness: 1 });
    islands.forEach(([x, z, color], islandIndex) => {
      const ground = new THREE.Mesh(
        new THREE.CylinderGeometry(18, 22, 2.6, 16),
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
      );
      ground.position.set(x, -1.1, z); ground.receiveShadow = true; this.scene.add(ground);
      this.islandCenters.push({ x, z, r: 18 });
      for (let i = 0; i < 5; i++) {
        const angle = i * 2.4 + islandIndex, radius = 4 + (i % 3) * 3.5;
        const tx = x + Math.cos(angle) * radius, tz = z + Math.sin(angle) * radius;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.scale.set(0.8, 4, 0.8); trunk.position.y = 2;
        const canopy = new THREE.Mesh(GEO.sphere, canopyMat);
        canopy.scale.set(4.4, 4.2, 4.4); canopy.position.y = 5;
        tree.add(trunk, canopy); tree.position.set(tx, 0, tz); this.scene.add(tree);
        this.fruitSpawnPoints.push(new THREE.Vector3(tx + 1.6, 0, tz + 1.2));
      }
    });
  }

  _buildDock() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const dock = new THREE.Group();
    const plank = new THREE.Mesh(GEO.box, wood);
    plank.scale.set(6, 0.35, 16);
    plank.position.set(WORLD.dock.x, 0.15, WORLD.dock.z);
    plank.receiveShadow = true; plank.castShadow = true;
    dock.add(plank);
    for (let i = -1; i <= 1; i += 2) {
      const post = new THREE.Mesh(GEO.cyl, wood);
      post.scale.set(0.5, 2.4, 0.5);
      post.position.set(WORLD.dock.x + i * 2.4, 1.2, WORLD.dock.z + 6);
      dock.add(post);
    }
    const lamp = new THREE.PointLight(0xffc978, 1.2, 28);
    lamp.position.set(WORLD.dock.x, 3.2, WORLD.dock.z + 6);
    dock.add(lamp);
    this.scene.add(dock);
    this.dock = dock;
  }

  isOnLand(x, z) {
    for (const p of this.islandCenters) {
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz <= p.r * p.r) return true;
    }
    return false;
  }
  nearDock(pos) {
    const dx = pos.x - WORLD.dock.x, dz = pos.z - WORLD.dock.z;
    return dx * dx + dz * dz <= WORLD.dock.radius * WORLD.dock.radius;
  }

  update(dt, time) {
    if (this.stars) this.stars.rotation.y += dt * 0.008;
    if (this.waterTex) this.waterTex.offset.x = (this.waterTex.offset.x + dt * 0.02) % 1;
    this.obelisks.forEach((o) => {
      const pulse = Math.sin(time * 1.5 + o.phase);
      o.crystal.position.y = 12 + pulse * 1.1;
      o.crystal.rotation.y += dt * 0.7;
    });
  }

  _applyGfx() {
    const q = this.gfx.quality;
    const pr = { Low: 0.55, Medium: 0.75, High: 1, Ultra: 1.35 }[q] || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * pr * this.gfx.pixelRatioScale);
    this.renderer.shadowMap.enabled = this.gfx.shadows;
    if (this.sun) {
      this.sun.castShadow = this.gfx.shadows;
      const map = q === 'Ultra' ? 2048 : q === 'Low' ? 512 : 1024;
      if (this.sun.shadow.mapSize.x !== map) this.sun.shadow.mapSize.set(map, map);
    }
    this.scene.fog = this.gfx.fog ? new THREE.Fog(0x071018, 90, 380) : null;
  }

  setGfx(key, value) {
    this.gfx[key] = value;
    this._applyGfx();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

export async function tryEnableBloom(world) {
  try {
    const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
    const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
    const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
    const composer = new EffectComposer(world.renderer);
    composer.addPass(new RenderPass(world.scene, world.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.55, 0.88);
    composer.addPass(bloom);
    world.composer = composer;
    world.render = () => composer.render();
    return true;
  } catch (e) {
    console.warn('Bloom unavailable, using direct render.', e);
    return false;
  }
}

export { GFX };

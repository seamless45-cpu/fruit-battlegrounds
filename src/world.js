// ============================================================
//  World: renderer, scene, lights, arena, graphics settings.
// ============================================================
import * as THREE from 'three';

const GFX = {
  quality: 'High',         // Low | Medium | High | Ultra
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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e1a);
    this.scene.fog = new THREE.Fog(0x0a0e1a, 90, 320);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 18, 28);

    this._buildLights();
    this._buildArena();
    this._buildIslands();
    this._buildAtmosphere();

    this._applyGfx();
    window.addEventListener('resize', () => this.onResize());
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9fb4ff, 0x1a1026, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(40, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 300;
    this.sun.shadow.camera.left = -120; this.sun.shadow.camera.right = 120;
    this.sun.shadow.camera.top = 120; this.sun.shadow.camera.bottom = -120;
    this.scene.add(this.sun);
    this.fill = new THREE.PointLight(0xa06bff, 0.6, 200);
    this.fill.position.set(-30, 30, -30);
    this.scene.add(this.fill);
  }

  _buildArena() {
    // ground
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.95, metalness: 0.0 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 64), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.scene.add(ground);

    // grid lines
    const grid = new THREE.GridHelper(320, 64, 0x3a4a7a, 0x232c47);
    grid.position.y = 0.02; grid.material.opacity = 0.35; grid.material.transparent = true;
    this.scene.add(grid);

    // arena boundary ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(150, 1.2, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0x6a4aff, emissive: 0x3a1f8a, emissiveIntensity: 0.8, roughness: 0.5 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; this.scene.add(ring);

    // corner pillars for depth
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b2238, roughness: 0.9, metalness: 0.1 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 30, 12), pillarMat);
      p.position.set(Math.cos(a) * 140, 15, Math.sin(a) * 140);
      p.castShadow = true; this.scene.add(p);
    }
    this.arenaRadius = 150;
  }

  _buildAtmosphere() {
    // A deep-space skybox and animated energy obelisks make the arena feel alive.
    const stars = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const radius = 180 + Math.random() * 130;
      const theta = Math.random() * Math.PI * 2;
      const y = 18 + Math.random() * 170;
      stars[i * 3] = Math.cos(theta) * radius;
      stars[i * 3 + 1] = y;
      stars[i * 3 + 2] = Math.sin(theta) * radius;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x91bfff, size: 1.15, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.stars);

    this.obelisks = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.18;
      const group = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 1), new THREE.MeshStandardMaterial({ color: 0x4d5eff, emissive: 0x243ccf, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.45 }));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.75, 28, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x587cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      crystal.position.y = 13; beam.position.y = 14; group.add(crystal, beam);
      group.position.set(Math.cos(angle) * 128, 0, Math.sin(angle) * 128);
      this.scene.add(group); this.obelisks.push({ group, crystal, phase: i * 0.78 });
    }
  }

  _buildIslands() {
    this.fruitSpawnPoints = [];
    const islands = [[-78, -62, 0x356943], [88, -52, 0x72553d], [18, 102, 0x426e85]];
    islands.forEach(([x, z, color], islandIndex) => {
      const ground = new THREE.Mesh(new THREE.CylinderGeometry(20, 25, 2.5, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
      ground.position.set(x, -1, z); ground.receiveShadow = true; this.scene.add(ground);
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.4 + islandIndex, radius = 5 + (i % 3) * 4;
        const tx = x + Math.cos(angle) * radius, tz = z + Math.sin(angle) * radius;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.35, .55, 4, 7), new THREE.MeshStandardMaterial({ color: 0x5b3823, roughness: 1 }));
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2f7d4a, roughness: .85 }));
        trunk.position.y = 2; canopy.position.y = 5; tree.add(trunk, canopy); tree.position.set(tx, 0, tz); this.scene.add(tree);
        this.fruitSpawnPoints.push(new THREE.Vector3(tx + 1.6, 0, tz + 1.2));
      }
    });
  }

  update(dt, time) {
    if (this.stars) this.stars.rotation.y += dt * 0.008;
    this.obelisks.forEach((o) => {
      const pulse = Math.sin(time * 1.5 + o.phase);
      o.crystal.position.y = 13 + pulse * 1.1;
      o.crystal.rotation.y += dt * 0.7;
      o.crystal.rotation.x += dt * 0.23;
    });
  }

  _applyGfx() {
    const q = this.gfx.quality;
    const pr = { Low: 0.6, Medium: 0.8, High: 1, Ultra: 1.5 }[q] || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * pr * this.gfx.pixelRatioScale);
    this.renderer.shadowMap.enabled = this.gfx.shadows;
    if (this.sun) this.sun.castShadow = this.gfx.shadows;
    this.scene.fog = this.gfx.fog ? new THREE.Fog(0x0a0e1a, 90, 320) : null;
    // particle multiplier used by effects via world.gfx.particles
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

// optional bloom via addons (guarded)
export async function tryEnableBloom(world) {
  try {
    const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
    const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
    const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
    const composer = new EffectComposer(world.renderer);
    composer.addPass(new RenderPass(world.scene, world.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.85);
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

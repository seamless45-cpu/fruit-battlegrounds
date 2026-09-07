// ============================================================
//  World: ocean, main island, fruit isles, dock, lights, gfx.
// ============================================================
import * as THREE from 'three';
import { WORLD, ISLANDS } from './config.js';
import { bakeWaterTex, bakeSandTex } from './prerender.js';
import { GEO, createQuestNpc, createShopNpc, makeNameSprite } from './models.js';

const GFX = {
  quality: 'High',
  shadows: true,
  bloom: true,
  fog: true,
  particles: true,
  pixelRatioScale: 1,
  invertLookX: false,
  invertLookY: false,
  lookSens: 1,
  fov: 60,
  softLock: true,
  freeAim: 0.32,
  exposure: 1.22,
  clouds: true,
  fastMode: false,
  reduceMotion: false,
};

function detectGpu(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    let raw = ext
      ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      : (gl.getParameter(gl.RENDERER) || '');
    raw = String(raw).replace(/^ANGLE\s*\(/i, '').replace(/\)\s*$/, '');
    raw = raw.replace(/\s*,\s*(Direct3D|D3D11?|OpenGL|Vulkan|Metal|vs_\d).*$/i, '');
    raw = raw.replace(/NVIDIA( Corporation)?/ig, '').replace(/AMD /i, '').replace(/Intel\(R\)\s*/i, 'intel ');
    raw = raw.replace(/\s+/g, ' ').trim().toLowerCase();
    return 'gpu: ' + (raw || 'unknown');
  } catch {
    return 'gpu: unknown';
  }
}

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
    this.renderer.toneMappingExposure = 1.22;
    this.gpuName = detectGpu(this.renderer);

    this.scene = new THREE.Scene();
    this.fogColor = 0xb9d8ef;
    this.scene.background = new THREE.Color(0x87c6f0);
    this.scene.fog = new THREE.Fog(this.fogColor, 180, 720);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
    this.camera.position.set(0, 18, 28);

    this.islandCenters = [];
    this.fruitSpawnPoints = [];

    this._buildLights();
    this._buildSky();
    this._buildOcean();
    this._buildArena();
    this._buildIslands();
    this._buildDock();
    this._buildQuestNpc();
    this._buildAtmosphere();

    this._applyGfx();
    window.addEventListener('resize', () => this.onResize());
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xfff4d6, 0x6a9a4a, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff6d8, 1.9);
    this.sun.position.set(80, 140, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 520;
    this.sun.shadow.camera.left = -260; this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260; this.sun.shadow.camera.bottom = -260;
    this.scene.add(this.sun);
    this.fill = new THREE.PointLight(0xffe0a0, 0.45, 260);
    this.fill.position.set(-40, 40, -20);
    this.scene.add(this.fill);
  }

  _buildSky() {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x3e9eff) },
        mid: { value: new THREE.Color(0x9ad4ff) },
        bot: { value: new THREE.Color(0xf7f1d8) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;',
        'void main(){',
        '  float h = clamp(vP.y / 420.0 * 0.5 + 0.45, 0.0, 1.0);',
        '  vec3 col = mix(bot, mid, smoothstep(0.0, 0.45, h));',
        '  col = mix(col, top, smoothstep(0.4, 1.0, h));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(780, 24, 16), skyMat);
    this.scene.add(sky);
    this.sky = sky;

    const sunMesh = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    sunMesh.scale.set(28, 28, 28);
    sunMesh.position.set(120, 160, 70);
    this.scene.add(sunMesh);
    this.sunMesh = sunMesh;

    const halo = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.22, depthWrite: false,
    }));
    halo.scale.set(52, 52, 52);
    halo.position.copy(sunMesh.position);
    this.scene.add(halo);
  }

  _buildOcean() {
    const waterTex = bakeWaterTex();
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400, 1, 1),
      new THREE.MeshStandardMaterial({ map: waterTex, color: 0x3db0d4, metalness: 0.42, roughness: 0.32 }),
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
      new THREE.MeshStandardMaterial({ map: sand, color: 0x4a8a45, roughness: 0.95 }),
    );
    ground.position.y = -1.4; ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(WORLD.islandRadius * 2, 32, 0x8ab87a, 0x3d6a40);
    grid.position.y = 0.02; grid.material.opacity = 0.18; grid.material.transparent = true;
    this.scene.add(grid);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(WORLD.islandRadius, 1.05, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0xe8c35a, emissive: 0xc9a227, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.35 }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35; this.scene.add(ring);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.9, metalness: 0.08 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(GEO.cyl, pillarMat);
      p.scale.set(4.4, 22, 4.4);
      p.position.set(Math.cos(a) * (WORLD.islandRadius - 8), 11, Math.sin(a) * (WORLD.islandRadius - 8));
      p.castShadow = true; this.scene.add(p);
    }
    this.arenaRadius = WORLD.islandRadius;
    const arena = ISLANDS.find((i) => i.id === 'arena') || { id: 'arena', name: 'Grand Arena', x: 0, z: 0, r: WORLD.islandRadius, faction: 'neutral', boss: 'Captain Rook', elite: 'Warlord Ember' };
    this.islandCenters.push({ id: arena.id, name: arena.name, x: 0, z: 0, r: WORLD.islandRadius, faction: arena.faction, boss: arena.boss, elite: arena.elite });
  }

  _buildAtmosphere() {
    this.clouds = [];
    const puffMat = new THREE.MeshLambertMaterial({ color: 0xfffdf6, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) {
        const puff = new THREE.Mesh(GEO.sphere, puffMat);
        const s = 10 + (k % 3) * 5;
        puff.scale.set(s * 1.6, s * 0.55, s);
        puff.position.set((k - 1) * 7, (k % 2) * 2.2, (k % 3 - 1) * 4);
        cloud.add(puff);
      }
      const a = (i / 14) * Math.PI * 2;
      const r = 90 + (i % 5) * 28;
      cloud.position.set(Math.cos(a) * r, 48 + (i % 4) * 8, Math.sin(a) * r);
      this.scene.add(cloud);
      this.clouds.push({ group: cloud, speed: 1.6 + (i % 3) * 0.4, radius: r, angle: a, y: cloud.position.y });
    }

    this.obelisks = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.18;
      const group = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({
        color: 0xf0c36a, emissive: 0xc9a227, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4,
      }));
      crystal.position.y = 12; group.add(crystal);
      group.position.set(Math.cos(angle) * (WORLD.islandRadius - 14), 0, Math.sin(angle) * (WORLD.islandRadius - 14));
      this.scene.add(group); this.obelisks.push({ group, crystal, phase: i * 0.78 });
    }
  }

  _buildQuestNpc() {
    const npc = createQuestNpc();
    npc.group.position.set(WORLD.questNpc.x, 0, WORLD.questNpc.z);
    npc.group.rotation.y = Math.PI * 0.85;
    this.scene.add(npc.group);
    this.questNpc = {
      group: npc.group,
      bang: npc.bang,
      position: new THREE.Vector3(WORLD.questNpc.x, 0, WORLD.questNpc.z),
    };

    const shop = createShopNpc();
    shop.group.position.set(WORLD.shopNpc.x, 0, WORLD.shopNpc.z);
    shop.group.rotation.y = -Math.PI * 0.7;
    this.scene.add(shop.group);
    this.shopNpc = {
      group: shop.group,
      bang: shop.bang,
      position: new THREE.Vector3(WORLD.shopNpc.x, 0, WORLD.shopNpc.z),
    };
  }

  _buildIslands() {
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7d4a, roughness: 0.85 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3823, roughness: 1 });
    ISLANDS.forEach((isle, islandIndex) => {
      if (!this.islandCenters.some((c) => c.id === isle.id)) {
        this.islandCenters.push({
          id: isle.id, name: isle.name, x: isle.x, z: isle.z, r: isle.r,
          faction: isle.faction, boss: isle.boss, elite: isle.elite,
        });
      }
      if (isle.skipMesh) return;
      const ground = new THREE.Mesh(
        new THREE.CylinderGeometry(isle.r, isle.r + 4, 2.6, 18),
        new THREE.MeshStandardMaterial({ color: isle.color, roughness: 0.95 }),
      );
      ground.position.set(isle.x, -1.1, isle.z); ground.receiveShadow = true; this.scene.add(ground);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(isle.r, 0.55, 6, 28),
        new THREE.MeshStandardMaterial({
          color: isle.faction === 'marine' ? 0x8ab4ff : isle.faction === 'pirate' ? 0xc9a227 : 0xe8eefc,
          roughness: 0.5, metalness: 0.25,
        }),
      );
      rim.rotation.x = -Math.PI / 2; rim.position.set(isle.x, 0.22, isle.z); this.scene.add(rim);

      const trees = isle.trees || 4;
      for (let i = 0; i < trees; i++) {
        const angle = i * 2.4 + islandIndex, radius = 3 + (i % 3) * Math.max(2.2, isle.r * 0.22);
        const tx = isle.x + Math.cos(angle) * radius, tz = isle.z + Math.sin(angle) * radius;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(GEO.cyl, trunkMat);
        trunk.scale.set(0.8, 4, 0.8); trunk.position.y = 2;
        const canopy = new THREE.Mesh(GEO.sphere, canopyMat);
        canopy.scale.set(4.4, 4.2, 4.4); canopy.position.y = 5;
        tree.add(trunk, canopy); tree.position.set(tx, 0, tz); this.scene.add(tree);
        this.fruitSpawnPoints.push(new THREE.Vector3(tx + 1.6, 0, tz + 1.2));
      }

      const label = makeNameSprite(isle.name);
      label.position.set(isle.x, 8.4, isle.z);
      this.scene.add(label);
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
  nearQuestNpc(pos) {
    const n = WORLD.questNpc;
    const dx = pos.x - n.x, dz = pos.z - n.z;
    return dx * dx + dz * dz <= n.radius * n.radius;
  }
  nearShopNpc(pos) {
    const n = WORLD.shopNpc;
    if (!n) return false;
    const dx = pos.x - n.x, dz = pos.z - n.z;
    return dx * dx + dz * dz <= n.radius * n.radius;
  }

  update(dt, time) {
    if (this.gfx.reduceMotion) return;
    if (this.waterTex) this.waterTex.offset.x = (this.waterTex.offset.x + dt * 0.02) % 1;
    if (this.clouds) {
      this.clouds.forEach((c) => {
        c.angle += dt * 0.012 * c.speed;
        c.group.position.x = Math.cos(c.angle) * c.radius;
        c.group.position.z = Math.sin(c.angle) * c.radius;
        c.group.position.y = c.y + Math.sin(time * 0.4 + c.angle) * 1.4;
      });
    }
    if (this.questNpc && this.questNpc.bang) {
      this.questNpc.bang.position.y = 4.15 + Math.sin(time * 2.4) * 0.18;
    }
    this.obelisks.forEach((o) => {
      const pulse = Math.sin(time * 1.5 + o.phase);
      o.crystal.position.y = 12 + pulse * 1.1;
      o.crystal.rotation.y += dt * 0.7;
    });
  }

  _applyGfx() {
    const q = this.gfx.quality;
    let pr = { Low: 0.55, Medium: 0.75, High: 1, Ultra: 1.35 }[q] || 1;
    if (this.gfx.fastMode) pr = Math.min(pr, 0.5);
    const scale = this.gfx.fastMode ? Math.min(this.gfx.pixelRatioScale, 0.6) : this.gfx.pixelRatioScale;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * pr * scale);
    const shadows = this.gfx.fastMode ? false : this.gfx.shadows;
    this.renderer.shadowMap.enabled = shadows;
    if (this.sun) {
      this.sun.castShadow = shadows;
      const map = this.gfx.fastMode || q === 'Low' ? 512 : q === 'Ultra' ? 2048 : 1024;
      if (this.sun.shadow.mapSize.x !== map) this.sun.shadow.mapSize.set(map, map);
    }
    this.scene.fog = this.gfx.fog && !this.gfx.fastMode ? new THREE.Fog(this.fogColor || 0xb9d8ef, 140, 560) : null;
    this.renderer.toneMappingExposure = this.gfx.exposure || 1.22;
    if (this.camera && this.gfx.fov) {
      this.camera.fov = this.gfx.fov;
      this.camera.updateProjectionMatrix();
    }
    const showClouds = this.gfx.clouds !== false && !this.gfx.fastMode && !this.gfx.reduceMotion;
    if (this.clouds) this.clouds.forEach((c) => { c.group.visible = showClouds; });
    document.body.classList.toggle('reduce-motion', !!this.gfx.reduceMotion);
    document.body.classList.toggle('fast-mode', !!this.gfx.fastMode);
  }

  setGfx(key, value) {
    this.gfx[key] = value;
    if (key === 'fastMode' && value) {
      this.gfx.particles = false;
      this.gfx.bloom = false;
      this.gfx.clouds = false;
    }
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
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.42, 0.86);
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

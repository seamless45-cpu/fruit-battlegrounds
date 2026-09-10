/**
 * Renderer + post-processing stack.
 * Pipeline: RenderPass -> UnrealBloomPass -> FXAA -> OutputPass (tonemap + sRGB)
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { Settings } from './settings.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = Settings.get('exposure');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = Settings.get('shadows');
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x05070d, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 6000);
    this.camera.position.set(0, 14, 20);

    // ---- post processing ----
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      Settings.get('bloomStrength'), Settings.get('bloomRadius'), Settings.get('bloomThreshold'),
    );
    this.composer.addPass(this.bloomPass);

    this.fxaaPass = new FXAAPass();
    this.composer.addPass(this.fxaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.applySettings();
    window.addEventListener('resize', () => this.resize());
    Settings.onChange(() => this.applySettings());
    this.resize();
  }

  applySettings() {
    const s = Settings.values;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pr * s.resolutionScale);
    this.renderer.toneMappingExposure = s.exposure;
    this.renderer.shadowMap.enabled = s.shadows;
    this.renderer.shadowMap.needsUpdate = true;

    this.bloomPass.enabled = s.bloom;
    this.bloomPass.strength = s.bloomStrength;
    this.bloomPass.radius = s.bloomRadius;
    this.bloomPass.threshold = s.bloomThreshold;
    this.fxaaPass.enabled = s.fxaa;

    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render() { this.composer.render(); }
}

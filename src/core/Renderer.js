// Renderizador WebGL + cadena de post-procesado:
//   escena -> oclusión ambiental (GTAO, calidad alta) -> límite de brillo -> bloom -> tone mapping/sRGB
//   -> etalonaje (saturación, contraste, tono cálido) + viñeta.
// La calidad se adapta sola si los FPS caen.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { REALISTIC } from '../gfx/Style.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.12 },
    contrast: { value: 1.06 },
    warmth: { value: 0.025 },
    vignette: { value: 0.32 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation, contrast, warmth, vignette;
    uniform vec3 tint;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb += vec3(warmth, warmth * 0.35, -warmth);
      c.rgb *= tint;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * vignette * 1.6;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }`,
};

export class Renderer {
  constructor(container, { lowQuality = false } = {}) {
    this.lowQuality = lowQuality;
    this.renderer = new THREE.WebGLRenderer({ antialias: !lowQuality, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(devicePixelRatio, lowQuality ? 1.25 : 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // en modo realista las montañas están más lejos (perspectiva aérea)
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, REALISTIC ? 700 : 400);

    // antialiasing MSAA dentro del post-procesado (bordes de hojas y vallas limpios)
    const rt = new THREE.WebGLRenderTarget(innerWidth * this.pixelRatio, innerHeight * this.pixelRatio, { type: THREE.HalfFloatType, samples: lowQuality ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!lowQuality) {
      try {
        this.ao = new GTAOPass(this.scene, this.camera, innerWidth, innerHeight);
        this.ao.output = GTAOPass.OUTPUT.Default;
        this.ao.blendIntensity = 0.85;
        this.ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 12 });
        this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
        this.composer.addPass(this.ao);
      } catch (e) {
        console.warn('GTAO no disponible', e);
        this.ao = null;
      }
    }
    // límite de brillo antes del bloom: un reflejo del sol en el hielo (miles de
    // veces más brillante que el resto) no debe convertirse en un velo enorme
    this.clamp = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, maxValue: { value: 6 } },
      vertexShader: GradeShader.vertexShader,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float maxValue; varying vec2 vUv;
        void main() { vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(min(c.rgb, vec3(maxValue)), c.a); }`,
    });
    this.composer.addPass(this.clamp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    // calidad adaptativa
    this.frameTimes = [];
    this.adaptT = 0;
    this.level = lowQuality ? 1 : 2; // 2 = alta, 1 = media, 0 = baja

    addEventListener('resize', () => this.resize());
  }

  /** Ajusta el etalonaje por zona (cálido en la aldea, frío en las cuevas...). */
  setGrade({ saturation = 1.12, contrast = 1.06, warmth = 0.025, vignette = 0.32, tint = 0xffffff } = {}) {
    const u = this.grade.uniforms;
    u.saturation.value = saturation; u.contrast.value = contrast; u.warmth.value = warmth; u.vignette.value = vignette;
    u.tint.value.set(tint);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /** Baja la calidad si los fotogramas son lentos de forma sostenida. */
  adapt(dt) {
    if (this.level === 0 || this.fixedQuality) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 1 / 40) {
      this.level--;
      if (this.level === 1 && this.ao) { this.ao.enabled = false; }
      if (this.level === 0) {
        this.bloom.enabled = false;
        this.pixelRatio = Math.min(this.pixelRatio, 1);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.composer.setPixelRatio?.(this.pixelRatio);
        this.resize();
      }
      console.info(`[calidad] nivel ${this.level} (${(1 / avg).toFixed(0)} fps)`);
    }
  }

  render() { this.composer.render(); }
}

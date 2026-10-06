// Fuego del modo realista: llama de sombreador (ruido que sube, forma de gota,
// gradiente blanco-amarillo-naranja-rojo, mezcla aditiva) que siempre mira a la
// cámara, y brasas que suben y se apagan. Todo se anima en la GPU con el tiempo
// global; cada llama usa su posición en el mundo como semilla, así comparten un
// único material y programa.
import * as THREE from 'three';
import { GLOBAL } from './ModelKit.js';

let flameMat = null;
function flameMaterial() {
  if (flameMat) return flameMat;
  flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL.time, uIntensity: { value: 3.2 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        vUv = uv;
        vec3 wp = modelMatrix[3].xyz;
        vSeed = fract(sin(dot(wp.xz, vec2(12.9898, 78.233))) * 43758.5453) * 100.0;
        // cartel orientado a la cámara, con la escala del objeto (para el parpadeo)
        vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        mv.xy += position.xy * sc;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uIntensity;
      varying vec2 vUv;
      varying float vSeed;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += n2(p) * a; p *= 2.03; a *= 0.5; } return s; }
      void main() {
        float t = uTime + vSeed;
        vec2 uv = vUv;
        // el ruido sube y deforma la llama (más arriba, más deformación)
        float n = fbm(vec2(uv.x * 3.0, uv.y * 2.2 - t * 2.6));
        float n2v = fbm(vec2(uv.x * 6.0 + 3.1, uv.y * 4.0 - t * 4.1));
        uv.x += (n - 0.5) * 0.35 * uv.y + sin(t * 3.0 + uv.y * 4.0) * 0.03 * uv.y;
        // forma de gota: ancha abajo, afilada arriba
        float w = mix(0.42, 0.03, pow(uv.y, 0.8));
        float dx = abs(uv.x - 0.5) / max(w, 0.001);
        float body = 1.0 - smoothstep(0.55, 1.0, dx + (n2v - 0.5) * 0.5);
        body *= smoothstep(0.0, 0.12, uv.y) * (1.0 - smoothstep(0.55, 1.0, uv.y + (n - 0.5) * 0.4));
        if (body <= 0.002) discard;
        // gradiente de temperatura: núcleo blanco-amarillo, borde naranja-rojo
        float core = body * (1.0 - smoothstep(0.0, 0.7, uv.y)) * (1.0 - smoothstep(0.0, 0.6, dx));
        vec3 col = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.45, 0.06), body);
        col = mix(col, vec3(1.0, 0.85, 0.45), core);
        gl_FragColor = vec4(col * body * uIntensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return flameMat;
}

/** Llama orientada a la cámara con la base en el origen local. */
export function flameMesh(width = 0.5, height = 0.6) {
  const geo = new THREE.PlaneGeometry(width, height);
  geo.translate(0, height / 2, 0);
  const m = new THREE.Mesh(geo, flameMaterial());
  m.frustumCulled = false; // el cartel se desplaza en el sombreador
  m.renderOrder = 2;
  return m;
}

let emberMat = null;
/** Brasas: puntos que suben en espiral, se enfrían y reaparecen abajo. */
export function embers(count = 14, radius = 0.35, height = 2.4) {
  if (!emberMat) {
    emberMat = new THREE.ShaderMaterial({
      uniforms: { uTime: GLOBAL.time, uH: { value: height } },
      vertexShader: /* glsl */`
        attribute vec3 seed;
        uniform float uTime, uH;
        varying float vLife;
        void main() {
          float life = fract(uTime * (0.25 + seed.x * 0.3) + seed.y);
          vLife = life;
          float a = seed.z * 6.2831 + life * 4.0;
          vec3 p = vec3(cos(a) * position.x * (1.0 + life), life * uH, sin(a) * position.x * (1.0 + life));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.0 - life) * 26.0 / max(1.0, -mv.z) * 6.0;
        }`,
      fragmentShader: /* glsl */`
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * (1.0 - vLife);
          gl_FragColor = vec4(vec3(2.4, 0.9, 0.25) * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * radius;
    seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const pts = new THREE.Points(g, emberMat);
  pts.frustumCulled = false;
  return pts;
}

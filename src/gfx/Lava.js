// Lava incandescente de los lagos del volcán: un plano emisivo con ruido que
// fluye despacio. No recibe sombras ni luces (brilla también de día) y su
// brillo supera 1 para que el bloom lo convierta en resplandor. Se instancia
// sobre las casillas 'lava' (ver Zone.js).
import * as THREE from 'three';
import { GLOBAL } from './ModelKit.js';

let cached = null;

export function lavaMaterial() {
  if (cached) return cached;
  cached = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL.time },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 p = vWorld.xz * 0.45;
        float t = uTime * 0.35;
        float n = noise(p + vec2(t, -0.6 * t)) * 0.6 + noise(p * 2.7 - vec2(0.8 * t, t)) * 0.4;
        vec3 crust = vec3(0.16, 0.02, 0.0);   // costra oscura
        vec3 hot = vec3(1.0, 0.40, 0.06);     // magma
        vec3 bright = vec3(1.6, 1.0, 0.45);   // grietas que brillan
        vec3 c = mix(crust, hot, smoothstep(0.30, 0.62, n));
        c = mix(c, bright, smoothstep(0.70, 0.90, n));
        gl_FragColor = vec4(c * 2.4, 1.0);
      }`,
  });
  return cached;
}

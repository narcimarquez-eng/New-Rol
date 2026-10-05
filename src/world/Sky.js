// Cielo degradado, nubes low-poly, montañas lejanas y agua animada.
import * as THREE from 'three';
import { part, merge, toonMat, instanced, mountainGeo } from './Props.js';
import { rng } from '../core/utils.js';

export function buildSky(pal) {
  const geo = new THREE.SphereGeometry(300, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(pal.skyTop) },
      horizon: { value: new THREE.Color(pal.skyHorizon) },
      bottom: { value: new THREE.Color(pal.skyBottom || pal.skyHorizon) },
      sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
      sunColor: { value: new THREE.Color(pal.sun || 0xfff2c0) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, horizon, bottom, sunColor, sunDir;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * (smoothstep(0.995, 0.998, s) * 1.5 + pow(s, 64.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.name = 'sky';
  return sky;
}

export function buildClouds(pal, seed = 3) {
  const r = rng(seed);
  const geo = merge([
    part(new THREE.IcosahedronGeometry(1, 0), 0xffffff, { sx: 1.6, sy: 0.7 }),
    part(new THREE.IcosahedronGeometry(0.8, 0), 0xffffff, { x: 1.2, y: 0.2, sy: 0.7 }),
    part(new THREE.IcosahedronGeometry(0.7, 0), 0xffffff, { x: -1.1, y: 0.1, sy: 0.6 }),
  ]);
  const items = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 90 + r() * 120;
    items.push({ x: Math.cos(a) * d, y: 45 + r() * 30, z: Math.sin(a) * d, s: 5 + r() * 6, ry: r() * 6, tint: pal.cloudTint ?? 1 });
  }
  const mesh = instanced(geo, toonMat({ fog: false }), items, { castShadow: false, receiveShadow: false });
  mesh.name = 'clouds';
  return mesh;
}

export function buildMountains(pal, radius, seed = 5) {
  const r = rng(seed);
  const items = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.1;
    const d = radius + 20 + r() * 40;
    const s = 25 + r() * 35;
    items.push({ x: Math.cos(a) * d, y: -3, z: Math.sin(a) * d, s, sy: 0.8 + r() * 0.8, ry: r() * 6 });
  }
  const mesh = instanced(mountainGeo(pal.mountain, pal.mountainSnow), toonMat(), items, { castShadow: false, receiveShadow: false });
  mesh.name = 'mountains';
  return mesh;
}

/** Plano de agua con ondas y espuma toon. */
export function buildWater(width, depth, pal) {
  const geo = new THREE.PlaneGeometry(width, depth, Math.ceil(width / 4), Math.ceil(depth / 4));
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { time: { value: 0 }, deep: { value: new THREE.Color(pal.waterDeep) }, shallow: { value: new THREE.Color(pal.water) } },
    ]),
    vertexShader: /* glsl */`
      uniform float time;
      varying vec3 vPos;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        p.y += sin(p.x * 0.5 + time * 1.3) * 0.08 + cos(p.z * 0.6 + time) * 0.08;
        vPos = p;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float time;
      uniform vec3 deep, shallow;
      varying vec3 vPos;
      #include <fog_pars_fragment>
      void main() {
        float w = sin(vPos.x * 1.3 + time * 1.7) * sin(vPos.z * 1.1 - time * 1.3);
        float foam = step(0.82, w);
        vec3 c = mix(deep, shallow, 0.5 + 0.5 * sin((vPos.x + vPos.z) * 0.15 + time * 0.5));
        c = mix(c, vec3(1.0), foam * 0.55);
        gl_FragColor = vec4(c, 0.86);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.userData.update = (t) => { mat.uniforms.time.value = t; };
  return mesh;
}

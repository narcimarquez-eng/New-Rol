// Cielo degradado, nubes low-poly, montañas lejanas y agua animada.
import * as THREE from 'three';
import { part, merge, toonMat, instanced, mountainGeo } from './Props.js';
import { rng } from '../core/utils.js';
import { spart, smerge, rockify } from '../gfx/ModelKit.js';

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
  // nubes esponjosas: varias bolas suaves con la base más oscura
  const geo = smerge([
    spart(rockify(new THREE.IcosahedronGeometry(1, 2), 0.05, 1), 0xffffff, { sx: 1.7, sy: 0.75, ao: 0.35 }),
    spart(rockify(new THREE.IcosahedronGeometry(0.85, 2), 0.05, 2), 0xffffff, { x: 1.25, y: 0.25, sy: 0.8, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(0.75, 2), 0.05, 3), 0xffffff, { x: -1.2, y: 0.12, sy: 0.7, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(0.7, 2), 0.05, 4), 0xffffff, { x: 0.3, y: 0.55, z: 0.2, ao: 0.2 }),
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

/** Textura de alturas del terreno (0..1 codifica -3..+2 m) para la espuma de orilla. */
function heightTexture(terrain) {
  const w = terrain.VW, h = terrain.VH;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((terrain.heights[i] + 3) / 5) * 255)));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Plano de agua con ondas, profundidad, espuma en la orilla y destellos. */
export function buildWater(width, depth, pal, terrain, level = -0.55) {
  const geo = new THREE.PlaneGeometry(width, depth, Math.ceil(width / 2), Math.ceil(depth / 2));
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 }, deep: { value: new THREE.Color(pal.waterDeep) }, shallow: { value: new THREE.Color(pal.water) },
        heights: { value: null }, hOrigin: { value: new THREE.Vector2() }, hSize: { value: new THREE.Vector2() }, level: { value: level },
      },
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
      uniform float time, level;
      uniform vec3 deep, shallow;
      uniform sampler2D heights;
      uniform vec2 hOrigin, hSize;
      varying vec3 vPos;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = (vPos.xz - hOrigin) / hSize;
        float ground = texture2D(heights, uv).r * 5.0 - 3.0;
        float d = level - ground;            // profundidad del agua
        if (d < -0.05) discard;
        vec3 c = mix(shallow, deep, smoothstep(0.0, 1.3, d));
        // ondas y destellos
        float w = sin(vPos.x * 1.3 + time * 1.7) * sin(vPos.z * 1.1 - time * 1.3);
        c = mix(c, vec3(1.0), step(0.86, w) * 0.35);
        // espuma animada en la orilla
        float band = smoothstep(0.32, 0.0, d + sin(time * 2.0 + vPos.x * 0.8 + vPos.z * 0.6) * 0.06);
        c = mix(c, vec3(1.0), band * 0.85);
        gl_FragColor = vec4(c, mix(0.78, 0.95, band));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  if (terrain) {
    mat.uniforms.heights.value = heightTexture(terrain);
    mat.uniforms.hOrigin.value.set(terrain.originX, terrain.originZ);
    mat.uniforms.hSize.value.set((terrain.VW - 1) * terrain.step, (terrain.VH - 1) * terrain.step);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.userData.update = (t) => { mat.uniforms.time.value = t; };
  return mesh;
}

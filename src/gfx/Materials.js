// Materiales PBR del modo realista.
//  - triplanar(): proyecta texturas desde X/Y/Z en espacio de mundo (no necesita
//    UV), con mapa de normales y rugosidad; opcionalmente cubre las caras
//    superiores con hierba o nieve. Funciona con InstancedMesh.
//  - terrainMaterial(): mezcla 4 capas (césped, tierra, piedra, nieve) según
//    pesos por vértice, con detalle de normales y rugosidad por capa.
import * as THREE from 'three';
import { tex, rockTextures, cobbleTextures, snowTextures, iceTextures, sandTextures, flagstoneTextures, clayTextures } from './Textures.js';

const TRI_VERT_PARS = 'varying vec3 vTriPos;\nvarying vec3 vTriN;\n';
const TRI_VERT = `
  {
    mat4 triModel = modelMatrix;
    #ifdef USE_INSTANCING
      triModel = modelMatrix * instanceMatrix;
    #endif
    vTriPos = (triModel * vec4(transformed, 1.0)).xyz;
    vTriN = normalize(mat3(triModel) * objectNormal);
  }`;

/** Muestreo triplanar (incluido en los sombreadores). */
const TRI_FUNCS = `
  varying vec3 vTriPos;
  varying vec3 vTriN;
  vec3 triW() { vec3 w = pow(abs(vTriN), vec3(4.0)); return w / max(dot(w, vec3(1.0)), 1e-4); }
  vec4 triSample(sampler2D t, float s) {
    vec3 w = triW();
    return texture2D(t, vTriPos.zy * s) * w.x + texture2D(t, vTriPos.xz * s) * w.y + texture2D(t, vTriPos.xy * s) * w.z;
  }
  vec3 triNormalWorld(sampler2D t, float s, float strength) {
    vec3 w = triW();
    vec3 nx = texture2D(t, vTriPos.zy * s).xyz * 2.0 - 1.0;
    vec3 ny = texture2D(t, vTriPos.xz * s).xyz * 2.0 - 1.0;
    vec3 nz = texture2D(t, vTriPos.xy * s).xyz * 2.0 - 1.0;
    vec3 p = vec3(0.0, nx.y, nx.x) * w.x + vec3(ny.x, 0.0, ny.y) * w.y + vec3(nz.x, nz.y, 0.0) * w.z;
    return p * strength;
  }
`;

const triCache = new Map();
/**
 * @param {object} o { set: {map,normalMap,roughnessMap}, scale, color, vertexColors, normalStrength,
 *                     top: { set, color, from } (cubre caras horizontales), emissive,
 *                     fogScale (<1: la niebla afecta menos, para montañas lejanas) }
 */
export function triplanar(o = {}) {
  const key = o.key;
  if (key && triCache.has(key)) return triCache.get(key);
  const set = o.set || rockTextures();
  const mat = new THREE.MeshStandardMaterial({
    color: o.color ?? 0xffffff, vertexColors: o.vertexColors ?? true, roughness: 1, metalness: 0,
    emissive: o.emissive ?? 0x000000,
  });
  const top = o.top;
  const fogScale = o.fogScale ?? 1;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tTri = { value: set.map };
    sh.uniforms.tTriN = { value: set.normalMap };
    sh.uniforms.tTriR = { value: set.roughnessMap };
    sh.uniforms.triScale = { value: o.scale ?? 0.25 };
    sh.uniforms.triNS = { value: o.normalStrength ?? 0.8 };
    if (top) {
      sh.uniforms.tTop = { value: top.set.map };
      sh.uniforms.tTopN = { value: top.set.normalMap };
      sh.uniforms.topColor = { value: new THREE.Color(top.color ?? 0xffffff) };
      sh.uniforms.topFrom = { value: top.from ?? 0.6 };
    }
    sh.vertexShader = TRI_VERT_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + TRI_VERT);
    sh.fragmentShader = `uniform sampler2D tTri, tTriN, tTriR; uniform float triScale, triNS;
      ${top ? 'uniform sampler2D tTop, tTopN; uniform vec3 topColor; uniform float topFrom;' : ''}
      ${TRI_FUNCS}` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= triSample(tTri, triScale).rgb;
        ${top ? `float topMix = smoothstep(topFrom, topFrom + 0.15, vTriN.y);
        vec3 topTex = texture2D(tTop, vTriPos.xz * triScale * 1.3).rgb * topColor;
        diffuseColor.rgb = mix(diffuseColor.rgb, topTex, topMix);` : 'float topMix = 0.0;'}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(triSample(tTriR, triScale).r, 0.9, topMix);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 pw = triNormalWorld(tTriN, triScale, triNS);
          ${top ? 'pw = mix(pw, vec3(0.0), topMix);' : ''}
          normal = normalize(normal + (viewMatrix * vec4(pw, 0.0)).xyz);
        }`);
    if (fogScale !== 1) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          float fogD = vFogDepth * ${fogScale.toFixed(3)};
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogD * fogD );
          #else
            float fogFactor = smoothstep( fogNear, fogFar, fogD );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
        #endif`);
    }
  };
  mat.customProgramCacheKey = () => `tri-${top ? 'top' : 'plain'}-${fogScale}`;
  if (key) triCache.set(key, mat);
  return mat;
}

// ------------------------------------------------------------------ montañas lejanas
/**
 * Material de las montañas del fondo: el color (prado, bosque, roca, nieve) va
 * por vértice; la roca triplanar aporta grano y relieve. `fogScale` < 1 deja ver
 * las cumbres a través de la bruma (perspectiva aérea).
 */
export function backdropMaterial({ fogScale = 0.8 } = {}) {
  const set = rockTextures();
  const avg = new THREE.Color(0.45, 0.45, 0.45);
  averageColor(set.map, avg);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tTri: { value: set.map }, tTriN: { value: set.normalMap }, rockAvg: { value: avg } });
    sh.vertexShader = TRI_VERT_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + TRI_VERT);
    sh.fragmentShader = `uniform sampler2D tTri, tTriN; uniform vec3 rockAvg;
      ${TRI_FUNCS}` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float steep = smoothstep(0.92, 0.6, vTriN.y);
        vec3 grain = triSample(tTri, 0.045).rgb / max(rockAvg, vec3(0.05));
        diffuseColor.rgb *= mix(vec3(1.0), clamp(grain, 0.4, 1.8), 0.35 + 0.5 * steep);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + (viewMatrix * vec4(triNormalWorld(tTriN, 0.045, 0.7), 0.0)).xyz);`)
      .replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          float fogD = vFogDepth * ${fogScale.toFixed(3)};
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogD * fogD );
          #else
            float fogFactor = smoothstep( fogNear, fogFar, fogD );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
        #endif`);
  };
  m.customProgramCacheKey = () => `backdrop-${fogScale}`;
  return m;
}

// ------------------------------------------------------------------ terreno
/** Color medio (lineal) de una textura cuando termine de cargar. */
function averageColor(texture, target) {
  const done = () => {
    const img = texture.image;
    if (!img || !img.width) return false;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0, 8, 8);
    const d = c.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    target.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
    return true;
  };
  if (!done()) { const id = setInterval(() => { if (done()) clearInterval(id); }, 150); }
}

const terrainMats = new Map();
/**
 * Material del terreno. Los pesos de capa llegan en el atributo `splat` y el
 * color por vértice da el tono de la zona; las texturas aportan el detalle (se
 * normalizan por su color medio). Cada variante elige sus cuatro capas:
 *   default: césped, tierra, adoquines, nieve · desert: césped del oasis, arena, losas, tierra agrietada
 */
export function terrainMaterial(variant = 'default') {
  if (terrainMats.has(variant)) return terrainMats.get(variant);
  const desert = variant === 'desert';
  const castle = variant === 'castle'; // castillo y santuarios: losas grandes y adoquín
  const grass = tex('tex/grass.jpg');
  const sand = desert ? sandTextures() : null;
  const dirt = desert ? sand.map : tex('tex/dirt_color.jpg');
  const dirtN = desert ? sand.normalMap : tex('tex/dirt_normal.jpg', { srgb: false });
  const cobble = desert || castle ? flagstoneTextures() : cobbleTextures();
  const snow = desert ? clayTextures() : castle ? cobbleTextures() : snowTextures();
  // escala (repeticiones por unidad) de cada capa
  const sc = desert ? { d: 0.07, s: 0.15, n: 0.12 } : castle ? { d: 0.22, s: 0.13, n: 0.4 } : { d: 0.22, s: 0.5, n: 0.11 };
  const rough = desert ? new THREE.Vector4(0.96, 0.93, 0.84, 0.95) : castle ? new THREE.Vector4(0.97, 0.93, 0.78, 0.86) : new THREE.Vector4(0.97, 0.93, 0.86, 0.72);
  const avg = { g: new THREE.Color(0.2, 0.3, 0.1), d: new THREE.Color(0.3, 0.25, 0.2), s: new THREE.Color(0.4, 0.4, 0.4), n: new THREE.Color(0.9, 0.9, 0.95) };
  averageColor(grass, avg.g); averageColor(dirt, avg.d);
  averageColor(cobble.map, avg.s); averageColor(snow.map, avg.n);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      scD: { value: sc.d }, scS: { value: sc.s }, scN: { value: sc.n }, layerRough: { value: rough },
      tGrass: { value: grass }, tDirt: { value: dirt }, tDirtN: { value: dirtN },
      tStone: { value: cobble.map }, tStoneN: { value: cobble.normalMap },
      tSnow: { value: snow.map }, tSnowN: { value: snow.normalMap },
      avgG: { value: avg.g }, avgD: { value: avg.d }, avgS: { value: avg.s }, avgN: { value: avg.n },
    });
    sh.vertexShader = 'attribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    sh.fragmentShader = `varying vec4 vSplat; varying vec3 vWPos;
      uniform sampler2D tGrass, tDirt, tDirtN, tStone, tStoneN, tSnow, tSnowN;
      uniform vec3 avgG, avgD, avgS, avgN;
      uniform float scD, scS, scN;
      uniform vec4 layerRough;
    ` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec4 sw = vSplat / max(dot(vSplat, vec4(1.0)), 1e-3);
        vec2 uw = vWPos.xz;
        // dos escalas de césped para ocultar la repetición
        vec3 tg = texture2D(tGrass, uw * 0.17).rgb * 0.6 + texture2D(tGrass, uw * 0.047 + 0.37).rgb * 0.4;
        vec3 td = texture2D(tDirt, uw * scD).rgb;
        vec3 ts = texture2D(tStone, uw * scS).rgb;
        vec3 tn = texture2D(tSnow, uw * scN).rgb;
        vec3 detail = (tg / max(avgG, 0.02)) * sw.x + (td / max(avgD, 0.02)) * sw.y + (ts / max(avgS, 0.02)) * sw.z + (tn / max(avgN, 0.02)) * sw.w;
        diffuseColor.rgb *= clamp(detail, 0.2, 1.9);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = dot(sw, layerRough);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 nd = texture2D(tDirtN, uw * scD).xy * 2.0 - 1.0;
          vec2 ns = texture2D(tStoneN, uw * scS).xy * 2.0 - 1.0;
          vec2 nn = texture2D(tSnowN, uw * scN).xy * 2.0 - 1.0;
          vec2 p = nd * (sw.y * 0.9 + sw.x * 0.35) + ns * sw.z * 1.1 + nn * sw.w * 0.5;
          normal = normalize(normal + (viewMatrix * vec4(p.x, 0.0, -p.y, 0.0)).xyz);
        }`);
  };
  m.customProgramCacheKey = () => 'terrain-real';
  terrainMats.set(variant, m);
  return m;
}

let iceReal = null;
/** Hielo del lago: barniz brillante (clearcoat) que refleja el cielo, escarcha y grietas, algo translúcido. */
export function iceMaterialReal() {
  if (iceReal) return iceReal;
  const set = iceTextures();
  iceReal = new THREE.MeshPhysicalMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0x8fb8d2, roughness: 1, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.14,
    transparent: true, opacity: 0.8, envMapIntensity: 1.4,
  });
  // coordenadas de textura en espacio de mundo: sin costuras entre casillas
  iceReal.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      {
        mat4 iceM = modelMatrix;
        #ifdef USE_INSTANCING
          iceM = modelMatrix * instanceMatrix;
        #endif
        vec2 iceUv = (iceM * vec4(position, 1.0)).xz * 0.09;
        vMapUv = iceUv; vNormalMapUv = iceUv; vRoughnessMapUv = iceUv;
      }`);
  };
  iceReal.customProgramCacheKey = () => 'ice-world-uv';
  return iceReal;
}

/** Madera procedural triplanar (vallas, puentes, carteles...). */
export { woodTextures, plasterTextures, roofTextures, rockTextures, snowTextures, cobbleTextures, iceTextures } from './Textures.js';

// Kit de modelado y materiales "estilo dibujo animado":
//  - geometría suave (indexada) con colores por vértice y AO falsa por altura
//  - contornos de tinta (técnica "inverted hull") para mallas e instancias
//  - caras pintadas en canvas con parpadeo
//  - viento en vegetación y uniformes globales (tiempo, posición del jugador)
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from '../core/utils.js';
import { REALISTIC } from './Style.js';

// ---------------------------------------------------------------- uniformes globales
export const GLOBAL = {
  time: { value: 0 },
  playerPos: { value: new THREE.Vector3() },
  windStrength: { value: 1 },
};

// ---------------------------------------------------------------- toon
let grad = null;
export function gradientMap() {
  if (grad) return grad;
  // 4 tonos: sombra profunda, sombra, luz, brillo
  grad = new THREE.DataTexture(new Uint8Array([
    95, 95, 105, 255, 150, 150, 158, 255, 225, 225, 225, 255, 255, 255, 255, 255,
  ]), 4, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;
  return grad;
}

/** Material toon con colores por vértice. Cada personaje usa su propia instancia (para destellos). */
/**
 * Material iluminado según el estilo global: PBR (MeshStandardMaterial) en modo
 * realista o toon por bandas en modo dibujo animado.
 */
export function litMaterial(opts = {}) {
  if (REALISTIC) {
    const { gradientMap: _g, ...rest } = opts;
    return new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, ...rest });
  }
  return new THREE.MeshToonMaterial({ gradientMap: gradientMap(), ...opts });
}

export function charMat(opts = {}) {
  const m = litMaterial({ vertexColors: true, ...opts });
  if (!opts.emissive) m.emissive = new THREE.Color(0);
  return m;
}

// ---------------------------------------------------------------- geometría suave
/**
 * Pieza de geometría suave: conserva el índice (normales suavizadas), aplica la
 * transformación y pinta un color uniforme con oscurecimiento inferior opcional (AO).
 */
export function spart(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, ao = 0.18, flat = false, top = null } = {}) {
  let g = geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  if (flat) g = g.index ? g.toNonIndexed() : g;
  else if (!g.index) g = mergeVertices(g, 1e-4);
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  ));
  g.computeVertexNormals();
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const c = new THREE.Color(color);
  const tc = top ? new THREE.Color(top.color) : null; // color superior (p. ej. nieve)
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = bb.max.y - bb.min.y > 1e-4 ? (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y) : 1;
    const k = 1 - ao * (1 - t);
    const cc = tc && t >= top.from ? tc : c;
    const kk = tc && t >= top.from ? 1 : k;
    arr[i * 3] = cc.r * kk; arr[i * 3 + 1] = cc.g * kk; arr[i * 3 + 2] = cc.b * kk;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Fusiona piezas (todas indexadas o todas no indexadas). */
export function smerge(parts) {
  const anyIndexed = parts.some((p) => p.index);
  const norm = anyIndexed ? parts.map((p) => (p.index ? p : mergeVertices(p))) : parts;
  return mergeGeometries(norm, false);
}

/** Deforma una geometría con ruido coherente por posición (sin grietas entre caras). */
export function rockify(geo, amp = 0.15, seed = 1, freq = 2.3) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = hash2(Math.round(v.x * 100 * freq), Math.round((v.y * 37 + v.z) * 100 * freq), seed) - 0.5;
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amp * 2) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- viento (GLSL compartido)
// Los parámetros van en uniformes para que todos los materiales compartan
// un único programa de sombreado (menos compilaciones = arranque más rápido).
const WIND_GLSL = `
      {
        float hgt = max(0.0, position.y - uWindFrom);
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float ph = ip.x * 0.21 + ip.z * 0.17;
        float sway = sin(uTime * 1.6 + ph) * 0.7 + sin(uTime * 2.9 + ph * 1.7) * 0.3;
        transformed.x += sway * hgt * uWindAmount * uWind;
        transformed.z += cos(uTime * 1.3 + ph) * hgt * uWindAmount * 0.6 * uWind;
      }`;
const WIND_PARS = 'uniform float uTime;\nuniform float uWind;\nuniform float uWindFrom;\nuniform float uWindAmount;\n';

// ---------------------------------------------------------------- contornos
const outlineMats = new Map();
/** Material de contorno: caras traseras desplazadas por la normal, color tinta. */
export function outlineMaterial(thickness = 0.03, color = 0x1d1712, { wind = null } = {}) {
  const key = `${thickness}|${color}|${wind ? wind.from + ',' + wind.amount : ''}`;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.outlineThickness = { value: thickness };
    sh.uniforms.uTime = GLOBAL.time;
    sh.uniforms.uWind = GLOBAL.windStrength;
    sh.uniforms.uWindFrom = { value: wind ? wind.from : 0 };
    sh.uniforms.uWindAmount = { value: wind ? wind.amount : 0 };
    sh.vertexShader = 'uniform float outlineThickness;\n' + WIND_PARS + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += normalize(normal) * outlineThickness;' + WIND_GLSL,
    );
  };
  m.customProgramCacheKey = () => 'outline-v3';
  outlineMats.set(key, m);
  return m;
}

/** Añade un contorno a una malla (comparte geometría; usa normales suavizadas si hace falta). */
export function addOutline(mesh, thickness = 0.03) {
  if (REALISTIC) return null; // el modo realista no usa contornos de tinta
  let geo = mesh.geometry;
  if (!geo.index) geo = smoothNormalsGeo(geo);
  const o = new THREE.Mesh(geo, outlineMaterial(thickness));
  o.name = 'outline';
  o.castShadow = false; o.receiveShadow = false;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

/** Copia de la geometría con vértices soldados y normales suaves (para extruir contornos sin huecos). */
export function smoothNormalsGeo(geo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  const merged = mergeVertices(g, 1e-3);
  merged.computeVertexNormals();
  return merged;
}

/** Contorno para una InstancedMesh (comparte matrices de instancia). */
export function instancedOutline(mesh, thickness = 0.06, wind = null) {
  if (REALISTIC) return null;
  const geo = smoothNormalsGeo(mesh.geometry);
  const o = new THREE.InstancedMesh(geo, outlineMaterial(thickness, 0x1d1712, { wind }), mesh.count);
  o.instanceMatrix = mesh.instanceMatrix;
  o.count = mesh.count;
  o.castShadow = false; o.receiveShadow = false;
  o.name = 'outline';
  return o;
}

// ---------------------------------------------------------------- viento
const windCache = new Map();
/**
 * Variante de un material toon con balanceo por viento. Las vértices se mueven
 * en proporción a su altura por encima de `from` (el tronco/base no se mueve).
 */
export function windMat(base, { from = 1.2, amount = 0.06 } = {}) {
  const key = `${base.uuid}|${from}|${amount}`;
  if (windCache.has(key)) return windCache.get(key);
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = GLOBAL.time;
    sh.uniforms.uWind = GLOBAL.windStrength;
    sh.uniforms.uWindFrom = { value: from };
    sh.uniforms.uWindAmount = { value: amount };
    sh.vertexShader = WIND_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + WIND_GLSL);
  };
  m.customProgramCacheKey = () => 'wind-v3';
  windCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------- caras pintadas
const faceCache = new Map();
/**
 * Textura de cara (2 fotogramas: ojos abiertos / cerrados) dibujada en canvas.
 * style: 'hero' | 'npc' | 'old' | 'girl' | 'kid' | 'angry' | 'cute' | 'wolf'
 */
export function faceTexture(style = 'npc', eye = '#2b2118') {
  const key = style + eye;
  if (faceCache.has(key)) return faceCache.get(key);
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.lineCap = 'round';
  for (let f = 0; f < 2; f++) {
    const ox = f * 128;
    const closed = f === 1;
    const big = style === 'hero' || style === 'cute' || style === 'kid' || style === 'girl';
    const ex = [ox + 44, ox + 84];
    const ey = style === 'cute' ? 60 : 56;
    const rx = big ? 13 : 9, ry = big ? 18 : 12;
    for (const x of ex) {
      if (closed) {
        c.strokeStyle = '#2b2118'; c.lineWidth = 5;
        c.beginPath(); c.arc(x, ey, rx * 0.9, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
      } else if (style === 'angry' || style === 'wolf') {
        c.fillStyle = '#fff6d0';
        c.beginPath(); c.ellipse(x, ey, rx + 2, ry * 0.75, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = eye;
        c.beginPath(); c.ellipse(x, ey + 1, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2); c.fill();
      } else if (style === 'old') {
        c.strokeStyle = '#2b2118'; c.lineWidth = 6;
        c.beginPath(); c.arc(x, ey + 4, 9, 1.1 * Math.PI, 1.9 * Math.PI); c.stroke();
      } else {
        c.fillStyle = '#ffffff';
        c.beginPath(); c.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = eye;
        c.beginPath(); c.ellipse(x + 1, ey + 3, rx * 0.72, ry * 0.75, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#111';
        c.beginPath(); c.ellipse(x + 1, ey + 4, rx * 0.38, ry * 0.42, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(x - rx * 0.25, ey - ry * 0.25, rx * 0.28, 0, Math.PI * 2); c.fill();
        if (style === 'girl') {
          c.strokeStyle = '#2b2118'; c.lineWidth = 3;
          for (const d of [-1, 0, 1]) { c.beginPath(); c.moveTo(x + d * 6, ey - ry); c.lineTo(x + d * 9, ey - ry - 7); c.stroke(); }
        }
      }
    }
    // cejas
    c.strokeStyle = style === 'old' ? '#e8e8e8' : '#3a2a1a';
    c.lineWidth = style === 'old' ? 9 : 5;
    const by = ey - (big ? 28 : 22);
    if (style === 'angry' || style === 'wolf') {
      c.beginPath(); c.moveTo(ex[0] - 16, by - 2); c.lineTo(ex[0] + 12, by + 10); c.stroke();
      c.beginPath(); c.moveTo(ex[1] + 16, by - 2); c.lineTo(ex[1] - 12, by + 10); c.stroke();
    } else if (style !== 'cute') {
      c.beginPath(); c.moveTo(ex[0] - 12, by + 2); c.quadraticCurveTo(ex[0], by - 5, ex[0] + 12, by + 2); c.stroke();
      c.beginPath(); c.moveTo(ex[1] - 12, by + 2); c.quadraticCurveTo(ex[1], by - 5, ex[1] + 12, by + 2); c.stroke();
    }
    // boca
    c.strokeStyle = '#5a2a1a'; c.lineWidth = 4;
    const mx = ox + 64, my = style === 'cute' ? 92 : 96;
    c.beginPath();
    if (style === 'angry' || style === 'wolf') { c.moveTo(mx - 12, my + 4); c.quadraticCurveTo(mx, my - 6, mx + 12, my + 4); }
    else if (style === 'cute') { c.moveTo(mx - 7, my); c.quadraticCurveTo(mx - 3, my + 6, mx, my); c.quadraticCurveTo(mx + 3, my + 6, mx + 7, my); }
    else { c.moveTo(mx - 8, my); c.quadraticCurveTo(mx, my + 6, mx + 8, my); }
    c.stroke();
    // mejillas
    if (style === 'hero' || style === 'girl' || style === 'kid' || style === 'cute') {
      c.fillStyle = 'rgba(255,120,120,0.35)';
      c.beginPath(); c.ellipse(ox + 28, 84, 9, 5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(ox + 100, 84, 9, 5, 0, 0, Math.PI * 2); c.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(0.5, 1);
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

/**
 * Calcomanía de cara: un casquete esférico delante de la cabeza.
 * Devuelve { mesh, blink(dt) } con parpadeo aleatorio.
 */
export function faceDecal(radius, style, eye, { width = 1.6, height = 1.1, center = 1.62 } = {}) {
  const tex = faceTexture(style, eye).clone();
  tex.needsUpdate = true;
  const geo = new THREE.SphereGeometry(radius * 1.012, 24, 14, Math.PI / 2 - width / 2, width, center - height / 2, height);
  const mat = litMaterial({ map: tex, transparent: true, alphaTest: 0.35, depthWrite: false });
  mat.emissive = new THREE.Color(0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  let t = 1 + Math.random() * 3, closedT = 0;
  return {
    mesh, mat,
    blink(dt) {
      t -= dt;
      if (closedT > 0) { closedT -= dt; if (closedT <= 0) tex.offset.x = 0; }
      else if (t <= 0) { tex.offset.x = 0.5; closedT = 0.12; t = 2 + Math.random() * 3.5; }
    },
  };
}

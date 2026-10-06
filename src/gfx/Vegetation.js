// Vegetación realista: árboles y arbustos generados con ez-tree (MIT), con
// corteza PBR (color, normales, rugosidad), hojas con transparencia recortada,
// sombras de las hojas y viento. Cada variante se genera una vez y se dibuja
// con instancias (una llamada por variante y zona).
import * as THREE from 'three';
import { Tree } from '../vendor/ez-tree/tree.js';
import { tex, texRepeat, tintedLeafTexture } from './Textures.js';
import { windMat } from './ModelKit.js';
import { rng as rngFn } from '../core/utils.js';

/**
 * Tipos de vegetación del juego.
 *   preset: preajuste de ez-tree · height: altura final en unidades de mundo
 *   lite: reduce hojas/ramas (para muros de bosque con cientos de árboles)
 */
export const KINDS = {
  oak: { preset: 'Oak Medium', height: 9.5, bark: 'oak', leaf: 'oak', tint: 0xd8e8b0 },
  oakSmall: { preset: 'Oak Small', height: 6.5, bark: 'oak', leaf: 'oak', tint: 0xd8e8b0 },
  cherry: { preset: 'Ash Medium', height: 8, bark: 'oak', leaf: 'cherry', tint: 0xffffff, barkTint: 0x9a7a6a },
  pine: { preset: 'Pine Medium', height: 11, bark: 'pine', leaf: 'pine', tint: 0xbfd8a8 },
  pineLite: { preset: 'Pine Small', height: 9, bark: 'pine', leaf: 'pine', tint: 0xb0cc98, lite: true },
  snowPine: { preset: 'Pine Medium', height: 10, bark: 'pine', leaf: 'pine', tint: 0xdfe8ef },
  bush: { preset: 'Bush 1', height: 2.0, bark: 'oak', leaf: 'oak', tint: 0xc8e0a0 },
  bush2: { preset: 'Bush 2', height: 2.2, bark: 'oak', leaf: 'ash', tint: 0xc8e0a0 },
  hedge: { preset: 'Bush 3', height: 3.6, bark: 'oak', leaf: 'oak', tint: 0xa8c888 },
  // versiones con "tarjetas" de hojas (planos texturizados alrededor de un núcleo
  // denso): ~40 veces menos triángulos, para los muros vegetales con cientos de piezas
  hedgeCard: { card: 'hedge', height: 3.2, leaf: 'oak', tint: 0xb8d498, core: 0x2c4620 },
  pineCard: { card: 'pine', height: 9.5, bark: 'pine', leaf: 'pine', tint: 0xb8cca0, core: 0x1f3219 },
  snowPineCard: { card: 'pine', height: 9, bark: 'pine', leaf: 'pine', tint: 0xd8e2e8, core: 0x2a3a30 },
  scrub: { card: 'hedge', height: 1.1, leaf: 'oak', tint: 0xb4a468, core: 0x5a4e2c }, // matorral seco del desierto
};

// ------------------------------------------------------------------ tarjetas
/** Añade un plano (tarjeta) con la base en `base`, creciendo hacia `up`, normal suavizada `n`. */
function pushCard(out, base, up, right, w, h, n, shade) {
  const b0 = base.clone().addScaledVector(right, -w / 2), b1 = base.clone().addScaledVector(right, w / 2);
  const t0 = b0.clone().addScaledVector(up, h), t1 = b1.clone().addScaledVector(up, h);
  const i = out.pos.length / 3;
  for (const [p, u, v] of [[b0, 0, 0], [b1, 1, 0], [t1, 1, 1], [t0, 0, 1]]) {
    out.pos.push(p.x, p.y, p.z); out.uv.push(u, v); out.nrm.push(n.x, n.y, n.z); out.col.push(shade, shade, shade);
  }
  out.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
}

/** Núcleo opaco que rellena los huecos entre tarjetas (va en su propio grupo/material). */
function pushCore(out, geo, shade) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  const i0 = out.pos.length / 3;
  for (let i = 0; i < p.count; i++) {
    out.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    out.nrm.push(nr.getX(i), nr.getY(i), nr.getZ(i));
    out.uv.push(0.5, 0.5);
    out.col.push(shade, shade, shade);
    out.idx.push(i0 + i);
  }
}

function cardGeometry(kind, seed) {
  const k = KINDS[kind];
  const r = rngFn(seed * 977 + 3);
  const out = { pos: [], nrm: [], uv: [], col: [], idx: [] };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  let branches = null;
  if (k.card === 'hedge') {
    const H = k.height, rx = 2.15, ry = H * 0.5, cy = H * 0.48;
    const core = new THREE.IcosahedronGeometry(1, 2);
    const cp = core.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
      const j = 0.78 + r() * 0.12;
      cp.setXYZ(i, x * rx * j, Math.max(y * ry * j, -cy * 0.95) + cy, z * rx * j);
    }
    pushCore(out, core, 1);
    out.coreCount = out.idx.length;
    for (let i = 0; i < 64; i++) {
      const a = r() * Math.PI * 2, el = -0.25 + r() * 1.3; // de los lados hacia arriba
      const d = v(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).normalize();
      const base = v(d.x * rx * 0.62, cy + d.y * ry * 0.62, d.z * rx * 0.62);
      const up = d.clone().add(v((r() - 0.5) * 0.6, 0.35 + r() * 0.3, (r() - 0.5) * 0.6)).normalize();
      const right = new THREE.Vector3().crossVectors(up, v(r() - 0.5, r() - 0.5, r() - 0.5)).normalize();
      const size = 1.5 + r() * 0.8;
      const n = d.clone().add(v(0, 0.35, 0)).normalize();
      pushCard(out, base, up, right, size * 0.9, size, n, 0.85 + r() * 0.15);
    }
  } else {
    // pino: tronco + pisos de ramas con tarjetas cruzadas que caen un poco
    const H = k.height;
    const trunk = new THREE.CylinderGeometry(0.12, 0.32, H * 0.92, 7, 1, true);
    trunk.translate(0, H * 0.46, 0);
    branches = trunk;
    pushCore(out, new THREE.ConeGeometry(1.25, H * 0.78, 8, 1, true).translate(0, H * 0.55, 0), 1);
    out.coreCount = out.idx.length;
    const tiers = 8;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1);
      const y = H * (0.2 + f * 0.7);
      const rad = (1 - f) * 2.6 + 0.55;
      const nb = Math.max(4, Math.round(8 - f * 4));
      const off = r() * Math.PI * 2;
      for (let b = 0; b < nb; b++) {
        const a = off + (b / nb) * Math.PI * 2 + (r() - 0.5) * 0.4;
        const out2 = v(Math.cos(a), 0, Math.sin(a));
        const up = out2.clone().add(v(0, -0.18 + r() * 0.2, 0)).normalize();
        const side = v(-Math.sin(a), 0, Math.cos(a));
        const base = v(0, y, 0).addScaledVector(out2, 0.15);
        const len = rad * (1.05 + r() * 0.25), w = len * 0.85;
        const n = out2.clone().add(v(0, 0.7, 0)).normalize();
        const shade = 0.75 + f * 0.25;
        // dos tarjetas cruzadas: una casi horizontal (vista desde arriba) y otra vertical
        const tilt = side.clone().applyAxisAngle(up, 0.35);
        pushCard(out, base, up, tilt, w, len, n, shade);
        pushCard(out, base, up, v(0, 1, 0).cross(up).cross(up).normalize().negate(), w * 0.8, len * 0.9, n, shade * 0.95);
      }
    }
    // punta
    for (let c = 0; c < 2; c++) {
      const right = c ? v(1, 0, 0) : v(0, 0, 1);
      pushCard(out, v(0, H * 0.84, 0), v(0, 1, 0), right, 1.1, H * 0.2, v(0, 1, 0), 1);
    }
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  leaves.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3));
  leaves.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  leaves.setIndex(out.idx);
  leaves.addGroup(0, out.coreCount, 0);
  leaves.addGroup(out.coreCount, out.idx.length - out.coreCount, 1);
  leaves.computeBoundingSphere();
  if (branches) { branches.deleteAttribute('normal'); branches.computeVertexNormals(); }
  return { branches, leaves, textureScale: { x: 1, y: 1 / (k.height * 0.35) }, tris: out.idx.length / 3 };
}

const geoCache = new Map();

/** Genera (y cachea) la geometría de una variante normalizada a su altura. */
export function treeGeometry(kind, seed = 1) {
  const key = `${kind}|${seed}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const k = KINDS[kind];
  if (k.card) {
    const out = cardGeometry(kind, seed);
    geoCache.set(key, out);
    return out;
  }
  const t = new Tree();
  t.loadPreset(k.preset);
  t.options.seed = seed * 7919 + 13;
  t.options.bark.textured = false;
  if (k.lite) {
    t.options.leaves.count = Math.max(4, Math.round(t.options.leaves.count * 0.55));
    t.options.branch.levels = Math.min(t.options.branch.levels, 2);
  }
  t.generate();
  const branches = t.branchesMesh.geometry;
  const leaves = t.leavesMesh.geometry;
  branches.computeBoundingBox(); leaves.computeBoundingBox();
  const box = branches.boundingBox.clone().union(leaves.boundingBox);
  const s = k.height / Math.max(0.01, box.max.y - box.min.y);
  const m = new THREE.Matrix4().makeScale(s, s, s).premultiply(new THREE.Matrix4().makeTranslation(0, -box.min.y * s, 0));
  branches.applyMatrix4(m); leaves.applyMatrix4(m);
  // sombreado de las hojas: normales "esféricas" desde el centro de la copa (luz más suave)
  leaves.computeBoundingBox();
  const c = new THREE.Vector3(); leaves.boundingBox.getCenter(c);
  const pos = leaves.attributes.position, nrm = leaves.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(c).normalize();
    const nx = nrm.getX(i) * 0.4 + v.x * 0.6, ny = nrm.getY(i) * 0.4 + v.y * 0.6 + 0.2, nz = nrm.getZ(i) * 0.4 + v.z * 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(i, nx / l, ny / l, nz / l);
  }
  const out = { branches, leaves, textureScale: t.options.bark.textureScale, tris: (branches.index.count + leaves.index.count) / 3 };
  geoCache.set(key, out);
  return out;
}

const matCache = new Map();
function barkMaterial(kind, scale) {
  const k = KINDS[kind];
  const key = `bark|${k.bark}|${scale.x}|${scale.y}|${k.barkTint ?? 0xffffff}`;
  if (matCache.has(key)) return matCache.get(key);
  const rep = (name, opts) => texRepeat(`bark/${k.bark}_${name}_1k.jpg`, scale.x, 1 / scale.y, opts);
  const m = new THREE.MeshStandardMaterial({
    map: rep('color'),
    normalMap: rep('normal', { srgb: false }),
    roughnessMap: rep('roughness', { srgb: false }),
    color: k.barkTint ?? 0xffffff,
  });
  matCache.set(key, m);
  return m;
}

function leafTexture(name) {
  if (name === 'cherry') return tintedLeafTexture('leaves/ash_color.png', [255, 170, 200], 'cherry');
  return tex(`leaves/${name}_color.png`);
}

function leafMaterials(kind) {
  const k = KINDS[kind];
  const key = `leaf|${k.leaf}|${k.tint}|${k.core ?? ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const map = leafTexture(k.leaf);
  const base = new THREE.MeshStandardMaterial({ map, color: k.tint, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.75, vertexColors: !!k.card });
  const mat = windMat(base, { from: k.height * 0.3, amount: 0.022 });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  const out = { mat, depth };
  if (k.card) {
    const core = new THREE.MeshStandardMaterial({ color: k.core ?? 0x2c4620, roughness: 0.9, side: THREE.DoubleSide });
    out.mat = [windMat(core, { from: k.height * 0.3, amount: 0.022 }), mat];
  }
  matCache.set(key, out);
  return out;
}

/** Corteza PBR para troncos sueltos (leños, tocones, postes); repetición en u (vuelta) y v (largo). */
export function barkMat(bark = 'oak', rx = 1, ry = 1, tint = 0xffffff) {
  const key = `barkmat|${bark}|${rx}|${ry}|${tint}`;
  if (matCache.has(key)) return matCache.get(key);
  const rep = (name, opts) => texRepeat(`bark/${bark}_${name}_1k.jpg`, rx, ry, opts);
  const m = new THREE.MeshStandardMaterial({ map: rep('color'), normalMap: rep('normal', { srgb: false }), roughnessMap: rep('roughness', { srgb: false }), color: tint });
  matCache.set(key, m);
  return m;
}

let endGrain = null;
/** Corte de un tronco: anillos de crecimiento (para las tapas de leños y tocones). */
export function endGrainMat() {
  if (endGrain) return endGrain;
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const img = c.createImageData(S, S);
  const r = rngFn(77);
  const wob = Array.from({ length: 16 }, () => r() * 6.283);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - S / 2, dy = y - S / 2;
    const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) / (S / 2);
    const ring = Math.sin((d * 22 + Math.sin(a * 3 + wob[0]) * 0.25 + Math.sin(a * 7 + wob[1]) * 0.1) * Math.PI * 2) * 0.5 + 0.5;
    const bark = d > 0.9 ? 1 : 0;
    const crack = Math.abs(Math.sin(a * 2.5 + wob[2])) < 0.02 && d > 0.15 ? 1 : 0;
    let v = 0.62 + ring * 0.12 - d * 0.1 - crack * 0.25 + (r() - 0.5) * 0.05;
    if (bark) v = 0.25 + r() * 0.06;
    const i = (y * S + x) * 4;
    img.data[i] = Math.min(255, v * 235); img.data[i + 1] = Math.min(255, v * 190); img.data[i + 2] = Math.min(255, v * 140); img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  endGrain = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  return endGrain;
}

/**
 * Crea las mallas instanciadas (ramas + hojas) para una lista de posiciones.
 * items: [{x,y,z,ry,s}] · devuelve un THREE.Group
 */
export function treeInstances(kind, items, { seed = 1, castShadow = true } = {}) {
  const g = new THREE.Group();
  if (!items.length) return g;
  const geo = treeGeometry(kind, seed);
  const bark = geo.branches ? new THREE.InstancedMesh(geo.branches, barkMaterial(kind, geo.textureScale), items.length) : null;
  const lm = leafMaterials(kind);
  const leaves = new THREE.InstancedMesh(geo.leaves, lm.mat, items.length);
  leaves.customDepthMaterial = lm.depth;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(0, it.ry || 0, 0); q.setFromEuler(e);
    p.set(it.x, it.y, it.z); sc.setScalar(it.s ?? 1);
    m.compose(p, q, sc);
    bark?.setMatrixAt(i, m); leaves.setMatrixAt(i, m);
  });
  const meshes = bark ? [bark, leaves] : [leaves];
  for (const mesh of meshes) {
    mesh.castShadow = castShadow; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  g.add(...meshes);
  g.userData.instances = meshes;
  return g;
}

/** Reparte una lista entre varias semillas para que no todos los árboles sean iguales. */
export function variedTrees(kind, items, seeds = [1, 2, 3], opts = {}) {
  const g = new THREE.Group();
  seeds.forEach((seed, si) => {
    const sub = items.filter((_, i) => i % seeds.length === si);
    if (sub.length) g.add(treeInstances(kind, sub, { ...opts, seed }));
  });
  return g;
}

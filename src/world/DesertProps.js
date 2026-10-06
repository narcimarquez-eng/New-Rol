// Objetos del Desierto Perdido: palmeras, cactus saguaro, muros en ruinas de
// arenisca, columnas, tiendas de lona y ánforas. Todo procedural; se dibuja con
// instancias (una llamada por tipo) o fusionado en una sola malla (las ruinas).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { triplanar } from '../gfx/Materials.js';
import { sandstoneTextures, palmFrondTexture } from '../gfx/Textures.js';
import { barkMat } from '../gfx/Vegetation.js';
import { windMat } from '../gfx/ModelKit.js';
import { rng, fbm, hash2 } from '../core/utils.js';
import { instanced } from './Props.js';
import { TILE } from './tiles.js';

let sandstoneMat = null;
/** Arenisca triplanar (ruinas, columnas, templo). */
export function sandstone() {
  return (sandstoneMat ??= triplanar({ key: 'sandstone', set: sandstoneTextures(), scale: 0.22, normalStrength: 1, vertexColors: true, color: 0xffffff }));
}

/** Colorea una geometría con un color uniforme (atributo de vértice) y un ligero oscurecido abajo. */
function paint(geo, hex, ao = 0.25) {
  const g = geo.index ? geo : mergeVertices(geo);
  g.computeBoundingBox();
  const bb = g.boundingBox, c = new THREE.Color(hex);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - bb.min.y) / Math.max(1e-4, bb.max.y - bb.min.y);
    const k = 1 - ao * (1 - t);
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ palmeras
const palmCache = new Map();
function palmGeometry(seed) {
  if (palmCache.has(seed)) return palmCache.get(seed);
  const r = rng(seed * 131 + 7);
  const H = 6.5 + r() * 1.5, bend = 0.9 + r() * 1.2, segs = 14;
  // tronco curvado con anillos
  const trunkParts = [];
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(bend * t * t * 1.4, t * H, 0));
  }
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    const rad0 = 0.3 - (i / segs) * 0.1, rad1 = 0.3 - ((i + 1) / segs) * 0.1;
    const cyl = new THREE.CylinderGeometry(rad1 * 0.92, rad0, len, 10, 1, true);
    cyl.translate(0, len / 2, 0);
    const dir = b.clone().sub(a).normalize();
    cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    cyl.translate(a.x, a.y, a.z);
    // abultamiento de cada anillo
    const ring = new THREE.TorusGeometry(rad0 * 1.02, 0.035, 5, 10).rotateX(Math.PI / 2);
    ring.translate(a.x, a.y + 0.02, a.z);
    trunkParts.push(cyl, ring);
  }
  for (const g of trunkParts) { g.deleteAttribute('normal'); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  const trunk = mergeGeometries(trunkParts.map((g) => g.index ? g.toNonIndexed() : g));
  trunk.computeVertexNormals();
  const top = pts[segs];
  // copa: hojas largas que salen del cogollo y cuelgan
  const fronds = [];
  const n = 11 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const L = 2.8 + r() * 1.1, W = 1.0;
    const g = new THREE.PlaneGeometry(W, L, 1, 8);
    g.translate(0, L / 2, 0);
    const p = g.attributes.position;
    const droop = 1.2 + r() * 0.8, lift = 0.5 + r() * 0.35;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = y / L;
      // la hoja sale hacia arriba y se curva hacia abajo (arco), y se pliega en V por el nervio
      const fold = Math.abs(p.getX(i)) * 0.35;
      p.setXYZ(i, p.getX(i), y * Math.cos(lift) - t * t * droop * L * 0.5 + fold * 0.3, -y * Math.sin(lift) * 0.15 + fold);
    }
    g.rotateX(-Math.PI / 2 + lift); // apunta hacia fuera
    g.rotateY((k / n) * Math.PI * 2 + r() * 0.3);
    g.translate(top.x, top.y, top.z);
    fronds.push(g);
  }
  const leaves = mergeGeometries(fronds);
  leaves.computeVertexNormals();
  // cocos
  const nuts = [];
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + r();
    const s = new THREE.SphereGeometry(0.17, 8, 6);
    s.translate(top.x + Math.cos(a) * 0.22, top.y - 0.25, top.z + Math.sin(a) * 0.22);
    nuts.push(s);
  }
  const coco = paint(mergeGeometries(nuts), 0x5a3a1c, 0.1);
  const out = { trunk, leaves, coco, height: H };
  palmCache.set(seed, out);
  return out;
}

let frondMat = null, cocoMat = null;
/** Palmeras instanciadas (tres variantes). items: [{x,y,z,ry,s}] */
export function palms(items) {
  const g = new THREE.Group();
  if (!items.length) return g;
  frondMat ??= windMat(new THREE.MeshStandardMaterial({ map: palmFrondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, color: 0xc8d890 }), { from: 4.5, amount: 0.03 });
  cocoMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const bark = barkMat('pine', 1.5, 3, 0xd8c0a0);
  for (let v = 0; v < 3; v++) {
    const sub = items.filter((_, i) => i % 3 === v);
    if (!sub.length) continue;
    const geo = palmGeometry(v + 1);
    g.add(instanced(geo.trunk, bark, sub), instanced(geo.leaves, frondMat, sub), instanced(geo.coco, cocoMat, sub));
  }
  return g;
}

// ------------------------------------------------------------------ cactus
const cactusCache = new Map();
function ribbed(radius, height, segH = 8) {
  const g = new THREE.CylinderGeometry(radius, radius * 1.05, height, 24, segH, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x);
    const rib = 1 + Math.cos(a * 12) * 0.08;
    // punta redondeada
    const top = Math.max(0, (y - height / 2 + radius) / radius);
    const round = top > 0 ? Math.sqrt(Math.max(0, 1 - top * top)) : 1;
    p.setX(i, x * rib * round); p.setZ(i, z * rib * round);
  }
  g.translate(0, height / 2, 0);
  return g;
}
function cactusGeometry(seed) {
  if (cactusCache.has(seed)) return cactusCache.get(seed);
  const r = rng(seed * 71 + 3);
  const H = 3.2 + r() * 1.2;
  const parts = [ribbed(0.38, H)];
  const arms = 1 + Math.floor(r() * 2);
  for (let k = 0; k < arms; k++) {
    const side = k === 0 ? 1 : -1;
    const y0 = H * (0.35 + r() * 0.2), out = 0.75 + r() * 0.2, up = 0.9 + r() * 0.8;
    const elbow = ribbed(0.24, out).rotateZ(-side * Math.PI / 2).translate(0, y0, 0);
    const arm = ribbed(0.24, up).translate(side * out, y0 - 0.05, 0);
    parts.push(elbow, arm);
  }
  for (const p of parts) p.deleteAttribute('uv');
  const geo = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  geo.computeVertexNormals();
  // franjas verticales más oscuras en los surcos
  const pos = geo.attributes.position, nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0x4f7a38), groove = new THREE.Color(0x2f4f22);
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const k = (Math.cos(a * 12) * 0.5 + 0.5);
    const c = groove.clone().lerp(base, k * 0.8 + 0.2 + nrm.getY(i) * 0.1);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cactusCache.set(seed, geo);
  return geo;
}
let cactusMat = null;
export function cacti(items) {
  const g = new THREE.Group();
  cactusMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
  for (let v = 0; v < 2; v++) {
    const sub = items.filter((_, i) => i % 2 === v);
    if (sub.length) g.add(instanced(cactusGeometry(v + 1), cactusMat, sub));
  }
  return g;
}

// ------------------------------------------------------------------ ruinas
/**
 * Muros en ruinas: por cada casilla, un bloque base y sillares encima con la
 * parte superior rota. Todo se fusiona en una sola malla de arenisca.
 * tiles: [{x, z, y, c, r, secret}]
 */
export function ruinWalls(tiles) {
  if (!tiles.length) return new THREE.Group();
  const parts = [];
  for (const t of tiles) {
    const h = (k) => hash2(t.c, t.r, k);
    const baseH = 2.6 + h(1) * 1.4;
    const tint = t.secret ? 0xfff0dc : 0xf2e2c8;
    const shade = new THREE.Color(tint).multiplyScalar(0.92 + h(2) * 0.12).getHex();
    parts.push(paint(new THREE.BoxGeometry(TILE, baseH, TILE).translate(t.x, t.y + baseH / 2 - 0.3, t.z), shade, 0.3));
    // sillares superiores: 2 filas, con huecos (la ruina)
    let y = t.y + baseH - 0.3;
    for (let row = 0; row < 2; row++) {
      const bh = 0.9 + h(10 + row) * 0.4;
      let x0 = -TILE / 2;
      let k = 0;
      while (x0 < TILE / 2 - 0.3) {
        const w = Math.min(TILE / 2 - x0, 1.1 + h(20 + row * 7 + k) * 1.1);
        if (h(40 + row * 9 + k) > 0.28 + row * 0.25) {
          const dz = (h(60 + k) - 0.5) * 0.3;
          const b = new THREE.BoxGeometry(w - 0.06, bh, TILE * (0.8 + h(70 + k) * 0.15));
          // lo orientamos según la dirección del muro (alterna por casilla)
          b.translate(x0 + w / 2, y + bh / 2, dz);
          if (h(5) > 0.5) b.rotateY(Math.PI / 2).translate(0, 0, 0);
          b.translate(t.x, 0, t.z);
          parts.push(paint(b, new THREE.Color(shade).multiplyScalar(0.94 + h(80 + k) * 0.1).getHex(), 0.15));
        }
        x0 += w; k++;
      }
      y += bh;
    }
  }
  const geo = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, sandstone());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'ruins';
  return mesh;
}

/** Columnas: tambores apilados con basa y capitel; algunas rotas. items: [{x,y,z,ry,broken}] */
export function columns(items, mat = null) {
  const g = new THREE.Group();
  const m = mat || sandstone();
  const build = (broken) => {
    const parts = [new THREE.BoxGeometry(1.9, 0.45, 1.9).translate(0, 0.22, 0)];
    const drums = broken ? 3 : 6;
    for (let i = 0; i < drums; i++) {
      const d = new THREE.CylinderGeometry(0.66, 0.7, 0.95, 18, 1);
      d.translate(0, 0.45 + 0.48 + i * 0.97, 0);
      if (broken && i === drums - 1) { d.rotateZ(0.08); }
      parts.push(d);
    }
    if (!broken) parts.push(new THREE.BoxGeometry(1.7, 0.4, 1.7).translate(0, 0.45 + drums * 0.97 + 0.2, 0));
    return paint(mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.toNonIndexed(); })), 0xf0dfc4, 0.25);
  };
  const full = items.filter((i) => !i.broken), broken = items.filter((i) => i.broken);
  if (full.length) g.add(instanced(build(false), m, full));
  if (broken.length) g.add(instanced(build(true), m, broken));
  return g;
}

/** Tienda de lona a rayas con postes (campamentos). */
export function tent(color = 0xb84a2e) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  const base = new THREE.Color(color);
  for (let i = 0; i < 8; i++) { c.fillStyle = `#${(i % 2 ? base.clone().multiplyScalar(0.75) : base).getHexString()}`; c.fillRect(i * 8, 0, 8, 64); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const cloth = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9, side: THREE.DoubleSide });
  const W = 3.2, D = 3.6, H = 2.4;
  const shape = new THREE.BufferGeometry();
  const v = [
    -W / 2, 0, -D / 2, 0, H, -D / 2, 0, H, D / 2, -W / 2, 0, -D / 2, 0, H, D / 2, -W / 2, 0, D / 2,
    W / 2, 0, -D / 2, W / 2, 0, D / 2, 0, H, D / 2, W / 2, 0, -D / 2, 0, H, D / 2, 0, H, -D / 2,
    -W / 2, 0, -D / 2, W / 2, 0, -D / 2, 0, H, -D / 2,
  ];
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0.5, 1];
  shape.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  shape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  shape.computeVertexNormals();
  const m = new THREE.Mesh(shape, cloth);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H + 0.4, 6), barkMat('oak', 0.3, 1));
  pole.position.set(0, (H + 0.4) / 2, D / 2 + 0.05); pole.castShadow = true;
  g.add(pole);
  return g;
}

/** Ánfora de barro (decoración, se puede romper como un arbusto en el futuro). */
export function jar() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = 0.18 + Math.sin(t * Math.PI) * 0.32 - (t > 0.85 ? (t - 0.85) * 1.2 : 0) + (t > 0.93 ? 0.08 : 0);
    pts.push(new THREE.Vector2(Math.max(0.05, r), t * 1.2));
  }
  const geo = paint(new THREE.LatheGeometry(pts, 16), 0xb0603a, 0.3);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export { fbm };

// Fábricas de geometría low-poly procedural (sin assets externos).
// Las geometrías se fusionan con colores por vértice para poder instanciarse
// (un draw call por tipo de objeto en toda la zona).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { spart, smerge, rockify, gradientMap as kitGradient, litMaterial } from '../gfx/ModelKit.js';
import { REALISTIC } from '../gfx/Style.js';
import { fbm } from '../core/utils.js';
import { triplanar, woodTextures, plasterTextures, roofTextures, rockTextures } from '../gfx/Materials.js';
import { sandstoneTextures } from '../gfx/Textures.js';
import { barkMat, endGrainMat } from '../gfx/Vegetation.js';
import { flameMesh, embers } from '../gfx/Fire.js';

// ---------- materiales compartidos ----------
let gradientMap = null;
function getGradient() {
  if (gradientMap) return gradientMap;
  gradientMap = kitGradient();
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const matCache = new Map();
/** Material toon (cel shading estilo Wind Waker) con colores por vértice. */
export function toonMat(opts = {}) {
  const key = JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  // en modo realista los objetos pequeños (mayoría de madera) usan madera triplanar teñida
  const m = REALISTIC && !opts.emissive && !opts.transparent
    ? triplanar({ set: woodTextures(), scale: 0.55, normalStrength: 0.5, vertexColors: true, ...(opts.side ? {} : {}) })
    : litMaterial({ vertexColors: true, ...opts });
  if (REALISTIC && opts.side) m.side = opts.side;
  matCache.set(key, m);
  return m;
}
export function toonColor(color, opts = {}) {
  return litMaterial({ color, ...opts });
}

// ---------- utilidades de geometría ----------
/** Prepara una geometría: no indexada, normales planas, color uniforme, transformada. */
export function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  // variación leve por cara para un look facetado más rico
  for (let i = 0; i < n; i += 3) {
    const v = 1 + (((i * 2654435761) >>> 0) % 100 / 100 - 0.5) * 0.12;
    for (let k = 0; k < 3 && i + k < n; k++) {
      arr[(i + k) * 3] = c.r * v; arr[(i + k) * 3 + 1] = c.g * v; arr[(i + k) * 3 + 2] = c.b * v;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function merge(parts) { return mergeGeometries(parts, false); }

/** Malla instanciada a partir de una lista de transformaciones. */
export function instanced(geo, mat, items, { castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  items.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0);
    q.setFromEuler(e);
    p.set(it.x, it.y || 0, it.z);
    const sc = it.s ?? 1;
    s.set(sc * (it.sx ?? 1), sc * (it.sy ?? 1), sc * (it.sz ?? 1));
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    col.setScalar(it.tint ?? 1);
    if (it.color) col.set(it.color);
    mesh.setColorAt(i, col);
  });
  mesh.count = items.length;
  mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Oculta una instancia (p.ej. arbusto cortado). */
export function hideInstance(mesh, i) {
  const m = new THREE.Matrix4().makeScale(0, 0, 0);
  mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
}

// ---------- geometrías instanciables ----------
// Formas orgánicas: copas redondeadas y deformadas, rocas facetadas con ruido,
// colores con oscurecimiento inferior (oclusión falsa) para dar volumen.
export function treeGeo(pal) {
  return smerge([
    spart(new THREE.CylinderGeometry(0.22, 0.42, 2.6, 8), pal.trunk, { y: 1.3, ao: 0.35 }),
    spart(new THREE.ConeGeometry(0.55, 0.6, 8), pal.trunk, { y: 0.25, ao: 0.4 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.75, 1), 0.12, 2), pal.leaf, { y: 3.5, sy: 0.9, ao: 0.45 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.25, 1), 0.12, 3), pal.leaf2, { x: 0.85, y: 4.15, z: 0.35, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.15, 1), 0.12, 4), pal.leaf2, { x: -0.85, y: 3.85, z: -0.4, ao: 0.35 }),
    spart(rockify(new THREE.IcosahedronGeometry(0.95, 1), 0.12, 5), pal.leaf, { x: 0.1, y: 4.75, z: -0.2, ao: 0.2 }),
  ]);
}

export function pineGeo(pal) {
  // con nieve, la parte superior de cada piso queda blanca
  const snow = pal.pineSnow ? { color: pal.pineSnow, from: 0.32 } : null;
  return smerge([
    spart(new THREE.CylinderGeometry(0.2, 0.36, 1.8, 8), pal.trunk, { y: 0.9, ao: 0.35 }),
    spart(new THREE.ConeGeometry(1.85, 2.3, 9, 3), pal.pine, { y: 2.3, ao: 0.5, top: snow }),
    spart(new THREE.ConeGeometry(1.45, 2.0, 9, 3), pal.pine2, { y: 3.5, ry: 0.3, ao: 0.4, top: snow }),
    spart(new THREE.ConeGeometry(0.95, 1.7, 9, 3), pal.pine, { y: 4.6, ry: 0.6, ao: 0.3, top: snow }),
  ]);
}

export function rockGeo(pal) {
  const parts = [
    spart(rockify(new THREE.IcosahedronGeometry(1.2, 1), 0.2, 6), pal.rock, { y: 0.45, sy: 0.72, ao: 0.4, flat: true }),
    spart(rockify(new THREE.IcosahedronGeometry(0.6, 1), 0.2, 7), pal.rock2, { x: 0.95, y: 0.25, z: 0.45, ao: 0.3, flat: true }),
  ];
  if (pal.rockMoss) parts.push(spart(rockify(new THREE.IcosahedronGeometry(1.05, 1), 0.15, 6), pal.rockMoss, { y: 0.78, sy: 0.25, ao: 0, flat: true }));
  return smerge(parts);
}

export function bushGeo(pal) {
  return smerge([
    spart(rockify(new THREE.IcosahedronGeometry(1.1, 1), 0.12, 8), pal.bush, { y: 0.75, sy: 0.8, ao: 0.45 }),
    spart(rockify(new THREE.IcosahedronGeometry(0.8, 1), 0.12, 9), pal.leaf2, { x: 0.6, y: 1.15, z: 0.2, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(0.7, 1), 0.12, 10), pal.bush, { x: -0.6, y: 1.0, z: -0.3, ao: 0.3 }),
  ]);
}

/** Bloque de muro de bosque/seto: base densa que ocupa la casilla entera. */
export function hedgeGeo(pal) {
  return smerge([
    spart(new THREE.BoxGeometry(4, 3, 4, 2, 2, 2), pal.hedge, { y: 1.5, ao: 0.5 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.6, 1), 0.12, 11), pal.hedge2, { x: -1, y: 3, z: -1, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.6, 1), 0.12, 12), pal.hedge2, { x: 1, y: 3.2, z: 1, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.4, 1), 0.12, 13), pal.hedge, { x: 1, y: 2.9, z: -1.1, ao: 0.3 }),
    spart(rockify(new THREE.IcosahedronGeometry(1.4, 1), 0.12, 14), pal.hedge, { x: -1.1, y: 3.1, z: 1, ao: 0.3 }),
  ]);
}

/** Pared de roca estratificada con cima cubierta (hierba o nieve). */
export function cliffGeo(pal) {
  const parts = [
    spart(rockify(new THREE.BoxGeometry(4.2, 2.6, 4.2, 3, 2, 3), 0.25, 15), pal.rock, { y: 1.3, ao: 0.45, flat: true }),
    spart(rockify(new THREE.BoxGeometry(3.9, 2.4, 3.9, 3, 2, 3), 0.25, 16), pal.rock2, { y: 3.6, ao: 0.25, flat: true }),
    spart(rockify(new THREE.IcosahedronGeometry(1.5, 1), 0.2, 17), pal.rock, { x: -0.9, y: 5.0, z: 0.7, ao: 0.2, flat: true }),
    spart(rockify(new THREE.IcosahedronGeometry(1.3, 1), 0.2, 18), pal.rock2, { x: 1.0, y: 5.1, z: -0.7, ao: 0.2, flat: true }),
    spart(rockify(new THREE.BoxGeometry(4.3, 0.5, 4.3, 3, 1, 3), 0.12, 19), pal.cliffTop || pal.leaf, { y: 5.95, ao: 0, flat: true }),
  ];
  if (pal.cliffIce) {
    parts.push(spart(new THREE.ConeGeometry(0.35, 1.6, 5), pal.cliffIce, { x: 1.4, y: 1.2, z: 1.4, rz: 0.3, ao: 0, flat: true }));
    parts.push(spart(new THREE.ConeGeometry(0.25, 1.1, 5), pal.cliffIce, { x: -1.5, y: 2.4, z: 1.2, rz: -0.4, ao: 0, flat: true }));
  }
  return smerge(parts);
}

/**
 * Bloque de acantilado del modo realista: columna de roca con relieve suave
 * (ruido coherente, sin facetas), cornisas horizontales y esquinas redondeadas.
 * El material triplanar le pone la textura y el musgo/nieve de la cara superior.
 */
export function cliffGeoReal(seed = 1) {
  let g = new THREE.BoxGeometry(4.6, 6.4, 4.6, 8, 12, 8);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position;
  const hw = 2.3;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // esquinas redondeadas
    const k = 1 - 0.16 * (Math.abs(x) * Math.abs(z)) / (hw * hw);
    x *= k; z *= k;
    const len = Math.hypot(x, z) || 1;
    const n = fbm(x * 0.35 + y * 0.22 + seed * 3.1, z * 0.35 - y * 0.18, seed + 5, 4) - 0.5;
    const ledge = Math.sin(y * 2.1 + n * 4) * 0.12;
    const off = n * 1.3 + ledge;
    const edge = Math.min(1, (y + 3.2) / 1.2); // la base no se mete hacia dentro
    x += (x / len) * off * edge; z += (z / len) * off * edge;
    if (y > 3.1) y += (fbm(x * 0.5 + 7, z * 0.5, seed + 9, 3) - 0.5) * 0.9;
    pos.setXYZ(i, x, y, z);
  }
  return smerge([spart(g, 0xffffff, { y: 3.0, ao: 0.45 })]);
}

/** Racimo de cristales de hielo luminosos. */
export function crystalGeo(pal) {
  const c = pal.crystal ?? 0x9fe7ff, c2 = pal.crystal2 ?? 0xd6f7ff;
  return smerge([
    spart(rockify(new THREE.IcosahedronGeometry(0.7, 0), 0.1, 20), pal.rock2, { y: 0.2, sy: 0.5, ao: 0.3, flat: true }),
    spart(new THREE.OctahedronGeometry(0.45, 0), c, { y: 1.3, sy: 2.6, ao: -0.3, flat: true }),
    spart(new THREE.OctahedronGeometry(0.3, 0), c2, { x: 0.5, y: 0.9, z: 0.2, sy: 2.2, rz: -0.4, ao: -0.3, flat: true }),
    spart(new THREE.OctahedronGeometry(0.28, 0), c, { x: -0.45, y: 0.8, z: -0.25, sy: 2.0, rz: 0.45, ao: -0.3, flat: true }),
  ]);
}

/** Pilar de hielo (obstáculo de los puzles deslizantes). */
export function icePillarGeo(pal) {
  return smerge([
    spart(rockify(new THREE.CylinderGeometry(1.5, 1.8, 3.4, 7, 2), 0.12, 21), pal.icePillar ?? 0xa8e6ff, { y: 1.7, ao: 0.35, flat: true }),
    spart(new THREE.ConeGeometry(1.2, 1.4, 7), pal.icePillar2 ?? 0xd8f6ff, { y: 4.1, ao: 0, flat: true }),
    spart(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 7), pal.pineSnow ?? 0xffffff, { y: 3.45, ao: 0, flat: true }),
  ]);
}

export function fenceGeo(pal, alongX) {
  const parts = [];
  const rot = alongX ? 0 : Math.PI / 2;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  for (const t of [-1.8, 0, 1.8]) {
    parts.push(part(new THREE.BoxGeometry(0.3, 1.4, 0.3), pal.wood, { x: t * cos, y: 0.7, z: -t * sin }));
  }
  parts.push(part(new THREE.BoxGeometry(4, 0.18, 0.12), pal.wood2, { y: 1.0, ry: rot }));
  parts.push(part(new THREE.BoxGeometry(4, 0.18, 0.12), pal.wood2, { y: 0.55, ry: rot }));
  return merge(parts);
}

export function flowerGeo() {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    petals.push(spart(new THREE.SphereGeometry(0.09, 6, 4), 0xffffff, { x: Math.cos(a) * 0.1, y: 0.48, z: Math.sin(a) * 0.1, sy: 0.5, ao: 0 }));
  }
  return smerge([
    spart(new THREE.CylinderGeometry(0.025, 0.03, 0.46, 4), 0x3f8f3a, { y: 0.23, ao: 0.3 }),
    spart(new THREE.SphereGeometry(0.07, 6, 4), 0xffe14d, { y: 0.5, ao: 0 }),
    ...petals,
  ]);
}

export function grassTuftGeo(pal) {
  return merge([
    part(new THREE.ConeGeometry(0.12, 0.8, 3), pal.grassTuft, { y: 0.4, rz: 0.2 }),
    part(new THREE.ConeGeometry(0.1, 0.65, 3), pal.grassTuft, { x: 0.15, y: 0.32, rz: -0.3 }),
    part(new THREE.ConeGeometry(0.1, 0.7, 3), pal.grassTuft, { x: -0.12, y: 0.35, z: 0.1, rx: 0.3 }),
  ]);
}

export function bridgeGeo(pal) {
  const parts = [];
  for (let i = -1.5; i <= 1.5; i += 0.75) parts.push(part(new THREE.BoxGeometry(0.65, 0.2, 4.2), i % 1.5 === 0 ? pal.wood : pal.wood2, { x: i, y: 0.05 }));
  parts.push(part(new THREE.BoxGeometry(0.15, 0.9, 4.2), pal.wood, { x: 0, y: 0.6, z: 0, rx: 0, ry: 0, sx: 1, sz: 1 }));
  return merge(parts);
}

// ---------- objetos individuales ----------
export function buildHouse(opts = {}) {
  if (REALISTIC) return buildHouseReal(opts);
  const { w = 8, d = 6, h = 3.4, wall = 0xf2e3c2, roof = 0xc0473a, trim = 0x7a4b2a, door = 'south' } = opts;
  const g = new THREE.Group();
  const parts = [
    part(new THREE.BoxGeometry(w, h, d), wall, { y: h / 2 }),
    part(new THREE.BoxGeometry(w + 0.2, 0.4, d + 0.2), trim, { y: 0.2 }),
  ];
  // vigas de esquina
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.35, h, 0.35), trim, { x: sx * w / 2, y: h / 2, z: sz * d / 2 }));
  }
  // tejado a dos aguas (prisma)
  const roofH = 2.4;
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.6, 0); shape.lineTo(d / 2 + 0.6, 0); shape.lineTo(0, roofH); shape.lineTo(-d / 2 - 0.6, 0);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.8, bevelEnabled: false });
  parts.push(part(roofGeo, roof, { x: -w / 2 - 0.4, y: h, ry: Math.PI / 2 }));
  // chimenea
  parts.push(part(new THREE.BoxGeometry(0.8, 1.8, 0.8), 0x8a8a8a, { x: w / 4, y: h + 1.6, z: -d / 6 }));
  // puerta y ventanas en la fachada
  const fz = door === 'north' ? -d / 2 - 0.05 : d / 2 + 0.05;
  parts.push(part(new THREE.BoxGeometry(1.3, 2.1, 0.15), 0x5a3420, { y: 1.05, z: fz }));
  parts.push(part(new THREE.BoxGeometry(1.0, 0.9, 0.15), 0x9fd3f0, { x: -w / 3, y: 2.0, z: fz }));
  parts.push(part(new THREE.BoxGeometry(1.0, 0.9, 0.15), 0x9fd3f0, { x: w / 3, y: 2.0, z: fz }));
  parts.push(part(new THREE.BoxGeometry(1.2, 0.15, 0.3), trim, { x: -w / 3, y: 1.5, z: fz }));
  parts.push(part(new THREE.BoxGeometry(1.2, 0.15, 0.3), trim, { x: w / 3, y: 1.5, z: fz }));
  const mesh = new THREE.Mesh(merge(parts), toonMat());
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/** Casa realista: cimientos de piedra, yeso, entramado de madera, tejas, vidrio. */
function buildHouseReal({ w = 8, d = 6, h = 3.4, wall = 0xf2e3c2, roof = 0xc0473a, trim = 0x7a4b2a, door = 'south' } = {}) {
  const g = new THREE.Group();
  const stone = triplanar({ key: 'house-stone', set: rockTextures(), scale: 0.45, normalStrength: 1, vertexColors: false, color: 0xb0aaa0 });
  const plaster = triplanar({ set: plasterTextures(), scale: 0.35, normalStrength: 0.5, vertexColors: false, color: wall });
  const wood = triplanar({ key: 'house-wood', set: woodTextures(), scale: 0.5, normalStrength: 0.7, vertexColors: false, color: 0x8a6a50 });
  const add = (geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(w + 0.4, 0.7, d + 0.4), stone, 0, 0.35);
  add(new THREE.BoxGeometry(w, h, d), plaster, 0, h / 2 + 0.3);
  // entramado de madera
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.32, h, 0.32), wood, sx * w / 2, h / 2 + 0.3, sz * d / 2);
  for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(w + 0.1, 0.26, 0.3), wood, 0, h + 0.2, sz * d / 2);
    add(new THREE.BoxGeometry(w + 0.1, 0.2, 0.26), wood, 0, h * 0.55 + 0.3, sz * d / 2);
  }
  // tejado a dos aguas con tejas (UV de caja, repetición según tamaño)
  const rise = 2.3, half = d / 2 + 0.7;
  const slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  const rt = roofTextures();
  const rep = (t) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set((w + 1) / 1.6, slope / 1.1); c.needsUpdate = true; return c; };
  const roofMat = new THREE.MeshStandardMaterial({ map: rep(rt.map), normalMap: rep(rt.normalMap), roughnessMap: rep(rt.roughnessMap), color: roof });
  for (const s of [-1, 1]) {
    const panel = add(new THREE.BoxGeometry(w + 1, 0.16, slope), roofMat, 0, h + 0.3 + rise / 2, s * half / 2, 0, s * ang);
    panel.rotation.x = s * ang;
  }
  add(new THREE.BoxGeometry(w + 1.05, 0.22, 0.32), wood, 0, h + 0.32 + rise, 0); // cumbrera
  // hastiales (triángulos de yeso)
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, rise * (d / 2) / half); tri.lineTo(-d / 2, 0);
  const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false });
  for (const sx of [-1, 1]) add(gable, plaster, sx * (w / 2) - (sx > 0 ? 0.2 : 0), h + 0.3, 0, Math.PI / 2);
  // chimenea
  add(new THREE.BoxGeometry(0.9, 2.4, 0.9), stone, w / 4, h + 1.6, -d / 6);
  // fachada: puerta, ventanas con vidrio y marco
  const fz = door === 'north' ? -d / 2 - 0.06 : d / 2 + 0.06;
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: 0.05, metalness: 0.6 });
  add(new THREE.BoxGeometry(1.4, 2.2, 0.16), wood, 0, 1.4, fz);
  for (const wx of [-w / 3, w / 3]) {
    add(new THREE.BoxGeometry(1.25, 1.1, 0.14), wood, wx, 2.2, fz);
    add(new THREE.BoxGeometry(1.0, 0.85, 0.16), glass, wx, 2.2, fz + Math.sign(fz) * 0.02);
    add(new THREE.BoxGeometry(1.4, 0.14, 0.4), wood, wx, 1.6, fz);
  }
  // ventanas laterales
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.14, 1.0, 1.1), wood, sx * (w / 2 + 0.05), 2.2, 0);
    add(new THREE.BoxGeometry(0.16, 0.78, 0.86), glass, sx * (w / 2 + 0.07), 2.2, 0);
  }
  return g;
}

/**
 * Roca suelta del modo realista: esfera deformada con ruido coherente (sin
 * facetas), base aplastada para asentarse en el suelo.
 */
export function boulderGeoReal(seed = 1, detail = 4) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = fbm(x * 1.3 + seed * 5.3 + y * 0.7, z * 1.3 - y * 0.9 + seed * 1.7, seed + 3, 4);
    const k = 0.72 + n * 0.6;
    let ny = y * k * 0.72;
    if (ny < -0.15) ny = -0.15 + (ny + 0.15) * 0.25; // base plana
    pos.setXYZ(i, x * k * (1 + (seed % 3) * 0.08), ny + 0.2, z * k);
  }
  g.computeVertexNormals();
  return g;
}

let rockPlain = null;
const rockPlainMat = () => (rockPlain ??= triplanar({ key: 'rock-plain', set: rockTextures(), scale: 0.7, normalStrength: 1, vertexColors: false, color: 0x8f8a84 }));

/** Leño con corteza y anillos en los cortes (eje X). */
export function logReal(length = 2.2, radius = 0.35, bark = 'oak') {
  const geo = new THREE.CylinderGeometry(radius * 0.92, radius, length, 14, 1);
  const m = new THREE.Mesh(geo, [barkMat(bark, 1, length / 2.2), endGrainMat(), endGrainMat()]);
  m.rotation.z = Math.PI / 2;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Hoguera realista: leños en tipi, piedras alrededor, lecho de brasas, llamas y chispas. */
export function campfireReal() {
  const g = new THREE.Group();
  // leños en tipi: cada uno sale hacia fuera y se inclina hacia el centro
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 1.2, 10), [barkMat('pine', 1, 0.55), endGrainMat(), endGrainMat()]);
    const holder = new THREE.Group();
    holder.rotation.y = -a;
    log.position.set(0.3, 0.42, 0);
    log.rotation.z = 0.62;
    log.castShadow = true; log.receiveShadow = true;
    holder.add(log);
    g.add(holder);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = new THREE.Mesh(boulderGeoReal(i + 2, 2), rockPlainMat());
    st.position.set(Math.cos(a) * 0.78, -0.05, Math.sin(a) * 0.78);
    st.scale.setScalar(0.2 + (i % 3) * 0.04);
    st.rotation.y = a * 3;
    st.castShadow = true; st.receiveShadow = true;
    g.add(st);
  }
  const bed = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 1, emissive: new THREE.Color(0xff5a10), emissiveIntensity: 0.9 }));
  bed.position.y = 0.03;
  g.add(bed);
  const flame = flameMesh(0.95, 1.05);
  flame.position.y = 0.05;
  g.add(flame);
  const flame2 = flameMesh(0.6, 0.75);
  flame2.position.set(0.12, 0.05, 0.08);
  g.add(flame2);
  const sparks = embers(16, 0.3, 2.6);
  sparks.position.y = 0.3;
  g.add(sparks);
  g.userData.realFlame = flame;
  return g;
}

export function buildTorch(pal, { tall = 2.2 } = {}) {
  if (REALISTIC) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, tall, 10), barkMat('pine', 0.5, tall / 2.2));
    pole.position.y = tall / 2;
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.45, metalness: 0.85 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.3, 12, 1, true), metal);
    cup.position.y = tall + 0.02;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16).rotateX(Math.PI / 2), metal);
    ring.position.y = tall + 0.16;
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0x21160e, roughness: 1, emissive: new THREE.Color(0xff4a10), emissiveIntensity: 0.35 }));
    cloth.position.y = tall + 0.1;
    for (const m of [pole, cup, ring, cloth]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    const flame = flameMesh(0.62, 0.62);
    flame.position.y = tall + 0.15;
    g.add(flame);
    g.userData.flame = flame;
    g.userData.flameY = tall + 0.4;
    return g;
  }
  const g = new THREE.Group();
  const pole = new THREE.Mesh(merge([
    part(new THREE.CylinderGeometry(0.12, 0.16, tall, 6), pal.wood || 0x6b4426, { y: tall / 2 }),
    part(new THREE.CylinderGeometry(0.28, 0.18, 0.35, 6), 0x444444, { y: tall }),
  ]), toonMat());
  pole.castShadow = true;
  g.add(pole);
  const flame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.7, 0.12), toneMapped: false }),
  );
  flame.position.y = tall + 0.4;
  flame.scale.set(1, 1.6, 1);
  g.add(flame);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.9), toneMapped: false }));
  inner.position.y = tall + 0.35;
  g.add(inner);
  g.userData.flame = flame;
  g.userData.flameY = tall + 0.4;
  return g;
}

export function buildChest({ big = false } = {}) {
  const s = big ? 1.4 : 1;
  const g = new THREE.Group();
  const base = new THREE.Mesh(merge([
    part(new THREE.BoxGeometry(1.4 * s, 0.8 * s, 1.0 * s), 0x8b5a2b, { y: 0.4 * s }),
    part(new THREE.BoxGeometry(1.45 * s, 0.12 * s, 1.05 * s), 0xd4a537, { y: 0.75 * s }),
    part(new THREE.BoxGeometry(0.12 * s, 0.8 * s, 1.05 * s), 0xd4a537, { x: -0.55 * s, y: 0.4 * s }),
    part(new THREE.BoxGeometry(0.12 * s, 0.8 * s, 1.05 * s), 0xd4a537, { x: 0.55 * s, y: 0.4 * s }),
  ]), toonMat());
  base.castShadow = true;
  g.add(base);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.8 * s, -0.5 * s);
  const lid = new THREE.Mesh(merge([
    part(new THREE.CylinderGeometry(0.5 * s, 0.5 * s, 1.4 * s, 8, 1, false, 0, Math.PI), 0x8b5a2b, { y: 0, z: 0.5 * s, rz: Math.PI / 2, ry: 0 }),
    part(new THREE.BoxGeometry(0.25 * s, 0.3 * s, 0.12 * s), 0xffd34d, { y: 0.05 * s, z: 1.02 * s }),
  ]), toonMat());
  lid.castShadow = true;
  lidPivot.add(lid);
  g.add(lidPivot);
  g.userData.lid = lidPivot;
  return g;
}

/** Puerta/verja con cerradura. color indica la llave necesaria. */
export function buildGate({ width = 4, color = 0xc9a227, style = 'wood' } = {}) {
  if (style === 'stone') return stoneGate(width, color);
  const g = new THREE.Group();
  const icy = style === 'ice' || style === 'icewall';
  const frameCol = icy ? 0x7f93ad : 0x6d6d6d, frameCol2 = icy ? 0x6f839d : 0x5d5d5d;
  const frame = new THREE.Mesh(merge([
    part(new THREE.BoxGeometry(0.6, 4.4, 0.8), frameCol, { x: -width / 2, y: 2.2 }),
    part(new THREE.BoxGeometry(0.6, 4.4, 0.8), frameCol, { x: width / 2, y: 2.2 }),
    part(new THREE.BoxGeometry(width + 0.6, 0.6, 0.8), frameCol2, { y: 4.4 }),
  ]), toonMat());
  frame.castShadow = true;
  g.add(frame);
  let door;
  if (style === 'icewall') {
    // muro macizo de hielo: se derrite con la Llave de Fuego
    door = new THREE.Mesh(smerge([
      spart(rockify(new THREE.BoxGeometry(width - 0.5, 4.1, 1.1, 4, 4, 2), 0.18, 31), 0xbfefff, { y: 2.05, ao: 0.25, flat: true }),
      spart(new THREE.OctahedronGeometry(0.45, 0), color, { y: 2.1, z: 0.5, sy: 1.4, ao: 0, flat: true }),
    ]), litMaterial({ vertexColors: true, transparent: true, opacity: 0.88, roughness: 0.15 }));
  } else {
    const doorParts = [];
    const n = 5;
    const bar = style === 'wood' ? 0x7a4b2a : style === 'ice' ? 0xa8dcf5 : 0x555a66;
    for (let i = 0; i < n; i++) {
      const x = -width / 2 + 0.3 + (i + 0.5) * ((width - 0.6) / n);
      doorParts.push(part(new THREE.BoxGeometry((width - 0.6) / n - 0.08, 3.8, 0.25), bar, { x, y: 1.95 }));
    }
    doorParts.push(part(new THREE.BoxGeometry(width - 0.5, 0.3, 0.35), icy ? 0x6f839d : 0x3b3b3b, { y: 1.1 }));
    doorParts.push(part(new THREE.BoxGeometry(width - 0.5, 0.3, 0.35), icy ? 0x6f839d : 0x3b3b3b, { y: 3.0 }));
    doorParts.push(part(new THREE.BoxGeometry(0.7, 0.8, 0.45), color, { y: 2.05 })); // cerradura
    door = new THREE.Mesh(merge(doorParts), toonMat());
  }
  door.castShadow = true;
  g.add(door);
  g.userData.door = door;
  return g;
}

/** Puerta de templo: losa de arenisca entre dos pilares, con un sol de oro (la cerradura). */
function stoneGate(width, color) {
  const g = new THREE.Group();
  const stone = triplanar({ key: 'sandstone-gate', set: sandstoneTextures(), scale: 0.3, normalStrength: 1, vertexColors: true, color: 0xffffff });
  const frame = new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(1.0, 5.6, 1.2), 0xf0dcc0, { x: -width / 2 - 0.2, y: 2.8, ao: 0.3 }),
    spart(new THREE.BoxGeometry(1.0, 5.6, 1.2), 0xf0dcc0, { x: width / 2 + 0.2, y: 2.8, ao: 0.3 }),
    spart(new THREE.BoxGeometry(width + 2.0, 1.0, 1.4), 0xe8d2b0, { y: 5.9, ao: 0.1 }),
  ]), stone);
  frame.castShadow = true; frame.receiveShadow = true;
  g.add(frame);
  const slab = smerge([spart(new THREE.BoxGeometry(width - 0.1, 4.6, 0.7), 0xe6d0ac, { y: 2.3, ao: 0.2 })]);
  const door = new THREE.Mesh(slab, stone);
  // sol de oro en relieve: disco y rayos
  const gold = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.3, emissive: new THREE.Color(color), emissiveIntensity: 0.15 });
  const sun = new THREE.Group();
  sun.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20).rotateX(Math.PI / 2), gold));
  for (let i = 0; i < 12; i++) {
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 4), gold);
    const a = (i / 12) * Math.PI * 2;
    ray.position.set(Math.cos(a) * 0.65, Math.sin(a) * 0.65, 0);
    ray.rotation.z = a - Math.PI / 2;
    sun.add(ray);
  }
  sun.position.set(0, 2.6, 0.38);
  door.add(sun);
  door.castShadow = true; door.receiveShadow = true;
  g.add(door);
  g.userData.door = door;
  return g;
}

/** Bloque de hielo empujable. */
export function buildIceBlock() {
  const m = new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(3.5, 3.0, 3.5, 2, 2, 2), 0xa8e3ff, { y: 1.5, ao: 0.3, flat: true }),
    spart(new THREE.BoxGeometry(3.6, 0.35, 3.6), 0xf2fbff, { y: 3.05, ao: 0, flat: true }),
    spart(new THREE.BoxGeometry(0.15, 2.2, 0.1), 0xe8f9ff, { x: -0.9, y: 1.6, z: 1.76, rz: 0.3, ao: 0, flat: true }),
    spart(new THREE.BoxGeometry(0.12, 1.4, 0.1), 0xe8f9ff, { x: 0.8, y: 1.2, z: 1.76, rz: -0.5, ao: 0, flat: true }),
  ]), litMaterial({ vertexColors: true, emissive: new THREE.Color(0x10303f), roughness: 0.2 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Placa de presión rúnica. */
export function buildPlate() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(smerge([
    spart(new THREE.CylinderGeometry(1.8, 1.9, 0.2, 16), 0x6f7f95, { y: 0.1, ao: 0 }),
  ]), toonMat());
  base.receiveShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 16), litMaterial({ color: 0x9fb4cc, emissive: new THREE.Color(0) }));
  top.position.y = 0.28;
  g.add(top);
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.2, 1.8), toneMapped: false }));
  rune.rotation.x = Math.PI / 2; rune.position.y = 0.39;
  g.add(rune);
  g.userData.top = top; g.userData.rune = rune;
  return g;
}

/** Piedra rúnica que reinicia los bloques de un puzle. */
export function buildRuneStone() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(smerge([
    spart(rockify(new THREE.BoxGeometry(1.2, 2.4, 0.8, 2, 3, 1), 0.12, 41), 0x7f8ea6, { y: 1.2, ao: 0.35, flat: true }),
  ]), toonMat()));
  const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.6, 2.2), toneMapped: false }));
  glyph.position.set(0, 1.5, 0.45);
  g.add(glyph);
  g.children[0].castShadow = true;
  return g;
}

export function buildSign() {
  const m = new THREE.Mesh(merge([
    part(new THREE.BoxGeometry(0.2, 1.4, 0.2), 0x6b4426, { y: 0.7 }),
    part(new THREE.BoxGeometry(1.4, 0.8, 0.15), 0xb8864b, { y: 1.4 }),
  ]), toonMat());
  m.castShadow = true;
  return m;
}

export function buildWell() {
  const parts = [part(new THREE.CylinderGeometry(1.3, 1.4, 1.1, 10, 1, true), 0x9a9a9a, { y: 0.55 })];
  parts.push(part(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 10), 0x3d6fa8, { y: 0.6 }));
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.2, 2.4, 0.2), 0x6b4426, { x: sx * 1.2, y: 1.2 }));
  parts.push(part(new THREE.ConeGeometry(1.9, 1.0, 4), 0xc0473a, { y: 2.8, ry: Math.PI / 4 }));
  const m = new THREE.Mesh(merge(parts), toonMat({ side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

export function buildDummy() {
  const m = new THREE.Mesh(merge([
    part(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), 0x6b4426, { y: 1.1 }),
    part(new THREE.BoxGeometry(1.6, 0.18, 0.18), 0x6b4426, { y: 1.5 }),
    part(new THREE.CylinderGeometry(0.45, 0.4, 0.9, 7), 0xd9c27a, { y: 1.4 }),
    part(new THREE.IcosahedronGeometry(0.35, 0), 0xd9c27a, { y: 2.2 }),
  ]), toonMat());
  m.castShadow = true;
  return m;
}

export function buildStall({ roof = 0x3a8fc0 } = {}) {
  const parts = [part(new THREE.BoxGeometry(3.2, 1.0, 1.2), 0x8b5a2b, { y: 0.5 })];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.15, 2.6, 0.15), 0x6b4426, { x: sx * 1.5, y: 1.3, z: sz * 0.55 }));
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.BoxGeometry(0.85, 0.12, 1.8), i % 2 ? roof : 0xffffff, { x: -1.3 + i * 0.85, y: 2.7, rx: 0.15 }));
  // botellas de poción
  [0xe0405a, 0x40a0e0, 0x50d070].forEach((c, i) => parts.push(part(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 6), c, { x: -0.8 + i * 0.8, y: 1.18 })));
  const m = new THREE.Mesh(merge(parts), toonMat());
  m.castShadow = true;
  return m;
}

/** Arco de transición entre zonas. */
export function buildPortal(pal, { color = 0x8fe3ff } = {}) {
  const g = new THREE.Group();
  const stone = new THREE.Mesh(merge([
    part(new THREE.BoxGeometry(0.8, 4.5, 0.8), pal.rock || 0x888888, { x: -2.2, y: 2.25 }),
    part(new THREE.BoxGeometry(0.8, 4.5, 0.8), pal.rock || 0x888888, { x: 2.2, y: 2.25 }),
    part(new THREE.BoxGeometry(5.4, 0.8, 1.0), pal.rock2 || 0x777777, { y: 4.7 }),
  ]), toonMat());
  stone.castShadow = true;
  g.add(stone);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  glow.position.y = 2.1;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

export function buildStatue(color = 0xb0b0b0) {
  const m = new THREE.Mesh(merge([
    part(new THREE.BoxGeometry(2, 0.8, 2), 0x8a8a8a, { y: 0.4 }),
    part(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 7), color, { y: 1.9 }),
    part(new THREE.IcosahedronGeometry(0.55, 0), color, { y: 3.3 }),
    part(new THREE.ConeGeometry(0.25, 1.6, 4), 0xd8c070, { x: 0.6, y: 2.8, rz: -0.3 }),
  ]), toonMat());
  m.castShadow = true;
  return m;
}

/** Pequeña montaña para el horizonte. */
export function mountainGeo(color, snow) {
  return merge([
    part(new THREE.ConeGeometry(1, 1, 6), color, { y: 0.5 }),
    part(new THREE.ConeGeometry(0.35, 0.36, 6), snow, { y: 0.83 }),
  ]);
}

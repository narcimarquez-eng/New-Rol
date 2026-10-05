// Fábricas de geometría low-poly procedural (sin assets externos).
// Las geometrías se fusionan con colores por vértice para poder instanciarse
// (un draw call por tipo de objeto en toda la zona).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- materiales compartidos ----------
let gradientMap = null;
function getGradient() {
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
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient(), ...opts });
  matCache.set(key, m);
  return m;
}
export function toonColor(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradient(), ...opts });
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
export function treeGeo(pal) {
  return merge([
    part(new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6), pal.trunk, { y: 1.2 }),
    part(new THREE.IcosahedronGeometry(1.7, 0), pal.leaf, { y: 3.4 }),
    part(new THREE.IcosahedronGeometry(1.2, 0), pal.leaf2, { x: 0.8, y: 4.1, z: 0.3 }),
    part(new THREE.IcosahedronGeometry(1.1, 0), pal.leaf2, { x: -0.8, y: 3.8, z: -0.4 }),
  ]);
}

export function pineGeo(pal) {
  return merge([
    part(new THREE.CylinderGeometry(0.22, 0.35, 1.6, 6), pal.trunk, { y: 0.8 }),
    part(new THREE.ConeGeometry(1.8, 2.4, 7), pal.pine, { y: 2.4 }),
    part(new THREE.ConeGeometry(1.4, 2.1, 7), pal.pine2, { y: 3.6 }),
    part(new THREE.ConeGeometry(0.9, 1.8, 7), pal.pine, { y: 4.7 }),
  ]);
}

export function rockGeo(pal) {
  return merge([
    part(new THREE.DodecahedronGeometry(1.2, 0), pal.rock, { y: 0.5, sy: 0.75 }),
    part(new THREE.DodecahedronGeometry(0.6, 0), pal.rock2, { x: 0.9, y: 0.3, z: 0.4 }),
  ]);
}

export function bushGeo(pal) {
  return merge([
    part(new THREE.IcosahedronGeometry(1.1, 0), pal.bush, { y: 0.8, sy: 0.8 }),
    part(new THREE.IcosahedronGeometry(0.8, 0), pal.leaf2, { x: 0.6, y: 1.2, z: 0.2 }),
    part(new THREE.IcosahedronGeometry(0.7, 0), pal.bush, { x: -0.6, y: 1.0, z: -0.3 }),
  ]);
}

/** Bloque de muro de bosque/seto: base densa que ocupa la casilla entera. */
export function hedgeGeo(pal) {
  return merge([
    part(new THREE.BoxGeometry(4, 3, 4), pal.hedge, { y: 1.5 }),
    part(new THREE.IcosahedronGeometry(1.6, 0), pal.hedge2, { x: -1, y: 3, z: -1 }),
    part(new THREE.IcosahedronGeometry(1.6, 0), pal.hedge2, { x: 1, y: 3.2, z: 1 }),
    part(new THREE.IcosahedronGeometry(1.4, 0), pal.hedge, { x: 1, y: 2.9, z: -1.1 }),
    part(new THREE.IcosahedronGeometry(1.4, 0), pal.hedge, { x: -1.1, y: 3.1, z: 1 }),
  ]);
}

export function cliffGeo(pal) {
  return merge([
    part(new THREE.BoxGeometry(4, 5, 4), pal.rock, { y: 2.5 }),
    part(new THREE.DodecahedronGeometry(1.6, 0), pal.rock2, { x: -1, y: 5, z: 0.8 }),
    part(new THREE.DodecahedronGeometry(1.4, 0), pal.rock, { x: 1.1, y: 5.3, z: -0.7 }),
    part(new THREE.BoxGeometry(4.2, 0.4, 4.2), pal.cliffTop || pal.leaf, { y: 6 }),
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
  return merge([
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 3), 0x3f8f3a, { y: 0.2 }),
    part(new THREE.OctahedronGeometry(0.14, 0), 0xffffff, { y: 0.45 }),
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
export function buildHouse({ w = 8, d = 6, h = 3.4, wall = 0xf2e3c2, roof = 0xc0473a, trim = 0x7a4b2a, door = 'south' } = {}) {
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

export function buildTorch(pal, { tall = 2.2 } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(merge([
    part(new THREE.CylinderGeometry(0.12, 0.16, tall, 6), pal.wood || 0x6b4426, { y: tall / 2 }),
    part(new THREE.CylinderGeometry(0.28, 0.18, 0.35, 6), 0x444444, { y: tall }),
  ]), toonMat());
  pole.castShadow = true;
  g.add(pole);
  const flame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.35), toneMapped: false }),
  );
  flame.position.y = tall + 0.4;
  flame.scale.set(1, 1.6, 1);
  g.add(flame);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 1.8), toneMapped: false }));
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
  const g = new THREE.Group();
  const frame = new THREE.Mesh(merge([
    part(new THREE.BoxGeometry(0.6, 4.4, 0.8), 0x6d6d6d, { x: -width / 2, y: 2.2 }),
    part(new THREE.BoxGeometry(0.6, 4.4, 0.8), 0x6d6d6d, { x: width / 2, y: 2.2 }),
    part(new THREE.BoxGeometry(width + 0.6, 0.6, 0.8), 0x5d5d5d, { y: 4.4 }),
  ]), toonMat());
  frame.castShadow = true;
  g.add(frame);
  const doorParts = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + 0.3 + (i + 0.5) * ((width - 0.6) / n);
    doorParts.push(part(new THREE.BoxGeometry((width - 0.6) / n - 0.08, 3.8, 0.25), style === 'wood' ? 0x7a4b2a : 0x555a66, { x, y: 1.95 }));
  }
  doorParts.push(part(new THREE.BoxGeometry(width - 0.5, 0.3, 0.35), 0x3b3b3b, { y: 1.1 }));
  doorParts.push(part(new THREE.BoxGeometry(width - 0.5, 0.3, 0.35), 0x3b3b3b, { y: 3.0 }));
  doorParts.push(part(new THREE.BoxGeometry(0.7, 0.8, 0.45), color, { y: 2.05 })); // cerradura
  const door = new THREE.Mesh(merge(doorParts), toonMat());
  door.castShadow = true;
  g.add(door);
  g.userData.door = door;
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

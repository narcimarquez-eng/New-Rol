// Arquitectura y mobiliario del castillo (y de los santuarios de piedra):
// muros de sillería con zócalo, cornisa, almenas y saeteras; torres redondas con
// tejado de pizarra; alfombras, estandartes, estatuas de caballeros (el modelo
// KayKit convertido en piedra), trono y estanterías. Sirven en los dos estilos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REALISTIC } from '../gfx/Style.js';
import { triplanar } from '../gfx/Materials.js';
import { ashlarTextures, carpetTexture, bannerTexture } from '../gfx/Textures.js';
import { litMaterial, spart, smerge } from '../gfx/ModelKit.js';
import { hash2 } from '../core/utils.js';
import { TILE } from './tiles.js';
import { instantiate, charactersReady, clip } from '../gfx/Characters.js';

const stoneCache = new Map();
/** Piedra de sillería; `tint` tiñe toda la piedra (musgo, hielo, arenisca...). */
export function castleStone(tint = 0xffffff) {
  if (stoneCache.has(tint)) return stoneCache.get(tint);
  const m = REALISTIC
    ? triplanar({ key: `castle-stone-${tint}`, set: ashlarTextures(), scale: 0.22, normalStrength: 1.1, vertexColors: true, color: tint })
    : litMaterial({ vertexColors: true, color: tint });
  stoneCache.set(tint, m);
  return m;
}

function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Muros de castillo. tiles: [{x, y, z, c, r, secret}] · isWall(c, r): ¿hay muro en esa casilla?
 * Los lados que dan a una casilla libre llevan almenas y alguna saetera.
 */
export function castleWalls(tiles, isWall, { height = 7.2, tint = 0xffffff, merlons = true } = {}) {
  if (!tiles.length) return new THREE.Group();
  const parts = [];
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const t of tiles) {
    const h = (k) => hash2(t.c, t.r, k);
    const base = (t.secret ? 1.06 : 0.92 + h(1) * 0.1);
    const col = new THREE.Color(0xffffff).multiplyScalar(base).getHex();
    const y0 = t.y - 0.5;
    parts.push(paint(new THREE.BoxGeometry(TILE, height, TILE).translate(t.x, y0 + height / 2, t.z), col));
    // zócalo y cornisa
    parts.push(paint(new THREE.BoxGeometry(TILE + 0.36, 0.9, TILE + 0.36).translate(t.x, y0 + 0.45, t.z), new THREE.Color(col).multiplyScalar(0.86).getHex()));
    parts.push(paint(new THREE.BoxGeometry(TILE + 0.3, 0.36, TILE + 0.3).translate(t.x, y0 + height - 0.1, t.z), new THREE.Color(col).multiplyScalar(0.95).getHex()));
    for (const [dc, dr] of SIDES) {
      if (isWall(t.c + dc, t.r + dr)) continue;
      // almenas a lo largo del borde libre
      if (merlons) {
        for (const k of [-1, 1]) {
          const along = k * TILE * 0.27;
          const ox = dc ? dc * (TILE / 2 - 0.35) : along, oz = dr ? dr * (TILE / 2 - 0.35) : along;
          const bw = dc ? 0.7 : 1.15, bd = dc ? 1.15 : 0.7;
          parts.push(paint(new THREE.BoxGeometry(bw, 1.05, bd).translate(t.x + ox, y0 + height + 0.6, t.z + oz), col));
        }
      }
      // saetera (hendidura oscura)
      if (h(10 + dc * 3 + dr * 7) < 0.3) {
        const ox = dc * (TILE / 2 + 0.03), oz = dr * (TILE / 2 + 0.03);
        const g = new THREE.BoxGeometry(dc ? 0.06 : 0.32, 1.5, dc ? 0.32 : 0.06).translate(t.x + ox, y0 + height * 0.62, t.z + oz);
        parts.push(paint(g, 0x141210));
      }
    }
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, castleStone(tint));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'castle-walls';
  return mesh;
}

let slateMat = null;
/** Torres redondas con almenas y tejado cónico de pizarra. items: [{x, y, z}] */
export function towers(items, { tint = 0xffffff } = {}) {
  const g = new THREE.Group();
  if (!items.length) return g;
  const parts = [], roofs = [];
  for (const it of items) {
    const H = 11;
    parts.push(paint(new THREE.CylinderGeometry(2.3, 2.6, H, 20, 1).translate(it.x, it.y - 0.5 + H / 2, it.z), 0xf0f0f0));
    parts.push(paint(new THREE.CylinderGeometry(2.75, 2.5, 0.6, 20).translate(it.x, it.y - 0.5 + H, it.z), 0xe0e0e0));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      parts.push(paint(new THREE.BoxGeometry(0.9, 1.0, 0.5).rotateY(-a).translate(it.x + Math.cos(a) * 2.45, it.y - 0.5 + H + 0.8, it.z + Math.sin(a) * 2.45), 0xe8e8e8));
    }
    roofs.push(paint(new THREE.ConeGeometry(2.6, 4.2, 20).translate(it.x, it.y - 0.5 + H + 3.1, it.z), 0x2e3440));
  }
  const body = new THREE.Mesh(mergeGeometries(parts), castleStone(tint));
  body.castShadow = true; body.receiveShadow = true;
  slateMat ??= REALISTIC ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 }) : litMaterial({ vertexColors: true });
  const roof = new THREE.Mesh(mergeGeometries(roofs), slateMat);
  roof.castShadow = true;
  g.add(body, roof);
  return g;
}

/** Alfombra de w × l unidades (el largo va en la dirección Z local). */
export function carpet(w, l) {
  const tex = carpetTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, l / w);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2),
    REALISTIC ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 })
      : litMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.y = 0.06;
  m.receiveShadow = true;
  return m;
}

/** Estandarte colgado de una barra (cara hacia +Z local). */
export function banner(kind = 'royal') {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0, 1, 6),
    REALISTIC ? new THREE.MeshStandardMaterial({ map: bannerTexture(kind), roughness: 0.9, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 })
      : litMaterial({ map: bannerTexture(kind), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
  // ligera curva de la tela
  const pos = cloth.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getY(i) + 1.5) * 1.3) * 0.08);
  cloth.geometry.computeVertexNormals();
  cloth.position.y = 3.6;
  cloth.castShadow = true;
  const rod = new THREE.Mesh(smerge([spart(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), 0xb08a4a, { y: 5.15, rz: Math.PI / 2, ao: 0 })]),
    REALISTIC ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.9 }) : litMaterial({ vertexColors: true }));
  g.add(cloth, rod);
  return g;
}

let statueMat = null;
/** Estatua de caballero: el modelo KayKit con una pose fija y material de piedra. */
export function knightStatue({ pose = 'Idle', t = 0.4, model = 'knight', show = ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield'] } = {}) {
  const g = new THREE.Group();
  // pedestal
  g.add(Object.assign(new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(2.4, 0.5, 2.4), 0xb8b2a8, { y: 0.25, ao: 0.3 }),
    spart(new THREE.BoxGeometry(2.0, 0.9, 2.0), 0xc8c2b8, { y: 0.95, ao: 0.2 }),
  ]), castleStone()), { castShadow: true, receiveShadow: true }));
  if (!charactersReady()) return g;
  const inst = instantiate({ model, show });
  const s = 2.9 / 2.19;
  inst.scene.scale.setScalar(s);
  inst.scene.position.y = 1.4;
  statueMat ??= REALISTIC
    ? triplanar({ key: 'statue-stone', set: ashlarTextures(), scale: 0.9, normalStrength: 0.4, vertexColors: false, color: 0xcfc8bc })
    : litMaterial({ color: 0xc8c2b8 });
  inst.scene.traverse((o) => { if (o.isMesh) { o.material = statueMat; o.castShadow = true; o.receiveShadow = true; } });
  const c = clip(pose);
  if (c) {
    const mixer = new THREE.AnimationMixer(inst.scene);
    const a = mixer.clipAction(c);
    a.play();
    mixer.update(t * c.duration);
  }
  g.add(inst.scene);
  return g;
}

/** Trono de piedra con respaldo alto y cojín rojo. */
export function throne() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(3.2, 0.6, 2.6), 0x8a8478, { y: 0.3, ao: 0.3 }),
    spart(new THREE.BoxGeometry(2.4, 1.0, 1.9), 0x9a9488, { y: 1.1, ao: 0.2 }),
    spart(new THREE.BoxGeometry(2.4, 3.6, 0.5), 0x9a9488, { y: 2.6, z: -0.75, ao: 0.2 }),
    spart(new THREE.BoxGeometry(0.45, 1.0, 1.9), 0x8a8478, { x: -1.3, y: 1.9, ao: 0 }),
    spart(new THREE.BoxGeometry(0.45, 1.0, 1.9), 0x8a8478, { x: 1.3, y: 1.9, ao: 0 }),
    spart(new THREE.ConeGeometry(0.35, 0.9, 4), 0x9a9488, { x: -1.0, y: 4.85, z: -0.75, ry: Math.PI / 4, ao: 0 }),
    spart(new THREE.ConeGeometry(0.35, 0.9, 4), 0x9a9488, { x: 1.0, y: 4.85, z: -0.75, ry: Math.PI / 4, ao: 0 }),
  ]), castleStone());
  m.castShadow = true; m.receiveShadow = true;
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 1.6), REALISTIC ? new THREE.MeshStandardMaterial({ color: 0x7a1420, roughness: 0.9 }) : litMaterial({ color: 0x9a2030 }));
  cushion.position.set(0, 1.72, 0.05);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9a50ff).multiplyScalar(2), toneMapped: false }));
  gem.position.set(0, 4.0, -0.48);
  g.add(m, cushion, gem);
  return g;
}

let bookTex = null;
/** Estantería de madera llena de libros (frente hacia +Z local). */
export function bookshelf() {
  if (!bookTex) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#2a1a10'; c.fillRect(0, 0, 256, 256);
    const cols = ['#7a2020', '#204a7a', '#2a6a3a', '#6a5a2a', '#4a2a6a', '#8a6a3a', '#3a3a3a'];
    for (let shelf = 0; shelf < 4; shelf++) {
      let x = 6;
      const y1 = shelf * 64 + 60;
      while (x < 250) {
        const w = 8 + Math.floor(Math.random() * 10), h = 34 + Math.floor(Math.random() * 18);
        c.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        c.fillRect(x, y1 - h, w - 1, h);
        c.fillStyle = 'rgba(230,200,120,0.5)'; c.fillRect(x + 1, y1 - h + 6, w - 3, 2);
        x += w;
      }
      c.fillStyle = '#5a3a22'; c.fillRect(0, y1, 256, 4);
    }
    bookTex = new THREE.CanvasTexture(cv);
    bookTex.colorSpace = THREE.SRGBColorSpace;
  }
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 0.9), REALISTIC ? new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }) : litMaterial({ color: 0x6a4428 }));
  frame.position.y = 1.8;
  const books = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.3), REALISTIC ? new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.85 }) : litMaterial({ map: bookTex }));
  books.position.set(0, 1.8, 0.46);
  frame.castShadow = true; frame.receiveShadow = true;
  g.add(frame, books);
  return g;
}

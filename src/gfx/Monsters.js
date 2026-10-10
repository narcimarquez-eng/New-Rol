// Monstruos animados a partir del pack "Ultimate Monsters" de Quaternius (CC0),
// recoloreados por tools/build-monsters.mjs (public/assets/monsters/). Aquí se
// terminan de modificar al cargarlos, una sola vez por modelo:
//  - materiales especiales: gelatina translúcida de los limos, espíritu luminoso,
//    ojos que brillan en la oscuridad;
//  - accesorios propios pegados a los huesos (y que por tanto siguen la animación):
//    corona del Rey Trasgo, cristales de hielo del golem y del limo de hielo,
//    motas venenosas de la seta, cuernos de escarcha del murciélago...
// Los accesorios se colocan disparando rayos contra la malla en su pose de reposo,
// así quedan pegados a la superficie sea cual sea la forma del modelo.
// Cada enemigo clona después la escena (huesos, mallas y accesorios incluidos).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const BASE = `${import.meta.env.BASE_URL}assets/monsters/`;
export const MONSTERS = ['slime', 'iceslime', 'bat', 'frostbat', 'plant', 'goblin', 'goblinking', 'spirit', 'golem'];

const lib = { models: new Map(), ready: false };

/** Carga todos los monstruos. Si falla, el juego sigue con los modelos procedurales. */
export async function preloadMonsters() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltfs = await Promise.all(MONSTERS.map((m) => loader.loadAsync(`${BASE}${m}.glb`)));
  MONSTERS.forEach((name, i) => {
    const { scene, animations } = gltfs[i];
    scene.updateMatrixWorld(true);
    for (const o of meshesOf(scene)) { o.computeBoundingBox?.(); o.computeBoundingSphere?.(); }
    const box = new THREE.Box3().setFromObject(scene);
    MODS[name]?.(scene, box);
    scene.updateMatrixWorld(true);
    lib.models.set(name, { scene, box, clips: new Map(animations.map((c) => [c.name, c])) });
  });
  lib.ready = true;
}

export const monstersReady = () => lib.ready;

/**
 * Crea una instancia: { scene, meshes, materials, clips, hands, height, footY }.
 * La escena viene sin escalar; height/footY son los de la pose de reposo.
 */
export function instantiateMonster(name) {
  const src = lib.models.get(name);
  if (!src) throw new Error(`monstruo desconocido: ${name}`);
  const scene = skClone(src.scene);
  const swap = new Map();
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    o.castShadow = !o.userData.noShadow; o.receiveShadow = true;
    o.frustumCulled = false;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) if (!swap.has(m)) swap.set(m, m.clone());
    o.material = Array.isArray(o.material) ? o.material.map((m) => swap.get(m)) : swap.get(o.material);
  });
  return {
    scene, meshes, materials: [...swap.values()], clips: src.clips,
    hands: { r: scene.getObjectByName('LowerArmR') || scene.getObjectByName('Head') || scene },
    height: src.box.max.y - src.box.min.y, footY: src.box.min.y,
  };
}

// ---------------------------------------------------------------- utilidades

function meshesOf(root) {
  const out = [];
  root.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

function materialsOf(root) {
  const out = new Map();
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) out.set(m.name, m); });
  return out;
}

/** Sustituye un material (en todas las mallas que lo usan) por otro. */
function replaceMaterial(root, name, make) {
  const old = materialsOf(root).get(name);
  if (!old) return null;
  const m = make(old);
  m.name = name;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) o.material = o.material.map((x) => (x === old ? m : x));
    else if (o.material === old) o.material = m;
  });
  return m;
}

/** Brillo propio de un material, que se conserva tras los destellos de daño. */
function glow(m, hex, intensity) {
  if (!m) return;
  m.emissive = new THREE.Color(hex);
  m.emissiveIntensity = intensity;
  m.userData.baseEmissive = hex;
  m.userData.baseEmissiveIntensity = intensity;
}

const ray = new THREE.Raycaster();
const nm = new THREE.Matrix3();

/**
 * Dispara un rayo contra el modelo y devuelve { point, normal, object } del primer
 * impacto (opcionalmente solo contra ciertos materiales).
 */
function hit(root, origin, dir, mats = null) {
  ray.set(origin, dir.clone().normalize());
  const hits = ray.intersectObjects(meshesOf(root), false);
  for (const h of hits) {
    const mat = Array.isArray(h.object.material) ? h.object.material[h.face.materialIndex] : h.object.material;
    if (mats && !mats.includes(mat.name)) continue;
    const normal = h.face.normal.clone().applyNormalMatrix(nm.getNormalMatrix(h.object.matrixWorld)).normalize();
    return { point: h.point, normal, object: h.object };
  }
  return null;
}

/** Hueso que más pesa en el vértice más cercano a un punto (para pegarle el accesorio). */
function boneAt(mesh, point) {
  if (!mesh.isSkinnedMesh) return mesh;
  const pos = mesh.geometry.attributes.position, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  const v = new THREE.Vector3();
  let best = -1, bd = Infinity;
  for (let i = 0; i < pos.count; i++) {
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    const d = v.distanceToSquared(point);
    if (d < bd) { bd = d; best = i; }
  }
  let bi = 0, bw = -1;
  for (let k = 0; k < 4; k++) if (sw.getComponent(best, k) > bw) { bw = sw.getComponent(best, k); bi = si.getComponent(best, k); }
  return mesh.skeleton.bones[bi];
}

/**
 * Pega un accesorio en la superficie: lo orienta con su eje +Y según la normal
 * (inclinado `tilt` hacia ella) y lo cuelga del hueso que mueve esa zona.
 */
function stud(root, h, obj, { tilt = 1, bone = null, sink = 0 } = {}) {
  const up = new THREE.Vector3(0, 1, 0).lerp(h.normal, tilt).normalize();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  obj.position.copy(h.point).addScaledVector(h.normal, -sink);
  root.add(obj);
  obj.updateMatrixWorld(true);
  const b = bone ? root.getObjectByName(bone) : boneAt(h.object, h.point);
  b.attach(obj);
  return obj;
}

const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

// ---------------------------------------------------------------- materiales

/** Cristal de hielo: translúcido, con brillo frío propio. */
function iceMat(hex = 0xbfefff, glowHex = 0x3fb8ff, glowI = 0.35) {
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.88, flatShading: true });
  glow(m, glowHex, glowI);
  return m;
}

/** Gelatina: brillante, algo translúcida y con un leve brillo interior de su color. */
function jelly(old, opacity = 0.84) {
  const m = new THREE.MeshPhysicalMaterial({
    color: old.color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
    sheen: 0.6, sheenColor: new THREE.Color(old.color).offsetHSL(0, 0, 0.25), transparent: true, opacity,
  });
  glow(m, new THREE.Color(old.color).multiplyScalar(0.35).getHex(), 0.5);
  return m;
}

// ---------------------------------------------------------------- piezas

function crystal(r, h, mat) {
  const g = new THREE.ConeGeometry(r, h, 5, 1);
  g.translate(0, h / 2, 0);
  // punta algo torcida para que no parezcan conos perfectos
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h * 0.9) p.setX(i, p.getX(i) + r * 0.25);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function crystalCluster(size, mat, n = 3) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const c = crystal(size * (0.22 + rand() * 0.1), size * (0.7 + rand() * 0.6) * (i ? 0.75 : 1), mat);
    c.rotation.set((rand() - 0.5) * 0.9 * (i ? 1 : 0.3), rand() * 6.3, (rand() - 0.5) * 0.9 * (i ? 1 : 0.3));
    c.position.set((rand() - 0.5) * size * 0.3, 0, (rand() - 0.5) * size * 0.3);
    g.add(c);
  }
  return g;
}

/** Corona de oro con puntas y gemas. */
function crown(r) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c033, metalness: 0.95, roughness: 0.28, name: 'Crown_Gold' });
  const gem = new THREE.MeshStandardMaterial({ color: 0xd0203a, metalness: 0.1, roughness: 0.08, name: 'Crown_Gem' });
  glow(gem, 0x801020, 0.5);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, r * 0.42, 24, 1, true), gold));
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.07, 6, 24), gold);
  band.rotation.x = Math.PI / 2; band.position.y = -r * 0.2;
  g.add(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tall = i % 2 === 0;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * (tall ? 0.75 : 0.45), 4), gold);
    sp.position.set(Math.sin(a) * r, r * (0.2 + (tall ? 0.37 : 0.22)), Math.cos(a) * r);
    g.add(sp);
    if (tall) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 8, 6), gold);
      ball.position.set(Math.sin(a) * r, r * 0.98, Math.cos(a) * r);
      g.add(ball);
    }
    const gm = new THREE.Mesh(new THREE.OctahedronGeometry(r * (tall ? 0.13 : 0.09)), gem);
    gm.position.set(Math.sin(a) * r * 1.04, -r * 0.02, Math.cos(a) * r * 1.04);
    g.add(gm);
  }
  for (const m of g.children) m.userData.noShadow = false;
  return g;
}

// ---------------------------------------------------------------- modificaciones

const MODS = {
  slime(scene) {
    replaceMaterial(scene, 'Green_Main', (o) => jelly(o));
  },

  iceslime(scene, box) {
    replaceMaterial(scene, 'Pink_Main', (o) => jelly(o, 0.8));
    replaceMaterial(scene, 'Pink_Secondary', (o) => jelly(o, 0.9));
    // corona de escarcha alrededor de la cima
    const mat = iceMat();
    const top = box.max.y, size = box.max.y - box.min.y;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = (box.max.x - box.min.x) * (i === 0 ? 0 : 0.2);
      const h = hit(scene, new THREE.Vector3(Math.sin(a) * r, top + 1, Math.cos(a) * r - size * 0.05), new THREE.Vector3(0, -1, 0));
      if (h) stud(scene, h, crystalCluster(size * (i === 0 ? 0.32 : 0.2), mat, i === 0 ? 3 : 2), { tilt: 0.6, sink: size * 0.03 });
    }
  },

  bat(scene, box) { batMods(scene, box, 0xffc030); },
  frostbat(scene, box) { batMods(scene, box, 0x7fe8ff, true); },

  plant(scene, box) {
    // seta venenosa: sombrero rojo con motas blancas y ojos verdes
    const spot = new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.75, name: 'Spot' });
    const size = box.max.y - box.min.y, w = box.max.x - box.min.x;
    let placed = 0;
    for (let i = 0; i < 40 && placed < 13; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * w * 0.45;
      const h = hit(scene, new THREE.Vector3(Math.sin(a) * r, box.max.y + 1, Math.cos(a) * r), new THREE.Vector3(0, -1, 0), ['MushroomKing_Secondary']);
      if (!h) continue;
      const s = size * (0.05 + rand() * 0.05);
      const d = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 6), spot);
      d.scale.y = 0.3;
      stud(scene, h, d, { tilt: 1, sink: s * 0.05 });
      placed++;
    }
    const eye = materialsOf(scene).get('Eye_Black');
    if (eye) { eye.color.set(0x204010); glow(eye, 0x60ff40, 0.6); }
  },

  goblin(scene) {
    const eye = materialsOf(scene).get('Eye_Black');
    if (eye) { eye.color.set(0x402000); glow(eye, 0xffa020, 0.4); }
  },

  goblinking(scene, box) {
    // corona sobre la cabeza (por encima del pelo)
    const head = scene.getObjectByName('Head');
    const hp = head.getWorldPosition(new THREE.Vector3());
    const h = hit(scene, new THREE.Vector3(hp.x, box.max.y + 1, hp.z), new THREE.Vector3(0, -1, 0));
    const size = box.max.y - box.min.y;
    if (h) {
      const c = crown(size * 0.19);
      c.position.copy(h.point).add(new THREE.Vector3(0, size * 0.015, 0));
      c.rotation.x = -0.12;
      scene.add(c); c.updateMatrixWorld(true);
      head.attach(c);
    }
    const eye = materialsOf(scene).get('Eye_Black');
    if (eye) { eye.color.set(0x400000); glow(eye, 0xff2a10, 0.8); }
  },

  spirit(scene) {
    replaceMaterial(scene, 'Ghost_Main', (o) => {
      const m = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: 0.3, transparent: true, opacity: 0.72, depthWrite: false, sheen: 1, sheenColor: new THREE.Color(0xe8fbff) });
      glow(m, 0x4fb8ff, 0.75);
      return m;
    });
    for (const o of meshesOf(scene)) { o.userData.noShadow = true; o.renderOrder = 2; }
    const eye = materialsOf(scene).get('Eye_Black');
    if (eye) { eye.color.set(0x0a2a5a); glow(eye, 0x9ff3ff, 1.6); }
  },

  golem(scene, box) {
    // yeti de hielo: crestas de cristal en la espalda, los hombros y la cabeza
    const mat = iceMat(0xbfefff, 0x2f9fff, 0.45);
    const size = box.max.y - box.min.y, d = box.max.z - box.min.z;
    const torso = scene.getObjectByName('Torso').getWorldPosition(new THREE.Vector3());
    const back = [[0, 0.1], [-0.18, 0.02], [0.18, 0.02], [-0.1, -0.1], [0.1, -0.1], [0, -0.2], [-0.26, 0.14], [0.26, 0.14]];
    for (const [x, y] of back) {
      const h = hit(scene, new THREE.Vector3(x * size, torso.y + y * size, box.min.z - d), new THREE.Vector3(0, 0, 1));
      if (h) stud(scene, h, crystalCluster(size * (0.16 + rand() * 0.06), mat, 3), { tilt: 0.75, sink: size * 0.01 });
    }
    for (const side of ['L', 'R']) {
      const sh = scene.getObjectByName(`Shoulder${side}`) || scene.getObjectByName(`Shoulder.${side}`);
      if (!sh) continue;
      const p = sh.getWorldPosition(new THREE.Vector3());
      const h = hit(scene, new THREE.Vector3(p.x * 1.25, box.max.y + 1, p.z - d * 0.08), new THREE.Vector3(0, -1, 0));
      if (h) stud(scene, h, crystalCluster(size * 0.15, mat, 3), { tilt: 0.5, sink: size * 0.01 });
    }
    // guanteletes de hielo: cristales por fuera de los antebrazos
    for (const side of ['L', 'R']) {
      const arm = scene.getObjectByName(`LowerArm${side}`);
      if (!arm) continue;
      const p = arm.getWorldPosition(new THREE.Vector3());
      const sx = Math.sign(p.x) || 1;
      for (const dy of [-0.06, -0.12]) {
        const h = hit(scene, new THREE.Vector3(p.x + sx * size, p.y + dy * size, p.z), new THREE.Vector3(-sx, 0, 0));
        if (h) stud(scene, h, crystalCluster(size * 0.11, mat, 2), { tilt: 0.8, sink: size * 0.01 });
      }
    }
    const head = scene.getObjectByName('Head').getWorldPosition(new THREE.Vector3());
    const hh = hit(scene, new THREE.Vector3(head.x, box.max.y + 1, head.z - d * 0.1), new THREE.Vector3(0, -1, 0));
    if (hh) stud(scene, hh, crystalCluster(size * 0.12, mat, 2), { tilt: 0.3, sink: size * 0.01 });
    const eye = materialsOf(scene).get('Eye_Black');
    if (eye) { eye.color.set(0x0a3060); glow(eye, 0x6fd8ff, 1.4); }
  },
};

/** Murciélagos: ojos que brillan; el de escarcha lleva además una cresta de hielo en el lomo. */
function batMods(scene, box, eyeHex, icy = false) {
  const eye = materialsOf(scene).get('Eye_Black');
  if (eye) { eye.color.set(eyeHex).multiplyScalar(0.3); glow(eye, eyeHex, 1.5); }
  if (!icy) return;
  const size = box.max.y - box.min.y;
  const mat = iceMat(0xdff6ff, 0x5fc8ff, 0.4);
  const torso = scene.getObjectByName('Torso').getWorldPosition(new THREE.Vector3());
  for (const [x, dz] of [[0, -0.12], [-0.07, -0.2], [0.07, -0.2], [0, -0.28]]) {
    const h = hit(scene, new THREE.Vector3(torso.x + x * size, box.max.y + 1, torso.z + dz * size), new THREE.Vector3(0, -1, 0));
    if (h) stud(scene, h, crystalCluster(size * 0.13, mat, 2), { tilt: 0.6, sink: size * 0.01 });
  }
}

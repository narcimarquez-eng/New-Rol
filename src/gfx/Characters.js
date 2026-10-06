// Personajes KayKit (Kay Lousberg, CC0): se cargan una vez al arrancar —
// modelos sin animaciones + un archivo de animaciones compartido— y luego se
// clonan para cada personaje. Todos usan el mismo esqueleto de 41 huesos, así
// que cualquier clip sirve para cualquier personaje.
// Los archivos los genera tools/build-characters.mjs en public/assets/chars/.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const BASE = `${import.meta.env.BASE_URL}assets/chars/`;
export const MODELS = ['rogue', 'rogue_hooded', 'knight', 'barbarian', 'mage', 'skeleton_warrior', 'skeleton_mage', 'skeleton_rogue', 'skeleton_minion'];
export const PROPS = ['sk_blade', 'sk_axe', 'sk_crossbow', 'sk_staff', 'sk_shield_small_a', 'sk_shield_large_a', 'sk_arrow'];

const lib = { scenes: new Map(), props: new Map(), clips: new Map(), ready: false };

/** Carga todos los modelos y las animaciones. Resuelve aunque falle (el juego usa entonces los modelos antiguos). */
export async function preloadCharacters() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const get = (f) => loader.loadAsync(BASE + f);
  const [anims, ...rest] = await Promise.all([get('anims.glb'), ...MODELS.map((m) => get(`${m}.glb`)), ...PROPS.map((p) => get(`${p}.glb`))]);
  for (const c of anims.animations) lib.clips.set(c.name, c);
  MODELS.forEach((m, i) => { rest[i].scene.updateMatrixWorld(true); lib.scenes.set(m, rest[i].scene); });
  PROPS.forEach((p, i) => lib.props.set(p, rest[MODELS.length + i].scene));
  lib.ready = true;
}

export const charactersReady = () => lib.ready;
export const clip = (name) => lib.clips.get(name);

/** Recolorea celdas de la paleta (atlas de 8x4 celdas) conservando su degradado. */
const recolorCache = new Map();
function recolorTexture(tex, cells) {
  const key = tex.uuid + JSON.stringify(cells);
  if (recolorCache.has(key)) return recolorCache.get(key);
  const img = tex.image;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0);
  const cw = img.width / 8, ch = img.height / 4;
  for (const [cell, hex] of Object.entries(cells)) {
    const [cx, cy] = cell.split(',').map(Number);
    const d = c.getImageData(cx * cw, cy * ch, cw, ch);
    let avg = 0;
    for (let i = 0; i < d.data.length; i += 4) avg += d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    avg /= d.data.length / 4;
    const t = new THREE.Color(hex);
    for (let i = 0; i < d.data.length; i += 4) {
      const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / Math.max(avg, 1);
      d.data[i] = Math.min(255, t.r * 255 * l); d.data[i + 1] = Math.min(255, t.g * 255 * l); d.data[i + 2] = Math.min(255, t.b * 255 * l);
    }
    c.putImageData(d, cx * cw, cy * ch);
  }
  const out = new THREE.CanvasTexture(cv);
  out.flipY = false; out.colorSpace = THREE.SRGBColorSpace;
  out.magFilter = tex.magFilter; out.minFilter = tex.minFilter;
  recolorCache.set(key, out);
  return out;
}

/** Nombres de los huesos de las manos (GLTFLoader quita los puntos: "handslot.r" -> "handslotr"). */
export const HAND = { r: 'handslotr', l: 'handslotl' };

/**
 * Crea una instancia de un personaje.
 * def: {
 *   model: 'rogue' | 'knight' | ...,
 *   show: [nodos de accesorio visibles] (los demás accesorios se ocultan),
 *   borrow: { r: ['knight', '1H_Sword'], l: [...] }  armas de otro modelo (se enlazan a este esqueleto),
 *   props: { r: 'sk_blade', l: 'sk_shield_small_a' }  armas sueltas en la mano,
 *   recolor: { 'x,y': color } celdas de la paleta,
 *   tint: color que multiplica todos los materiales (versiones oscuras),
 * }
 * Devuelve { scene, meshes, materials, hands } (la escena ya clonada, sin escalar).
 */
export function instantiate(def) {
  const src = lib.scenes.get(def.model);
  if (!src) throw new Error(`modelo KayKit desconocido: ${def.model}`);
  const scene = skClone(src);
  const show = new Set(def.show || []);
  // accesorios: todo lo que no es parte del cuerpo
  const BODY = /(ArmLeft|ArmRight|Body|Head|Head_Hooded|Skull|LegLeft|LegRight|Eyes|Jaw)$/;
  scene.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && !BODY.test(o.name) && !show.has(o.name)) o.visible = false; });
  // armas de otro modelo: son mallas con piel, se vuelven a enlazar a los huesos de éste (mismos nombres)
  for (const [, [model, node]] of Object.entries(def.borrow || {})) {
    const from = lib.scenes.get(model).getObjectByName(node);
    if (!from) continue;
    const item = from.clone();
    item.visible = true;
    item.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const bones = o.skeleton.bones.map((b) => scene.getObjectByName(b.name));
      o.bind(new THREE.Skeleton(bones, o.skeleton.boneInverses), o.bindMatrix);
    });
    (scene.getObjectByName(from.parent.name) || scene).add(item);
  }
  // armas sueltas: se compensa la escala del hueso para que conserven su tamaño
  scene.updateMatrixWorld(true);
  for (const [side, prop] of Object.entries(def.props || {})) {
    const slot = scene.getObjectByName(HAND[side]);
    const item = lib.props.get(prop).clone();
    const ws = new THREE.Vector3(); slot.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws);
    item.scale.setScalar(1 / ws.x);
    item.name = `prop_${side}`;
    slot.add(item);
  }
  // materiales propios (para destellos y recoloreado sin afectar a otros personajes)
  const swap = new Map();
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    o.castShadow = true; o.receiveShadow = true;
    o.frustumCulled = false; // las animaciones mueven la malla fuera de su caja de reposo
    if (!swap.has(o.material)) {
      const m = o.material.clone();
      if (def.recolor && m.map) m.map = recolorTexture(m.map, def.recolor);
      m.roughness = Math.max(m.roughness, 0.6); m.metalness = Math.min(m.metalness, 0.2);
      if (def.tint != null) m.color.multiply(new THREE.Color(def.tint)); // p. ej. caballeros oscuros
      swap.set(o.material, m);
    }
    o.material = swap.get(o.material);
  });
  return { scene, meshes, materials: [...swap.values()], hands: { r: scene.getObjectByName(HAND.r), l: scene.getObjectByName(HAND.l) } };
}

// Herramienta de desarrollo (no forma parte del juego): monta variantes de los
// personajes KayKit en la escena real para compararlas en capturas.
// Uso (servidor de desarrollo): const m = await import('/src/dev/charPreview.js'); await m.lineup(window.__game, VARIANTES)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { GLOBAL } from '../gfx/ModelKit.js';

const BASE = '/assets/kaykit-preview/';
const loader = new GLTFLoader();
const cache = new Map();
const load = (p) => { if (!cache.has(p)) cache.set(p, loader.loadAsync(BASE + p)); return cache.get(p); };

/** Recolorea celdas de la paleta (atlas 8x4 de 128 px) conservando el degradado. */
function recolorTexture(tex, cells) {
  const img = tex.image;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d');
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
  return out;
}

/**
 * v: { model, keep: [nodos de manos visibles], hide: [nodos ocultos], attach: { r, l }, recolor: { 'x,y': color } }
 */
export async function buildVariant(v) {
  const gltf = await load(`Characters/${v.model}.glb`);
  const root = skClone(gltf.scene);
  const keep = new Set(v.keep || []), hide = new Set(v.hide || []);
  for (const slot of ['handslotl', 'handslotr']) {
    root.getObjectByName(slot)?.children.forEach((o) => { o.visible = keep.has(o.name); });
  }
  root.traverse((o) => { if (hide.has(o.name)) o.visible = false; });
  // armas de otro personaje (mismo esqueleto: misma escala y orientación en la mano)
  for (const [side, [model, node]] of Object.entries(v.attachFrom || {})) {
    const src = (await load(`Characters/${model}.glb`)).scene.getObjectByName(node);
    const item = src.clone();
    item.visible = true;
    // las armas del pack van "pegadas" al esqueleto (SkinnedMesh): se vuelven a enlazar
    // a los huesos de este personaje, que tienen los mismos nombres
    item.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const bones = o.skeleton.bones.map((bn) => root.getObjectByName(bn.name));
      o.bind(new THREE.Skeleton(bones, o.skeleton.boneInverses), o.bindMatrix);
    });
    (root.getObjectByName(src.parent.name) || root.getObjectByName(side === 'r' ? 'handslotr' : 'handslotl')).add(item);
  }
  for (const [side, file] of Object.entries(v.attach || {})) {
    const item = (await load(`Assets/${file}.gltf`)).scene.clone();
    root.getObjectByName(side === 'r' ? 'handslotr' : 'handslotl').add(item);
  }
  // todas las piezas comparten un material con la paleta: se sustituye por una copia recoloreada
  const swap = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (v.recolor && o.material.map) {
      if (!swap.has(o.material)) { const m = o.material.clone(); m.map = recolorTexture(o.material.map, v.recolor); swap.set(o.material, m); }
      o.material = swap.get(o.material);
    }
  });
  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations;
  let current = null;
  const api = {
    root, mixer, clips,
    /** Encadena clips (cada uno una vez) con fundido; el último se repite. */
    sequence(names, fade = 0.15) {
      let i = 0;
      const next = () => {
        const clip = THREE.AnimationClip.findByName(clips, names[i]);
        const a = mixer.clipAction(clip);
        a.reset(); a.setLoop(i === names.length - 1 ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
        if (current) a.crossFadeFrom(current, fade, false);
        a.play(); current = a; i++;
      };
      mixer.addEventListener('finished', () => { if (i < names.length) next(); });
      next();
    },
    play(name, { loop = true } = {}) {
      const clip = THREE.AnimationClip.findByName(clips, name);
      if (!clip) { console.warn('sin clip', name); return; }
      current?.stop();
      current = mixer.clipAction(clip);
      current.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      current.clampWhenFinished = true;
      current.reset().play();
    },
  };
  return api;
}

/** Coloca las variantes en fila, congela el juego y devuelve un control para avanzar y dibujar. */
export async function lineup(g, variants, { center, facing = Math.PI, spacing = 1.9, camDist = 7.5, camHeight = 2.2, height = 1.75 } = {}) {
  g.step = () => {};
  const [cx, cz] = center;
  g.player.place(cx, cz, 0);
  g.updateLights();
  g.player.root.visible = false;
  // los NPC cercanos estorban en la foto
  for (const e of [...(g.interactables || []), ...(g.enemies || [])]) if (e.root && Math.hypot(e.root.position.x - cx, e.root.position.z - cz) < 9) e.root.visible = false;
  const built = [];
  const n = variants.length;
  const dir = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)); // hacia donde miran
  const side = new THREE.Vector3(dir.z, 0, -dir.x);
  for (let i = 0; i < n; i++) {
    const b = await buildVariant(variants[i]);
    // misma escala para todos (comparten esqueleto): se mide el pícaro sin sombrero
    if (!lineup.scale) {
      const ref = skClone((await load('Characters/Rogue.glb')).scene);
      const box = new THREE.Box3().setFromObject(ref);
      lineup.scale = height / Math.max(0.01, box.max.y - box.min.y);
    }
    b.root.scale.setScalar(lineup.scale);
    const off = (i - (n - 1) / 2) * spacing;
    const x = cx + side.x * off, z = cz + side.z * off;
    b.root.position.set(x, g.zone.height(x, z), z);
    b.root.rotation.y = facing;
    g.scene.add(b.root);
    b.play(variants[i].anim || 'Idle');
    built.push(b);
  }
  const cam = g.camera;
  cam.position.set(cx + dir.x * camDist, g.zone.height(cx, cz) + camHeight, cz + dir.z * camDist);
  cam.lookAt(cx, g.zone.height(cx, cz) + 1.0, cz);
  let t = 0;
  return {
    built,
    advance(dt) { t += dt; GLOBAL.time.value += dt; for (const b of built) b.mixer.update(dt); },
    render() { g.gfx.render(); },
    labels(names) {
      document.querySelectorAll('.pv-label').forEach((e) => e.remove());
      built.forEach((b, i) => {
        const p = b.root.position.clone(); p.y += height + 0.35;
        p.project(cam);
        const el = document.createElement('div');
        el.className = 'pv-label';
        el.innerHTML = names[i];
        el.style.cssText = `position:fixed;left:${(p.x * 0.5 + 0.5) * innerWidth}px;top:${(-p.y * 0.5 + 0.5) * innerHeight}px;transform:translate(-50%,-100%);font:700 17px system-ui;text-align:center;line-height:1.15;color:#fff;text-shadow:0 2px 6px #000,0 0 2px #000;z-index:99;white-space:nowrap`;
        document.body.appendChild(el);
      });
    },
  };
}

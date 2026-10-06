// Modelos de los acertijos mágicos: braseros, espejos, ídolo y cristal solar,
// cristales de cambio con barreras roja/azul, losas rúnicas, tablilla de runas y
// bloques de piedra empujables. Funcionan en los dos estilos gráficos: en el
// realista la piedra es triplanar (textura de roca) y el metal es PBR.
import * as THREE from 'three';
import { REALISTIC } from '../gfx/Style.js';
import { spart, smerge, rockify, litMaterial } from '../gfx/ModelKit.js';
import { triplanar, rockTextures } from '../gfx/Materials.js';
import { flameMesh, embers } from '../gfx/Fire.js';

let stoneM = null, metalM = null;
/** Piedra tallada (colores por vértice). */
export function stoneMat() {
  return (stoneM ??= REALISTIC
    ? triplanar({ key: 'puzzle-stone', set: rockTextures(), scale: 0.55, normalStrength: 0.9, vertexColors: true, color: 0xffffff })
    : litMaterial({ vertexColors: true }));
}
function metalMat() {
  return (metalM ??= REALISTIC
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.85 })
    : litMaterial({ vertexColors: true }));
}
/** Material que brilla (por encima de 1 para el bloom). */
export function glowMat(color, k = 1.6, opts = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false, ...opts });
}
/** Altura del rayo de luz (disco del ídolo, centro de los espejos y del cristal). */
export const BEAM_Y = 2.0;
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/** Llama: de sombreador en el estilo realista, octaedros brillantes en el de dibujo. */
function flame(scale = 1) {
  if (REALISTIC) {
    const g = new THREE.Group();
    const f = flameMesh(1.1 * scale, 1.25 * scale);
    const f2 = flameMesh(0.7 * scale, 0.9 * scale);
    f2.position.set(0.12 * scale, 0, 0.08 * scale);
    const sp = embers(14, 0.35 * scale, 2.4 * scale);
    sp.position.y = 0.3;
    g.add(f, f2, sp);
    g.userData.core = f;
    return g;
  }
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 * scale, 0), glowMat(0xff7a1a, 1.2));
  outer.scale.set(1, 1.7, 1); outer.position.y = 0.55 * scale;
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * scale, 0), glowMat(0xffd27a, 1.6));
  inner.position.y = 0.45 * scale;
  g.add(outer, inner);
  g.userData.core = outer;
  return g;
}

// ------------------------------------------------------------------ brasero
/** Brasero de piedra con cuenco de bronce. userData: { flame, coal, ring, flameY } */
export function buildBrazier({ eternal = false } = {}) {
  const g = new THREE.Group();
  const stone = eternal ? 0xb8a98a : 0x8f897d;
  g.add(shadowed(new THREE.Mesh(smerge([
    spart(new THREE.CylinderGeometry(0.8, 1.0, 0.35, 12), stone, { y: 0.17, ao: 0.35 }),
    spart(new THREE.CylinderGeometry(0.4, 0.52, 1.05, 12), stone, { y: 0.87, ao: 0.25 }),
    spart(new THREE.CylinderGeometry(0.62, 0.44, 0.26, 12), stone, { y: 1.5, ao: 0.1 }),
  ]), stoneMat())));
  const bowl = new THREE.Mesh(smerge([
    spart(new THREE.CylinderGeometry(1.0, 0.55, 0.55, 16, 1, true), 0x8a6a3a, { y: 1.88, ao: 0.25 }),
    spart(new THREE.TorusGeometry(1.0, 0.07, 6, 20), 0xb08a4a, { y: 2.15, rx: Math.PI / 2, ao: 0 }),
  ]), metalMat());
  bowl.material.side = THREE.DoubleSide;
  g.add(shadowed(bowl));
  const coal = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.6, 0.18, 14),
    new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 1, emissive: new THREE.Color(0xff5a10), emissiveIntensity: 0 }));
  coal.position.y = 1.86;
  g.add(coal);
  // anillo rúnico al pie: brilla cuando el brasero arde
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.05, 6, 28).rotateX(Math.PI / 2), glowMat(eternal ? 0xffc060 : 0xff8a3a, 0.2));
  ring.position.y = 0.37;
  g.add(ring);
  const f = flame(1.15);
  f.position.y = 1.95;
  g.add(f);
  g.userData = { flame: f, coal, ring, flameY: 2.6 };
  return g;
}

// ------------------------------------------------------------------ espejos y rayo de sol
/**
 * Espejo giratorio sobre pedestal. El cristal está en `pivot`; con rotation.y = ±π/4
 * queda en diagonal (los espejos '/' y '\' del mapa).
 */
export function buildMirror({ fixed = false } = {}) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(2.4, 0.4, 2.4), 0x8f897d, { y: 0.2, ao: 0.3 }),
    spart(new THREE.CylinderGeometry(0.35, 0.45, 0.5, 10), 0x9a9488, { y: 0.6, ao: 0.2 }),
  ]), stoneMat())));
  const pivot = new THREE.Group();
  pivot.position.y = 0.85;
  const frame = shadowed(new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(0.16, 2.3, 0.22), fixed ? 0x6a6050 : 0xb08a4a, { x: -1.3, y: 1.15, ao: 0.1 }),
    spart(new THREE.BoxGeometry(0.16, 2.3, 0.22), fixed ? 0x6a6050 : 0xb08a4a, { x: 1.3, y: 1.15, ao: 0.1 }),
    spart(new THREE.BoxGeometry(2.76, 0.16, 0.22), fixed ? 0x6a6050 : 0xb08a4a, { y: 2.3, ao: 0 }),
    spart(new THREE.BoxGeometry(2.76, 0.16, 0.22), fixed ? 0x6a6050 : 0xb08a4a, { y: 0.05, ao: 0 }),
    spart(new THREE.BoxGeometry(2.5, 2.1, 0.08), 0x3a2a1e, { y: 1.15, z: -0.08, ao: 0 }),
  ]), metalMat()));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.44, 2.08),
    REALISTIC ? new THREE.MeshStandardMaterial({ color: 0xe8eef4, metalness: 1, roughness: 0.04, envMapIntensity: 1.4 })
      : litMaterial({ color: 0xcfeaff, emissive: new THREE.Color(0x24506a) }));
  pane.position.set(0, 1.15, 0.03);
  // destello que aparece cuando el rayo da en el espejo
  const spark = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), glowMat(0xfff0b0, 2.2, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  spark.position.set(0, 1.15, 0.06);
  pivot.add(frame, pane, spark);
  g.add(pivot);
  g.userData = { pivot, spark };
  return g;
}

/** Ídolo solar: obelisco con un disco dorado que dispara el rayo de luz. */
export function buildSunIdol() {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(2.2, 0.5, 2.2), 0xb8a888, { y: 0.25, ao: 0.3 }),
    spart(rockify(new THREE.BoxGeometry(1.3, 3.4, 1.1, 2, 4, 2), 0.05, 17), 0xc8b694, { y: 2.2, ao: 0.3, flat: true }),
    spart(new THREE.ConeGeometry(0.9, 0.9, 4), 0xc8b694, { y: 4.35, ry: Math.PI / 4, ao: 0 }),
  ]), stoneMat())));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24).rotateX(Math.PI / 2), glowMat(0xffc040, 0.5));
  disc.position.set(0, BEAM_Y, 0.6);
  g.add(disc);
  const rays = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.95, 12, 1), glowMat(0xffd070, 0.4, { side: THREE.DoubleSide }));
  rays.position.set(0, BEAM_Y, 0.62);
  g.add(rays);
  g.userData = { disc, rays };
  return g;
}

/** Cristal solar: recibe el rayo y se ilumina. */
export function buildSunCrystal() {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(smerge([
    spart(new THREE.CylinderGeometry(1.0, 1.2, 0.4, 8), 0x8f897d, { y: 0.2, ao: 0.3 }),
    spart(new THREE.CylinderGeometry(0.55, 0.75, 0.75, 8), 0x9a9488, { y: 0.77, ao: 0.25 }),
  ]), stoneMat())));
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0),
    REALISTIC ? new THREE.MeshStandardMaterial({ color: 0xffb040, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0xff9020), emissiveIntensity: 0.15, transparent: true, opacity: 0.92 })
      : litMaterial({ color: 0xffb040, emissive: new THREE.Color(0x402000) }));
  gem.scale.set(1, 1.4, 1);
  gem.position.y = BEAM_Y;
  g.add(gem);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), glowMat(0xffc860, 1.0, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = BEAM_Y;
  g.add(halo);
  g.userData = { gem, halo };
  return g;
}

let beamMats = null;
/** Materiales del rayo de luz (núcleo blanco y halo dorado, aditivos). */
export function beamMaterials() {
  return (beamMats ??= {
    core: glowMat(0xfff4d0, 2.6, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
    halo: glowMat(0xffb040, 1.1, { transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  });
}

// ------------------------------------------------------------------ cristales de cambio y barreras
export const SWITCH_COLORS = { red: 0xff3a4a, blue: 0x3a8cff };

/** Cristal de cambio sobre pedestal (se golpea con la espada). */
export function buildSwitchCrystal() {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(smerge([
    spart(new THREE.CylinderGeometry(0.85, 1.0, 0.35, 8), 0x8f897d, { y: 0.17, ao: 0.3 }),
    spart(new THREE.CylinderGeometry(0.32, 0.48, 1.2, 8), 0x9a9488, { y: 0.95, ao: 0.25 }),
    spart(new THREE.CylinderGeometry(0.6, 0.35, 0.25, 8), 0x8f897d, { y: 1.65, ao: 0 }),
  ]), stoneMat())));
  const orbMat = REALISTIC
    ? new THREE.MeshStandardMaterial({ color: 0xff3a4a, roughness: 0.12, metalness: 0.1, emissive: new THREE.Color(0xff3a4a), emissiveIntensity: 0.9 })
    : litMaterial({ color: 0xff3a4a, emissive: new THREE.Color(0x601018) });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), orbMat);
  orb.position.y = 2.35;
  g.add(orb);
  g.userData = { orb };
  return g;
}

/** Barrera de cristal de color: levantada bloquea el paso; bajada queda a ras de suelo. */
export function buildBarrier(color) {
  const c = SWITCH_COLORS[color] ?? 0xffffff;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.9, 3.7),
    REALISTIC ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.78, emissive: new THREE.Color(c), emissiveIntensity: 0.35 })
      : litMaterial({ color: c, transparent: true, opacity: 0.85, emissive: new THREE.Color(c).multiplyScalar(0.3) }));
  body.position.y = 1.45;
  body.castShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), toneMapped: false }));
  edges.position.copy(body.position);
  const lift = new THREE.Group();
  lift.add(body, edges);
  // marco de piedra al ras del suelo (se ve con la barrera bajada)
  const frame = new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(3.9, 0.12, 0.2), 0x6f6a60, { y: 0.06, z: 1.85, ao: 0 }),
    spart(new THREE.BoxGeometry(3.9, 0.12, 0.2), 0x6f6a60, { y: 0.06, z: -1.85, ao: 0 }),
    spart(new THREE.BoxGeometry(0.2, 0.12, 3.9), 0x6f6a60, { x: 1.85, y: 0.06, ao: 0 }),
    spart(new THREE.BoxGeometry(0.2, 0.12, 3.9), 0x6f6a60, { x: -1.85, y: 0.06, ao: 0 }),
  ]), stoneMat());
  frame.receiveShadow = true;
  g.add(lift, frame);
  g.userData = { lift, body };
  return g;
}

// ------------------------------------------------------------------ runas
/** Dibuja la runa `symbol` (0..5) en un contexto 2D centrado en (cx, cy) con tamaño s. */
export function drawGlyph(c, symbol, cx, cy, s) {
  c.save();
  c.translate(cx, cy);
  c.lineWidth = s * 0.09;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  const r = s * 0.36;
  switch (symbol % 6) {
    case 0: // sol
      c.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      break;
    case 1: // luna
      c.arc(0, 0, r * 0.85, Math.PI * 0.3, Math.PI * 1.7);
      c.arc(r * 0.35, 0, r * 0.62, Math.PI * 1.55, Math.PI * 0.45, true);
      break;
    case 2: // árbol / flecha
      c.moveTo(0, r); c.lineTo(0, -r);
      c.moveTo(-r * 0.6, -r * 0.3); c.lineTo(0, -r); c.lineTo(r * 0.6, -r * 0.3);
      c.moveTo(-r * 0.5, r * 0.2); c.lineTo(0, -r * 0.3); c.lineTo(r * 0.5, r * 0.2);
      break;
    case 3: // agua
      for (let k = -1; k <= 1; k++) {
        c.moveTo(-r, k * r * 0.55);
        c.bezierCurveTo(-r * 0.5, k * r * 0.55 - r * 0.35, -r * 0.1, k * r * 0.55 + r * 0.35, r * 0.3, k * r * 0.55);
        c.quadraticCurveTo(r * 0.65, k * r * 0.55 - r * 0.25, r, k * r * 0.55);
      }
      break;
    case 4: // ojo (almendra y pupila rellena)
      c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 1.35, r, 0); c.quadraticCurveTo(0, r * 1.35, -r, 0);
      c.closePath(); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      c.fillStyle = c.strokeStyle; c.fill();
      break;
    default: // estrella
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
        if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
  }
  c.stroke();
  c.restore();
}

const glyphTex = new Map();
function glyphTexture(symbol) {
  if (glyphTex.has(symbol)) return glyphTex.get(symbol);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.strokeStyle = '#fff';
  drawGlyph(c, symbol, 64, 64, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  glyphTex.set(symbol, t);
  return t;
}

/** Losa rúnica del suelo (se pisa). userData.glyph: material del símbolo (para encenderlo). */
export function buildRuneTile(symbol) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(3.5, 0.22, 3.5), 0x7d786e, { y: 0.06, ao: 0 }),
  ]), stoneMat());
  slab.receiveShadow = true;
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glyphTexture(symbol), color: new THREE.Color(0.35, 0.6, 0.9), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  glyph.position.y = 0.19;
  g.add(slab, glyph);
  g.userData = { glyph: glyph.material };
  return g;
}

/** Tablilla de piedra con la secuencia de runas grabada en su cara. */
export function buildRuneTablet(sequence) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(smerge([
    spart(new THREE.BoxGeometry(3.6, 0.4, 1.4), 0x8a8478, { y: 0.2, ao: 0.3 }),
    spart(rockify(new THREE.BoxGeometry(3.2, 2.6, 0.7, 4, 3, 1), 0.04, 23), 0x9a9488, { y: 1.7, ao: 0.25, flat: true }),
  ]), stoneMat())));
  const n = sequence.length;
  const cv = document.createElement('canvas'); cv.width = 128 * n; cv.height = 128;
  const c = cv.getContext('2d');
  c.strokeStyle = '#fff';
  sequence.forEach((s, i) => drawGlyph(c, s, 64 + i * 128, 64, 118));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const w = Math.min(2.9, 0.62 * n);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, w / n),
    new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.5, 0.85, 1.3), transparent: true, depthWrite: false, toneMapped: false }));
  face.position.set(0, 1.8, 0.37);
  g.add(face);
  g.userData = { face: face.material };
  return g;
}

// ------------------------------------------------------------------ bloque de piedra
/** Bloque de piedra tallada empujable (como el de hielo, pero no desliza fuera del hielo). */
export function buildStoneBlock() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(smerge([
    spart(rockify(new THREE.BoxGeometry(3.5, 3.0, 3.5, 3, 3, 3), 0.05, 7), 0x9a9286, { y: 1.5, ao: 0.35, flat: true }),
    spart(new THREE.BoxGeometry(3.62, 0.25, 3.62), 0x857e72, { y: 0.12, ao: 0, flat: true }),
    spart(new THREE.BoxGeometry(3.62, 0.25, 3.62), 0x857e72, { y: 2.9, ao: 0, flat: true }),
  ]), stoneMat());
  shadowed(m);
  g.add(m);
  // runa tenue en las cuatro caras
  const mat = new THREE.MeshBasicMaterial({ map: glyphTexture(5), color: new THREE.Color(0.4, 0.75, 1.1), transparent: true, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), mat);
    const a = i * Math.PI / 2;
    p.position.set(Math.sin(a) * 1.79, 1.5, Math.cos(a) * 1.79);
    p.rotation.y = a;
    g.add(p);
  }
  return g;
}

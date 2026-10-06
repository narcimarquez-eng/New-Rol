// Texturas: carga de imágenes de public/assets y generación procedural en canvas
// (adoquines, yeso, tablones, tejas, roca) con su mapa de normales derivado
// de la altura. Todo se cachea y se reutiliza entre zonas.
import * as THREE from 'three';
import { rng } from '../core/utils.js';

const BASE = import.meta.env.BASE_URL || './';
const loader = new THREE.TextureLoader();
const cache = new Map();
const pendingClones = new WeakMap(); // textura cargando -> copias que esperan la imagen

/** Carga una imagen de public/assets (asíncrona: la textura se rellena al llegar). */
export function tex(path, { srgb = true, repeat = 1 } = {}) {
  const key = `${path}|${srgb}|${repeat}`;
  if (cache.has(key)) return cache.get(key);
  const t = loader.load(`${BASE}assets/${path}`, () => {
    for (const c of pendingClones.get(t) || []) c.needsUpdate = true;
    pendingClones.delete(t);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Copia de una textura cargada con otra repetición (comparte la imagen). */
export function texRepeat(path, rx, ry, opts = {}) {
  const base = tex(path, opts);
  const c = base.clone();
  c.repeat.set(rx, ry);
  if (!base.image) {
    // clone() marca la copia para subir a la GPU, pero aún no hay imagen: se
    // marca de nuevo cuando llegue (evita avisos mientras carga)
    c.version = 0;
    if (!pendingClones.has(base)) pendingClones.set(base, []);
    pendingClones.get(base).push(c);
  }
  return c;
}

// ------------------------------------------------------------------ procedurales
/** Ruido de valor tileable en canvas (para variación de color/altura). */
function valueNoise(size, cells, r) {
  const g = [];
  for (let i = 0; i < cells * cells; i++) g.push(r());
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * cells, fy = (y / size) * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  return out;
}

function fbmTile(size, r, octaves = [[4, 0.5], [8, 0.25], [16, 0.15], [32, 0.1]]) {
  const out = new Float32Array(size * size);
  for (const [cells, amp] of octaves) {
    const n = valueNoise(size, cells, r);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
  }
  return out;
}

/** Construye textura de color + normales + rugosidad a partir de funciones por píxel. */
function build(size, fn, { normalStrength = 2, roughBase = 0.85 } = {}) {
  const color = document.createElement('canvas');
  color.width = color.height = size;
  const cctx = color.getContext('2d');
  const img = cctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const o = fn(x, y, i);
    img.data[i * 4] = o.r; img.data[i * 4 + 1] = o.g; img.data[i * 4 + 2] = o.b; img.data[i * 4 + 3] = 255;
    height[i] = o.h; rough[i] = o.rough ?? roughBase;
  }
  cctx.putImageData(img, 0, 0);
  // normales a partir de la altura (diferencias centrales, tileable)
  const normal = document.createElement('canvas');
  normal.width = normal.height = size;
  const nctx = normal.getContext('2d');
  const nimg = nctx.createImageData(size, size);
  const rcv = document.createElement('canvas');
  rcv.width = rcv.height = size;
  const rctx = rcv.getContext('2d');
  const rimg = rctx.createImageData(size, size);
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = (H(x + 1, y) - H(x - 1, y)) * normalStrength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * normalStrength;
    const l = Math.hypot(dx, dy, 1);
    nimg.data[i * 4] = ((-dx / l) * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 1] = ((dy / l) * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 3] = 255;
    const rv = Math.max(0, Math.min(255, rough[i] * 255));
    rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = rv; rimg.data[i * 4 + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(color, true), normalMap: mk(normal, false), roughnessMap: mk(rcv, false) };
}

const procCache = new Map();
function cached(key, f) { if (!procCache.has(key)) procCache.set(key, f()); return procCache.get(key); }
const clamp255 = (v) => Math.max(0, Math.min(255, v));

/** Adoquines irregulares (diagrama de Voronoi). */
export function cobbleTextures() {
  return cached('cobble', () => {
    const size = 256, r = rng(4), pts = [];
    const n = 7;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) pts.push([(x + 0.2 + r() * 0.6) / n * size, (y + 0.2 + r() * 0.6) / n * size, 0.75 + r() * 0.3]);
    const noise = fbmTile(size, r);
    const cell = size / n;
    return build(size, (x, y, i) => {
      let d1 = 1e9, d2 = 1e9, tone = 1;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      // solo las 9 celdas vecinas (con envoltura para que sea tileable)
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox, gy = cy + oy;
        const [px, py, t] = pts[((gy + n) % n) * n + ((gx + n) % n)];
        const d = Math.hypot(x - (px + Math.floor(gx / n) * size), y - (py + Math.floor(gy / n) * size));
        if (d < d1) { d2 = d1; d1 = d; tone = t; } else if (d < d2) d2 = d;
      }
      const edge = Math.min(1, (d2 - d1) / 6);
      const nz = noise[i];
      const v = (0.45 + nz * 0.35) * tone * (0.35 + 0.65 * edge);
      return { r: clamp255(v * 205), g: clamp255(v * 195), b: clamp255(v * 180), h: edge * 0.8 + nz * 0.25, rough: 0.6 + (1 - edge) * 0.35 };
    }, { normalStrength: 3 });
  });
}

/** Yeso/encalado con manchas suaves. */
export function plasterTextures() {
  return cached('plaster', () => {
    const size = 256, r = rng(8);
    const noise = fbmTile(size, r, [[3, 0.4], [9, 0.3], [27, 0.2], [64, 0.1]]);
    return build(size, (x, y, i) => {
      const v = 0.82 + noise[i] * 0.22;
      return { r: clamp255(v * 236), g: clamp255(v * 226), b: clamp255(v * 205), h: noise[i] * 0.6, rough: 0.92 };
    }, { normalStrength: 1.5 });
  });
}

/** Tablones de madera (vetas a lo largo de V). */
export function woodTextures() {
  return cached('wood', () => {
    const size = 256, r = rng(12);
    const noise = fbmTile(size, r, [[2, 0.5], [6, 0.3], [24, 0.2]]);
    const planks = 4;
    const offs = Array.from({ length: planks }, () => r());
    return build(size, (x, y, i) => {
      const p = Math.floor((x / size) * planks);
      const u = (x / size) * planks - p;
      const yy = (y / size + offs[p]) % 1;
      const grain = Math.sin((yy * 40 + noise[i] * 6 + p * 3) ) * 0.5 + 0.5;
      const gap = u < 0.04 || u > 0.96 ? 0.35 : 1;
      const v = (0.55 + grain * 0.2 + noise[i] * 0.2) * gap * (0.85 + offs[p] * 0.3);
      return { r: clamp255(v * 150), g: clamp255(v * 100), b: clamp255(v * 62), h: gap * 0.6 + grain * 0.15, rough: 0.8 };
    }, { normalStrength: 2.5 });
  });
}

/** Tejas cerámicas (filas desplazadas). El color base se tiñe con el material. */
export function roofTextures() {
  return cached('roof', () => {
    const size = 256, r = rng(16);
    const noise = fbmTile(size, r);
    const rows = 8, cols = 6;
    return build(size, (x, y, i) => {
      const ry = (y / size) * rows, row = Math.floor(ry), fy = ry - row;
      const rx = (x / size) * cols + (row % 2) * 0.5, fx = rx - Math.floor(rx);
      const curve = Math.sin(fx * Math.PI); // teja curva
      const lip = fy > 0.85 ? 0.45 : 1;     // sombra del solape
      const h = curve * 0.6 + (1 - fy) * 0.4;
      const v = (0.6 + curve * 0.3 + noise[i] * 0.25) * lip;
      return { r: clamp255(v * 255), g: clamp255(v * 245), b: clamp255(v * 240), h: h * lip, rough: 0.7 };
    }, { normalStrength: 4 });
  });
}

/** Roca con estratos y grietas (para acantilados, rocas y piedra). */
/**
 * Voronoi repetible: para cada píxel devuelve la celda más cercana, el vector
 * hasta su punto (en píxeles) y F2-F1 (distancia al borde, en píxeles).
 */
function voronoiTile(size, cells, r, { warpX = null, warpY = null, aniso = 1 } = {}) {
  const pts = [];
  for (let i = 0; i < cells * cells; i++) pts.push([r(), r()]);
  const cs = size / cells;
  const id = new Int32Array(size * size), dxA = new Float32Array(size * size), dyA = new Float32Array(size * size), edge = new Float32Array(size * size);
  for (let y0 = 0; y0 < size; y0++) for (let x0 = 0; x0 < size; x0++) {
    const i0 = y0 * size + x0;
    // deformación del dominio: bordes curvos en vez de polígonos rectos
    const x = x0 + (warpX ? warpX[i0] : 0), y = y0 + (warpY ? warpY[i0] : 0);
    const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
    let d1 = 1e9, d2 = 1e9, best = 0, bx = 0, by = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy;
      const k = ((gy + cells) % cells) * cells + ((gx + cells) % cells);
      const px = (gx + pts[k][0]) * cs, py = (gy + pts[k][1]) * cs;
      const d = Math.hypot(x - px, (y - py) * aniso);
      if (d < d1) { d2 = d1; d1 = d; best = k; bx = x - px; by = y - py; } else if (d < d2) d2 = d;
    }
    id[i0] = best; dxA[i0] = bx; dyA[i0] = by; edge[i0] = d2 - d1;
  }
  return { id, dx: dxA, dy: dyA, edge };
}

/** Roca: lascas facetadas (cada celda con su inclinación), fracturas, estratos y grano. */
export function rockTextures() {
  return cached('rock', () => {
    const size = 512;
    const wx = fbmTile(size, rng(34), [[4, 0.6], [8, 0.4]]), wy = fbmTile(size, rng(35), [[4, 0.6], [8, 0.4]]);
    for (let i = 0; i < wx.length; i++) { wx[i] = (wx[i] - 0.5) * 70; wy[i] = (wy[i] - 0.5) * 40; }
    // celdas aplastadas en vertical: lajas horizontales como en un acantilado real
    const big = voronoiTile(size, 6, rng(30), { warpX: wx, warpY: wy, aniso: 2.2 });
    const small = voronoiTile(size, 14, rng(31), { warpX: wx, warpY: wy, aniso: 1.6 });
    const rb = rng(32), rs = rng(33);
    const planeB = Array.from({ length: 36 }, () => [(rb() - 0.5) * 0.5, (rb() - 0.5) * 0.9, rb(), rb()]);
    const planeS = Array.from({ length: 196 }, () => [(rs() - 0.5) * 0.25, (rs() - 0.5) * 0.4, rs(), rs()]);
    const macro = fbmTile(size, rng(20), [[3, 0.4], [6, 0.35], [12, 0.25]]);
    const warp = fbmTile(size, rng(22), [[4, 0.6], [8, 0.4]]);
    const grain = fbmTile(size, rng(26), [[128, 0.5], [256, 0.5]]);
    const tint = fbmTile(size, rng(23), [[2, 0.6], [5, 0.4]]);
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    return build(size, (x, y, i) => {
      const pb = planeB[big.id[i]], ps = planeS[small.id[i]];
      const facet = big.dx[i] * pb[0] + big.dy[i] * pb[1] + pb[2] * 12 + small.dx[i] * ps[0] + small.dy[i] * ps[1] + ps[2] * 2;
      // solo algunos bordes son grietas abiertas (según la celda vecina, aquí aproximado por la propia)
      const openB = pb[3] > 0.35 ? 1 : 0.25, openS = ps[3] > 0.7 ? 1 : 0;
      const crackB = (1 - sm(0, 3, big.edge[i])) * openB, crackS = (1 - sm(0, 1.6, small.edge[i])) * openS;
      const strata = Math.sin((y / size) * Math.PI * 2 * 5 + (warp[i] - 0.5) * 6);
      const h = facet - crackB * 6 - crackS * 2 + (macro[i] - 0.5) * 30 + strata * 2 + (grain[i] - 0.5) * 1.4;
      const crack = Math.max(crackB, crackS * 0.5);
      const v = Math.max(0.12, 0.56 + (pb[2] - 0.5) * 0.07 + (ps[2] - 0.5) * 0.03 + (macro[i] - 0.5) * 0.25
        + strata * 0.02 + (grain[i] - 0.5) * 0.12 - crack * 0.22);
      const w = (tint[i] - 0.5) * 0.12; // vetas cálidas/frías suaves
      return { r: clamp255(v * 228 * (1 + w)), g: clamp255(v * 226), b: clamp255(v * 224 * (1 - w)), h, rough: 0.8 + crack * 0.15 };
    }, { normalStrength: 0.5 });
  });
}

/** Hielo: escarcha nubosa, burbujas y grietas blancas finas (algunas, no todas las celdas). */
export function iceTextures() {
  return cached('ice', () => {
    const size = 512;
    const wx = fbmTile(size, rng(40), [[3, 0.6], [6, 0.4]]), wy = fbmTile(size, rng(41), [[3, 0.6], [6, 0.4]]);
    for (let i = 0; i < wx.length; i++) { wx[i] = (wx[i] - 0.5) * 90; wy[i] = (wy[i] - 0.5) * 90; }
    const big = voronoiTile(size, 4, rng(42), { warpX: wx, warpY: wy });
    const small = voronoiTile(size, 11, rng(43), { warpX: wx, warpY: wy });
    const rb = rng(44), open = Array.from({ length: 121 }, () => rb());
    const frost = fbmTile(size, rng(45), [[3, 0.4], [7, 0.3], [16, 0.2], [40, 0.1]]);
    const bubbles = fbmTile(size, rng(46), [[96, 1]]);
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    return build(size, (x, y, i) => {
      const cB = (1 - sm(0, 1.6, big.edge[i])) * (open[big.id[i] % 121] > 0.25 ? 1 : 0);
      const cS = (1 - sm(0, 1.0, small.edge[i])) * (open[small.id[i]] > 0.72 ? 0.7 : 0);
      const crack = Math.max(cB, cS);
      const f = sm(0.45, 0.8, frost[i]);
      const bub = bubbles[i] > 0.83 ? (bubbles[i] - 0.83) * 4 : 0;
      const v = 0.6 + f * 0.32 + crack * 0.38 + bub * 0.25;
      return { r: clamp255(v * 228), g: clamp255(v * 242), b: clamp255(v * 255), h: f * 1.5 - crack * 3 + bub, rough: 0.05 + f * 0.3 + crack * 0.35 };
    }, { normalStrength: 0.6 });
  });
}

/** Nieve: casi blanca con ondulaciones suaves y brillos. */
export function snowTextures() {
  return cached('snow', () => {
    const size = 256, r = rng(24);
    const noise = fbmTile(size, r, [[3, 0.5], [7, 0.3], [20, 0.2]]);
    const sparkle = fbmTile(size, rng(25), [[64, 1]]);
    return build(size, (x, y, i) => {
      const v = 0.9 + noise[i] * 0.1;
      return { r: clamp255(v * 245), g: clamp255(v * 249), b: clamp255(v * 255), h: noise[i], rough: sparkle[i] > 0.82 ? 0.25 : 0.75 };
    }, { normalStrength: 1.2 });
  });
}

/** Recolorea la textura de hojas (p. ej. a rosa para cerezos) conservando su alfa. */
export function tintedLeafTexture(path, rgb, key) {
  return cached(`leaf-${key}`, () => {
    // la textura no tiene imagen hasta que el lienzo teñido está listo (igual que
    // TextureLoader); así no se reserva en la GPU con un tamaño equivocado
    const t = new THREE.Texture();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const c = cv.getContext('2d');
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 255;
        const k = 0.55 + l * 0.9;
        d.data[i] = clamp255(rgb[0] * k); d.data[i + 1] = clamp255(rgb[1] * k); d.data[i + 2] = clamp255(rgb[2] * k);
      }
      c.putImageData(d, 0, 0);
      t.image = cv;
      t.needsUpdate = true;
    };
    img.src = `${BASE}assets/${path}`;
    return t;
  });
}

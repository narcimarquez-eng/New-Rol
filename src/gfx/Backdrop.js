// Montañas del fondo: un terreno de 1,4 km alrededor del mapa jugable, plano
// bajo la zona y que sube en colinas y cordilleras con ruido "ridged" (crestas
// afiladas como las de una montaña real). El color sale de la pendiente y la
// altura: prados y bosques abajo, roca en las laderas y nieve en las cumbres.
import * as THREE from 'three';
import { noise2, fbm } from '../core/utils.js';
import { backdropMaterial } from './Materials.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Ruido de crestas: 1 - |ruido| elevado, con pesos por octava (multifractal). */
function ridged(x, z, seed) {
  let sum = 0, amp = 0.5, f = 1, w = 1, norm = 0;
  for (let i = 0; i < 6; i++) {
    let n = 1 - Math.abs(noise2(x * f, z * f, seed + i * 31) * 2 - 1);
    n *= n;
    n *= w;
    w = Math.min(1, n * 1.8);
    sum += n * amp; norm += amp;
    amp *= 0.5; f *= 2.03;
  }
  return sum / norm;
}

/**
 * @param {number} halfW media anchura del mapa jugable (x)
 * @param {number} halfH media profundidad del mapa jugable (z)
 * @param {object} o { seed, peak (altura de cumbres), hills, snowline, colors: {meadow, forest, rock, snow}, fogScale }
 */
export function buildBackdrop(halfW, halfH, o = {}) {
  const seed = o.seed ?? 7;
  const size = 1400, seg = 220;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const peak = o.peak ?? 95, hills = o.hills ?? 14;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const dx = Math.max(0, Math.abs(x) - halfW), dz = Math.max(0, Math.abs(z) - halfH);
    const d = Math.hypot(dx, dz);
    if (d < 3) { pos.setY(i, -0.6); continue; }
    // deformación del dominio: crestas curvas en vez de rejilla
    const wx = x + (fbm(x * 0.004, z * 0.004, seed + 3, 3) - 0.5) * 160;
    const wz = z + (fbm(x * 0.004 + 9.1, z * 0.004 - 4.7, seed + 5, 3) - 0.5) * 160;
    const foot = fbm(wx * 0.012, wz * 0.012, seed + 11, 4) * hills * smooth(3, 70, d);
    const mount = Math.pow(ridged(wx * 0.0042, wz * 0.0042, seed), 1.35) * peak * smooth(40, 330, d);
    pos.setY(i, -0.6 + foot + mount);
  }
  geo.computeVertexNormals();

  const c = o.colors || {};
  const meadow = new THREE.Color(c.meadow ?? 0x5d7a36), forest = new THREE.Color(c.forest ?? 0x2c4422);
  const rock = new THREE.Color(c.rock ?? 0x7d776d), snow = new THREE.Color(c.snow ?? 0xf0f3f7);
  const snowline = o.snowline ?? 58;
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ny = nrm.getY(i);
    const n1 = fbm(x * 0.02, z * 0.02, seed + 41, 3);
    // bosque en manchas a media altura, prado en lo bajo
    const forestAmt = smooth(0.42, 0.58, n1) * smooth(4, 12, y) * (1 - smooth(snowline * 0.55, snowline * 0.8, y));
    tmp.copy(meadow).lerp(forest, Math.max(forestAmt, smooth(10, 28, y) * 0.7));
    // roca en pendientes fuertes (y en lo alto, donde no crece nada)
    const rockAmt = Math.max(smooth(0.86, 0.7, ny), smooth(snowline * 0.6, snowline * 0.9, y) * 0.85);
    tmp.lerp(rock, rockAmt);
    // nieve por encima de la cota, salvo en paredes muy verticales
    const sl = snowline + (n1 - 0.5) * 18;
    const snowAmt = smooth(sl - 6, sl + 6, y) * smooth(0.55, 0.75, ny);
    tmp.lerp(snow, snowAmt);
    const v = 0.92 + noise2(x * 0.15, z * 0.15, seed + 77) * 0.16;
    col[i * 3] = tmp.r * v; col[i * 3 + 1] = tmp.g * v; col[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, backdropMaterial({ fogScale: o.fogScale ?? 0.8 }));
  mesh.name = 'backdrop';
  mesh.receiveShadow = true;
  return mesh;
}

// Hierba: miles de briznas instanciadas en una sola llamada de dibujo.
// El sombreador las mece con el viento y las aparta al paso del jugador.
import * as THREE from 'three';
import { TILE, tileInfo } from './tiles.js';
import { GLOBAL } from '../gfx/ModelKit.js';
import { rng } from '../core/utils.js';
import { REALISTIC } from '../gfx/Style.js';

function bladeGeometry() {
  if (REALISTIC) return bladeGeometryReal();
  // brizna estrecha de 5 vértices (3 triángulos), con color base->punta
  const pos = [-0.07, 0, 0, 0.07, 0, 0, -0.05, 0.24, 0, 0.05, 0.24, 0, 0, 0.48, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // normales hacia arriba: la hierba se ilumina como el suelo (sin parpadeos)
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const base = 0.72, mid = 0.9, tip = 1.1;
  g.setAttribute('color', new THREE.Float32BufferAttribute([base, base, base, base, base, base, mid, mid, mid, mid, mid, mid, tip, tip, tip], 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  return g;
}

/** Brizna realista: más fina y alta, curvada, base oscura y punta clara. */
function bladeGeometryReal() {
  const pos = [-0.035, 0, 0, 0.035, 0, 0, -0.028, 0.3, 0.03, 0.028, 0.3, 0.03, -0.016, 0.55, 0.09, 0.016, 0.55, 0.09, 0, 0.75, 0.17];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(7).fill([0, 1, 0]).flat(), 3));
  const c = [0.45, 0.45, 0.62, 0.62, 0.82, 0.82, 1.05];
  g.setAttribute('color', new THREE.Float32BufferAttribute(c.flatMap((v, i) => [v * (i > 3 ? 1.05 : 1), v, v * (i > 3 ? 0.85 : 1)]), 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  return g;
}

/**
 * @param {import('./Zone.js').Zone} zone
 * @param {number} density briznas por casilla
 */
export function buildGrass(zone, density = 48) {
  const pal = zone.palette;
  const r = rng(77);
  const items = [];
  const g = REALISTIC && pal.groundReal ? pal.groundReal : pal.ground;
  const cGrass = new THREE.Color(REALISTIC ? (pal.grassBladeReal ?? g.grass) : (pal.grassBlade ?? g.grass));
  const cForest = new THREE.Color(REALISTIC ? (pal.grassBladeReal2 ?? g.forest) : (pal.grassBlade2 ?? g.forest));
  for (let row = 0; row < zone.H; row++) {
    for (let c = 0; c < zone.W; c++) {
      const info = tileInfo(zone.charAt(c, row));
      if (info.solid && !info.cuttable) continue;
      if (info.ground !== 'grass' && info.ground !== 'forest') continue;
      if (info.secret || zone.occupied.has(`${c},${row}`)) continue;
      const n = info.decor === 'tallgrass' ? density * 1.6 : density;
      const [cx, cz] = zone.tileToWorld(c, row);
      // menos hierba junto a caminos para un borde natural
      const nearPath = ['=', 'o', 's'].some((ch) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => zone.charAt(c + dc, row + dr) === ch));
      const count = Math.round(n * (nearPath ? 0.55 : 1));
      for (let k = 0; k < count; k++) {
        let x = cx + (r() - 0.5) * TILE, z = cz + (r() - 0.5) * TILE;
        if (nearPath) {
          // concentrar las briznas lejos del borde con camino
          x = cx + (r() - 0.5) * TILE * 0.9; z = cz + (r() - 0.5) * TILE * 0.9;
        }
        const y = zone.height(x, z);
        const s = (0.7 + r() * 0.7) * (info.decor === 'tallgrass' ? 1.5 : 1);
        const col = (info.ground === 'forest' ? cForest : cGrass).clone().offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.12);
        items.push({ x, y, z, ry: r() * Math.PI, s, col });
      }
    }
  }
  const geo = bladeGeometry();
  const mat = REALISTIC
    ? new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = GLOBAL.time;
    sh.uniforms.uPlayer = GLOBAL.playerPos;
    sh.uniforms.uWind = GLOBAL.windStrength;
    sh.vertexShader = 'uniform float uTime;\nuniform vec3 uPlayer;\nuniform float uWind;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      float h = position.y / ${REALISTIC ? '0.75' : '0.48'};
      float bend = h * h;
      vec2 wp = mvPosition.xz;
      float gust = sin(uTime * 1.7 + wp.x * 0.35 + wp.y * 0.22) * 0.6 + sin(uTime * 3.1 + wp.x * 0.9) * 0.25;
      mvPosition.x += gust * 0.22 * bend * uWind;
      mvPosition.z += gust * 0.12 * bend * uWind;
      // apartarse del jugador
      vec2 dp = wp - uPlayer.xz;
      float dist = length(dp);
      float push = smoothstep(1.4, 0.2, dist);
      mvPosition.xz += normalize(dp + 0.0001) * push * 0.5 * bend;
      mvPosition.y -= push * 0.25 * bend;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
      `,
    );
  };
  // las dos caras se iluminan igual (normal siempre hacia arriba)
  const prevCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prevCompile(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;',
    );
  };
  mat.customProgramCacheKey = () => 'grass-v2';
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(0, it.ry, 0); q.setFromEuler(e);
    p.set(it.x, it.y - 0.02, it.z); s.set(it.s, it.s, it.s);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, it.col);
  });
  mesh.count = items.length;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.name = 'grass';
  return mesh;
}

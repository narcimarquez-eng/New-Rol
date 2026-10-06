// Terreno low-poly facetado generado a partir del mapa ASCII de la zona.
// La función height() reproduce exactamente la triangulación de la malla,
// así los personajes siempre pisan la superficie visible.
import * as THREE from 'three';
import { TILE, tileInfo } from './tiles.js';
import { fbm } from '../core/utils.js';
import { REALISTIC } from '../gfx/Style.js';
import { terrainMaterial } from '../gfx/Materials.js';

// capa de textura del terreno realista por tipo de suelo: césped, tierra, piedra, nieve
const LAYER = { grass: 0, forest: 0, path: 1, sand: 1, water: 1, stone: 2, snow: 3, ice: 3 };

const SUB = 2; // vértices por casilla (resolución)

export class Terrain {
  constructor(zone) {
    this.zone = zone;
    const { W, H } = zone;
    this.W = W; this.H = H;
    this.step = TILE / SUB;
    this.VW = W * SUB + 1; this.VH = H * SUB + 1;
    this.originX = -W * TILE / 2; this.originZ = -H * TILE / 2;
    this.heights = new Float32Array(this.VW * this.VH);
    const amp = zone.data.terrain?.amplitude ?? 0.8;
    const seed = zone.data.terrain?.seed ?? 1;

    for (let j = 0; j < this.VH; j++) {
      for (let i = 0; i < this.VW; i++) {
        const x = this.originX + i * this.step, z = this.originZ + j * this.step;
        let h = (fbm(x * 0.05, z * 0.05, seed, 3) - 0.3) * amp;
        // fracción de agua alrededor del vértice -> orillas inclinadas
        const wf = this.waterFraction(i, j);
        h = h * (1 - wf) - wf * 1.6;
        this.heights[j * this.VW + i] = h;
      }
    }
    this.mesh = this.buildMesh(REALISTIC && zone.palette.groundReal ? { ...zone.palette, ground: zone.palette.groundReal } : zone.palette);
  }

  waterFraction(i, j) {
    // un vértice en (i,j) toca las casillas cuyas esquinas/centros comparte
    const cs = [], rs = [];
    if (i % SUB === 0) { cs.push(i / SUB - 1, i / SUB); } else cs.push(Math.floor(i / SUB));
    if (j % SUB === 0) { rs.push(j / SUB - 1, j / SUB); } else rs.push(Math.floor(j / SUB));
    let w = 0, n = 0;
    for (const r of rs) for (const c of cs) {
      n++;
      const t = tileInfo(this.zone.charAt(c, r));
      if (t.water) w++;
    }
    return n ? w / n : 0;
  }

  vh(i, j) {
    i = Math.max(0, Math.min(this.VW - 1, i)); j = Math.max(0, Math.min(this.VH - 1, j));
    return this.heights[j * this.VW + i];
  }

  /** Altura exacta del terreno en (x,z) siguiendo la triangulación de la malla. */
  height(x, z) {
    const gx = (x - this.originX) / this.step, gz = (z - this.originZ) / this.step;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const h00 = this.vh(i, j), h10 = this.vh(i + 1, j), h01 = this.vh(i, j + 1), h11 = this.vh(i + 1, j + 1);
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  buildMesh(palette) {
    // malla indexada (sombreado suave) con colores por vértice mezclados entre
    // casillas vecinas, oclusión ambiental "horneada" junto a muros y detalle
    // de ruido en el sombreador.
    const VW = this.VW, VH = this.VH;
    const pos = new Float32Array(VW * VH * 3);
    const col = new Float32Array(VW * VH * 3);
    const splat = new Float32Array(VW * VH * 4);
    const layerAt = (x, z) => {
      const tc = Math.floor((x - this.originX) / TILE), tr = Math.floor((z - this.originZ) / TILE);
      return LAYER[tileInfo(zone.charAt(tc, tr)).ground] ?? 0;
    };
    const c = new THREE.Color(), acc = new THREE.Color();
    const zone = this.zone;
    const colorAt = (x, z) => {
      const tc = Math.floor((x - this.originX) / TILE), tr = Math.floor((z - this.originZ) / TILE);
      const info = tileInfo(zone.charAt(tc, tr));
      return palette.ground[info.ground] ?? palette.ground.grass;
    };
    const solidTall = (tc, tr) => {
      const info = tileInfo(zone.charAt(tc, tr));
      return info.solid === 'box' && info.tall;
    };
    for (let j = 0; j < VH; j++) {
      for (let i = 0; i < VW; i++) {
        const x = this.originX + i * this.step, z = this.originZ + j * this.step;
        const k = j * VW + i;
        pos[k * 3] = x; pos[k * 3 + 1] = this.heights[k]; pos[k * 3 + 2] = z;
        // mezcla de 5 muestras alrededor del vértice
        acc.setRGB(0, 0, 0);
        for (const [ox, oz, w] of [[0, 0, 0.4], [1.2, 0, 0.15], [-1.2, 0, 0.15], [0, 1.2, 0.15], [0, -1.2, 0.15]]) {
          c.set(colorAt(x + ox, z + oz));
          acc.r += c.r * w; acc.g += c.g * w; acc.b += c.b * w;
          splat[k * 4 + layerAt(x + ox, z + oz)] += w;
        }
        // variación suave de tono a gran escala
        const n = fbm(x * 0.06, z * 0.06, 31, 2) - 0.5;
        acc.offsetHSL(n * 0.03, n * 0.1, n * 0.08);
        // oclusión junto a muros altos
        const tc = Math.floor((x - this.originX) / TILE), tr = Math.floor((z - this.originZ) / TILE);
        let ao = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!solidTall(tc + dc, tr + dr)) continue;
          const bx0 = this.originX + (tc + dc) * TILE, bz0 = this.originZ + (tr + dr) * TILE;
          const ddx = Math.max(bx0 - x, 0, x - (bx0 + TILE)), ddz = Math.max(bz0 - z, 0, z - (bz0 + TILE));
          ao += Math.max(0, 1 - Math.hypot(ddx, ddz) / 2.6);
        }
        const shade = 1 - Math.min(1, ao) * 0.38;
        col[k * 3] = acc.r * shade; col[k * 3 + 1] = acc.g * shade; col[k * 3 + 2] = acc.b * shade;
      }
    }
    const idx = [];
    for (let j = 0; j < VH - 1; j++) {
      for (let i = 0; i < VW - 1; i++) {
        const a = j * VW + i, b = a + 1, d = a + VW, e = d + 1;
        // mismo orden que height(): (00,01,10) y (10,01,11)
        idx.push(a, d, b, b, d, e);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (REALISTIC) {
      const mesh = new THREE.Mesh(geo, terrainMaterial());
      mesh.receiveShadow = true;
      mesh.name = 'terrain';
      return mesh;
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
      sh.fragmentShader = `varying vec3 vWPos;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
        }
      ` + sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float tn = tNoise(vWPos.xz * 0.45) * 0.6 + tNoise(vWPos.xz * 1.9) * 0.4;
        diffuseColor.rgb *= 0.9 + tn * 0.17;`,
      );
    };
    mat.customProgramCacheKey = () => 'terrain-v2';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}

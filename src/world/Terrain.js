// Terreno low-poly facetado generado a partir del mapa ASCII de la zona.
// La función height() reproduce exactamente la triangulación de la malla,
// así los personajes siempre pisan la superficie visible.
import * as THREE from 'three';
import { TILE, tileInfo } from './tiles.js';
import { fbm, hash2 } from '../core/utils.js';

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
    this.mesh = this.buildMesh(zone.palette);
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
    const pos = [], col = [];
    const c = new THREE.Color();
    const pushTri = (ax, az, bx, bz, cx, cz, ah, bh, chh) => {
      pos.push(ax, ah, az, bx, bh, bz, cx, chh, cz);
      // color de cara según la casilla del baricentro + variación
      const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
      const tc = Math.floor((mx - this.originX) / TILE), tr = Math.floor((mz - this.originZ) / TILE);
      const info = tileInfo(this.zone.charAt(tc, tr));
      c.set(palette.ground[info.ground] || palette.ground.grass);
      const jit = (hash2(Math.floor(mx * 3), Math.floor(mz * 3), 7) - 0.5) * 0.08;
      c.offsetHSL(0, 0, jit);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    };
    for (let j = 0; j < this.VH - 1; j++) {
      for (let i = 0; i < this.VW - 1; i++) {
        const x0 = this.originX + i * this.step, z0 = this.originZ + j * this.step;
        const x1 = x0 + this.step, z1 = z0 + this.step;
        const h00 = this.vh(i, j), h10 = this.vh(i + 1, j), h01 = this.vh(i, j + 1), h11 = this.vh(i + 1, j + 1);
        // mismo orden que height(): (00,01,10) y (10,01,11), con cara hacia arriba
        pushTri(x0, z0, x0, z1, x1, z0, h00, h01, h10);
        pushTri(x1, z0, x0, z1, x1, z1, h10, h01, h11);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}

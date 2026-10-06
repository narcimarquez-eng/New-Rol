// Construye una zona jugable a partir de sus datos: terreno, objetos
// instanciados, colisiones, luces, entidades (NPCs, enemigos, cofres...).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE, tileInfo } from './tiles.js';
import { Terrain } from './Terrain.js';
import { Collision } from './Collision.js';
import * as P from './Props.js';
import * as D from './DesertProps.js';
import { buildSky, buildClouds, buildMountains, buildWater } from './Sky.js';
import { rng, hash2 } from '../core/utils.js';
import { buildGrass } from './Grass.js';
import { windMat, instancedOutline, addOutline, spart, smerge, rockify } from '../gfx/ModelKit.js';
import { REALISTIC } from '../gfx/Style.js';
import { buildAtmosphere, buildRealWater } from '../gfx/Environment.js';
import { buildBackdrop } from '../gfx/Backdrop.js';
import { treeInstances, variedTrees, barkMat, endGrainMat } from '../gfx/Vegetation.js';
import { triplanar, rockTextures, woodTextures, snowTextures, iceMaterialReal } from '../gfx/Materials.js';
import { sandTextures } from '../gfx/Textures.js';
import { tex } from '../gfx/Textures.js';

let iceMat = null;
/** Material del hielo: brillo especular, transparencia leve y grietas pintadas. */
function iceMaterial() {
  if (iceMat) return iceMat;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(120,170,200,0.55)'; c.lineWidth = 1.5;
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    let x = r() * 128, y = r() * 128;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; c.lineTo(x, y); }
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(20, 30); c.lineTo(40, 18); c.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  iceMat = new THREE.MeshStandardMaterial({ color: 0xd2f1ff, map: tex, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.72, emissive: new THREE.Color(0x1a3a4a) });
  return iceMat;
}

export class Zone {
  /**
   * @param {object} data datos de la zona
   * @param {{high?: boolean}} quality alta = contornos en el entorno y más hierba
   */
  constructor(data, quality = { high: true }) {
    this.quality = quality;
    this.data = data;
    this.id = data.id;
    this.palette = data.palette;
    this.map = data.map;
    this.H = data.map.length;
    this.W = Math.max(...data.map.map((r) => r.length));
    this.group = new THREE.Group();
    this.group.name = `zone:${data.id}`;
    this.updaters = [];
    this.torches = [];
    this.occupied = new Set(); // casillas ocupadas por casas (sin decoración)
    for (const e of data.entities) {
      if (e.type === 'house') {
        for (let r = 0; r < e.size[1]; r++) for (let c = 0; c < e.size[0]; c++) this.occupied.add(`${e.tile[0] + c},${e.tile[1] + r}`);
      }
    }

    this.isIce = data.map.some((row) => row.includes('i'));
    this.terrain = new Terrain(this);
    this.group.add(this.terrain.mesh);
    this.collision = new Collision(this);
    this.buildEnvironment();
    this.buildTiles();
    this.buildStaticEntities();
  }

  charAt(c, r) {
    if (r < 0 || r >= this.H || c < 0 || c >= this.W) return '#';
    return this.map[r][c] || '.';
  }

  /** Centro de mundo de una casilla (admite coordenadas fraccionarias). */
  tileToWorld(c, r) {
    return [-this.W * TILE / 2 + (c + 0.5) * TILE, -this.H * TILE / 2 + (r + 0.5) * TILE];
  }

  height(x, z) { return this.terrain.height(x, z); }

  isIceTile(c, r) { return !!tileInfo(this.charAt(c, r)).ice; }

  buildEnvironment() {
    if (REALISTIC) { this.buildRealEnvironment(); return; }
    const pal = this.palette;
    this.sky = buildSky(pal);
    this.group.add(this.sky);
    this.clouds = buildClouds(pal);
    this.group.add(this.clouds);
    const radius = Math.max(this.W, this.H) * TILE * 0.7;
    this.group.add(buildMountains(pal, radius));

    // suelo exterior infinito (más allá del mapa)
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: pal.ground.forest }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.6;
    outer.receiveShadow = true;
    this.group.add(outer);

    // agua (solo visible donde el terreno está hundido)
    const hasWater = this.map.some((row) => /[~B]/.test(row));
    if (hasWater) {
      const water = buildWater(this.W * TILE, this.H * TILE, pal, this.terrain, -0.55);
      water.position.y = -0.55;
      this.group.add(water);
      this.updaters.push((t) => water.userData.update(t));
    }

    this.fogColor = new THREE.Color(pal.fog);
  }

  /** Atmósfera realista: cielo físico, luz ambiental, nubes, montañas y agua reflectante. */
  buildRealEnvironment() {
    const pal = this.palette;
    const atmo = { ...(this.data.atmosphere || {}) };
    const a = buildAtmosphere(this.quality.renderer, atmo);
    this.sky = a.sky; this.envMap = a.envMap; this.sunDir = a.sunDir; this.hazeColor = a.hazeColor;
    this.group.add(a.sky);
    this.updaters.push((t) => a.sky.userData.update(t));
    // montañas y valle alrededor del mapa (sustituyen al suelo exterior)
    this.group.add(buildBackdrop(this.W * TILE / 2, this.H * TILE / 2, { seed: this.data.terrain?.seed ?? 7, ...(atmo.backdrop || {}) }));
    // agua con reflejos
    if (this.map.some((row) => /[~B]/.test(row))) {
      const water = buildRealWater(this.W * TILE, this.H * TILE, atmo, this.sunDir, { level: -0.55, lowQuality: !this.quality.high });
      this.group.add(water);
      this.updaters.push((t) => water.userData.update(t));
    }
    this.fogColor = this.hazeColor;
  }

  /** Recorre el mapa y genera las mallas instanciadas por tipo de objeto. */
  buildTiles() {
    const pal = this.palette;
    const lists = { tree: [], pine: [], rock: [], bush: [], wall: [], wallTree: [], cliff: [], fenceX: [], fenceZ: [], flowers: [], tufts: [], bridge: [], secret: [], secretTree: [], crystal: [], icepillar: [], iceSheet: [], ruin: [], column: [], cactus: [], palm: [], scrub: [] };
    const rockWalls = this.data.wallStyle === 'rock';
    const r = rng(this.data.terrain?.seed ?? 1);
    this.bushIndex = new Map(); // "c,r" -> índice de instancia
    const flowerColors = [0xff6b9a, 0xffe14d, 0xffffff, 0x9b7bff, 0xff9a3c];

    for (let row = 0; row < this.H; row++) {
      for (let c = 0; c < this.W; c++) {
        const ch = this.charAt(c, row);
        const info = tileInfo(ch);
        const [x, z] = this.tileToWorld(c, row);
        const y = this.height(x, z);
        const jx = (hash2(c, row, 1) - 0.5) * 0.8, jz = (hash2(c, row, 2) - 0.5) * 0.8;
        const rot = hash2(c, row, 3) * Math.PI * 2;
        const sc = 0.85 + hash2(c, row, 4) * 0.35;
        const occ = this.occupied.has(`${c},${row}`);
        switch (info.prop) {
          case 'tree': lists.tree.push({ x: x + jx, y, z: z + jz, ry: rot, s: sc }); break;
          case 'pine': lists.pine.push({ x: x + jx, y, z: z + jz, ry: rot, s: sc * 1.1 }); break;
          case 'rock': lists.rock.push({ x: x + jx * 0.5, y: y - 0.1, z: z + jz * 0.5, ry: rot, s: sc }); break;
          case 'bush': this.bushIndex.set(`${c},${row}`, lists.bush.length); lists.bush.push({ x, y, z, ry: rot, s: sc * 0.95 }); break;
          case 'wall': {
            if (rockWalls) {
              // muro de roca/hielo: los secretos se ven casi iguales (un tono más claro)
              lists.cliff.push({ x, y: y - 0.3, z, ry: Math.floor(hash2(c, row, 5) * 4) * Math.PI / 2, sy: 0.85 + hash2(c, row, 6) * 0.4, tint: info.secret ? 1.07 : 1, secret: info.secret });
              break;
            }
            const target = info.secret ? lists.secret : lists.wall;
            target.push({ x, y: y - 0.2, z, ry: Math.floor(hash2(c, row, 5) * 4) * Math.PI / 2, sy: 0.9 + hash2(c, row, 6) * 0.4 });
            const tt = info.secret ? lists.secretTree : lists.wallTree;
            tt.push({ x: x + jx * 1.5, y: y + 1.5, z: z + jz * 1.5, ry: rot, s: 1.1 + hash2(c, row, 7) * 0.5 });
            break;
          }
          case 'cliff': lists.cliff.push({ x, y: y - 0.3, z, ry: Math.floor(hash2(c, row, 5) * 4) * Math.PI / 2, sy: 0.85 + hash2(c, row, 6) * 0.5 }); break;
          case 'fence': {
            const isF = (cc, rr) => this.charAt(cc, rr) === 'F';
            const h = isF(c - 1, row) || isF(c + 1, row);
            const v = isF(c, row - 1) || isF(c, row + 1);
            if (h || !v) lists.fenceX.push({ x, y, z });
            if (v) lists.fenceZ.push({ x, y, z });
            break;
          }
          case 'bridge': lists.bridge.push({ x, y: -0.35, z, ry: 0 }); break;
          case 'crystal': lists.crystal.push({ x: x + jx * 0.5, y, z: z + jz * 0.5, ry: rot, s: sc }); this.torches.push({ x, z, y: y + 1.4, phase: rot, color: this.palette.crystalLight ?? 0x7fd8ff, crystal: true, obj: { userData: {} } }); break;
          case 'iceSheet': break;
          case 'ruin': lists.ruin.push({ x, z, y, c, r: row, secret: info.secret }); break;
          case 'column': lists.column.push({ x, y: y - 0.1, z, ry: Math.floor(hash2(c, row, 5) * 4) * Math.PI / 2, broken: hash2(c, row, 6) < 0.35 }); break;
          case 'cactus': lists.cactus.push({ x: x + jx, y: y - 0.1, z: z + jz, ry: rot, s: sc }); break;
          case 'palm': lists.palm.push({ x: x + jx * 0.6, y: y - 0.1, z: z + jz * 0.6, ry: rot, s: 0.9 + hash2(c, row, 4) * 0.25 }); break;
          case 'icepillar': lists.icepillar.push({ x, y: y - 0.1, z, ry: Math.floor(hash2(c, row, 5) * 4) * Math.PI / 2, sy: 0.9 + hash2(c, row, 6) * 0.3 }); break;
          default: break;
        }
        if (info.ice) lists.iceSheet.push({ x, y: this.height(x, z) + 0.04, z, ry: Math.floor(hash2(c, row, 9) * 4) * Math.PI / 2 });
        if (occ) continue;
        if (info.decor === 'flowers') {
          for (let k = 0; k < 6; k++) lists.flowers.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, s: 0.8 + r() * 0.6, color: flowerColors[Math.floor(r() * flowerColors.length)] });
        } else if (info.decor === 'scrub') {
          for (let k = 0; k < 2; k++) lists.scrub.push({ x: x + (r() - 0.5) * 3.2, y, z: z + (r() - 0.5) * 3.2, ry: r() * 6, s: 0.6 + r() * 0.5 });
        } else if (info.decor === 'tallgrass') {
          for (let k = 0; k < 7; k++) lists.tufts.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, ry: r() * 6, s: 0.8 + r() * 0.8 });
        } else if (info.ground === 'grass' || info.ground === 'forest') {
          // matojos dispersos por todo el césped para dar textura
          if (r() < 0.45) lists.tufts.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, ry: r() * 6, s: 0.5 + r() * 0.5 });
          if (info.ground === 'grass' && r() < 0.08) lists.flowers.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, s: 0.8, color: flowerColors[Math.floor(r() * flowerColors.length)] });
        }
      }
    }

    const high = this.quality.high;
    const add = (geo, mat, items, opt = {}) => {
      if (!items.length) return null;
      const m = P.instanced(geo, mat, items, opt);
      this.group.add(m);
      // contornos de tinta (solo calidad alta)
      if (high && opt.outline) { const o = instancedOutline(m, opt.outline, opt.wind || null); if (o) this.group.add(o); }
      return m;
    };
    // objetos del desierto (mismos modelos en los dos estilos)
    if (lists.ruin.length) this.group.add(D.ruinWalls(lists.ruin));
    if (lists.column.length) this.group.add(D.columns(lists.column));
    if (lists.cactus.length) this.group.add(D.cacti(lists.cactus));
    if (lists.palm.length) this.group.add(D.palms(lists.palm));
    if (lists.scrub.length) this.group.add(treeInstances('scrub', lists.scrub, { seed: 1, castShadow: false }));
    if (REALISTIC) { this.buildRealProps(lists, add); return; }
    const tm = P.toonMat();
    const treeWind = { from: 2.2, amount: 0.05 };
    const pineWind = { from: 1.6, amount: 0.04 };
    const bushWind = { from: 0.3, amount: 0.05 };
    const lowWind = { from: 0.0, amount: 0.25 };
    add(P.treeGeo(pal), windMat(tm, treeWind), lists.tree, { outline: 0.05, wind: treeWind });
    add(P.pineGeo(pal), windMat(tm, pineWind), lists.pine, { outline: 0.05, wind: pineWind });
    add(P.rockGeo(pal), tm, lists.rock, { outline: 0.05 });
    this.bushMesh = add(P.bushGeo(pal), windMat(tm, bushWind), lists.bush, { outline: 0.045, wind: bushWind });
    add(P.hedgeGeo(pal), tm, lists.wall, { outline: 0.05 });
    const wallTreeGeo = this.data.wallStyle === 'forest' ? P.pineGeo(pal) : P.treeGeo(pal);
    const wallWind = this.data.wallStyle === 'forest' ? pineWind : treeWind;
    add(wallTreeGeo, windMat(tm, wallWind), lists.wallTree, { outline: 0.05, wind: wallWind });
    // los pasadizos secretos se ven igual que un muro... casi (un tono más claro)
    add(P.hedgeGeo(pal), tm, lists.secret.map((i) => ({ ...i, tint: 1.08 })), { outline: 0.05 });
    add(wallTreeGeo, windMat(tm, wallWind), lists.secretTree, { outline: 0.05, wind: wallWind });
    add(P.cliffGeo(pal), tm, lists.cliff, { outline: 0.05 });
    add(P.fenceGeo(pal, true), tm, lists.fenceX, { outline: 0.03 });
    add(P.fenceGeo(pal, false), tm, lists.fenceZ, { outline: 0.03 });
    add(P.flowerGeo(), windMat(tm, lowWind), lists.flowers, { castShadow: false });
    add(P.grassTuftGeo(pal), windMat(tm, lowWind), lists.tufts, { castShadow: false });
    add(P.bridgeGeo(pal), tm, lists.bridge, { outline: 0.03 });
    add(P.crystalGeo(pal), P.toonMat({ emissive: new THREE.Color(pal.crystalGlow ?? 0x2a6f8f) }), lists.crystal, { outline: 0.03 });
    add(P.icePillarGeo(pal), tm, lists.icepillar, { outline: 0.05 });
    // placas de hielo brillantes con grietas
    if (lists.iceSheet.length) {
      const sheet = P.instanced(new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2), iceMaterial(), lists.iceSheet, { castShadow: false });
      this.group.add(sheet);
    }
    // hierba con viento
    if (pal.grassDensity !== 0) this.group.add(buildGrass(this, Math.round((pal.grassDensity ?? 48) * (high ? 1 : 0.4))));
  }

  /** Vegetación y objetos del modo realista (árboles ez-tree, roca triplanar, madera...). */
  buildRealProps(lists, add) {
    const pal = this.palette;
    const caves = this.data.wallStyle === 'rock';
    const topCover = this.data.cliffTop === 'sand'
      ? { set: sandTextures(), color: pal.groundReal?.sand ?? 0xe4c48e, from: 0.6 }
      : caves
        ? { set: snowTextures(), color: 0xffffff, from: 0.55 }
        : { set: { map: tex('tex/grass.jpg'), normalMap: rockTextures().normalMap }, color: pal.groundReal?.grass ?? 0x7d9a4a, from: 0.6 };
    const rockMat = triplanar({ key: `rock-${this.id}`, set: rockTextures(), scale: 0.3, normalStrength: 1, vertexColors: false, color: pal.rockReal ?? 0xa09a90, top: topCover });
    const woodMat = triplanar({ key: 'wood-real', set: woodTextures(), scale: 0.5, normalStrength: 0.6, vertexColors: true });

    // árboles sueltos (T) y pinos (P), varias especies y semillas
    const kinds = this.data.trees || ['oak'];
    kinds.forEach((kind, ki) => {
      const sub = lists.tree.filter((_, i) => i % kinds.length === ki).map((i) => ({ ...i, s: (i.s ?? 1) * 0.95 }));
      if (sub.length) this.group.add(variedTrees(kind, sub, [1, 2]));
    });
    if (lists.pine.length) this.group.add(variedTrees(this.data.pineKind || 'pine', lists.pine, [1, 2, 3]));
    // muros vegetales: setos densos (y pinos encima en el bosque)
    // (tarjetas de hojas: los muros tienen cientos de piezas)
    const hedgeItems = [];
    for (const it of [...lists.wall, ...lists.secret]) {
      hedgeItems.push({ x: it.x - 0.8, y: it.y + 0.1, z: it.z - 0.6, ry: it.ry, s: 1.05 });
      hedgeItems.push({ x: it.x + 0.8, y: it.y + 0.1, z: it.z + 0.7, ry: it.ry + 1.7, s: 0.95 });
    }
    if (hedgeItems.length) this.group.add(variedTrees('hedgeCard', hedgeItems, [1, 2, 3]));
    const wallTrees = [...lists.wallTree, ...lists.secretTree].map((i) => ({ ...i, y: i.y - 1.5, s: 0.85 + (i.s - 1.1) * 0.4 }));
    if (wallTrees.length) this.group.add(variedTrees(this.data.wallTreeKind || 'pineCard', wallTrees, [1, 2, 3]));
    // arbustos cortables: una sola variante para conservar los índices de instancia
    if (lists.bush.length) {
      const bushes = treeInstances('bush', lists.bush.map((i) => ({ ...i, s: (i.s ?? 1) * 1.05 })), { seed: 1 });
      this.bushMeshes = bushes.userData.instances;
      this.group.add(bushes);
    }
    // rocas y acantilados de roca triplanar con musgo o nieve encima
    // rocas sueltas: dos variantes de canto rodado (grande + pequeño al lado)
    for (const v of [0, 1]) {
      const geo = smerge([
        spart(P.boulderGeoReal(3 + v * 4), 0xffffff, { sx: 1.35, sy: 1.25, sz: 1.2, ao: 0.4 }),
        spart(P.boulderGeoReal(5 + v * 4, 3), 0xffffff, { x: 1.15, z: 0.5 - v, sx: 0.6, sy: 0.55, sz: 0.6, ao: 0.3 }),
      ]);
      add(geo, rockMat, lists.rock.filter((_, i) => i % 2 === v));
    }
    // acantilados: dos variantes de bloque, giro y escala variados para que el muro no se repita
    const cliffs = lists.cliff.map((it, i) => ({ ...it, ry: it.ry + (hash2(i, 3, 11) - 0.5) * 0.5,
      sx: 1.05 + hash2(i, 4, 11) * 0.2, sz: 1.05 + hash2(i, 5, 11) * 0.2, sy: (it.sy ?? 1) * (0.9 + hash2(i, 6, 11) * 0.35) }));
    add(P.cliffGeoReal(1), rockMat, cliffs.filter((_, i) => i % 2 === 0));
    add(P.cliffGeoReal(2), rockMat, cliffs.filter((_, i) => i % 2 === 1));
    // madera: vallas y puentes
    add(P.fenceGeo(pal, true), woodMat, lists.fenceX);
    add(P.fenceGeo(pal, false), woodMat, lists.fenceZ);
    add(P.bridgeGeo(pal), woodMat, lists.bridge);
    // flores y matojos con viento
    const plant = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    add(P.flowerGeo(), windMat(plant, { from: 0.0, amount: 0.25 }), lists.flowers, { castShadow: false });
    add(P.grassTuftGeo({ ...pal, grassTuft: pal.groundReal?.grass ?? pal.grassTuft }), windMat(plant, { from: 0.0, amount: 0.25 }), lists.tufts, { castShadow: false });
    // cristales e hielo
    add(P.crystalGeo(pal), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.1, emissive: new THREE.Color(pal.crystalGlow ?? 0x2a6f8f), transparent: true, opacity: 0.9 }), lists.crystal);
    add(P.icePillarGeo(pal), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.85 }), lists.icepillar);
    // hielo: una sola superficie continua que sigue el terreno (sin escalones entre casillas)
    if (lists.iceSheet.length) {
      const geos = lists.iceSheet.map((it) => {
        const g = new THREE.PlaneGeometry(TILE, TILE, 2, 2).rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const wx = it.x + p.getX(i), wz = it.z + p.getZ(i);
          p.setXYZ(i, wx, this.height(wx, wz) + 0.05, wz);
        }
        g.deleteAttribute('uv'); // el material usa coordenadas de mundo
        g.deleteAttribute('normal');
        return g;
      });
      const geo = mergeVertices(mergeGeometries(geos), 1e-3);
      geo.computeVertexNormals();
      const ice = new THREE.Mesh(geo, iceMaterialReal());
      ice.receiveShadow = true;
      ice.name = 'ice';
      this.group.add(ice);
    }
    if (pal.grassDensity !== 0) this.group.add(buildGrass(this, Math.round((pal.grassDensity ?? 48) * (this.quality.high ? 1.6 : 0.5))));
  }

  /** Corta un arbusto: quita su instancia y su colisión. */
  cutBush(c, r) {
    const i = this.bushIndex.get(`${c},${r}`);
    if (i == null) return false;
    this.bushIndex.delete(`${c},${r}`);
    if (this.bushMeshes) this.bushMeshes.forEach((m) => P.hideInstance(m, i));
    else P.hideInstance(this.bushMesh, i);
    this.collision.clearTile(c, r);
    return true;
  }

  /** Entidades estáticas (casas, carteles, decoración). Las dinámicas las crea el juego. */
  buildStaticEntities() {
    const pal = this.palette;
    for (const e of this.data.entities) {
      if (e.type === 'house') {
        const w = e.size[0] * TILE, d = e.size[1] * TILE;
        const [cx, cz] = this.tileToWorld(e.tile[0] + (e.size[0] - 1) / 2, e.tile[1] + (e.size[1] - 1) / 2);
        const house = P.buildHouse({ w: w - 0.6, d: d - 1.0, roof: e.roof, wall: e.wall, door: e.door });
        const houseMeshes = [];
        house.traverse((o) => { if (o.isMesh) houseMeshes.push(o); });
        houseMeshes.forEach((m) => addOutline(m, 0.05));
        house.position.set(cx, this.minHeight(cx, cz, w / 2, d / 2) - 0.1, cz);
        this.group.add(house);
        this.collision.addBox(cx, cz, w - 0.4, d - 0.8, { tall: true, tag: 'house' });
      } else if (e.type === 'prop') {
        const [x, z] = this.tileToWorld(...e.tile);
        let obj;
        switch (e.kind) {
          case 'well': obj = P.buildWell(); break;
          case 'statue': obj = P.buildStatue(); break;
          case 'stall': obj = P.buildStall(); break;
          case 'anvil': obj = new THREE.Mesh(P.merge([
            P.part(new THREE.BoxGeometry(0.5, 0.6, 0.5), 0x555555, { y: 0.3 }),
            P.part(new THREE.BoxGeometry(1.1, 0.35, 0.5), 0x444444, { y: 0.75 }),
          ]), P.toonMat()); break;
          case 'campfire': obj = this.buildCampfire(); break;
          case 'tent': obj = D.tent(e.color); break;
          case 'jar': obj = D.jar(); break;
          case 'log':
            if (REALISTIC) { obj = new THREE.Group(); const l = P.logReal(2.2, 0.35); l.position.y = 0.33; obj.add(l); break; }
            obj = new THREE.Mesh(P.part(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 7), pal.trunk, { rz: Math.PI / 2, y: 0.35 }), P.toonMat()); break;
          case 'stump':
            if (REALISTIC) {
              obj = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.7, 16), [barkMat('oak', 1.2, 0.35), endGrainMat(), endGrainMat()]);
              obj.geometry.translate(0, 0.35, 0); break;
            }
            obj = new THREE.Mesh(P.part(new THREE.CylinderGeometry(0.55, 0.65, 0.7, 8), pal.trunk, { y: 0.35 }), P.toonMat()); break;
          default: continue;
        }
        obj.position.set(x, this.height(x, z), z);
        obj.rotation.y = e.rot || 0;
        const fire = this.torches.find((t) => t.obj === obj);
        if (fire) { fire.x = x; fire.z = z; fire.y = obj.position.y + 0.9; }
        const meshes = [];
        // (las llamas de sombreador no proyectan sombra)
        obj.traverse((o) => { if (o.isMesh && !o.material.isShaderMaterial) { o.castShadow = true; o.receiveShadow = true; if (o.material.type !== 'MeshBasicMaterial') meshes.push(o); } });
        meshes.forEach((m) => addOutline(m, 0.04));
        this.group.add(obj);
        if (e.radius) this.collision.addCircle(x, z, e.radius, { tall: false });
        if (e.box) this.collision.addBox(x, z, e.box[0], e.box[1], { tall: false });
      } else if (e.type === 'torch') {
        const [x, z] = this.tileToWorld(...e.tile);
        const t = P.buildTorch(pal);
        t.children.forEach((m) => { if (m.isMesh && m.material.type !== 'MeshBasicMaterial') addOutline(m, 0.03); });
        t.position.set(x, this.height(x, z), z);
        this.group.add(t);
        this.collision.addCircle(x, z, 0.3);
        this.torches.push({ obj: t, x, z, y: t.position.y + t.userData.flameY, phase: Math.random() * 10 });
      } else if (e.type === 'fountain') {
        const [x, z] = this.tileToWorld(...e.tile);
        this.fountain = { x, z, radius: e.radius };
        // columna de luz de la fuente
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fffe0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
        beam.position.set(x, 4, z);
        this.group.add(beam);
        this.updaters.push((t) => { beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.04; beam.rotation.y = t * 0.3; });
      }
    }
  }

  buildCampfire() {
    if (REALISTIC) {
      const g = P.campfireReal();
      const flame = g.userData.realFlame;
      this.torches.push({ obj: g, x: 0, z: 0, y: 0, phase: 1, lateBind: true, flame });
      this.updaters.push((t) => { flame.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.05, 1); });
      return g;
    }
    const g = new THREE.Group();
    const logs = new THREE.Mesh(P.merge([
      P.part(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 5), 0x5a3a22, { y: 0.15, rz: Math.PI / 2 }),
      P.part(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 5), 0x5a3a22, { y: 0.15, rz: Math.PI / 2, ry: Math.PI / 2 }),
      P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { x: 0.6 }), P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { x: -0.6 }),
      P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { z: 0.6 }), P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { z: -0.6 }),
    ]), P.toonMat());
    g.add(logs);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.6, 0.1), toneMapped: false }));
    flame.position.y = 0.7;
    g.add(flame);
    g.userData.flameY = 0.8;
    // reutilizamos la lógica de antorchas para su luz parpadeante
    this.torches.push({ obj: g, x: 0, z: 0, y: 0, phase: 1, lateBind: true, flame });
    this.updaters.push((t) => { flame.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.2, 1); });
    return g;
  }

  minHeight(cx, cz, hw, hd) {
    let m = Infinity;
    for (const [dx, dz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]]) m = Math.min(m, this.height(cx + dx, cz + dz));
    return m;
  }

  update(t) {
    for (const u of this.updaters) u(t);
    if (this.clouds) this.clouds.rotation.y = t * 0.004;
  }

  dispose() {
    this.envMap?.dispose();
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Array.isArray(o.material) && o.material.type === 'ShaderMaterial') o.material.dispose();
    });
  }
}

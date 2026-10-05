// Construye una zona jugable a partir de sus datos: terreno, objetos
// instanciados, colisiones, luces, entidades (NPCs, enemigos, cofres...).
import * as THREE from 'three';
import { TILE, tileInfo } from './tiles.js';
import { Terrain } from './Terrain.js';
import { Collision } from './Collision.js';
import * as P from './Props.js';
import { buildSky, buildClouds, buildMountains, buildWater } from './Sky.js';
import { rng, hash2 } from '../core/utils.js';

export class Zone {
  constructor(data) {
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

  buildEnvironment() {
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
      const water = buildWater(this.W * TILE, this.H * TILE, pal);
      water.position.y = -0.55;
      this.group.add(water);
      this.updaters.push((t) => water.userData.update(t));
    }

    this.fogColor = new THREE.Color(pal.fog);
  }

  /** Recorre el mapa y genera las mallas instanciadas por tipo de objeto. */
  buildTiles() {
    const pal = this.palette;
    const lists = { tree: [], pine: [], rock: [], bush: [], wall: [], wallTree: [], cliff: [], fenceX: [], fenceZ: [], flowers: [], tufts: [], bridge: [], secret: [], secretTree: [] };
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
          default: break;
        }
        if (occ) continue;
        if (info.decor === 'flowers') {
          for (let k = 0; k < 6; k++) lists.flowers.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, s: 0.8 + r() * 0.6, color: flowerColors[Math.floor(r() * flowerColors.length)] });
        } else if (info.decor === 'tallgrass') {
          for (let k = 0; k < 7; k++) lists.tufts.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, ry: r() * 6, s: 0.8 + r() * 0.8 });
        } else if (info.ground === 'grass' || info.ground === 'forest') {
          // matojos dispersos por todo el césped para dar textura
          if (r() < 0.45) lists.tufts.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, ry: r() * 6, s: 0.5 + r() * 0.5 });
          if (info.ground === 'grass' && r() < 0.08) lists.flowers.push({ x: x + (r() - 0.5) * 3.6, y, z: z + (r() - 0.5) * 3.6, s: 0.8, color: flowerColors[Math.floor(r() * flowerColors.length)] });
        }
      }
    }

    const add = (geo, mat, items, opt) => {
      if (!items.length) return null;
      const m = P.instanced(geo, mat, items, opt);
      this.group.add(m);
      return m;
    };
    const tm = P.toonMat();
    add(P.treeGeo(pal), tm, lists.tree);
    add(P.pineGeo(pal), tm, lists.pine);
    add(P.rockGeo(pal), tm, lists.rock);
    this.bushMesh = add(P.bushGeo(pal), tm, lists.bush);
    add(P.hedgeGeo(pal), tm, lists.wall);
    add(this.data.wallStyle === 'forest' ? P.pineGeo(pal) : P.treeGeo(pal), tm, lists.wallTree);
    // los pasadizos secretos se ven igual que un muro... casi (un tono más claro)
    add(P.hedgeGeo(pal), tm, lists.secret.map((i) => ({ ...i, tint: 1.08 })), { castShadow: true });
    add(this.data.wallStyle === 'forest' ? P.pineGeo(pal) : P.treeGeo(pal), tm, lists.secretTree);
    add(P.cliffGeo(pal), tm, lists.cliff);
    add(P.fenceGeo(pal, true), tm, lists.fenceX);
    add(P.fenceGeo(pal, false), tm, lists.fenceZ);
    add(P.flowerGeo(), tm, lists.flowers, { castShadow: false });
    add(P.grassTuftGeo(pal), tm, lists.tufts, { castShadow: false });
    add(P.bridgeGeo(pal), tm, lists.bridge);
  }

  /** Corta un arbusto: quita su instancia y su colisión. */
  cutBush(c, r) {
    const i = this.bushIndex.get(`${c},${r}`);
    if (i == null) return false;
    this.bushIndex.delete(`${c},${r}`);
    P.hideInstance(this.bushMesh, i);
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
          case 'log': obj = new THREE.Mesh(P.part(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 7), pal.trunk, { rz: Math.PI / 2, y: 0.35 }), P.toonMat()); break;
          case 'stump': obj = new THREE.Mesh(P.part(new THREE.CylinderGeometry(0.55, 0.65, 0.7, 8), pal.trunk, { y: 0.35 }), P.toonMat()); break;
          default: continue;
        }
        obj.position.set(x, this.height(x, z), z);
        obj.rotation.y = e.rot || 0;
        const fire = this.torches.find((t) => t.obj === obj);
        if (fire) { fire.x = x; fire.z = z; fire.y = obj.position.y + 0.9; }
        obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.group.add(obj);
        if (e.radius) this.collision.addCircle(x, z, e.radius, { tall: false });
        if (e.box) this.collision.addBox(x, z, e.box[0], e.box[1], { tall: false });
      } else if (e.type === 'torch') {
        const [x, z] = this.tileToWorld(...e.tile);
        const t = P.buildTorch(pal);
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
    const g = new THREE.Group();
    const logs = new THREE.Mesh(P.merge([
      P.part(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 5), 0x5a3a22, { y: 0.15, rz: Math.PI / 2 }),
      P.part(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 5), 0x5a3a22, { y: 0.15, rz: Math.PI / 2, ry: Math.PI / 2 }),
      P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { x: 0.6 }), P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { x: -0.6 }),
      P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { z: 0.6 }), P.part(new THREE.DodecahedronGeometry(0.2, 0), 0x777777, { z: -0.6 }),
    ]), P.toonMat());
    g.add(logs);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3), toneMapped: false }));
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
    this.clouds.rotation.y = t * 0.004;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Array.isArray(o.material) && o.material.type === 'ShaderMaterial') o.material.dispose();
    });
  }
}

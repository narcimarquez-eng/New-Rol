// Entidades con las que se interactúa: NPCs, cofres, puertas, carteles,
// objetos recogibles, muñecos de entrenamiento y portales entre zonas.
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';
import * as P from '../world/Props.js';
import { ITEMS } from '../data/items.js';
import { TILE } from '../world/tiles.js';
import { dampAngle } from '../core/utils.js';
import { addOutline } from '../gfx/ModelKit.js';

/** Contorno de tinta para todas las mallas opacas de un objeto. */
function outlineAll(obj, t = 0.04) {
  const meshes = [];
  obj.traverse((o) => { if (o.isMesh && !o.material.transparent && o.material.type !== 'MeshBasicMaterial' && o.name !== 'outline') meshes.push(o); });
  for (const m of meshes) addOutline(m, t);
}

class Base {
  constructor(game, data) {
    this.game = game;
    this.data = data;
    const [x, z] = this.centerOf(data);
    this.x = x; this.z = z;
    this.y = game.zone.height(x, z);
    this.radius = 2.2;
    this.visible = true;
    this.root = new THREE.Group();
    this.root.position.set(x, this.y, z);
  }
  centerOf(d) {
    const span = d.span || 1;
    return this.game.zone.tileToWorld(d.tile[0] + (span - 1) / 2, d.tile[1]);
  }
  get prompt() { return null; }
  interact() {}
  update() {}
  dispose() { this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
}

// ---------------- NPC ----------------
function catModel() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(P.merge([
    P.part(new THREE.BoxGeometry(0.5, 0.4, 0.9), 0xf4a261, { y: 0.4 }),
    P.part(new THREE.BoxGeometry(0.45, 0.42, 0.42), 0xf4a261, { y: 0.75, z: 0.5 }),
    P.part(new THREE.ConeGeometry(0.1, 0.2, 4), 0xe76f51, { x: -0.14, y: 1.02, z: 0.5 }),
    P.part(new THREE.ConeGeometry(0.1, 0.2, 4), 0xe76f51, { x: 0.14, y: 1.02, z: 0.5 }),
    P.part(new THREE.BoxGeometry(0.08, 0.08, 0.04), 0x1b4332, { x: -0.1, y: 0.8, z: 0.72 }),
    P.part(new THREE.BoxGeometry(0.08, 0.08, 0.04), 0x1b4332, { x: 0.1, y: 0.8, z: 0.72 }),
    P.part(new THREE.CylinderGeometry(0.06, 0.05, 0.7, 5), 0xe76f51, { y: 0.75, z: -0.55, rx: -0.6 }),
    ...[[-0.15, 0.3], [0.15, 0.3], [-0.15, -0.3], [0.15, -0.3]].map(([x, z]) => P.part(new THREE.BoxGeometry(0.12, 0.25, 0.12), 0xf4a261, { x, y: 0.12, z })),
  ]), P.toonMat());
  m.castShadow = true;
  g.add(m);
  return g;
}

function fairyModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.5, 1.9), toneMapped: false }));
  body.position.y = 1.8;
  g.add(body);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), wingMat); wl.position.set(-0.4, 1.9, -0.1);
  const wr = wl.clone(); wr.position.x = 0.4;
  g.add(wl, wr);
  g.userData.wings = [wl, wr];
  g.userData.body = body;
  return g;
}

export class NPC extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.name = data.name;
    this.radius = 2.6;
    this.mapColor = '#5ad1ff';
    if (data.look === 'cat') { this.model = null; this.mesh = catModel(); this.radius = 2.0; }
    else if (data.look === 'fairy') { this.model = null; this.mesh = fairyModel(); this.fairy = true; this.mapColor = '#bff8ff'; }
    else { this.model = new CharacterModel(data.look || {}); this.mesh = this.model.root; }
    if (data.look === 'cat') outlineAll(this.mesh, 0.025);
    this.root.add(this.mesh);
    this.facing = data.facing || 0;
    this.baseFacing = this.facing;
    this.root.rotation.y = this.facing;
    this.home = { x: this.x, z: this.z };
    this.collider = game.zone.collision.addCircle(this.x, this.z, data.look === 'cat' ? 0.5 : 0.55, { tag: 'npc' });
    this.talking = false;
    this.wanderT = Math.random() * 3;
    this.target = null;
    // indicador de misión (!) sobre la cabeza
    const mark = new THREE.Mesh(P.merge([
      P.part(new THREE.BoxGeometry(0.16, 0.45, 0.16), 0xffd34d, { y: 0.35 }),
      P.part(new THREE.BoxGeometry(0.16, 0.16, 0.16), 0xffd34d, { y: 0 }),
    ]), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    mark.position.y = 3.0;
    mark.visible = false;
    this.root.add(mark);
    this.mark = mark;
  }

  get prompt() { return `Hablar con ${this.name}`; }

  interact() { this.game.talkTo(this); }

  update(dt) {
    const g = this.game, p = g.player;
    const t = g.time;
    let speed = 0;
    if (this.talking) {
      this.facing = dampAngle(this.facing, Math.atan2(p.x - this.x, p.z - this.z), 8, dt);
    } else if (this.data.wander) {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2, r = Math.random() * this.data.wander * TILE * 0.5;
        this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
      }
      if (this.target) {
        const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.3) this.target = null;
        else {
          this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 6, dt);
          const pos = { x: this.x + dx / d * 2 * dt, z: this.z + dz / d * 2 * dt };
          g.zone.collision.resolve(pos, 0.5, this.collider);
          this.x = pos.x; this.z = pos.z; speed = 0.35;
          this.collider.x = this.x; this.collider.z = this.z;
        }
      }
    } else {
      // mira al jugador si está cerca
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      const targetF = d < 6 ? Math.atan2(p.x - this.x, p.z - this.z) : this.baseFacing;
      this.facing = dampAngle(this.facing, targetF, 3, dt);
    }
    this.y = g.zone.height(this.x, this.z);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.facing;
    if (this.model) this.model.animate(dt, { speed, talk: this.talking });
    if (this.fairy) {
      const ud = this.mesh.userData;
      ud.body.position.y = 1.8 + Math.sin(t * 2) * 0.25;
      ud.wings[0].rotation.y = Math.sin(t * 18) * 0.6; ud.wings[1].rotation.y = -Math.sin(t * 18) * 0.6;
      ud.wings[0].position.y = ud.wings[1].position.y = ud.body.position.y + 0.1;
      if (Math.random() < dt * 8) g.particles.spawn(this.x + (Math.random() - 0.5), this.y + ud.body.position.y, this.z + (Math.random() - 0.5), { color: 0xbff8ff, size: 0.5, life: 1, gravity: -0.3, vy: 0.3 });
    }
    // marca de misión
    const has = g.npcHasNews(this);
    this.mark.visible = has;
    if (has) { this.mark.rotation.y = t * 2; this.mark.position.y = (this.model ? 3.0 * (this.model.cfg.scale || 1) : 2.2) + Math.sin(t * 4) * 0.1; }
  }
}

// ---------------- cofre ----------------
export class Chest extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.mesh = P.buildChest({ big: data.big });
    outlineAll(this.mesh, 0.035);
    this.root.add(this.mesh);
    this.root.rotation.y = data.facing || 0;
    this.opened = game.progress.flags.has(`chest_${this.id}`);
    this.mapColor = this.opened ? null : '#ffd34d';
    if (this.opened) this.mesh.userData.lid.rotation.x = -1.9;
    const s = data.big ? 1.4 : 1;
    this.collider = game.zone.collision.addBox(this.x, this.z, 1.5 * s, 1.5 * s, { tall: false, tag: 'chest' });
    this.radius = data.big ? 4.6 : 4.2; // se puede abrir desde la casilla de al lado
    this.openT = -1;
    this.updateVisibility();
  }
  updateVisibility() {
    // un cofre con requisito (p. ej. derrotar al jefe) aparece cuando se cumple
    const ok = this.game.progress.check(this.data.requires);
    if (ok && !this.visible) this.game.particles.sparkle(this.x, this.y, this.z, { count: 50, radius: 1.5 });
    this.visible = ok;
    this.root.visible = ok;
    this.collider.enabled = ok;
  }
  get prompt() { return this.visible && !this.opened ? 'Abrir cofre' : null; }
  interact() {
    if (this.opened || !this.visible) return;
    this.opened = true;
    this.mapColor = null;
    this.openT = 0;
    const g = this.game;
    g.progress.flags.add(`chest_${this.id}`);
    if (this.data.flag) g.progress.flags.add(this.data.flag);
    g.audio.sfx('chest');
    g.particles.sparkle(this.x, this.y + 0.8, this.z, { count: 50 });
    setTimeout(() => g.giveItem(this.data.item, this.data.count || 1, { fanfare: true }), 450);
    if (this.data.secret) setTimeout(() => g.audio.sfx('secret'), 100);
  }
  update(dt) {
    if (!this.visible) { if (this.data.requires) this.updateVisibility(); return; }
    if (this.openT >= 0 && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 2.5);
      this.mesh.userData.lid.rotation.x = -1.9 * (1 - Math.pow(1 - this.openT, 3));
      if (Math.random() < 0.6) this.game.particles.spawn(this.x + (Math.random() - 0.5), this.y + 1, this.z + (Math.random() - 0.5), { vy: 3, color: 0xfff1a0, life: 0.8, gravity: -1, size: 0.6 });
    }
  }
}

// ---------------- puerta ----------------
export class Door extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    const span = data.span || 1;
    const width = span * TILE;
    const keyColor = data.requires?.item ? ITEMS[data.requires.item].color : 0xc9a227;
    this.mesh = P.buildGate({ width, color: keyColor, style: data.style || 'wood' });
    outlineAll(this.mesh, 0.04);
    this.root.add(this.mesh);
    this.open = game.progress.flags.has(`opened_${this.id}`);
    this.collider = game.zone.collision.addBox(this.x, this.z, width, TILE * 0.5, { tall: true, tag: 'door', height: 4.5 });
    this.radius = 3.6;
    this.mapColor = this.open ? null : '#ff9f1c';
    this.anim = this.open ? 1 : 0;
    this.applyAnim();
  }
  get prompt() {
    if (this.open) return null;
    if (this.data.auto && this.game.progress.check(this.data.requires)) return null;
    return this.game.progress.check(this.data.requires) ? 'Abrir puerta' : 'Examinar puerta';
  }
  interact() {
    if (this.open) return;
    const g = this.game, req = this.data.requires;
    if (!g.progress.check(req)) {
      g.audio.sfx('locked');
      g.ui.openDialog('Puerta', [this.data.lockedText || 'Está cerrada.']);
      g.setMode('dialog');
      return;
    }
    if (req?.item && this.data.consume) g.progress.take(req.item);
    this.openDoor();
  }
  openDoor() {
    const g = this.game;
    this.open = true;
    this.mapColor = null;
    g.progress.flags.add(`opened_${this.id}`);
    g.audio.sfx('door');
    g.particles.puff(this.x, this.y + 0.5, this.z, { color: 0xbba98a, count: 16, size: 2.5 });
    g.shake(0.25);
    g.save();
  }
  applyAnim() {
    this.mesh.userData.door.position.y = -this.anim * 4.2;
    this.mesh.userData.door.visible = this.anim < 0.99;
    this.collider.enabled = this.anim < 0.5;
  }
  update(dt) {
    // las puertas automáticas se abren solas al acercarse si se cumple su condición
    if (!this.open && this.data.auto && this.game.progress.check(this.data.requires)) {
      const p = this.game.player;
      if (Math.hypot(p.x - this.x, p.z - this.z) < 9) this.openDoor();
    }
    if (this.open && this.anim < 1) {
      this.anim = Math.min(1, this.anim + dt * (this.data.style === 'icewall' ? 0.45 : 0.8));
      this.applyAnim();
      if (this.data.style === 'icewall' && Math.random() < 0.8) {
        // vapor al derretirse
        this.game.particles.spawn(this.x + (Math.random() - 0.5) * 6, this.y + 1 + Math.random() * 3, this.z + (Math.random() - 0.5), { color: 0xffffff, size: 1.8, life: 1.2, gravity: -2, vy: 1, drag: 1 });
      }
    }
  }
}

// ---------------- cartel ----------------
export class Sign extends Base {
  constructor(game, data) {
    super(game, data);
    this.mesh = P.buildSign();
    outlineAll(this.mesh, 0.035);
    this.root.add(this.mesh);
    this.root.rotation.y = data.facing || 0;
    game.zone.collision.addCircle(this.x, this.z, 0.4);
    this.radius = 2.4;
  }
  get prompt() { return 'Leer cartel'; }
  interact() {
    this.game.ui.openDialog('Cartel', this.data.text.split('\n'));
    this.game.setMode('dialog');
  }
}

// ---------------- objeto recogible ----------------
export class Pickup extends Base {
  constructor(game, data, x, z) {
    super(game, data.tile ? data : { ...data, tile: [0, 0] });
    if (x != null) { this.x = x; this.z = z; this.y = game.zone.height(x, z); this.root.position.set(x, this.y, z); }
    this.id = data.id; // con id = persistente (no reaparece)
    this.item = data.item;
    const it = ITEMS[this.item];
    this.radius = 1.3;
    this.auto = true;
    let geo;
    if (this.item === 'heart') geo = new THREE.OctahedronGeometry(0.32, 0);
    else if (this.item.startsWith('coin')) geo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10).rotateX(Math.PI / 2);
    else if (this.item === 'wisp') geo = new THREE.IcosahedronGeometry(0.3, 1);
    else if (this.item === 'axe') geo = P.merge([P.part(new THREE.BoxGeometry(0.1, 1, 0.1), 0x8b5a2b, {}), P.part(new THREE.BoxGeometry(0.5, 0.35, 0.08), 0xbbbbbb, { x: 0.2, y: 0.4 })]);
    else geo = new THREE.IcosahedronGeometry(0.3, 0);
    const glowColor = new THREE.Color(it.color).multiplyScalar(this.item === 'wisp' ? 2.6 : 1.25);
    const mat = this.item === 'axe' ? P.toonMat() : new THREE.MeshBasicMaterial({ color: glowColor, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.root.add(this.mesh);
    this.mapColor = data.id ? '#9fffd0' : null;
    this.t = Math.random() * 6;
    this.life = data.id ? Infinity : 14; // las monedas soltadas desaparecen
    this.vy = x != null ? 5 : 0;
    this.hop = x != null ? 0.01 : 0;
    if (this.item === 'wisp') { this.light = true; }
  }
  update(dt) {
    this.t += dt;
    this.life -= dt;
    if (this.vy || this.hop > 0) {
      this.hop += this.vy * dt; this.vy -= 18 * dt;
      if (this.hop <= 0) { this.hop = 0; this.vy = 0; }
    }
    const baseY = this.item === 'wisp' ? 1.4 : 0.6;
    this.mesh.position.y = baseY + this.hop + Math.sin(this.t * 3) * 0.15;
    this.mesh.rotation.y = this.t * 2.5;
    this.root.visible = this.life > 3 || Math.floor(this.life * 8) % 2 === 0;
    if (this.item === 'wisp' && Math.random() < dt * 6) this.game.particles.spawn(this.x, this.y + this.mesh.position.y, this.z, { color: 0x9fffd0, size: 0.5, life: 0.9, gravity: -0.5, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
    // recogida al tocar
    const p = this.game.player;
    if (Math.hypot(p.x - this.x, p.z - this.z) < this.radius) this.collect();
    else if (this.life <= 0) this.removed = true;
  }
  collect() {
    const g = this.game;
    this.removed = true;
    if (this.id) g.progress.flags.add(`picked_${this.id}`);
    const it = ITEMS[this.item];
    const special = it.kind === 'quest' || it.kind === 'key' || it.kind === 'upgrade';
    g.giveItem(this.item, 1, { fanfare: special });
    g.particles.sparkle(this.x, this.y + 0.6, this.z, { color: it.color, count: special ? 30 : 10, life: 0.7 });
  }
}

// ---------------- muñeco de entrenamiento ----------------
export class Dummy extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.mesh = P.buildDummy();
    outlineAll(this.mesh, 0.035);
    this.root.add(this.mesh);
    game.zone.collision.addCircle(this.x, this.z, 0.5);
    this.wobble = 0;
    this.done = game.progress.flags.has(`dummy_${this.id}`);
    this.mapColor = this.done ? null : '#ffd34d';
  }
  hit() {
    this.wobble = 1;
    const g = this.game;
    if (!this.done) {
      this.done = true;
      this.mapColor = null;
      g.progress.flags.add(`dummy_${this.id}`);
      const n = g.dummies.filter((d) => d.done).length;
      if (n >= g.dummies.length) {
        if (!g.progress.flags.has('dummies_done')) {
          g.progress.flags.add('dummies_done');
          g.audio.sfx('quest');
          g.ui.toast('¡Entrenamiento completado! Vuelve con el Anciano Bruno.');
        }
      } else g.ui.toast(`Muñecos golpeados: ${n}/${g.dummies.length}`);
    }
  }
  update(dt) {
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 1.5);
      this.mesh.rotation.z = Math.sin(this.wobble * 20) * this.wobble * 0.35;
    }
  }
}

// ---------------- portal ----------------
export class Portal extends Base {
  constructor(game, data) {
    super(game, data);
    this.mesh = P.buildPortal(game.zone.palette);
    outlineAll(this.mesh, 0.04);
    this.root.add(this.mesh);
    this.radius = 2.2;
    this.width = (data.span || 1) * TILE;
  }
  update() {
    const g = this.game, p = g.player;
    this.mesh.userData.glow.material.opacity = 0.18 + Math.sin(g.time * 3) * 0.08;
    if (Math.abs(p.x - this.x) < this.width / 2 && Math.abs(p.z - this.z) < 2.2 && g.mode === 'play' && !g.transitioning) {
      g.usePortal(this.data);
    }
  }
}

// ---------------- puzles de hielo ----------------
const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Bloque de hielo que se empuja caminando contra él; sobre el hielo se desliza. */
export class IceBlock extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.kind = 'iceblock';
    this.group = data.group;
    this.home = [Math.round(data.tile[0]), Math.round(data.tile[1])];
    this.tile = [...this.home];
    this.mesh = P.buildIceBlock();
    outlineAll(this.mesh, 0.05);
    this.root.add(this.mesh);
    this.collider = game.zone.collision.addBox(this.x, this.z, TILE * 0.88, TILE * 0.88, { tall: true, height: 3.2, tag: 'iceblock' });
    this.pushT = 0;
    this.moving = null; // { dir, to }
    this.locked = false; // sobre su placa: ya no se mueve
    this.mapColor = '#bfefff';
  }

  setTile(c, r) {
    this.tile = [c, r];
    const [x, z] = this.game.zone.tileToWorld(c, r);
    this.x = x; this.z = z;
    this.updateCollider();
  }

  updateCollider() {
    const h = TILE * 0.44;
    Object.assign(this.collider, { minX: this.x - h, maxX: this.x + h, minZ: this.z - h, maxZ: this.z + h });
    this.y = this.game.zone.height(this.x, this.z);
    this.root.position.set(this.x, this.y, this.z);
  }

  /** ¿Puede el bloque ocupar la casilla? (sin muros, otros objetos ni el jugador) */
  canEnter(c, r) {
    const zone = this.game.zone, col = zone.collision;
    const s = col.getSolid(c, r);
    if (s) return false;
    const [x, z] = col.tileCenter(c, r);
    for (const o of col.colliders) {
      if (!o.enabled || o === this.collider) continue;
      if (o.type === 'box' && x > o.minX - 0.5 && x < o.maxX + 0.5 && z > o.minZ - 0.5 && z < o.maxZ + 0.5) return false;
      if (o.type === 'circle' && Math.hypot(x - o.x, z - o.z) < o.r + 1.2) return false;
    }
    const p = this.game.player;
    if (Math.abs(p.x - x) < TILE * 0.5 + p.radius && Math.abs(p.z - z) < TILE * 0.5 + p.radius) return false;
    return true;
  }

  push(dc, dr) {
    const [c, r] = this.tile;
    if (!this.canEnter(c + dc, r + dr)) { this.game.audio.sfx('locked'); return; }
    this.moving = { dir: [dc, dr], to: [c + dc, r + dr] };
    this.game.audio.sfx('door');
  }

  reset() {
    if (this.locked) return;
    this.moving = null;
    this.setTile(...this.home);
    this.game.particles.puff(this.x, this.y + 1, this.z, { color: 0xcff6ff, count: 14, size: 2.4 });
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.moving) {
      const [tc, tr] = this.moving.to;
      const [tx, tz] = g.zone.tileToWorld(tc, tr);
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      const step = 11 * dt;
      if (d <= step) {
        this.x = tx; this.z = tz; this.tile = [tc, tr];
        const [dc, dr] = this.moving.dir;
        if (g.zone.isIceTile(tc, tr) && this.canEnter(tc + dc, tr + dr)) this.moving.to = [tc + dc, tr + dr];
        else { this.moving = null; g.shake(0.15); g.particles.puff(this.x, this.y + 0.3, this.z, { color: 0xe8fbff, count: 8, size: 2 }); }
      } else {
        this.x += dx / d * step; this.z += dz / d * step;
        if (Math.random() < 0.5) g.particles.spawn(this.x, this.y + 0.1, this.z, { color: 0xe8fbff, size: 0.8, life: 0.5, vy: 1.5, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3 });
      }
      this.updateCollider();
      return;
    }
    if (this.locked || p.state !== 'normal' || p.slide) { this.pushT = 0; return; }
    // empuje: jugador pegado a una cara del bloque y caminando hacia él
    const id = p.inputDir;
    let pushing = null;
    if (id && id.mag > 0.4) {
      for (const [dc, dr] of CARDINALS) {
        const along = dc ? (this.x - p.x) * dc : (this.z - p.z) * dr;
        const across = dc ? Math.abs(this.z - p.z) : Math.abs(this.x - p.x);
        const dot = id.x * dc + id.z * dr;
        // desde la casilla contigua (sobre hielo el jugador se queda en el centro de la casilla)
        if (along > 0 && along < TILE + 0.3 && across < 1.4 && dot > 0.75) pushing = [dc, dr];
      }
    }
    if (pushing && this.pushDir && pushing[0] === this.pushDir[0] && pushing[1] === this.pushDir[1]) {
      this.pushT += dt;
      if (this.pushT > 0.35) { this.pushT = 0; this.push(...pushing); }
    } else { this.pushT = 0; this.pushDir = pushing; }
  }
}

/** Placa de presión: se activa con un bloque de hielo encima. */
export class Plate extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.kind = 'plate';
    this.tileRC = [Math.round(data.tile[0]), Math.round(data.tile[1])];
    this.mesh = P.buildPlate();
    this.root.add(this.mesh);
    this.pressed = game.progress.flags.has(data.flag);
    this.mapColor = this.pressed ? null : '#7fdcff';
    this.applyLook();
  }
  applyLook() {
    const u = this.mesh.userData;
    u.top.position.y = this.pressed ? 0.12 : 0.28;
    u.top.material.emissive.set(this.pressed ? 0x2a7fa8 : 0x000000);
  }
  update() {
    if (this.pressed) return;
    const g = this.game;
    const block = g.interactables.find((i) => i instanceof IceBlock && !i.moving && i.tile[0] === this.tileRC[0] && i.tile[1] === this.tileRC[1]);
    if (!block) {
      this.mesh.userData.rune.material.color.setRGB(0.6, 1.2, 1.8).multiplyScalar(0.7 + Math.sin(g.time * 3) * 0.3);
      return;
    }
    this.pressed = true;
    block.locked = true;
    this.mapColor = null;
    g.progress.flags.add(this.data.flag);
    g.audio.sfx('secret');
    g.ui.toast(this.data.text || '¡Algo se ha abierto a lo lejos!');
    g.particles.sparkle(this.x, this.y + 0.5, this.z, { color: 0x9ff3ff, count: 50, radius: 2 });
    g.shake(0.3);
    this.applyLook();
    g.save();
  }
}

/** Piedra rúnica: devuelve los bloques de su grupo a la posición inicial. */
export class ResetStone extends Base {
  constructor(game, data) {
    super(game, data);
    this.kind = 'resetstone';
    this.mesh = P.buildRuneStone();
    outlineAll(this.mesh, 0.04);
    this.root.add(this.mesh);
    this.root.rotation.y = data.facing || 0;
    game.zone.collision.addCircle(this.x, this.z, 0.7);
    this.radius = 2.6;
  }
  get prompt() { return 'Tocar la piedra rúnica (reiniciar bloques)'; }
  interact() {
    const g = this.game;
    const blocks = g.interactables.filter((i) => i instanceof IceBlock && i.group === this.data.group);
    if (blocks.every((b) => b.locked)) { g.ui.toast('La piedra ya no reacciona.'); return; }
    blocks.forEach((b) => b.reset());
    g.audio.sfx('secret');
    g.ui.toast('Los bloques vuelven a su sitio.');
  }
}

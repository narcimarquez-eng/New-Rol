// Enemigos con IA de estados: patrulla -> persecución (si te ven) -> ataque
// (con anticipación visible) -> recuperación. Incluye el mini-jefe Rey Trasgo
// con dos fases. Los modelos se generan por código.
import * as THREE from 'three';
import { ENEMIES } from '../data/enemies.js';
import { CharacterModel } from './CharacterModel.js';
import { part, merge } from '../world/Props.js';
import { clamp, dampAngle, angleDiff } from '../core/utils.js';

let grad = null;
function gradient() {
  if (grad) return grad;
  grad = new THREE.DataTexture(new Uint8Array([100, 100, 100, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  return grad;
}
const newMat = () => { const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient() }); m.emissive = new THREE.Color(0); return m; };

// ---------------- modelos ----------------
function slimeModel(color) {
  const mat = newMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  const c = new THREE.Color(color);
  const blob = new THREE.Mesh(merge([
    part(new THREE.IcosahedronGeometry(0.8, 1), c.getHex(), { y: 0.62, sy: 0.75 }),
    part(new THREE.IcosahedronGeometry(0.3, 0), c.clone().offsetHSL(0, 0, 0.15).getHex(), { x: -0.25, y: 1.0, z: 0.2, sy: 0.6 }),
    part(new THREE.BoxGeometry(0.16, 0.24, 0.08), 0x111111, { x: -0.22, y: 0.75, z: 0.68 }),
    part(new THREE.BoxGeometry(0.16, 0.24, 0.08), 0x111111, { x: 0.22, y: 0.75, z: 0.68 }),
    part(new THREE.BoxGeometry(0.06, 0.08, 0.06), 0xffffff, { x: -0.2, y: 0.82, z: 0.72 }),
    part(new THREE.BoxGeometry(0.06, 0.08, 0.06), 0xffffff, { x: 0.24, y: 0.82, z: 0.72 }),
  ]), mat);
  blob.castShadow = true;
  body.add(blob);
  root.add(body);
  return { root, body, mat };
}

function batModel(color) {
  const mat = newMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(new THREE.Mesh(merge([
    part(new THREE.IcosahedronGeometry(0.4, 0), color, {}),
    part(new THREE.ConeGeometry(0.1, 0.3, 4), color, { x: -0.2, y: 0.4 }),
    part(new THREE.ConeGeometry(0.1, 0.3, 4), color, { x: 0.2, y: 0.4 }),
    part(new THREE.BoxGeometry(0.1, 0.1, 0.05), 0xffe14d, { x: -0.13, y: 0.08, z: 0.36 }),
    part(new THREE.BoxGeometry(0.1, 0.1, 0.05), 0xffe14d, { x: 0.13, y: 0.08, z: 0.36 }),
  ]), mat));
  const wingGeo = merge([part(new THREE.BoxGeometry(0.9, 0.05, 0.5), new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex(), { x: 0.5 })]);
  const wl = new THREE.Mesh(wingGeo, mat); const wr = new THREE.Mesh(wingGeo, mat);
  const pl = new THREE.Group(); pl.position.x = -0.25; pl.rotation.y = Math.PI; pl.add(wl);
  const pr = new THREE.Group(); pr.position.x = 0.25; pr.add(wr);
  body.add(pl, pr);
  body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(body);
  return { root, body, mat, wings: [pl, pr] };
}

function plantModel(color) {
  const mat = newMat();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(merge([
    part(new THREE.ConeGeometry(0.9, 0.5, 6), 0x2e7d32, { y: 0.25 }),
    part(new THREE.BoxGeometry(1.4, 0.06, 0.4), 0x43a047, { y: 0.15, ry: 0.5 }),
    part(new THREE.BoxGeometry(1.4, 0.06, 0.4), 0x43a047, { y: 0.15, ry: -0.9 }),
  ]), mat));
  const stalk = new THREE.Group(); stalk.position.y = 0.4;
  stalk.add(new THREE.Mesh(merge([part(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 5), 0x388e3c, { y: 0.6 })]), mat));
  const head = new THREE.Group(); head.position.y = 1.3; stalk.add(head);
  const top = new THREE.Mesh(merge([
    part(new THREE.SphereGeometry(0.5, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), color, {}),
    part(new THREE.ConeGeometry(0.06, 0.2, 3), 0xffffff, { x: -0.2, y: -0.05, z: 0.3, rx: Math.PI }),
    part(new THREE.ConeGeometry(0.06, 0.2, 3), 0xffffff, { x: 0.2, y: -0.05, z: 0.3, rx: Math.PI }),
    part(new THREE.IcosahedronGeometry(0.08, 0), 0xffffff, { x: 0.25, y: 0.3, z: 0.25 }),
    part(new THREE.IcosahedronGeometry(0.08, 0), 0xffffff, { x: -0.1, y: 0.4, z: -0.2 }),
  ]), mat);
  const bottom = new THREE.Mesh(merge([
    part(new THREE.SphereGeometry(0.45, 7, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xc2185b, {}),
    part(new THREE.ConeGeometry(0.06, 0.2, 3), 0xffffff, { x: 0, y: 0.05, z: 0.3 }),
  ]), mat);
  const jawTop = new THREE.Group(); jawTop.add(top);
  const jawBot = new THREE.Group(); jawBot.add(bottom);
  head.add(jawTop, jawBot);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body: stalk, mat, head, jawTop, jawBot };
}

function goblinModel(color, king = false) {
  const m = new CharacterModel({
    skin: king ? 0x8fbf4f : 0x9ccc65, tunic: color, belt: 0x3e2723, pants: 0x5d4037, boots: 0x3e2723,
    hair: 0x3e2723, hatStyle: 'horns', eyes: 0xff3b30, club: true, clubColor: king ? 0x5d4037 : 0x8b5a2b,
    scale: king ? 2.1 : 0.95,
  });
  if (king) {
    const crown = new THREE.Mesh(merge([
      part(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 8, 1, true), 0xffd34d, { y: 0.72 }),
      part(new THREE.ConeGeometry(0.07, 0.2, 4), 0xffd34d, { x: 0.25, y: 0.88 }),
      part(new THREE.ConeGeometry(0.07, 0.2, 4), 0xffd34d, { x: -0.25, y: 0.88 }),
      part(new THREE.ConeGeometry(0.07, 0.2, 4), 0xffd34d, { z: 0.25, y: 0.88 }),
      part(new THREE.IcosahedronGeometry(0.06, 0), 0xe63946, { z: 0.33, y: 0.74 }),
    ]), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient(), side: THREE.DoubleSide }));
    m.head.add(crown);
  }
  return m;
}

// ---------------- enemigo ----------------
export class Enemy {
  constructor(game, spawn, zoneData) {
    const def = ENEMIES[spawn.kind];
    if (!def) throw new Error(`Enemigo desconocido: ${spawn.kind}`);
    this.game = game;
    this.kind = spawn.kind;
    this.def = def;
    this.spawn = spawn;
    const diff = zoneData.difficulty || 1;
    this.maxHp = Math.round(def.hp * (def.boss ? 1 : diff));
    this.hp = this.maxHp;
    // la vida escala con la dificultad completa; el daño, a la mitad (más justo)
    this.dmg = Math.max(1, Math.round(def.dmg * (def.boss ? 1 : 1 + (diff - 1) * 0.5)));
    this.speed = def.speed * (def.boss ? 1 : 0.9 + diff * 0.1);
    this.radius = def.radius;
    this.alive = true;
    this.state = 'idle';
    this.stateT = Math.random() * 2;
    this.cool = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.vel = new THREE.Vector2();
    this.lastSeen = -99;
    this.phase = 1;

    const [x, z] = game.zone.tileToWorld(...spawn.tile);
    this.home = { x, z };
    this.pos = new THREE.Vector3(x, game.zone.height(x, z), z);
    this.patrolTarget = null;

    // modelo
    const tint = def.color;
    if (def.model === 'slime') { const m = slimeModel(tint); Object.assign(this, { root: m.root, body: m.body, mat: m.mat }); }
    else if (def.model === 'bat') { const m = batModel(tint); Object.assign(this, { root: m.root, body: m.body, mat: m.mat, wings: m.wings }); }
    else if (def.model === 'plant') { const m = plantModel(tint); Object.assign(this, { root: m.root, body: m.body, mat: m.mat, head: m.head, jawTop: m.jawTop, jawBot: m.jawBot }); }
    else {
      this.cm = goblinModel(tint, def.model === 'goblinKing');
      this.root = this.cm.root; this.mat = this.cm.material;
    }
    this.root.position.copy(this.pos);
    this.flashT = 0;
    this.flyY = def.flying ? 2.2 : 0;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  /** Golpe recibido desde el jugador. */
  hurt(dmg, fromX, fromZ) {
    if (!this.alive) return;
    this.hp -= dmg;
    const d = Math.hypot(this.pos.x - fromX, this.pos.z - fromZ) || 1;
    const k = this.def.knockback;
    this.vel.set((this.pos.x - fromX) / d * k, (this.pos.z - fromZ) / d * k);
    this.flash();
    this.lastSeen = this.game.time;
    if (this.hp <= 0) { this.die(); return; }
    if (!this.def.boss || this.state !== 'attack') { this.state = 'hurt'; this.stateT = 0; }
    if (this.def.boss && this.phase === 1 && this.hp <= this.maxHp / 2) this.enterPhase2();
  }

  enterPhase2() {
    this.phase = 2;
    this.speed *= 1.35;
    this.game.audio.sfx('boss');
    this.game.ui.toast('¡El Rey Trasgo se enfurece!');
    this.game.shake(0.6);
    this.game.particles.burst(this.pos.x, this.pos.y + 2, this.pos.z, { count: 40, color: 0xff4d2e, speed: 9, up: 5, life: 0.9 });
    if (this.cm) this.cm.material.color.setRGB(1.25, 0.8, 0.8);
    // invoca refuerzos
    for (const off of [[-4, 0], [4, 0]]) {
      const c = (this.pos.x + off[0] + this.game.zone.W * 2) / 4 - 0.5, r = (this.pos.z + off[1] + this.game.zone.H * 2) / 4 - 0.5;
      this.game.spawnEnemy({ kind: 'goblin', tile: [c, r], summoned: true });
    }
  }

  flash() { this.flashT = 0.2; }

  die() {
    this.alive = false;
    this.state = 'dead'; this.stateT = 0;
    this.game.onEnemyKilled(this);
  }

  canSee(player) {
    const d = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    if (d > this.def.sight) return false;
    return this.game.zone.collision.lineOfSight(this.pos.x, this.pos.z, player.x, player.z);
  }

  inArena(player) {
    const a = this.spawn.arena;
    if (!a) return true;
    const [x0, z0] = this.game.zone.tileToWorld(a[0] - 0.5, a[1] - 0.5);
    const [x1, z1] = this.game.zone.tileToWorld(a[2] + 0.5, a[3] + 0.5);
    return player.x > x0 && player.x < x1 && player.z > z0 && player.z < z1;
  }

  update(dt, player) {
    const g = this.game;
    this.stateT += dt;
    if (this.cool > 0) this.cool -= dt;

    if (this.state === 'dead') {
      // animación de muerte breve antes de desaparecer
      const k = this.stateT / 0.35;
      this.root.scale.setScalar(Math.max(0.01, 1 - k) * (this.cm ? this.cm.cfg.scale : 1));
      this.root.rotation.y += dt * 12;
      if (k >= 1) this.removed = true;
      return;
    }

    const dx = player.x - this.pos.x, dz = player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    const playerAlive = player.state !== 'dead';
    const sees = playerAlive && (this.def.boss ? this.inArena(player) : this.canSee(player));
    if (sees) this.lastSeen = g.time;
    const aggro = playerAlive && (g.time - this.lastSeen < (this.def.boss ? 99 : 3)) && dist < this.def.sight * 1.6;
    let moveSpeed = 0, moveDir = this.facing;

    switch (this.state) {
      case 'idle':
      case 'patrol': {
        if (aggro) { this.state = 'chase'; this.stateT = 0; if (!this.alerted) { this.alerted = true; this.alert(); } break; }
        if (this.def.stationary) break;
        if (!this.patrolTarget || this.stateT > 5) {
          this.stateT = 0;
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
          const tx = this.home.x + Math.cos(a) * r, tz = this.home.z + Math.sin(a) * r;
          this.patrolTarget = g.zone.collision.blocked(tx, tz, this.radius) ? null : { x: tx, z: tz };
          this.state = this.patrolTarget ? 'patrol' : 'idle';
        }
        if (this.state === 'patrol' && this.patrolTarget) {
          const px = this.patrolTarget.x - this.pos.x, pz = this.patrolTarget.z - this.pos.z;
          if (Math.hypot(px, pz) < 0.6) { this.patrolTarget = null; this.state = 'idle'; this.stateT = 3 + Math.random() * 2; }
          else { moveDir = Math.atan2(px, pz); moveSpeed = this.speed * 0.45; }
        }
        break;
      }
      case 'chase': {
        if (!aggro) { this.state = 'idle'; this.alerted = false; this.patrolTarget = { ...this.home }; this.state = 'patrol'; break; }
        moveDir = toPlayer;
        const range = this.def.attackRange + (this.phase === 2 ? 0.4 : 0);
        if (dist < range && this.cool <= 0) {
          this.state = 'windup'; this.stateT = 0;
          this.facing = toPlayer;
          if (this.def.boss && this.phase === 2 && Math.random() < 0.35) this.attackType = 'slam';
          else this.attackType = 'swing';
          g.audio.sfx('enemyAtk');
        } else if (this.def.boss && this.phase === 2 && dist > 7 && dist < 16 && this.cool <= 0 && Math.random() < dt * 0.8) {
          // embestida
          this.state = 'windup'; this.stateT = 0; this.attackType = 'charge'; this.facing = toPlayer;
          g.audio.sfx('enemyAtk');
        } else if (!this.def.stationary) {
          moveSpeed = dist > range * 0.8 ? this.speed : 0;
        }
        break;
      }
      case 'windup': {
        const wind = (this.def.windup || 0.3) * (this.attackType === 'charge' ? 1.3 : 1) * (this.phase === 2 ? 0.75 : 1);
        this.facing = dampAngle(this.facing, toPlayer, 6, dt);
        if (this.stateT >= wind) { this.state = 'attack'; this.stateT = 0; this.didHit = false; if (this.def.model === 'slime') g.audio.sfx('hop'); }
        break;
      }
      case 'attack': {
        const dur = this.attackType === 'charge' ? 0.7 : this.def.model === 'bat' ? 0.55 : 0.35;
        // movimientos de ataque específicos
        if (this.def.model === 'slime' || this.def.model === 'bat' || this.attackType === 'charge') {
          moveDir = this.facing;
          moveSpeed = this.attackType === 'charge' ? 16 : this.def.model === 'bat' ? 9 : 7;
        }
        if (!this.didHit && this.stateT > dur * 0.3) {
          if (this.attackType === 'slam') {
            this.didHit = true;
            g.combat.shockwave(this.pos.x + Math.sin(this.facing) * 2.5, this.pos.z + Math.cos(this.facing) * 2.5, 5, this.dmg, this);
          } else {
            const reach = this.def.attackRange + this.radius * 0.5 + 0.3;
            const ang = Math.abs(angleDiff(this.facing, toPlayer));
            if (dist < reach && (ang < 1.2 || dist < this.radius + 0.9)) {
              this.didHit = true;
              player.takeDamage(this.dmg, this.pos.x, this.pos.z, this.def.boss ? 12 : 7);
            }
          }
        }
        if (this.stateT >= dur) {
          this.state = 'recover'; this.stateT = 0;
          this.cool = this.def.cooldown * (this.phase === 2 ? 0.7 : 1) * (0.8 + Math.random() * 0.4);
        }
        break;
      }
      case 'recover':
        if (this.def.model === 'bat') { moveDir = toPlayer + Math.PI; moveSpeed = this.speed * 0.6; }
        if (this.stateT > 0.5) { this.state = aggro ? 'chase' : 'idle'; this.stateT = 0; }
        break;
      case 'hurt':
        if (this.stateT > 0.3) { this.state = 'chase'; this.stateT = 0; }
        break;
      default: break;
    }

    // orientación y desplazamiento
    if (moveSpeed > 0) {
      if (this.state !== 'attack') this.facing = dampAngle(this.facing, moveDir, 8, dt);
      this.move(Math.sin(moveDir) * moveSpeed * dt, Math.cos(moveDir) * moveSpeed * dt);
    }
    if (this.vel.lengthSq() > 0.01) {
      this.move(this.vel.x * dt, this.vel.y * dt);
      this.vel.multiplyScalar(Math.exp(-7 * dt));
    }
    // correa: no alejarse demasiado de casa
    if (!this.def.boss && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 28 && this.state === 'chase') {
      this.lastSeen = -99;
    }

    const ground = g.zone.height(this.pos.x, this.pos.z);
    this.pos.y = ground;
    this.animate(dt, moveSpeed, dist);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.mat.emissive.set(this.flashT > 0 ? 0xffffff : 0x000000);
      this.mat.emissiveIntensity = 0.9;
    } else if (this.state === 'windup') {
      // telegrafía del ataque: destello amarillo
      const on = Math.floor(this.stateT * 16) % 2 === 0;
      this.mat.emissive.set(on ? 0xffc040 : 0x000000);
      this.mat.emissiveIntensity = 0.5;
    } else this.mat.emissive.set(0x000000);
  }

  alert() {
    // signo de exclamación sobre la cabeza
    this.game.particles.spawn(this.pos.x, this.pos.y + (this.def.boss ? 5.5 : 2.6) + this.flyY, this.pos.z, { color: 0xffe14d, size: 2.2, life: 0.5, gravity: 0, vy: 1 });
    if (this.def.boss) { this.game.ui.showBoss(this); this.game.audio.sfx('boss'); }
  }

  move(mx, mz) {
    const col = this.game.zone.collision;
    const steps = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.3));
    for (let i = 0; i < steps; i++) {
      this.pos.x += mx / steps; this.pos.z += mz / steps;
      col.resolve(this.pos, this.radius);
    }
  }

  animate(dt, moveSpeed, dist) {
    const t = this.game.time + this.home.x;
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.root.rotation.y = this.facing;
    const m = this.def.model;
    if (m === 'slime') {
      let sq = 1 + Math.sin(t * 6) * 0.06, hop = 0;
      if (this.state === 'windup') sq = 0.7;
      if (this.state === 'attack') { hop = Math.sin(Math.min(1, this.stateT / 0.35) * Math.PI) * 1.2; sq = 1.25; }
      if (moveSpeed > 0 && this.state !== 'attack') { hop = Math.abs(Math.sin(t * 7)) * 0.4; }
      this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      this.body.position.y = hop;
    } else if (m === 'bat') {
      const flap = Math.sin(t * 22) * 0.8;
      this.wings[0].rotation.z = -flap; this.wings[1].rotation.z = flap;
      let y = this.flyY + Math.sin(t * 3) * 0.3;
      if (this.state === 'attack') y = THREE.MathUtils.lerp(this.flyY, 1.0, Math.sin(Math.min(1, this.stateT / 0.55) * Math.PI));
      this.body.position.y = y;
    } else if (m === 'plant') {
      const open = this.state === 'windup' ? 0.9 : this.state === 'attack' ? Math.max(0, 0.9 - this.stateT * 6) : 0.15 + Math.sin(t * 2) * 0.1;
      this.jawTop.rotation.x = -open; this.jawBot.rotation.x = open * 0.6;
      this.body.rotation.x = this.state === 'attack' ? 0.9 : this.state === 'windup' ? -0.4 : Math.sin(t * 1.5) * 0.1;
      this.body.rotation.z = Math.sin(t * 1.2) * 0.1;
    } else if (this.cm) {
      let attack = null;
      if (this.state === 'windup') attack = { t: Math.min(0.25, this.stateT * 0.6), combo: 2 };
      if (this.state === 'attack') attack = { t: 0.25 + Math.min(0.75, this.stateT / 0.35), combo: 2 };
      this.cm.animate(dt, { speed: moveSpeed / 3, attack, hurt: this.state === 'hurt' });
    }
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.mat.dispose?.();
  }
}

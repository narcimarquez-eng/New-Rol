// Enemigos con IA de estados: patrulla -> persecución (si te ven) -> anticipación
// visible (destello amarillo) -> ataque -> recuperación.
// El tipo de ataque sale de los datos (def.ai): 'melee', 'hop', 'swoop', 'bite',
// 'lunge', 'ranged', 'boss' (Rey Trasgo) y 'golem' (Golem de Hielo).
import * as THREE from 'three';
import { ENEMIES } from '../data/enemies.js';
import { buildEnemyModel } from './EnemyModels.js';
import { dampAngle, angleDiff } from '../core/utils.js';
import { TILE } from '../world/tiles.js';

const DEFAULT_AI = { slime: 'hop', bat: 'swoop', plant: 'bite', goblin: 'melee', goblinKing: 'boss', wolf: 'lunge', spirit: 'ranged', golem: 'golem' };

export class Enemy {
  constructor(game, spawn, zoneData) {
    const def = ENEMIES[spawn.kind];
    if (!def) throw new Error(`Enemigo desconocido: ${spawn.kind}`);
    this.game = game;
    this.kind = spawn.kind;
    this.def = def;
    this.ai = def.ai || DEFAULT_AI[def.model] || 'melee';
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

    this.m = buildEnemyModel(def);
    this.root = this.m.root;
    this.mat = this.m.mat;
    this.cm = this.m.cm || null;
    this.body = this.m.body;
    this.root.position.copy(this.pos);
    this.flashT = 0;
    this.flyY = def.flying ? (def.flyHeight ?? 2.2) : 0;
    this.kk = this.m.kk || null; // modelo KayKit (esqueletos)
    // esqueletos enterrados: esperan en la arena y se levantan al acercarse el héroe
    if (def.dormant) {
      if (spawn.summoned) { this.state = 'awaken'; this.stateT = 0; }
      else { this.state = 'dormant'; this.dormant = true; }
    }
  }

  /** Brillo de todos los materiales (destello al recibir golpe / aviso de ataque). */
  setEmissive(hex, intensity) {
    const mats = this.kk ? this.kk.materials : [this.mat];
    for (const m of mats) { m.emissive.set(hex); m.emissiveIntensity = intensity; }
  }

  /** El esqueleto enterrado se levanta (invulnerable mientras tanto). */
  wake() {
    if (!this.dormant) return;
    this.dormant = false;
    this.state = 'awaken'; this.stateT = 0;
    const g = this.game;
    g.particles.burst(this.pos.x, this.pos.y + 0.3, this.pos.z, { count: 26, color: 0xd9b98a, speed: 4, up: 3, life: 0.9, size: 1.6 });
    g.audio.sfx('enemyAtk');
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }
  get scale() { return this.cm ? this.cm.cfg.scale : 1; }

  /** Golpe recibido desde el jugador. */
  hurt(dmg, fromX, fromZ, { heavy = false } = {}) {
    if (!this.alive) return 'ignored';
    if (this.dormant) { this.wake(); return 'ignored'; }
    if (this.state === 'awaken') return 'ignored';
    // escudo: para los golpes de frente salvo el remate del combo (rompe la guardia)
    if (this.def.shield && !heavy && !['windup', 'attack', 'hurt'].includes(this.state)) {
      const toSrc = Math.atan2(fromX - this.pos.x, fromZ - this.pos.z);
      if (Math.abs(angleDiff(this.facing, toSrc)) < 1.1 && Math.random() < this.def.shield) {
        this.state = 'block'; this.stateT = 0;
        this.facing = toSrc;
        return 'blocked';
      }
    }
    this.hp -= dmg;
    const d = Math.hypot(this.pos.x - fromX, this.pos.z - fromZ) || 1;
    const k = this.def.knockback;
    this.vel.set((this.pos.x - fromX) / d * k, (this.pos.z - fromZ) / d * k);
    this.flash();
    this.lastSeen = this.game.time;
    if (this.hp <= 0) { this.die(); return 'hit'; }
    if (!this.def.boss || this.state !== 'attack') { this.state = 'hurt'; this.stateT = 0; }
    if (this.def.boss && this.phase === 1 && this.hp <= this.maxHp / 2) this.enterPhase2();
    return 'hit';
  }

  enterPhase2() {
    const g = this.game;
    this.phase = 2;
    this.speed *= 1.35;
    g.audio.sfx('boss');
    g.ui.toast(this.def.phase2Text || `¡${this.def.name} se enfurece!`);
    g.shake(0.6);
    g.particles.burst(this.pos.x, this.pos.y + 2, this.pos.z, { count: 40, color: this.def.phase2Color ?? 0xff4d2e, speed: 9, up: 5, life: 0.9 });
    if (this.cm) this.cm.material.color.setRGB(1.25, 0.8, 0.8);
    else if (this.kk) for (const m of this.kk.materials) m.color.setRGB(1.25, 0.85, 0.75);
    else this.mat.color.setRGB(0.85, 1.05, 1.3);
    // invoca refuerzos a los lados
    const summon = this.def.summon || 'goblin';
    for (const off of [[-4, 0], [4, 0], [0, -4]].slice(0, this.def.summonCount || 2)) {
      const c = (this.pos.x + off[0] + g.zone.W * TILE / 2) / TILE - 0.5;
      const r = (this.pos.z + off[1] + g.zone.H * TILE / 2) / TILE - 0.5;
      if (!g.zone.collision.blocked(this.pos.x + off[0], this.pos.z + off[1], 0.7)) g.spawnEnemy({ kind: summon, tile: [c, r], summoned: true });
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
    // en plena tormenta de arena se ve la mitad de lejos
    if (d > this.def.sight * (1 - 0.5 * (this.game.storm?.level || 0))) return false;
    return this.game.zone.collision.lineOfSight(this.pos.x, this.pos.z, player.x, player.z);
  }

  inArena(player) {
    const a = this.spawn.arena;
    if (!a) return true;
    const [x0, z0] = this.game.zone.tileToWorld(a[0] - 0.5, a[1] - 0.5);
    const [x1, z1] = this.game.zone.tileToWorld(a[2] + 0.5, a[3] + 0.5);
    return player.x > x0 && player.x < x1 && player.z > z0 && player.z < z1;
  }

  /** Elige el ataque según la IA y la distancia. */
  chooseAttack(dist) {
    const ai = this.ai;
    if (ai === 'boss') {
      if (this.phase === 2 && dist > 7 && dist < 16 && Math.random() < 0.5) return 'charge';
      if (this.phase === 2 && dist < 6 && Math.random() < 0.35) return 'slam';
      return dist < this.def.attackRange + 0.4 ? 'swing' : null;
    }
    if (ai === 'golem') {
      if (dist > 7 && this.phase === 2) return 'throw';
      if (dist > 7) return null;
      return Math.random() < (this.phase === 2 ? 0.5 : 0.35) ? 'slam' : (dist < this.def.attackRange ? 'swing' : null);
    }
    if (ai === 'ranged') return dist < this.def.attackRange ? 'shoot' : null;
    return dist < this.def.attackRange ? 'swing' : null;
  }

  update(dt, player) {
    const g = this.game;
    this.stateT += dt;
    if (this.cool > 0) this.cool -= dt;

    if (this.state === 'dead') {
      if (this.kk) {
        // el esqueleto se desmorona y la arena se lo traga
        const k = this.stateT / 0.9;
        this.kk.animate(dt, { dead: Math.min(1, k) });
        if (k > 1) this.root.position.y = this.pos.y - (k - 1) * 1.5;
        if (k >= 1.8) this.removed = true;
        return;
      }
      const k = this.stateT / 0.35;
      this.root.scale.setScalar(Math.max(0.01, 1 - k) * this.scale);
      this.root.rotation.y += dt * 12;
      if (k >= 1) this.removed = true;
      return;
    }
    if (this.state === 'dormant') {
      const d = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
      if (d < (this.def.wake || 7) && player.state !== 'dead') this.wake();
      else { this.animate(dt, 0); return; }
    }
    if (this.state === 'awaken') {
      const T = this.def.awakenTime || 1.5;
      if (Math.random() < dt * 10) g.particles.spawn(this.pos.x + (Math.random() - 0.5) * 1.4, this.pos.y + 0.2, this.pos.z + (Math.random() - 0.5) * 1.4, { color: 0xd9b98a, size: 1.0, life: 0.6, gravity: 2, vy: 1.5 });
      this.facing = dampAngle(this.facing, Math.atan2(player.x - this.pos.x, player.z - this.pos.z), 3, dt);
      if (this.stateT >= T) { this.state = 'chase'; this.stateT = 0; this.lastSeen = g.time; this.alerted = true; }
      this.animate(dt, 0);
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
          this.patrolTarget = g.zone.collision.blocked(tx, tz, this.radius) || (g.zone.isIce && g.zone.isIceTile(...g.zone.collision.tileOf(tx, tz))) ? null : { x: tx, z: tz };
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
        if (!aggro) { this.alerted = false; this.patrolTarget = { ...this.home }; this.state = 'patrol'; break; }
        moveDir = toPlayer;
        const atk = this.cool <= 0 ? this.chooseAttack(dist) : null;
        if (atk && (this.ai !== 'ranged' || sees)) {
          this.state = 'windup'; this.stateT = 0;
          this.attackType = atk;
          this.facing = toPlayer;
          g.audio.sfx('enemyAtk');
        } else if (this.ai === 'ranged') {
          // mantener la distancia preferida
          const pref = this.def.preferDist || 8;
          if (dist < pref - 2) { moveDir = toPlayer + Math.PI; moveSpeed = this.speed; }
          else if (dist > pref + 1 || !sees) { moveSpeed = this.speed; }
          else { moveDir = toPlayer + Math.PI / 2 * Math.sign(Math.sin(g.time * 0.7 + this.home.x)); moveSpeed = this.speed * 0.5; }
          this.facing = dampAngle(this.facing, toPlayer, 6, dt);
        } else if (!this.def.stationary) {
          moveSpeed = dist > this.def.attackRange * 0.8 ? this.speed : 0;
        }
        break;
      }
      case 'windup': {
        const base = this.def.windup || 0.3;
        const wind = base * (this.attackType === 'charge' ? 1.3 : this.attackType === 'slam' ? 1.2 : 1) * (this.phase === 2 ? 0.75 : 1);
        this.facing = dampAngle(this.facing, toPlayer, 6, dt);
        if (this.stateT >= wind) {
          this.state = 'attack'; this.stateT = 0; this.didHit = false;
          if (this.ai === 'hop') g.audio.sfx('hop');
          if (this.attackType === 'shoot') this.shoot(player, false);
          if (this.attackType === 'throw') this.shoot(player, true);
        }
        break;
      }
      case 'attack': {
        const dur = this.attackType === 'charge' ? 0.7 : this.ai === 'swoop' ? 0.55 : this.ai === 'golem' ? 0.5 : 0.35;
        if (this.ai === 'hop' || this.ai === 'swoop' || this.ai === 'lunge' || this.attackType === 'charge') {
          moveDir = this.facing;
          moveSpeed = this.attackType === 'charge' ? 16 : this.ai === 'swoop' ? 9 : this.ai === 'lunge' ? 14 : 7;
        }
        if (!this.didHit && this.stateT > dur * 0.3 && this.attackType !== 'shoot' && this.attackType !== 'throw') {
          if (this.attackType === 'slam') {
            this.didHit = true;
            const reach = this.ai === 'golem' ? 2.2 : 2.5;
            g.combat.shockwave(this.pos.x + Math.sin(this.facing) * reach, this.pos.z + Math.cos(this.facing) * reach, this.ai === 'golem' ? 6 : 5, this.dmg, this);
          } else {
            const reach = this.def.attackRange + this.radius * 0.5 + 0.3;
            const ang = Math.abs(angleDiff(this.facing, toPlayer));
            if (dist < reach && (ang < 1.2 || dist < this.radius + 0.9)) {
              this.didHit = true;
              const r = player.takeDamage(this.dmg, this.pos.x, this.pos.z, this.def.boss ? 12 : 7);
              if (r === 'hit' && this.def.freeze) player.chill(this.def.freeze);
              if (r === 'hit' && this.def.poison) player.poison?.(this.def.poison);
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
        if (this.ai === 'swoop') { moveDir = toPlayer + Math.PI; moveSpeed = this.speed * 0.6; }
        if (this.stateT > (this.ai === 'golem' ? 0.8 : 0.5)) { this.state = aggro ? 'chase' : 'idle'; this.stateT = 0; }
        break;
      case 'hurt':
        if (this.stateT > 0.3) { this.state = 'chase'; this.stateT = 0; }
        break;
      case 'block':
        if (this.stateT > 0.45) { this.state = 'chase'; this.stateT = 0; this.cool = Math.min(this.cool, 0.15); }
        break;
      default: break;
    }

    if (moveSpeed > 0) {
      if (this.state !== 'attack') this.facing = dampAngle(this.facing, moveDir, 8, dt);
      this.move(Math.sin(moveDir) * moveSpeed * dt, Math.cos(moveDir) * moveSpeed * dt);
    }
    if (this.vel.lengthSq() > 0.01) {
      this.move(this.vel.x * dt, this.vel.y * dt);
      this.vel.multiplyScalar(Math.exp(-7 * dt));
    }
    if (!this.def.boss && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 28 && this.state === 'chase') this.lastSeen = -99;

    this.pos.y = g.zone.height(this.pos.x, this.pos.z);
    this.animate(dt, moveSpeed);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.setEmissive(this.flashT > 0 ? 0xffffff : 0x000000, 0.9);
    } else if (this.state === 'windup') {
      const on = Math.floor(this.stateT * 16) % 2 === 0;
      this.setEmissive(on ? 0xffc040 : 0x000000, 0.5);
    } else this.setEmissive(0x000000, 0);
  }

  /** Dispara un proyectil (fragmento de hielo o roca lanzada en arco). */
  shoot(player, heavy) {
    const g = this.game;
    const sx = this.pos.x + Math.sin(this.facing) * (this.radius + 0.4);
    const sz = this.pos.z + Math.cos(this.facing) * (this.radius + 0.4);
    const sy = this.pos.y + (heavy ? 4 : (this.def.shootHeight ?? 1.2) + this.flyY);
    // apuntar con un poco de anticipación
    const lead = heavy ? 0.6 : 0.25;
    const tx = player.x + Math.sin(player.facing) * player.speedNorm * lead * 4;
    const tz = player.z + Math.cos(player.facing) * player.speedNorm * lead * 4;
    const d = Math.hypot(tx - sx, tz - sz) || 1;
    const p = this.def.projectile || {};
    if (heavy) {
      const t = Math.max(0.6, d / 14);
      g.projectiles.spawn({ x: sx, y: sy, z: sz, vx: (tx - sx) / t, vz: (tz - sz) / t, vy: (g.zone.height(tx, tz) + 0.5 - sy + 0.5 * 18 * t * t) / t, gravity: 18, dmg: this.dmg, size: 0.9, color: 0xbfefff, heavy: true, src: this, freeze: 0 });
    } else {
      const sp = p.speed || 11;
      const n = p.burst || 1;
      // la tormenta de arena desvía los disparos
      const base = Math.atan2(tx - sx, tz - sz) + (Math.random() - 0.5) * 0.5 * (g.storm?.level || 0);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * (p.spread || 0.28);
        g.projectiles.spawn({ x: sx, y: sy, z: sz, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: 0, gravity: 0, dmg: this.dmg, size: p.size || 0.3, color: p.color || 0x9ff3ff, src: this, freeze: p.freeze || 0, arrow: !!p.arrow, poison: p.poison || 0 });
      }
    }
    g.audio.sfx('swing');
  }

  alert() {
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

  animate(dt, moveSpeed) {
    const t = this.game.time + this.home.x;
    const m = this.m;
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.root.rotation.y = this.facing;
    m.face?.blink(dt);
    const model = this.def.model;
    if (model === 'slime') {
      let sq = 1 + Math.sin(t * 6) * 0.06, hop = 0;
      if (this.state === 'windup') sq = 0.7;
      if (this.state === 'attack') { hop = Math.sin(Math.min(1, this.stateT / 0.35) * Math.PI) * 1.2; sq = 1.25; }
      if (moveSpeed > 0 && this.state !== 'attack') hop = Math.abs(Math.sin(t * 7)) * 0.4;
      this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      this.body.position.y = hop;
    } else if (model === 'bat') {
      const flap = Math.sin(t * 22) * 0.8;
      m.wings[0].rotation.z = -flap; m.wings[1].rotation.z = flap;
      let y = this.flyY + Math.sin(t * 3) * 0.3;
      if (this.state === 'attack') y = THREE.MathUtils.lerp(this.flyY, 1.0, Math.sin(Math.min(1, this.stateT / 0.55) * Math.PI));
      this.body.position.y = y;
    } else if (model === 'plant') {
      const open = this.state === 'windup' ? 0.9 : this.state === 'attack' ? Math.max(0, 0.9 - this.stateT * 6) : 0.15 + Math.sin(t * 2) * 0.1;
      m.jawTop.rotation.x = -open; m.jawBot.rotation.x = open * 0.6;
      this.body.rotation.x = this.state === 'attack' ? 0.9 : this.state === 'windup' ? -0.4 : Math.sin(t * 1.5) * 0.1;
      this.body.rotation.z = Math.sin(t * 1.2) * 0.1;
    } else if (model === 'wolf') {
      const run = moveSpeed > 0 ? Math.min(1, moveSpeed / 5) : 0;
      const ph = t * (6 + run * 8);
      m.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.6) * 0.8 * run; });
      this.body.position.y = 0.85 + Math.abs(Math.sin(ph)) * 0.12 * run;
      this.body.rotation.x = this.state === 'windup' ? 0.25 : this.state === 'attack' ? -0.2 : 0;
      if (this.state === 'windup') this.body.position.y = 0.65;
      m.tail.rotation.z = Math.sin(t * 8) * 0.3;
      m.head.rotation.x = this.state === 'windup' ? 0.3 : Math.sin(t * 2) * 0.05;
    } else if (model === 'spirit') {
      this.body.position.y = this.flyY + Math.sin(t * 2.2) * 0.25;
      this.body.rotation.z = Math.sin(t * 1.3) * 0.08;
      m.shards.children.forEach((s) => {
        const a = s.userData.a + t * (this.state === 'windup' ? 6 : 1.8);
        const r = this.state === 'windup' ? 0.55 : 0.8;
        s.position.set(Math.cos(a) * r, 0.3 + Math.sin(a * 2) * 0.15, Math.sin(a) * r);
        s.rotation.y = a;
      });
      if (Math.random() < dt * 6) this.game.particles.spawn(this.pos.x, this.pos.y + this.body.position.y - 0.6, this.pos.z, { color: 0xcff6ff, size: 0.5, life: 0.8, gravity: 0.5, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5) });
    } else if (model === 'golem') {
      const walk = moveSpeed > 0 ? 1 : 0;
      const ph = t * 3.2;
      m.legs[0].rotation.x = Math.sin(ph) * 0.4 * walk; m.legs[1].rotation.x = -Math.sin(ph) * 0.4 * walk;
      this.body.position.y = 2.3 + Math.abs(Math.cos(ph)) * 0.12 * walk;
      let al = Math.sin(ph) * 0.3 * walk, ar = -Math.sin(ph) * 0.3 * walk;
      if (this.state === 'windup') {
        const k = Math.min(1, this.stateT / 0.5);
        if (this.attackType === 'slam' || this.attackType === 'throw') { al = ar = -2.8 * k; }
        else ar = -1.8 * k;
      } else if (this.state === 'attack') {
        const k = Math.min(1, this.stateT / 0.2);
        if (this.attackType === 'slam') { al = ar = -2.8 + 3.6 * k; }
        else if (this.attackType === 'throw') { al = ar = -2.8 + 2.0 * k; }
        else ar = -1.8 + 2.6 * k;
      }
      m.armL.rotation.x = al; m.armR.rotation.x = ar;
      m.core.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
    } else if (model === 'scorpion') {
      const run = moveSpeed > 0 ? Math.min(1, moveSpeed / 4) : 0;
      const ph = t * (8 + run * 10);
      m.legs.forEach((l) => { l.rotation.y = Math.sin(ph + l.userData.i * 1.3 + (l.userData.sx > 0 ? Math.PI : 0)) * 0.35 * (run + 0.1); l.rotation.z = Math.abs(Math.cos(ph + l.userData.i)) * 0.15 * run * l.userData.sx; });
      // cola: curvada hacia delante; se tensa al preparar y golpea al atacar
      let curl = 0.55, strike = 0;
      if (this.state === 'windup') curl = 0.55 + Math.min(1, this.stateT / 0.4) * 0.25;
      if (this.state === 'attack') strike = Math.sin(Math.min(1, this.stateT / 0.35) * Math.PI);
      m.tail.forEach((seg, i) => { seg.rotation.x = -(curl + Math.sin(t * 3 + i) * 0.04) + (i > 1 ? strike * 0.5 : -strike * 0.2); });
      const open = this.state === 'windup' ? 0.5 : Math.sin(t * 4) * 0.1;
      m.claws.forEach((cl, i) => { cl.rotation.x = -open * 0.4; cl.rotation.y = (i ? -1 : 1) * (0.5 + open * 0.3); });
      this.body.position.y = 0.42 + Math.abs(Math.sin(ph)) * 0.03 * run;
    } else if (this.kk) {
      const c = this.def.clips || {};
      const st = { speed: moveSpeed / 7 };
      const clip = (this.attackType && c[this.attackType]) || c.attack || '1H_Melee_Attack_Chop';
      if (this.state === 'dormant') st.action = { name: c.dormant || 'Skeletons_Inactive_Floor_Pose', loop: true };
      else if (this.state === 'awaken') st.action = { name: c.awaken || 'Skeletons_Awaken_Floor', t: this.stateT / (this.def.awakenTime || 1.5) };
      else if (this.state === 'windup' && this.attackType !== 'charge') {
        const w = (this.def.windup || 0.3) * (this.attackType === 'slam' ? 1.2 : 1) * (this.phase === 2 ? 0.75 : 1);
        st.action = { name: clip, t: (c.windupSplit ?? 0.38) * Math.min(1, this.stateT / w) };
      } else if (this.state === 'windup' && this.attackType === 'charge') st.action = { name: c.taunt || 'Taunt', t: Math.min(1, this.stateT / 0.8) };
      else if (this.state === 'attack' && this.attackType !== 'charge') {
        const dur = this.ai === 'golem' ? 0.5 : 0.35;
        const k = c.windupSplit ?? 0.38;
        st.action = { name: clip, t: k + (1 - k) * Math.min(1, this.stateT / (this.attackType === 'slam' ? 0.5 : dur)) };
      } else if (this.state === 'attack' && this.attackType === 'charge') st.speed = 1.6;
      else if (this.state === 'recover' && this.attackType !== 'charge' && this.attackType) st.action = { name: clip, t: 1 };
      st.hurt = this.state === 'hurt';
      if (this.state === 'block') st.action = { name: 'Block_Hit', t: Math.min(1, this.stateT / 0.45) };
      this.kk.lookTarget = this.state === 'chase' || this.state === 'windup' ? (this._lt || (this._lt = new THREE.Vector3())).set(this.game.player.x, this.game.player.pos.y + 1.4, this.game.player.z) : null;
      this.kk.animate(dt, st);
    } else if (this.cm) {
      let attack = null;
      if (this.state === 'windup') attack = { t: Math.min(0.25, this.stateT * 0.6), combo: 2 };
      if (this.state === 'attack') attack = { t: 0.25 + Math.min(0.75, this.stateT / 0.35), combo: 2 };
      this.cm.animate(dt, { speed: moveSpeed / 3, attack, hurt: this.state === 'hurt' });
    }
  }

  dispose() {
    if (this.kk) { this.kk.dispose(); return; } // la geometría KayKit es compartida
    this.root.traverse((o) => { if (o.isMesh && o.name !== 'outline') o.geometry.dispose(); });
    this.mat.dispose?.();
  }
}

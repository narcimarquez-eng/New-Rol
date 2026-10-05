// Controlador del jugador: movimiento relativo a cámara, combate (combo de
// espada, bloqueo con escudo, voltereta con invulnerabilidad), vida y stamina.
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';
import { clamp, dampAngle, angleDiff } from '../core/utils.js';
import { TILE } from '../world/tiles.js';

const RADIUS = 0.5;
const SPEED = 7;
const SPRINT = 10.5;
const ATTACK_COST = 8;
const DODGE_COST = 22;
const SPRINT_COST = 14; // por segundo
const COMBO_TIMES = [0.42, 0.42, 0.58];
const SLIDE_SPEED = 10;

export class Player {
  constructor(game) {
    this.game = game;
    this.model = new CharacterModel({ sword: true, shield: true, face: 'hero', ears: 'pointy', eyes: '#2f6fd0', hatStyle: 'cap' });
    this.root = this.model.root;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2(); // velocidad de empuje (retroceso, voltereta)
    this.facing = 0; // 0 = mirando hacia -Z (norte)
    this.speedNorm = 0;
    this.radius = RADIUS;

    // estadísticas (la vida se mide en medios corazones)
    this.maxHp = 6; this.hp = 6;
    this.maxStamina = 100; this.stamina = 100;
    this.swordDamage = 1;
    this.staminaDelay = 0;

    this.state = 'normal'; // normal | attack | dodge | hurt | dead
    this.stateT = 0;
    this.combo = 0;
    this.queuedAttack = false;
    this.blocking = false;
    this.invuln = 0;
    this.hitSet = new Set();
    this.exhausted = false;
    this.trail = null;
    this.chillT = 0;
    this.slide = null; // deslizamiento sobre hielo { dir:[dc,dr], to:[c,r] }
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  place(x, z, facing = 0) {
    this.pos.set(x, this.game.zone.height(x, z), z);
    this.facing = facing;
    this.vel.set(0, 0);
    this.state = 'normal';
    this.slide = null;
    this.chillT = 0;
    this.root.position.copy(this.pos);
    this.root.rotation.y = facing;
  }

  setSwordGlow(on, color = 0x8fe3ff) {
    if (!this.model.weapon) return;
    if (on && !this.swordGlow) {
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.5, toneMapped: false }));
      glow.position.y = 0.74;
      this.model.weapon.add(glow);
      this.swordGlow = glow;
    } else if (on) this.swordGlow.material.color.set(color).multiplyScalar(1.6);
  }

  /** Congelación: ralentiza al jugador unos segundos. */
  chill(t) {
    this.chillT = Math.max(this.chillT, t);
    this.model.flash(0.4, 0x7fdcff);
    this.game.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, { count: 14, color: 0xcff6ff, speed: 3, up: 2, life: 0.6 });
  }

  /** Lógica de hielo: devuelve true si el deslizamiento controla el movimiento este frame. */
  updateIce(dt, dx, dz, mag) {
    const zone = this.game.zone;
    if (!zone.isIce) return false;
    const col = zone.collision;
    const [c, r] = col.tileOf(this.pos.x, this.pos.z);
    const onIce = zone.isIceTile(c, r);
    const passable = (cc, rr) => {
      const s = col.getSolid(cc, rr);
      if (s && s.kind === 'box') return false;
      const [x, z] = col.tileCenter(cc, rr);
      return !col.blocked(x, z, 0.45);
    };
    if (this.slide) {
      const [tc, tr] = this.slide.to;
      const [tx, tz] = col.tileCenter(tc, tr);
      const ddx = tx - this.pos.x, ddz = tz - this.pos.z;
      const d = Math.hypot(ddx, ddz);
      const step = SLIDE_SPEED * dt;
      if (d <= step) {
        this.pos.x = tx; this.pos.z = tz;
        const [dc, dr] = this.slide.dir;
        if (zone.isIceTile(tc, tr) && passable(tc + dc, tr + dr)) this.slide.to = [tc + dc, tr + dr];
        else { this.slide = null; if (Math.random() < 0.5) this.game.audio.sfx('dodge'); }
      } else {
        this.moveBy(ddx / d * step, ddz / d * step);
        if (Math.random() < dt * 30) this.game.particles.spawn(this.pos.x, this.pos.y + 0.1, this.pos.z, { color: 0xe8fbff, size: 0.6, life: 0.4, gravity: 1, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, vy: 1 });
        // si el empuje no avanza (bloqueado por algo dinámico), parar
        if (Math.hypot(this.pos.x - tx, this.pos.z - tz) > d - step * 0.3) this.slideStuck = (this.slideStuck || 0) + dt;
        else this.slideStuck = 0;
        if (this.slideStuck > 0.15) { this.slide = null; this.slideStuck = 0; }
      }
      this.speedNorm = 0.2;
      return true;
    }
    if (!onIce) return false;
    // sobre hielo y quieto: la entrada (o la inercia al entrar) inicia un deslizamiento en línea recta
    let ix = dx, iz = dz;
    if (mag < 0.3) {
      if (!this.iceEntryDir) return true; // quieto en el hielo
      [ix, iz] = this.iceEntryDir;
    }
    this.iceEntryDir = null;
    const horiz = Math.abs(ix) > Math.abs(iz);
    const dir = horiz ? [Math.sign(ix), 0] : [0, Math.sign(iz)];
    this.facing = Math.atan2(dir[0], dir[1]);
    const [cx, cz] = col.tileCenter(c, r);
    // alinear con el centro de la casilla en el eje perpendicular
    if (horiz) this.pos.z = cz; else this.pos.x = cx;
    if (passable(c + dir[0], r + dir[1])) this.slide = { dir, to: [c + dir[0], r + dir[1]] };
    else { this.pos.x = cx; this.pos.z = cz; }
    return true;
  }

  /** Dirección hacia delante según el ángulo de orientación. */
  forward(out = new THREE.Vector2()) { return out.set(Math.sin(this.facing), Math.cos(this.facing)); }

  update(dt, input, camYaw) {
    const g = this.game;
    this.stateT += dt;
    if (this.invuln > 0) this.invuln -= dt;

    // ---- stamina ----
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(this.maxStamina, this.stamina + (this.exhausted ? 22 : 34) * dt);
    if (this.exhausted && this.stamina >= this.maxStamina * 0.35) this.exhausted = false;

    if (this.state === 'dead') {
      this.model.animate(dt, { dead: Math.min(1, this.stateT * 2) });
      return;
    }

    // ---- entrada de movimiento relativa a la cámara ----
    const mv = input.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    // la cámara mira hacia (sin(yaw), cos(yaw)) invertido: delante = alejándose de la cámara
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = -fz, rz = fx;
    let dx = fx * mv.y + rx * mv.x, dz = fz * mv.y + rz * mv.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 0) { dx /= dl; dz /= dl; }

    this.blocking = this.state === 'normal' && input.isDown('block') && !this.exhausted;
    const sprinting = this.state === 'normal' && !this.blocking && input.isDown('run') && mag > 0.1 && this.stamina > 1 && !this.exhausted;

    // ---- acciones ----
    if (this.slide) { input.consume('attack'); input.consume('dodge'); }
    if (input.consume('attack') || (this.queuedAttack && this.state === 'normal')) {
      this.queuedAttack = false;
      if (this.state === 'attack' && this.stateT > COMBO_TIMES[this.combo] * 0.45 && this.combo < 2) {
        this.queuedAttack = true; // encadenar combo al terminar la fase de golpe
        this.comboNext = true;
      } else if (this.state === 'normal') {
        this.startAttack(0, dx, dz, mag);
      }
    }
    if (this.state === 'attack' && this.comboNext && this.stateT >= COMBO_TIMES[this.combo] * 0.62) {
      this.comboNext = false; this.queuedAttack = false;
      this.startAttack(this.combo + 1, dx, dz, mag);
    }
    if (input.consume('dodge') && (this.state === 'normal' || (this.state === 'attack' && this.stateT > 0.2))) {
      this.startDodge(dl > 0 && mag > 0.1 ? Math.atan2(dx, dz) : this.facing);
    }

    // ---- integración según estado ----
    let speed = 0;
    if (this.chillT > 0) {
      this.chillT -= dt;
      if (Math.random() < dt * 8) g.particles.spawn(this.pos.x + (Math.random() - 0.5), this.pos.y + 0.5 + Math.random(), this.pos.z + (Math.random() - 0.5), { color: 0xcff6ff, size: 0.5, life: 0.6, gravity: 1 });
    }
    const slow = this.chillT > 0 ? 0.55 : 1;
    if (this.state === 'normal' && this.updateIce(dt, dx, dz, mag)) {
      // el hielo controla el movimiento (sin atacar ni esquivar mientras se desliza)
      if (this.slide) this.queuedAttack = false;
    } else if (this.state === 'normal') {
      if (mag > 0.05) {
        speed = (sprinting ? SPRINT : SPEED) * mag * (this.blocking ? 0.4 : 1) * slow;
        if (!this.blocking) this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 14, dt);
        else this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 4, dt);
        this.moveBy(dx * speed * dt, dz * speed * dt);
        // al pisar hielo se conserva la dirección para iniciar el deslizamiento
        if (g.zone.isIce) {
          const [c, r] = g.zone.collision.tileOf(this.pos.x, this.pos.z);
          if (g.zone.isIceTile(c, r)) this.iceEntryDir = [dx, dz];
        }
      }
      if (sprinting) { this.useStamina(SPRINT_COST * dt, 0.3); }
    } else if (this.state === 'attack') {
      const dur = COMBO_TIMES[this.combo];
      // pequeño avance durante el golpe
      if (this.stateT > dur * 0.2 && this.stateT < dur * 0.5) {
        const f = this.forward();
        this.moveBy(f.x * 5 * dt, f.y * 5 * dt);
      }
      // ventana activa del golpe
      if (this.stateT > dur * 0.28 && this.stateT < dur * 0.62) {
        g.combat.playerSwing(this);
        const tip = this.model.weaponTip(this._tip || (this._tip = new THREE.Vector3()));
        if (tip) {
          const c = this.swordGlow ? 0x9fe7ff : 0xffffff;
          g.particles.spawn(tip.x, tip.y, tip.z, { color: c, size: 1.1, life: 0.16, gravity: 0, drag: 0 });
          g.particles.spawn((tip.x + this.pos.x) / 2, tip.y - 0.2, (tip.z + this.pos.z) / 2, { color: c, size: 0.7, life: 0.12, gravity: 0, drag: 0 });
        }
      }
      if (this.stateT >= dur) { this.state = 'normal'; this.stateT = 0; }
    } else if (this.state === 'dodge') {
      const k = 1 - this.stateT / 0.42;
      const s = 15 * Math.max(0.2, k) * (this.chillT > 0 ? 0.75 : 1);
      this.moveBy(Math.sin(this.rollDir) * s * dt, Math.cos(this.rollDir) * s * dt);
      this.facing = this.rollDir;
      if (this.stateT > 0.42) { this.state = 'normal'; this.stateT = 0; }
    } else if (this.state === 'hurt') {
      if (this.stateT > 0.35) { this.state = 'normal'; this.stateT = 0; }
    }

    // empuje residual (retroceso)
    if (this.vel.lengthSq() > 0.01) {
      this.moveBy(this.vel.x * dt, this.vel.y * dt);
      this.vel.multiplyScalar(Math.exp(-8 * dt));
    }

    this.speedNorm = THREE.MathUtils.lerp(this.speedNorm, speed / SPEED, 1 - Math.exp(-12 * dt));

    // ---- aplicar transformaciones y animar ----
    const ground = g.zone.height(this.pos.x, this.pos.z);
    this.pos.y = THREE.MathUtils.lerp(this.pos.y, ground, 1 - Math.exp(-20 * dt));
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    this.model.animate(dt, {
      speed: this.speedNorm,
      attack: this.state === 'attack' ? { t: this.stateT / COMBO_TIMES[this.combo], combo: this.combo } : null,
      block: this.blocking,
      roll: this.state === 'dodge' ? this.stateT / 0.42 : null,
      hurt: this.state === 'hurt',
    });
    // parpadeo durante la invulnerabilidad
    this.root.visible = !(this.invuln > 0 && this.state !== 'dodge' && Math.floor(this.invuln * 20) % 2 === 0);

    // polvo al correr
    if (this.speedNorm > 1.1 && Math.random() < dt * 10) g.particles.puff(this.pos.x, this.pos.y + 0.1, this.pos.z, { color: 0xe8dcc0, count: 1, size: 1.2, life: 0.4 });
  }

  startAttack(combo, dx, dz, mag) {
    if (this.stamina < ATTACK_COST * 0.5 || this.exhausted) { this.game.audio.sfx('stamina'); return; }
    // orientar el golpe hacia la entrada o hacia el enemigo más cercano (asistencia de apuntado)
    const target = this.game.combat.nearestEnemy(this.pos.x, this.pos.z, 4.5);
    if (target) this.facing = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    else if (mag > 0.2) this.facing = Math.atan2(dx, dz);
    this.state = 'attack'; this.stateT = 0; this.combo = combo;
    this.hitSet.clear();
    this.useStamina(ATTACK_COST, 0.5);
    this.game.audio.sfx('swing');
  }

  startDodge(dir) {
    if (this.stamina < DODGE_COST * 0.6 || this.exhausted) { this.game.audio.sfx('stamina'); return; }
    const z = this.game.zone;
    if (z.isIce && z.isIceTile(...z.collision.tileOf(this.pos.x, this.pos.z))) return; // en el hielo no hay agarre
    this.state = 'dodge'; this.stateT = 0; this.rollDir = dir;
    this.useStamina(DODGE_COST, 0.6);
    this.invuln = Math.max(this.invuln, 0.36);
    this.game.audio.sfx('dodge');
    this.game.particles.puff(this.pos.x, this.pos.y + 0.2, this.pos.z, { color: 0xe8dcc0, count: 6, size: 1.6 });
  }

  useStamina(n, delay) {
    this.stamina -= n;
    this.staminaDelay = Math.max(this.staminaDelay, delay);
    if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.staminaDelay = 1.0; }
  }

  /** Mueve con sub-pasos para no atravesar paredes a alta velocidad. */
  moveBy(mx, mz) {
    const col = this.game.zone.collision;
    const steps = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.25));
    for (let i = 0; i < steps; i++) {
      this.pos.x += mx / steps; this.pos.z += mz / steps;
      col.resolve(this.pos, RADIUS);
    }
  }

  /**
   * Recibe daño desde (fx,fz). Devuelve 'blocked' | 'hit' | 'ignored'.
   */
  takeDamage(dmg, fx, fz, knock = 6) {
    if (this.state === 'dead' || this.invuln > 0 || this.game.godMode) return 'ignored';
    const toSrc = Math.atan2(fx - this.pos.x, fz - this.pos.z);
    if (this.blocking && Math.abs(angleDiff(this.facing, toSrc)) < Math.PI * 0.42) {
      this.useStamina(12 + dmg * 4, 0.6);
      const d = Math.hypot(this.pos.x - fx, this.pos.z - fz) || 1;
      this.vel.set((this.pos.x - fx) / d * knock * 0.5, (this.pos.z - fz) / d * knock * 0.5);
      this.game.audio.sfx('block');
      const f = this.forward();
      this.game.particles.hit(this.pos.x + f.x * 0.7, this.pos.y + 1.3, this.pos.z + f.y * 0.7, 0xcfe8ff);
      if (this.exhausted) { this.blocking = false; this.state = 'hurt'; this.stateT = 0; } // guardia rota
      return 'blocked';
    }
    this.hp = clamp(this.hp - dmg, 0, this.maxHp);
    const d = Math.hypot(this.pos.x - fx, this.pos.z - fz) || 1;
    this.vel.set((this.pos.x - fx) / d * knock, (this.pos.z - fz) / d * knock);
    this.invuln = 1.0;
    this.model.flash(0.3);
    this.game.audio.sfx('hurt');
    this.game.particles.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, { count: 10, color: 0xff5050, speed: 4, life: 0.4 });
    this.game.shake(0.35);
    if (this.hp <= 0) { this.state = 'dead'; this.stateT = 0; this.game.onPlayerDeath(); }
    else { this.state = 'hurt'; this.stateT = 0; }
    this.game.events.emit('playerHurt', { hp: this.hp });
    return 'hit';
  }

  heal(n) { this.hp = clamp(this.hp + n, 0, this.maxHp); }
}

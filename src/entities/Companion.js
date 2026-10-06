// Compañero que acompaña al héroe: le sigue a un lado y un poco detrás, y
// cuando hay enemigos cerca del héroe se lanza a por ellos con sus propias
// animaciones de ataque. Los enemigos siguen centrados en el héroe, así que los
// compañeros no pueden caer: son apoyo, no una segunda vida.
import * as THREE from 'three';
import { KayKitModel } from './KayKitModel.js';
import { COMPANIONS } from '../data/companions.js';
import { dampAngle } from '../core/utils.js';

const RADIUS = 0.45;

export class Companion {
  constructor(game, id, index = 0) {
    const def = COMPANIONS[id];
    this.game = game;
    this.id = id;
    this.def = def;
    this.name = def.name;
    this.index = index;
    this.model = new KayKitModel(def.look);
    this.root = this.model.root;
    this.pos = new THREE.Vector3();
    this.facing = 0;
    this.state = 'follow'; // follow | attack
    this.stateT = 0;
    this.cool = 0;
    this.target = null;
    this.speedNorm = 0;
    this.combo = 0;
    this.chatT = 6 + Math.random() * 6;
    this.mapColor = def.mapColor;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  /** Coloca al compañero junto al héroe (al entrar en una zona o si se queda muy atrás). */
  placeNear(p) {
    const side = this.def.side ?? (this.index % 2 ? 1 : -1);
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const tryAt = (k) => {
      const x = p.x - fx * 1.6 * k + fz * side * 1.4 * k, z = p.z - fz * 1.6 * k - fx * side * 1.4 * k;
      return this.game.zone.collision.blocked(x, z, RADIUS) ? null : [x, z];
    };
    const at = tryAt(1) || tryAt(0.5) || [p.x, p.z];
    this.pos.set(at[0], this.game.zone.height(at[0], at[1]), at[1]);
    this.facing = p.facing;
    this.state = 'follow';
    this.root.position.copy(this.pos);
  }

  /** Enemigo al que atacar: el más cercano al héroe dentro de su zona de combate. */
  pickTarget() {
    const p = this.game.player;
    let best = null, bd = 12;
    for (const e of this.game.enemies) {
      if (!e.alive || e.state === 'dead') continue;
      if (e.def.flying && e.body?.position.y > 2.6) continue;
      if (e.dormant) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.stateT += dt;
    if (this.cool > 0) this.cool -= dt;
    const def = this.def;
    let speed = 0, moveDir = this.facing;

    // si se queda muy lejos (atajos, portales...), reaparece junto al héroe
    if (Math.hypot(p.x - this.x, p.z - this.z) > 26) this.placeNear(p);

    if (this.state === 'attack') {
      const T = def.attackTime;
      const e = this.target;
      if (e && e.alive) this.facing = dampAngle(this.facing, Math.atan2(e.x - this.x, e.z - this.z), 10, dt);
      if (!this.didHit && this.stateT > T * 0.45) {
        this.didHit = true;
        if (e && e.alive && Math.hypot(e.x - this.x, e.z - this.z) < def.range + e.radius + 0.6) {
          e.hurt(def.dmg, this.x, this.z);
          g.particles.hit((this.x + e.x) / 2, e.pos.y + 1, (this.z + e.z) / 2, 0xfff2a8);
          g.audio.sfx('hit');
        }
      }
      if (this.stateT >= T) { this.state = 'follow'; this.stateT = 0; this.cool = def.cooldown * (0.85 + Math.random() * 0.3); }
    } else {
      this.target = p.state === 'dead' ? null : this.pickTarget();
      const e = this.target;
      if (e) {
        const d = Math.hypot(e.x - this.x, e.z - this.z);
        moveDir = Math.atan2(e.x - this.x, e.z - this.z);
        if (d > def.range + e.radius) speed = def.speed;
        else if (this.cool <= 0) {
          this.state = 'attack'; this.stateT = 0; this.didHit = false;
          this.combo = (this.combo + 1) % def.attackClips.length;
          this.facing = moveDir;
          g.audio.sfx('swing');
        }
      } else {
        // seguir: a un lado y algo detrás del héroe
        const side = def.side ?? (this.index % 2 ? 1 : -1);
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
        const tx = p.x - fx * 1.8 + fz * side * 1.5, tz = p.z - fz * 1.8 - fx * side * 1.5;
        const d = Math.hypot(tx - this.x, tz - this.z);
        if (d > 0.6) {
          moveDir = Math.atan2(tx - this.x, tz - this.z);
          speed = Math.min(def.speed * 1.4, d * 3.2);
        } else this.facing = dampAngle(this.facing, p.facing, 3, dt);
      }
    }

    if (speed > 0) {
      this.facing = dampAngle(this.facing, moveDir, 10, dt);
      this.move(Math.sin(moveDir) * speed * dt, Math.cos(moveDir) * speed * dt);
    }
    // no pisar al héroe
    const dx = this.x - p.x, dz = this.z - p.z, dd = Math.hypot(dx, dz);
    if (dd > 0 && dd < 1.0) this.move(dx / dd * (1.0 - dd), dz / dd * (1.0 - dd));

    this.speedNorm = THREE.MathUtils.lerp(this.speedNorm, speed / 7, 1 - Math.exp(-10 * dt));
    this.pos.y = THREE.MathUtils.lerp(this.pos.y, g.zone.height(this.x, this.z), 1 - Math.exp(-20 * dt));
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;

    const m = this.model;
    if (this.target && this.target.alive) m.lookTarget = (this._look || (this._look = new THREE.Vector3())).set(this.target.x, this.target.pos.y + 1, this.target.z);
    else m.lookTarget = dd < 6 ? (this._lp || (this._lp = new THREE.Vector3())).set(p.x, p.pos.y + 1.5, p.z) : null;
    m.animate(dt, {
      speed: this.speedNorm,
      attack: this.state === 'attack' ? { t: this.stateT / def.attackTime, combo: this.combo, clips: def.attackClips } : null,
    });

    // comentarios de vez en cuando (solo fuera de combate)
    this.chatT -= dt;
    if (this.chatT <= 0) {
      this.chatT = 25 + Math.random() * 25;
      if (!this.target && g.mode === 'play') g.ui.toast(`${def.name}: ${def.lines[Math.floor(Math.random() * def.lines.length)]}`);
    }
  }

  move(mx, mz) {
    const col = this.game.zone.collision;
    const steps = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.25));
    for (let i = 0; i < steps; i++) {
      this.pos.x += mx / steps; this.pos.z += mz / steps;
      col.resolve(this.pos, RADIUS);
    }
  }

  dispose() { this.model.dispose(); }
}

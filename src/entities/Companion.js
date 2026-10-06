// Compañero que acompaña al héroe: se queda cerca de él sin estorbar (solo se
// pone en marcha cuando el héroe se aleja, así no da vueltas a su alrededor
// cada vez que éste gira) y cuando hay enemigos cerca del héroe se lanza a por
// ellos con sus propias animaciones de ataque. Los enemigos siguen centrados en el héroe, así que los
// compañeros no pueden caer: son apoyo, no una segunda vida.
import * as THREE from 'three';
import { KayKitModel } from './KayKitModel.js';
import { COMPANIONS } from '../data/companions.js';

const RADIUS = 0.45;
// distancias al héroe para seguirle: si se aleja más de FAR, camina hasta quedar
// a STOP; más cerca se queda quieto (si el héroe se le echa encima, se aparta sin girarse)
const STOP = 2.6, FAR = 4.4;
const MAX_TURN = 9; // giro máximo (rad/s): giros rápidos pero nunca instantáneos

/** Gira el ángulo a hacia b con amortiguación y velocidad máxima. */
function turnToward(a, b, lambda, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const step = d * (1 - Math.exp(-lambda * dt));
  const max = MAX_TURN * dt;
  return a + Math.max(-max, Math.min(max, step));
}

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
    this.moving = false; // en modo seguir: true mientras camina hacia el héroe
    this.turning = false; // en reposo: girándose hacia el héroe
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

  /**
   * Enemigo al que atacar: el más cercano al héroe dentro de su zona de combate.
   * Mantiene el objetivo actual mientras siga siendo válido (salvo que otro esté
   * claramente más cerca), para no ir y venir entre dos enemigos.
   */
  pickTarget() {
    const p = this.game.player;
    const valid = (e) => e.alive && e.state !== 'dead' && !e.dormant && !(e.def.flying && e.body?.position.y > 2.6);
    let best = null, bd = 12;
    for (const e of this.game.enemies) {
      if (!valid(e)) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    const cur = this.target;
    if (cur && valid(cur) && best !== cur) {
      const dc = Math.hypot(cur.x - p.x, cur.z - p.z);
      if (dc < 14 && dc < bd + 3) return cur;
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
      if (e && e.alive) this.facing = turnToward(this.facing, Math.atan2(e.x - this.x, e.z - this.z), 10, dt);
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
        // seguir: el punto de llegada está en la línea entre el héroe y el
        // compañero, así no depende de hacia dónde mira el héroe (no gira con él)
        const dx = this.x - p.x, dz = this.z - p.z, d = Math.hypot(dx, dz) || 1;
        if (!this.moving && d > FAR) this.moving = true;
        if (this.moving) {
          const tx = p.x + dx / d * STOP, tz = p.z + dz / d * STOP;
          const dt2 = Math.hypot(tx - this.x, tz - this.z);
          if (dt2 < 0.25 || d < STOP + 0.3) this.moving = false;
          else {
            moveDir = Math.atan2(tx - this.x, tz - this.z);
            // alcanza al héroe aunque corra; frena al llegar
            speed = Math.min(def.speed * 1.45, Math.max(2.2, dt2 * 2.6));
          }
        }
        if (!this.moving) {
          // en reposo: se gira hacia el héroe solo cuando éste queda bastante de lado
          const want = Math.atan2(-dx, -dz);
          const off = Math.abs(Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing)));
          if (off > 1.1 && d > 1.6) this.turning = true;
          if (this.turning) {
            this.facing = turnToward(this.facing, want, 3, dt);
            if (off < 0.15) this.turning = false;
          }
        }
      }
    }

    if (speed > 0) {
      this.turning = false;
      this.facing = turnToward(this.facing, moveDir, 10, dt);
      // primero se orienta y luego avanza: no camina de lado ni hacia atrás
      const align = Math.max(0, Math.cos(Math.atan2(Math.sin(moveDir - this.facing), Math.cos(moveDir - this.facing))));
      speed *= 0.25 + 0.75 * align;
      this.move(Math.sin(moveDir) * speed * dt, Math.cos(moveDir) * speed * dt);
    }
    // no amontonarse con los otros compañeros
    for (const o of g.companions) {
      if (o === this) continue;
      const ox = this.x - o.x, oz = this.z - o.z, od = Math.hypot(ox, oz);
      if (od > 0.001 && od < 1.7) this.move(ox / od * (1.7 - od) * 0.5, oz / od * (1.7 - od) * 0.5);
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

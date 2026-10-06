// Resolución de golpes: espada del jugador contra enemigos, muñecos y
// arbustos; ondas de choque del jefe; separación entre enemigos.
import { angleDiff } from '../core/utils.js';
import { TILE } from '../world/tiles.js';

const SWORD_RANGE = 2.5;
const SWORD_ARC = 1.15; // radianes a cada lado

export class Combat {
  constructor(game) { this.game = game; }

  /** Enemigo más cercano al que se puede golpear (no los enterrados ni los que aún se levantan). */
  nearestEnemy(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const e of this.game.enemies) {
      if (!e.alive || e.dormant || e.state === 'awaken') continue;
      const d = Math.hypot(e.x - x, e.z - z) - e.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** Comprueba la ventana activa de la espada (una vez por objetivo y golpe). */
  playerSwing(p) {
    const g = this.game;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const comboBonus = p.combo === 2 ? 1 : 0;
    const dmg = p.swordDamage + comboBonus;
    const inArc = (x, z, r = 0) => {
      const dx = x - p.x, dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d - r > SWORD_RANGE + (p.combo === 2 ? 0.4 : 0)) return false;
      if (d < r + 0.6) return true;
      return Math.abs(angleDiff(p.facing, Math.atan2(dx, dz))) < SWORD_ARC;
    };

    for (const e of g.enemies) {
      if (!e.alive || p.hitSet.has(e)) continue;
      if (e.def.flying && e.body.position.y > 2.6) continue; // demasiado alto
      if (!inArc(e.x, e.z, e.radius)) continue;
      p.hitSet.add(e);
      const res = e.hurt(dmg, p.x, p.z, { heavy: p.combo === 2 });
      if (res === 'ignored') continue;
      const hx = (p.x + e.x) / 2, hz = (p.z + e.z) / 2;
      if (res === 'blocked') {
        // el escudo enemigo para el golpe: chispas y rebote (el remate del combo rompe la guardia)
        g.particles.hit(hx, e.pos.y + 1.2, hz, 0xcfe8ff);
        g.audio.sfx('block');
        p.vel.set((p.x - e.x) * 2, (p.z - e.z) * 2);
        g.hitstop(0.03);
        continue;
      }
      g.particles.hit(hx, e.pos.y + 1 + (e.flyY || 0) * 0.6, hz, p.swordGlow ? 0x9fe7ff : 0xfff2a8);
      g.audio.sfx('hit');
      g.hitstop(e.def.boss ? 0.06 : 0.045);
      g.shake(0.12);
    }

    // la espada destruye proyectiles
    g.projectiles.slash((x, z, r) => inArc(x, z, r));

    for (const d of g.dummies) {
      if (p.hitSet.has(d) || !inArc(d.x, d.z, 0.5)) continue;
      p.hitSet.add(d);
      d.hit();
      g.particles.hit(d.x, 1.4 + d.y, d.z);
      g.audio.sfx('hit');
    }

    // arbustos cortables delante del jugador
    const zone = g.zone;
    const hx = p.x + fx * 1.6, hz = p.z + fz * 1.6;
    const [c0, r0] = zone.collision.tileOf(hx, hz);
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (!zone.bushIndex.has(`${c},${r}`)) continue;
      const [bx, bz] = zone.tileToWorld(c, r);
      if (!inArc(bx, bz, TILE * 0.45)) continue;
      if (zone.cutBush(c, r)) {
        g.particles.burst(bx, zone.height(bx, bz) + 0.8, bz, { count: 18, colors: [0x4caf50, 0x76d05a, 0x2e7d32], speed: 5, up: 4, life: 0.8, size: 1.2 });
        g.audio.sfx('bush');
        const roll = Math.random();
        if (roll < 0.35) g.spawnPickup('coin', bx, bz);
        else if (roll < 0.5) g.spawnPickup('heart', bx, bz);
        else if (roll < 0.53) g.spawnPickup('coin5', bx, bz);
      }
    }
  }

  /** Onda de choque circular (ataque de golpe al suelo del jefe). */
  shockwave(x, z, radius, dmg, src) {
    const g = this.game;
    g.shake(0.5);
    g.audio.sfx('kill');
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      g.particles.spawn(x + Math.cos(a) * 0.5, g.zone.height(x, z) + 0.3, z + Math.sin(a) * 0.5, { vx: Math.cos(a) * radius * 2.2, vz: Math.sin(a) * radius * 2.2, vy: 1.5, life: 0.45, size: 1.6, color: 0xd9b26f, gravity: 4, drag: 2 });
    }
    const p = g.player;
    if (Math.hypot(p.x - x, p.z - z) < radius) {
      const r = p.takeDamage(dmg, src.x, src.z, 11);
      if (r === 'hit' && src.def?.freeze) p.chill(src.def.freeze);
    }
  }

  /** Evita que los enemigos se amontonen entre sí y con el jugador. */
  separate() {
    const list = this.game.enemies;
    const p = this.game.player;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
          b.pos.x += dx / d * push; b.pos.z += dz / d * push;
        }
      }
      if (a.def.flying) continue;
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), min = a.radius + p.radius;
      if (d > 0 && d < min) {
        const push = min - d;
        p.pos.x += dx / d * push * 0.5; p.pos.z += dz / d * push * 0.5;
        a.pos.x -= dx / d * push * 0.5; a.pos.z -= dz / d * push * 0.5;
        this.game.zone.collision.resolve(p.pos, p.radius);
        this.game.zone.collision.resolve(a.pos, a.radius);
      }
    }
  }
}

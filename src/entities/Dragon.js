// Dragón de brasa (jefe de la fase 5): nace del volcán después de la elección con la Brasa
// Negra. Sale del suelo rompiendo la roca entre chorros de lava. Escupe fuego en un cono que
// se avisa antes (hay que apartarse), ataca de cerca con las garras y lanza bolas de lava
// que estallan en el suelo. Su piel de brasa no se hiere con la espada: hay que lanzarle
// cristales de hielo (tecla G) para congelarlo. Congelado no ataca, y entonces la espada sí le
// hace daño. Enemy.update le cede el turno (ver Enemy.js: ai === 'dragon').
import * as THREE from 'three';
import { dampAngle, angleDiff } from '../core/utils.js';

const EMERGE = 2.4;     // segundos que tarda en salir de la roca
const TELL = 1.1;       // aviso del cono de fuego (brasas que marcan el cono)
const BREATH = 2.2;     // duración del chorro de fuego
const WINDUP = 0.7;     // anticipación de un zarpazo
const STRIKE = 0.35;    // duración del zarpazo
const RECOVER = 0.8;    // pausa tras un ataque
const HURT_T = 0.35;    // aturdido tras un golpe
const BOMB_EVERY = 4.5; // cada cuánto lanza una bola de lava
const BOMB_DELAY = 1.1; // aviso antes de que la bola estalle
const BOMB_R = 2.4;     // radio de la explosión de lava
const BREATH_R = 11;    // alcance del fuego
const BREATH_CONE = 0.45; // semiángulo del cono de fuego (radianes)

const toward = (e, p) => Math.atan2(p.x - e.pos.x, p.z - e.pos.z);

/** Arena de la pelea en unidades del mundo (con medio tile de margen). */
function arenaBox(e) {
  const a = e.spawn.arena;
  if (!a) return null;
  const z = e.game.zone;
  const [x0, z0] = z.tileToWorld(a[0], a[1]);
  const [x1, z1] = z.tileToWorld(a[2], a[3]);
  return { x0: x0 - 2, z0: z0 - 2, x1: x1 + 2, z1: z1 + 2 };
}

const clampTo = (box, v, a, b) => (box ? Math.min(b, Math.max(a, v)) : v);

/** Mueve al dragón sin salirse de la arena. */
function moveBy(e, dx, dz) {
  e.move(dx, dz);
  const box = arenaBox(e);
  if (box) {
    e.pos.x = clampTo(box, e.pos.x, box.x0, box.x1);
    e.pos.z = clampTo(box, e.pos.z, box.z0, box.z1);
  }
}

/** Bola de lava: cae cerca del héroe, avisa con un círculo de brasas y estalla. */
function spawnBomb(e, p) {
  const box = arenaBox(e);
  const ox = (Math.random() - 0.5) * 2.4, oz = (Math.random() - 0.5) * 2.4;
  const x = clampTo(box, p.x + ox, box ? box.x0 + 2 : -Infinity, box ? box.x1 - 2 : Infinity);
  const z = clampTo(box, p.z + oz, box ? box.z0 + 2 : -Infinity, box ? box.z1 - 2 : Infinity);
  (e.bombs || (e.bombs = [])).push({ x, z, t: 0 });
}

function updateBombs(e, dt) {
  const g = e.game;
  e.bombs = (e.bombs || []).filter((b) => {
    b.t += dt;
    if (b.t < BOMB_DELAY) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        g.particles.spawn(b.x + Math.cos(a) * BOMB_R, g.zone.height(b.x, b.z) + 0.3, b.z + Math.sin(a) * BOMB_R,
          { color: 0xff5a1a, size: 0.5, life: 0.4, gravity: 0, vy: 0.6 });
      }
      return true;
    }
    g.combat.shockwave(b.x, b.z, BOMB_R, e.dmg, e);
    return false;
  });
}

/** Brasas que marcan el cono de fuego durante el aviso. */
function warnCone(e) {
  const g = e.game;
  for (let i = 0; i < 4; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const a = e.facing + side * BREATH_CONE * (0.7 + Math.random() * 0.3);
    const r = 3 + Math.random() * (BREATH_R - 3);
    g.particles.spawn(e.pos.x + Math.sin(a) * r, e.pos.y + 0.4, e.pos.z + Math.cos(a) * r,
      { color: 0xff3a1a, size: 0.35, life: 0.35, gravity: 0, vy: 0.5 });
  }
}

/** Chorro de fuego que sale de la boca. */
function fireFx(e) {
  const g = e.game;
  const mx = e.pos.x + Math.sin(e.facing) * 2.2, mz = e.pos.z + Math.cos(e.facing) * 2.2;
  for (let i = 0; i < 6; i++) {
    const a = e.facing + (Math.random() - 0.5) * 0.5;
    const v = 14 + Math.random() * 6;
    g.particles.spawn(mx, e.pos.y + 3.2, mz, {
      color: [0xff6a20, 0xffb040, 0xfff0a0][i % 3], size: 0.7 + Math.random() * 0.5, life: 0.55,
      gravity: 0.5, vx: Math.sin(a) * v, vz: Math.cos(a) * v, vy: 1 + Math.random(), drag: 0.6,
    });
  }
}

function frostFx(e) {
  e.game.particles.burst(e.pos.x, e.pos.y + 2.5, e.pos.z, { count: 26, colors: [0x9fe7ff, 0xffffff], speed: 3, up: 2, life: 0.9, size: 1.2 });
  e.game.audio.sfx('hit');
}

/** Una vez por frame: el dragón sigue su propia IA (Enemy.update le cede el turno). */
export function updateDragon(e, dt, p) {
  const g = e.game;
  const d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
  const toP = toward(e, p);
  e.frozenT = Math.max(0, (e.frozenT || 0) - dt);
  e.breathHit = Math.max(0, (e.breathHit || 0) - dt);
  e.lavaT = (e.lavaT ?? 3) - dt;
  if (e.lavaT <= 0 && e.state !== 'emerge' && e.frozenT <= 0) { e.lavaT = BOMB_EVERY; spawnBomb(e, p); }
  updateBombs(e, dt);

  const enter = (state) => {
    e.state = state; e.stateT = 0;
    if (state === 'tell' || state === 'claw') e.facing = toP;
  };
  let anim = { speed: 0 };

  if (e.state === 'emerge') {
    // sale de la roca: la tierra se rompe y brotan chorros de lava
    const k = Math.min(1, e.stateT / EMERGE);
    if (e.stateT < dt * 1.5) { g.shake(0.8); g.audio.sfx('boss'); }
    if (Math.random() < dt * 9) {
      g.particles.burst(e.pos.x + (Math.random() - 0.5) * 4, g.zone.height(e.pos.x, e.pos.z), e.pos.z + (Math.random() - 0.5) * 4,
        { count: 12, colors: [0x5a4a44, 0x3a302c, 0xff6a20], speed: 5, up: 5, life: 1, size: 1.4 });
    }
    e.body.position.y = -7 * (1 - k);
    anim = { speed: 0, action: { name: 'aleteo', loop: true } };
    if (k >= 1) { e.body.position.y = 0; enter('chase'); e.cool = 0.8; }
  } else if (e.frozenT > 0) {
    // congelado: no se mueve ni ataca; los golpes de espada le hacen daño ahora
    if (e.state !== 'frozen') { enter('frozen'); frostFx(e); }
    anim = { speed: 0 };
  } else if (e.state === 'frozen') {
    enter('recover');
  } else if (e.state === 'chase') {
    if (d < e.def.attackRange + 0.6 && e.cool <= 0) enter(Math.random() < 0.6 ? 'claw' : 'tell');
    else if (d < 15 && e.cool <= 0 && Math.random() < dt * 0.9) enter('tell');
    else {
      e.facing = dampAngle(e.facing, toP, 6, dt);
      const sp = e.speed;
      moveBy(e, (p.x - e.pos.x) / (d || 1) * sp * dt, (p.z - e.pos.z) / (d || 1) * sp * dt);
      anim = { speed: sp };
    }
  } else if (e.state === 'tell') {
    e.facing = dampAngle(e.facing, toP, 8, dt);
    warnCone(e);
    anim = { speed: 0, action: { name: 'ataque', t: 0.35 * Math.min(1, e.stateT / TELL) } };
    if (e.stateT >= TELL) enter('breath');
  } else if (e.state === 'breath') {
    e.facing = dampAngle(e.facing, toP, 1.6, dt); // sigue al héroe despacio mientras escupe
    fireFx(e);
    if (d < BREATH_R && Math.abs(angleDiff(e.facing, toP)) < BREATH_CONE && e.breathHit <= 0) {
      p.takeDamage(e.dmg, e.pos.x, e.pos.z, 6);
      e.breathHit = 0.5;
    }
    anim = { speed: 0, action: { name: 'ataque', t: 0.35 + 0.65 * Math.min(1, e.stateT / BREATH) } };
    if (e.stateT >= BREATH) { enter('recover'); e.cool = 1.2; }
  } else if (e.state === 'claw') {
    e.facing = dampAngle(e.facing, toP, 8, dt);
    anim = { speed: 0, action: { name: 'ataque', t: 0.35 * Math.min(1, e.stateT / WINDUP) } };
    if (e.stateT >= WINDUP) {
      if (d < e.def.attackRange + 0.9 && Math.abs(angleDiff(e.facing, toP)) < 1.1) p.takeDamage(e.dmg, e.pos.x, e.pos.z, 9);
      enter('strike');
    }
  } else if (e.state === 'strike') {
    anim = { speed: 0, action: { name: 'ataque', t: 0.35 + 0.65 * Math.min(1, e.stateT / STRIKE) } };
    if (e.stateT >= STRIKE) { enter('recover'); e.cool = 0.9; }
  } else if (e.state === 'recover') {
    if (e.stateT >= RECOVER) enter('chase');
  } else if (e.state === 'hurt') {
    anim = { speed: 0, hurt: true };
    if (e.stateT >= HURT_T) enter('chase');
  } else {
    enter('chase'); // estado desconocido: vuelve a perseguir
  }

  e.kk.lookTarget = (e._lt || (e._lt = new THREE.Vector3())).set(p.x, p.pos.y + 3, p.z);
  e.root.position.set(e.pos.x, e.pos.y, e.pos.z);
  e.root.rotation.y = e.facing;
  e.kk.animate(dt, anim);
}

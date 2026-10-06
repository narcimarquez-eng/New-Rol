// Acertijos mágicos (todos definidos con datos en las zonas):
//  - Braseros: hay que llevar fuego en la espada (de una llama a otra) y encender
//    todos los del grupo; los que tienen `duration` se apagan solos, así que hay
//    que encenderlos a tiempo. Al arder todos a la vez se activa la bandera.
//  - Rayo de sol: un ídolo solar dispara un rayo que viaja por casillas; los
//    espejos giratorios lo desvían 90°; los muros, bloques, puertas y barreras lo
//    cortan. Cuando llega al cristal solar se activa su bandera.
//  - Cristales de cambio: al golpearlos alternan las barreras rojas y azules.
//  - Runas: hay que pisar las losas en el orden grabado en la tablilla.
// (Los bloques de piedra son la clase IceBlock con estilo 'stone'.)
import * as THREE from 'three';
import { Base, IceBlock, Door, outlineAll } from './Interactables.js';
import * as PP from '../world/PuzzleProps.js';
import { TILE, tileInfo } from '../world/tiles.js';

const CARRY = 12; // segundos que la espada conserva el fuego
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

const tileOfEnt = (e) => [Math.round(e.data.tile[0]), Math.round(e.data.tile[1])];

// ------------------------------------------------------------------ braseros
export class Brazier extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.kind = 'brazier';
    this.eternal = !!data.eternal;
    this.mesh = PP.buildBrazier({ eternal: this.eternal });
    outlineAll(this.mesh, 0.035);
    this.root.add(this.mesh);
    game.zone.collision.addCircle(this.x, this.z, 0.95, { tall: false });
    this.radius = 2.9;
    this.solved = !!(data.flag && game.progress.flags.has(data.flag));
    this.lit = this.eternal || !!data.lit || this.solved;
    this.timer = 0;
    // luz parpadeante (reutiliza el reparto de luces de las antorchas)
    this.light = { obj: { userData: {} }, x: this.x, z: this.z, y: this.y + 2.5, phase: Math.random() * 10, off: !this.lit };
    game.zone.torches.push(this.light);
    game.dummies.push(this); // la espada en llamas enciende el brasero de un golpe
    this.applyLook();
  }

  get prompt() {
    const p = this.game.player;
    if (this.lit) return p.flameT > CARRY - 1 ? null : 'Prender la espada en el fuego';
    return p.flameT > 0 ? 'Encender el brasero' : 'Brasero apagado (hace falta fuego)';
  }

  interact() {
    const g = this.game, p = g.player;
    if (this.lit) { p.igniteSword(CARRY); g.audio.sfx('ignite'); return; }
    if (p.flameT > 0) this.ignite();
    else { g.audio.sfx('locked'); g.ui.toast('Necesitas fuego: prende la espada en una llama y vuelve.'); }
  }

  /** Golpe de espada: en llamas enciende el brasero; uno encendido prende la espada. */
  hit() {
    const p = this.game.player;
    if (!this.lit && p.flameT > 0) this.ignite();
    else if (this.lit && p.flameT < CARRY - 1) { p.igniteSword(CARRY); this.game.audio.sfx('ignite'); }
  }

  ignite() {
    const g = this.game;
    this.lit = true;
    this.timer = this.data.duration || 0;
    g.audio.sfx('ignite');
    g.particles.burst(this.x, this.y + 2.2, this.z, { count: 22, colors: [0xffb040, 0xff6a20, 0xfff0a0], speed: 4, up: 5, life: 0.7, size: 1.1 });
    this.applyLook();
    const grp = this.data.group;
    if (!grp || this.solved) return;
    const all = g.interactables.filter((i) => i instanceof Brazier && i.data.group === grp);
    if (!all.every((b) => b.lit)) return;
    for (const b of all) { b.solved = true; b.timer = 0; b.applyLook(); }
    if (this.data.flag) g.progress.flags.add(this.data.flag);
    g.audio.sfx('secret');
    g.ui.toast(this.data.text || '¡Todos los braseros arden! Algo se ha abierto.');
    for (const b of all) g.particles.sparkle(b.x, b.y + 2.4, b.z, { color: 0xffc060, count: 30, radius: 1.4 });
    g.shake(0.3);
    g.save();
  }

  extinguish() {
    const g = this.game;
    this.lit = false;
    g.audio.sfx('fizzle');
    g.particles.puff(this.x, this.y + 2.2, this.z, { color: 0x6a6a6a, count: 12, size: 2 });
    this.applyLook();
  }

  applyLook() {
    const u = this.mesh.userData;
    u.flame.visible = this.lit;
    u.coal.material.emissiveIntensity = this.lit ? 1.1 : 0;
    u.ring.material.color.set(this.solved || this.eternal ? 0xffc060 : 0xff8a3a).multiplyScalar(this.lit ? 1.6 : 0.15);
    this.light.off = !this.lit;
    this.mapColor = !this.lit && this.data.group ? '#ff9f43' : null;
  }

  update(dt) {
    if (!this.lit || !this.timer || this.solved) return;
    this.timer -= dt;
    // los últimos segundos la llama titila (aviso de que se apaga)
    const f = this.mesh.userData.flame;
    f.scale.setScalar(this.timer < 3 ? 0.55 + Math.abs(Math.sin(this.timer * 9)) * 0.45 : 1);
    if (this.timer <= 0) { f.scale.setScalar(1); this.extinguish(); }
  }

  dispose() { super.dispose(); const i = this.game.dummies.indexOf(this); if (i >= 0) this.game.dummies.splice(i, 1); }
}

// ------------------------------------------------------------------ rayo de sol
/** Espejo giratorio: '/' o '\' (se alterna con E). Desvía el rayo 90°. */
export class Mirror extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.kind = 'mirror';
    this.tileRC = tileOfEnt(this);
    this.orient = data.orient === '\\' ? '\\' : '/';
    this.fixed = !!data.fixed;
    this.mesh = PP.buildMirror({ fixed: this.fixed });
    outlineAll(this.mesh, 0.03);
    this.root.add(this.mesh);
    this.collider = game.zone.collision.addBox(this.x, this.z, 2.4, 2.4, { tall: false, tag: 'mirror' });
    this.radius = 3;
    this.angle = this.targetAngle();
    this.mesh.userData.pivot.rotation.y = this.angle;
    this.mapColor = '#fff3b0';
    this.hitT = 0;
  }
  targetAngle() { return this.orient === '/' ? Math.PI / 4 : -Math.PI / 4; }
  get prompt() { return this.fixed ? null : 'Girar el espejo'; }
  interact() {
    if (this.fixed) return;
    this.orient = this.orient === '/' ? '\\' : '/';
    this.game.audio.sfx('mirror');
  }
  /** Nueva dirección (dc, dr) del rayo tras rebotar en este espejo. */
  reflect(dc, dr) { return this.orient === '/' ? [-dr, -dc] : [dr, dc]; }
  update(dt) {
    // giro suave hasta la nueva orientación (por el camino corto)
    const want = this.targetAngle();
    let d = want - this.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.angle += d * (1 - Math.exp(-dt * 10));
    this.mesh.userData.pivot.rotation.y = this.angle;
    this.hitT = Math.max(0, this.hitT - dt);
    this.mesh.userData.spark.material.opacity = Math.min(1, this.hitT * 8) * (0.7 + Math.sin(this.game.time * 20) * 0.3);
  }
}

/** Cristal solar: se ilumina mientras el rayo le llega; la primera vez activa su bandera. */
export class BeamTarget extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.kind = 'beamtarget';
    this.tileRC = tileOfEnt(this);
    this.mesh = PP.buildSunCrystal();
    outlineAll(this.mesh, 0.03);
    this.root.add(this.mesh);
    game.zone.collision.addCircle(this.x, this.z, 1.1, { tall: false });
    this.solved = !!(data.flag && game.progress.flags.has(data.flag));
    this.lastHit = -10;
    this.glow = this.solved ? 1 : 0;
    this.light = { obj: { userData: {} }, x: this.x, z: this.z, y: this.y + PP.BEAM_Y, phase: 0, crystal: true, color: 0xffb040, off: !this.solved };
    game.zone.torches.push(this.light);
    this.mapColor = this.solved ? null : '#ffb040';
  }
  get lit() { return this.game.time - this.lastHit < 0.15; }
  onHit() {
    this.lastHit = this.game.time;
    if (this.solved) return;
    const g = this.game;
    this.solved = true;
    this.mapColor = null;
    if (this.data.flag) g.progress.flags.add(this.data.flag);
    g.audio.sfx('secret');
    g.ui.toast(this.data.text || '¡El cristal solar se enciende! Algo se ha abierto.');
    g.particles.sparkle(this.x, this.y + PP.BEAM_Y, this.z, { color: 0xffd070, count: 50, radius: 1.8 });
    g.shake(0.3);
    g.save();
  }
  update(dt) {
    const want = this.lit ? 1 : this.solved ? 0.45 : 0;
    this.glow += (want - this.glow) * (1 - Math.exp(-dt * 6));
    const u = this.mesh.userData;
    u.halo.material.opacity = this.glow * 0.35;
    if (u.gem.material.emissiveIntensity != null) u.gem.material.emissiveIntensity = 0.15 + this.glow * 2.5;
    u.gem.rotation.y += dt * (0.4 + this.glow * 2);
    this.light.off = this.glow < 0.2;
  }
}

/** Ídolo solar: emite el rayo en la dirección `dir` (N, S, E, O) si se cumple `requires`. */
export class BeamSource extends Base {
  constructor(game, data) {
    super(game, data);
    this.id = data.id;
    this.kind = 'beamsource';
    this.tileRC = tileOfEnt(this);
    this.dir = DIRS[data.dir] || DIRS.S;
    this.mesh = PP.buildSunIdol();
    outlineAll(this.mesh, 0.03);
    this.root.add(this.mesh);
    this.root.rotation.y = Math.atan2(this.dir[0], this.dir[1]);
    game.zone.collision.addBox(this.x, this.z, 2.2, 2.2, { tall: true, height: 4.5, tag: 'idol' });
    this.beam = new THREE.Group();
    game.scene.add(this.beam);
    this.sig = '';
    this.path = null;
  }

  /** Recorre el rayo casilla a casilla. Devuelve los puntos de giro y lo que alcanza. */
  trace() {
    const g = this.game, zone = g.zone;
    const at = new Map();
    for (const i of g.interactables) {
      if (i === this || i.removed) continue;
      if (i instanceof Mirror || i instanceof BeamTarget || i instanceof BeamSource) at.set(`${i.tileRC[0]},${i.tileRC[1]}`, i);
      else if (i instanceof IceBlock) at.set(`${i.tile[0]},${i.tile[1]}`, i);
      else if (i instanceof Barrier && i.raised) at.set(`${i.tileRC[0]},${i.tileRC[1]}`, i);
      else if (i instanceof Door && !i.open) {
        const span = i.data.span || 1;
        for (let k = 0; k < span; k++) at.set(`${Math.round(i.data.tile[0]) + k},${Math.round(i.data.tile[1])}`, i);
      }
    }
    let [c, r] = this.tileRC;
    let [dc, dr] = this.dir;
    const pts = [zone.tileToWorld(c, r)];
    const mirrors = [];
    let target = null;
    for (let n = 0; n < 300; n++) {
      c += dc; r += dr;
      const [x, z] = zone.tileToWorld(c, r);
      const edge = [x - dc * TILE / 2, z - dr * TILE / 2];
      if (c < 0 || r < 0 || c >= zone.W || r >= zone.H) { pts.push(edge); break; }
      const e = at.get(`${c},${r}`);
      if (e instanceof Mirror) { pts.push([x, z]); mirrors.push(e); [dc, dr] = e.reflect(dc, dr); continue; }
      if (e instanceof BeamTarget) { pts.push([x, z]); target = e; break; }
      if (e) { pts.push(edge); break; }
      const info = tileInfo(zone.charAt(c, r));
      if (info.solid && !info.water) { pts.push(edge); break; }
    }
    return { pts, mirrors, target };
  }

  rebuild(pts) {
    for (const m of this.beam.children) m.geometry.dispose();
    this.beam.clear();
    const mats = PP.beamMaterials();
    const y = this.y + PP.BEAM_Y;
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) continue;
      for (const [rad, mat] of [[0.09, mats.core], [0.32, mats.halo]]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 8, 1, true), mat);
        m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
        // los tramos siempre siguen la cuadrícula: a lo largo de X o de Z
        if (Math.abs(x1 - x0) > Math.abs(z1 - z0)) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
        m.renderOrder = 3;
        this.beam.add(m);
      }
    }
  }

  update() {
    const g = this.game;
    const on = g.progress.check(this.data.requires);
    const u = this.mesh.userData;
    u.disc.material.color.set(0xffc040).multiplyScalar(on ? 2.4 + Math.sin(g.time * 4) * 0.3 : 0.5);
    u.rays.rotation.z = g.time * 0.5;
    this.beam.visible = on;
    if (!on) { this.path = null; return; }
    const path = this.trace();
    this.path = path;
    const sig = path.pts.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join('|');
    if (sig !== this.sig) { this.sig = sig; this.rebuild(path.pts); if (this.lastSig !== undefined) g.audio.sfx('beam'); this.lastSig = sig; }
    for (const m of path.mirrors) m.hitT = 0.2;
    if (path.target) path.target.onHit();
    // chispas donde el rayo choca
    if (!path.target && Math.random() < 0.3) {
      const [x, z] = path.pts[path.pts.length - 1];
      g.particles.spawn(x, this.y + PP.BEAM_Y, z, { color: 0xffd070, size: 0.7, life: 0.35, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 3 });
    }
  }

  dispose() {
    super.dispose();
    for (const m of this.beam.children) m.geometry.dispose();
    this.game.scene.remove(this.beam);
  }
}

// ------------------------------------------------------------------ cristales de cambio
/** Alterna el estado de las barreras de la zona (0: rojas levantadas, 1: azules). */
function toggleSwitches(game) {
  game.switchState = game.switchState ? 0 : 1;
  game.audio.sfx('switch');
  game.shake(0.12);
}

export class CrystalSwitch extends Base {
  constructor(game, data) {
    super(game, data);
    this.kind = 'switch';
    this.mesh = PP.buildSwitchCrystal();
    outlineAll(this.mesh, 0.03);
    this.root.add(this.mesh);
    game.zone.collision.addCircle(this.x, this.z, 0.9, { tall: false });
    this.radius = 2.8;
    this.cool = 0;
    this.light = { obj: { userData: {} }, x: this.x, z: this.z, y: this.y + 2.3, phase: Math.random() * 6, crystal: true, color: PP.SWITCH_COLORS.red };
    game.zone.torches.push(this.light);
    game.dummies.push(this);
  }
  get prompt() { return 'Golpear el cristal'; }
  interact() { this.hit(); }
  hit() {
    if (this.cool > 0) return;
    this.cool = 0.45;
    toggleSwitches(this.game);
    this.game.particles.sparkle(this.x, this.y + 2.3, this.z, { color: this.game.switchState ? PP.SWITCH_COLORS.blue : PP.SWITCH_COLORS.red, count: 18, radius: 0.8 });
  }
  update(dt) {
    this.cool -= dt;
    const c = this.game.switchState ? PP.SWITCH_COLORS.blue : PP.SWITCH_COLORS.red;
    const orb = this.mesh.userData.orb;
    orb.material.color.set(c);
    orb.material.emissive.set(c).multiplyScalar(0.6);
    orb.rotation.y += dt * 1.5;
    orb.position.y = 2.35 + Math.sin(this.game.time * 2.2) * 0.08;
    this.light.color = c;
  }
  dispose() { super.dispose(); const i = this.game.dummies.indexOf(this); if (i >= 0) this.game.dummies.splice(i, 1); }
}

/** Barrera de cristal roja o azul: levantada según el estado de los cristales de cambio. */
export class Barrier extends Base {
  constructor(game, data) {
    super(game, data);
    this.kind = 'barrier';
    this.color = data.color === 'blue' ? 'blue' : 'red';
    this.tileRC = tileOfEnt(this);
    this.mesh = PP.buildBarrier(this.color);
    this.root.add(this.mesh);
    this.collider = game.zone.collision.addBox(this.x, this.z, TILE, TILE, { tall: true, height: 3, tag: 'barrier' });
    this.raised = this.wantRaised();
    this.lift = this.raised ? 0 : -2.8;
    this.apply();
  }
  wantRaised() { return (this.color === 'red') === !this.game.switchState; }
  apply() {
    this.mesh.userData.lift.position.y = this.lift;
    this.collider.enabled = this.raised;
    this.mapColor = this.raised ? (this.color === 'red' ? '#ff5a6a' : '#4a9cff') : null;
  }
  update(dt) {
    const want = this.wantRaised();
    if (want !== this.raised) {
      this.raised = want;
      if (want) this.pushOut();
    }
    const target = this.raised ? 0 : -2.8;
    this.lift += (target - this.lift) * (1 - Math.exp(-dt * 12));
    this.apply();
  }
  /** Si la barrera sube debajo del héroe, lo aparta a la casilla libre más cercana. */
  pushOut() {
    const g = this.game, p = g.player, zone = g.zone;
    if (Math.abs(p.x - this.x) > TILE / 2 + p.radius || Math.abs(p.z - this.z) > TILE / 2 + p.radius) return;
    let best = null, bd = Infinity;
    const [c0, r0] = this.tileRC;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const c = c0 + dc, r = r0 + dr;
      if (tileInfo(zone.charAt(c, r)).solid) continue;
      if (g.interactables.some((i) => i instanceof Barrier && i !== this && i.wantRaised() && i.tileRC[0] === c && i.tileRC[1] === r)) continue;
      const [x, z] = zone.tileToWorld(c, r);
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    if (best) { p.pos.x = best[0]; p.pos.z = best[1]; g.particles.puff(p.x, p.pos.y + 0.5, p.z, { color: 0xffffff, count: 10, size: 2 }); }
  }
}

// ------------------------------------------------------------------ runas
export class RuneTile extends Base {
  constructor(game, data) {
    super(game, data);
    this.kind = 'rune';
    this.symbol = data.symbol;
    this.tileRC = tileOfEnt(this);
    this.mesh = PP.buildRuneTile(data.symbol);
    this.root.add(this.mesh);
    this.lit = false;
    this.flash = 0; // > 0: destello (pista o error)
    this.flashColor = new THREE.Color();
  }
  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    const m = this.mesh.userData.glyph;
    if (this.flash > 0) m.color.copy(this.flashColor).multiplyScalar(0.6 + this.flash * 2);
    else if (this.lit) m.color.setRGB(2.4, 1.8, 0.7);
    else m.color.setRGB(0.35, 0.6, 0.9).multiplyScalar(0.8 + Math.sin(this.game.time * 2 + this.symbol) * 0.2);
  }
}

/** Tablilla de runas: guarda la secuencia de su grupo, la muestra y comprueba los pasos. */
export class RuneTablet extends Base {
  constructor(game, data) {
    super(game, data);
    this.kind = 'runetablet';
    this.seq = data.sequence;
    this.mesh = PP.buildRuneTablet(this.seq);
    outlineAll(this.mesh, 0.035);
    this.root.add(this.mesh);
    this.root.rotation.y = data.facing || 0;
    game.zone.collision.addBox(this.x, this.z, 3.4, 1.4, { tall: false });
    this.radius = 3.4;
    this.solved = !!(data.flag && game.progress.flags.has(data.flag));
    this.progress = 0;
    this.lastTile = null;
    this.hint = null; // reproducción de la secuencia { i, t }
  }
  runes() { return this.game.interactables.filter((i) => i instanceof RuneTile && i.data.group === this.data.group); }
  get prompt() { return 'Leer la tablilla rúnica'; }
  interact() {
    const g = this.game;
    g.ui.openDialog('Tablilla rúnica', this.data.lines || ['Las runas grabadas brillan una tras otra...', 'Pisa las losas del suelo en ese mismo orden.']);
    g.setMode('dialog');
    if (!this.solved) { this.hint = { i: 0, t: 0.6 }; this.reset(false); }
  }
  reset(error) {
    this.progress = 0;
    for (const r of this.runes()) {
      r.lit = false;
      if (error) { r.flash = 0.7; r.flashColor.setRGB(2.4, 0.3, 0.25); }
    }
  }
  update(dt) {
    const g = this.game;
    const runes = this.runes();
    if (this.solved) { for (const r of runes) r.lit = true; return; }
    // pista: las runas de la secuencia destellan una a una
    if (this.hint) {
      this.hint.t -= dt;
      if (this.hint.t <= 0) {
        const r = runes.find((k) => k.symbol === this.seq[this.hint.i]);
        if (r) { r.flash = 0.5; r.flashColor.setRGB(1.6, 1.9, 2.4); g.audio.sfx('rune'); }
        this.hint.i++;
        this.hint.t = 0.7;
        if (this.hint.i >= this.seq.length) this.hint = null;
      }
    }
    // pasos del héroe sobre las losas
    const p = g.player;
    const [c, r] = g.zone.collision.tileOf(p.x, p.z);
    const key = `${c},${r}`;
    if (key === this.lastTile) return;
    this.lastTile = key;
    const rune = runes.find((k) => k.tileRC[0] === c && k.tileRC[1] === r);
    if (!rune || rune.lit) return;
    if (rune.symbol === this.seq[this.progress]) {
      rune.lit = true;
      this.progress++;
      g.audio.sfx('rune');
      g.particles.sparkle(rune.x, rune.y + 0.4, rune.z, { color: 0xffd070, count: 14, radius: 1.2 });
      if (this.progress >= this.seq.length) this.solve();
    } else {
      g.audio.sfx('locked');
      g.ui.toast('Las runas se apagan... ese no era el orden.');
      this.reset(true);
    }
  }
  solve() {
    const g = this.game;
    this.solved = true;
    if (this.data.flag) g.progress.flags.add(this.data.flag);
    g.audio.sfx('secret');
    g.ui.toast(this.data.text || '¡Las runas responden! Algo se ha abierto.');
    for (const r of this.runes()) g.particles.sparkle(r.x, r.y + 0.5, r.z, { color: 0x9ff3ff, count: 20, radius: 1.5 });
    g.shake(0.3);
    g.save();
  }
}

/** Crea la entidad de puzle para un tipo de dato de zona (o null si no es de puzle). */
export function createPuzzleEntity(game, e) {
  switch (e.type) {
    case 'brazier': return new Brazier(game, e);
    case 'mirror': return new Mirror(game, e);
    case 'beamsource': return new BeamSource(game, e);
    case 'beamtarget': return new BeamTarget(game, e);
    case 'switch': return new CrystalSwitch(game, e);
    case 'barrier': return new Barrier(game, e);
    case 'rune': return new RuneTile(game, e);
    case 'runetablet': return new RuneTablet(game, e);
    case 'stoneblock': return new IceBlock(game, { ...e, style: 'stone' });
    default: return null;
  }
}

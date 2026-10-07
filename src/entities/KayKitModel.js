// Modelo animado KayKit con la misma interfaz que CharacterModel
// (root, animate(dt, estado), weapon, weaponTip(), flash(), dispose()).
//
// Animación:
//  - capa de locomoción: reposo / caminar / correr mezclados por velocidad, con la
//    cadencia de los pasos ajustada a la velocidad real (sin pies que patinan);
//  - acciones (ataques, voltereta, bloqueo, golpe, muerte, gestos) que se funden
//    sobre la locomoción. Los ataques, la voltereta y la muerte se "arrastran" con
//    el tiempo exacto del juego, así el golpe visual coincide con la ventana de daño;
//  - capa dinámica procedural encima: inclinación en los giros y al acelerar, y la
//    cabeza (y un poco el pecho) se giran hacia lo que el personaje mira.
import * as THREE from 'three';
import { instantiate, clip } from '../gfx/Characters.js';

const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Tramo del clip que se usa al arrastrar cada acción con el tiempo del juego (fracciones de su duración). */
const SCRUB = {
  '1H_Melee_Attack_Slice_Diagonal': [0.08, 0.72],
  '1H_Melee_Attack_Slice_Horizontal': [0.1, 0.72],
  '1H_Melee_Attack_Chop': [0.05, 0.7],
  '1H_Melee_Attack_Stab': [0.05, 0.5],
  '2H_Melee_Attack_Chop': [0.05, 0.75],
  '2H_Melee_Attack_Spin': [0.0, 0.8],
  Dodge_Forward: [0, 1],
  Death_A: [0, 1],
  Death_C_Skeletons: [0, 1],
  Skeletons_Awaken_Floor: [0, 1],
  '1H_Melee_Attack_Jump_Chop': [0, 0.85],
  Block_Hit: [0, 0.8],
  Taunt: [0, 1],
};

/** Devuelve un material a su brillo propio (ojos y cristales de los monstruos) o lo apaga. */
export function restoreEmissive(m) {
  m.emissive.set(m.userData.baseEmissive ?? 0);
  m.emissiveIntensity = m.userData.baseEmissiveIntensity ?? 0;
}

export class KayKitModel {
  /**
   * @param {object} def definición del personaje (ver instantiate en gfx/Characters.js) más:
   *   height: altura final · clips: { idle, walk, run, attacks:[...], dodge, block, hurt, death } ·
   *   runPace / walkPace: velocidad (en "speed" del juego) a la que el clip va a ritmo normal
   */
  constructor(def = {}, inst = null) {
    this.def = def;
    inst = inst || instantiate(def);
    this.inst = inst;
    this.root = new THREE.Group();
    this.lean = new THREE.Group(); // inclinación procedural
    this.root.add(this.lean);
    this.lean.add(inst.scene);
    const s = (def.height ?? 1.85) / (inst.height ?? 2.19);
    inst.scene.scale.setScalar(s);
    inst.scene.position.y = -(inst.footY ?? 0) * s;
    this.scale = s;
    this.materials = inst.materials;
    this.clipLib = inst.clips || null; // clips propios del modelo (monstruos); si no, los compartidos
    this.scrub = { ...SCRUB, ...(def.scrub || {}) };
    this.head = def.headBone === null ? null : inst.scene.getObjectByName(def.headBone ?? 'head');
    this.chest = def.chestBone === null ? null : inst.scene.getObjectByName(def.chestBone ?? 'chest');
    // "arma": grupo en la mano derecha, con el eje +Y a lo largo de la hoja
    this.weapon = new THREE.Group();
    inst.hands.r.add(this.weapon);
    this.bladeLength = def.bladeLength ?? 1.4;

    this.clips = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', attacks: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'], dodge: 'Dodge_Forward', block: 'Blocking', hurt: 'Hit_A', death: 'Death_A', talk: 'Idle', ...(def.clips || {}) };
    this.walkPace = def.walkPace ?? 0.32;
    this.runPace = def.runPace ?? 0.85;

    this.mixer = new THREE.AnimationMixer(inst.scene);
    this.actions = new Map(); // nombre -> { action, w, target }
    this.flashT = 0;
    this.t = Math.random() * 10;
    this.prevYaw = null;
    this.yawRate = 0;
    this.prevSpeed = 0;
    this.lookTarget = null; // Vector3 en el mundo, o null
    this.look = { yaw: 0, pitch: 0 };
    this.oneShot = null; // gesto puntual { name, until }
    this.lastHurt = false;
  }

  /** Acción del mezclador para un clip (se crea al usarla por primera vez). */
  slot(name) {
    let s = this.actions.get(name);
    if (!s) {
      const c = this.clipLib ? this.clipLib.get(name) : clip(name);
      if (!c) return null;
      const action = this.mixer.clipAction(c);
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      s = { action, w: 0, target: 0, name };
      this.actions.set(name, s);
    }
    return s;
  }

  /** Gesto puntual (vítores, recoger, interactuar...). Devuelve su duración. */
  play(name, { timeScale = 1, hold = false } = {}) {
    const s = this.slot(name);
    if (!s) return 0;
    s.action.reset();
    s.action.setLoop(THREE.LoopOnce, 1);
    s.action.clampWhenFinished = true;
    s.action.timeScale = timeScale;
    s.action.play();
    const dur = s.action.getClip().duration / timeScale;
    this.oneShot = { name, until: this.t + (hold ? 1e9 : dur - 0.12) };
    return dur;
  }

  stopGesture() { this.oneShot = null; }

  /** Destello al recibir daño. */
  flash(dur = 0.25, color = 0xff3030) { this.flashT = dur; this.flashColor = new THREE.Color(color); }

  /**
   * @param {number} dt
   * @param {object} s { speed, attack:{t,combo}, block, roll, hurt, dead, talk, action:{name,t} }
   */
  animate(dt, s = {}) {
    this.t += dt;
    const sp = s.speed || 0;
    // --- acción dominante ---
    let over = null; // { name, scrub: t|null, loop }
    if (s.dead != null && s.dead !== false) over = { name: this.clips.death, scrub: Math.min(1, s.dead) };
    else if (s.roll != null) over = { name: this.clips.dodge, scrub: s.roll };
    else if (s.attack && s.attack.t < 1) {
      const list = s.attack.clips || this.clips.attacks;
      over = { name: list[(s.attack.combo || 0) % list.length], scrub: s.attack.t };
    } else if (s.action) over = { name: s.action.name, scrub: s.action.t ?? null, loop: s.action.loop };
    else if (s.hurt) {
      if (!this.lastHurt) this.play(this.clips.hurt, { timeScale: 1.7 });
    } else if (s.block) over = { name: this.clips.block, scrub: null, loop: true };
    this.lastHurt = !!s.hurt;
    if (!over && this.oneShot) {
      if (this.t < this.oneShot.until) over = { name: this.oneShot.name, scrub: null, external: true };
      else this.oneShot = null;
    }

    // --- pesos objetivo ---
    for (const a of this.actions.values()) a.target = 0;
    if (over) {
      const a = this.slot(over.name);
      if (a) {
        a.target = 1;
        if (over.scrub != null) {
          const [t0, t1] = this.scrub[over.name] || [0, 1];
          a.action.timeScale = 0;
          a.action.time = (t0 + (t1 - t0) * Math.min(1, Math.max(0, over.scrub))) * a.action.getClip().duration;
        } else if (!over.external) {
          a.action.timeScale = 1;
          a.action.setLoop(THREE.LoopRepeat, Infinity);
        }
      }
    } else {
      // locomoción: reposo -> caminar -> correr según la velocidad
      const wRun = smooth(this.walkPace * 1.1, this.runPace * 0.8, sp);
      const wMove = smooth(0.03, 0.14, sp);
      const idle = this.slot(this.clips.idle), walk = this.slot(this.clips.walk), run = this.slot(this.clips.run);
      for (const a of [idle, walk, run]) { a.action.setLoop(THREE.LoopRepeat, Infinity); }
      run.target = wMove * wRun;
      run.action.timeScale = Math.max(0.7, sp / this.runPace);
      // modelos con un solo clip de avance (limos): caminar y correr son el mismo
      if (walk !== run) {
        walk.target = wMove * (1 - wRun);
        walk.action.timeScale = Math.max(0.5, sp / this.walkPace);
      } else walk.target = wMove;
      idle.target = 1 - wMove;
      idle.action.timeScale = 1;
    }
    // --- fundido de pesos (normalizados para no mezclar con la pose de reposo) ---
    const k = 1 - Math.exp(-dt / (over && over.scrub != null ? 0.05 : 0.11));
    let total = 0;
    for (const a of this.actions.values()) { a.w += (a.target - a.w) * k; if (a.target === 0 && a.w < 0.002) a.w = 0; total += a.w; }
    if (total < 1e-4) { const idle = this.slot(this.clips.idle); idle.w = 1; total = 1; }
    for (const a of this.actions.values()) a.action.setEffectiveWeight(a.w / total);
    // la mirada gira la cabeza y el pecho encima de la animación; el mezclador solo
    // reescribe un hueso si su valor animado cambia (en reposo casi no cambia), así
    // que se restaura la pose animada antes de actualizar para que el giro no se acumule
    if (this.posed) { this.head?.quaternion.copy(this.posed.head); this.chest?.quaternion.copy(this.posed.chest); }
    this.mixer.update(dt);
    if (!this.posed) this.posed = { head: new THREE.Quaternion(), chest: new THREE.Quaternion() };
    if (this.head) this.posed.head.copy(this.head.quaternion);
    if (this.chest) this.posed.chest.copy(this.chest.quaternion);

    // --- capa dinámica: inclinación en giros y aceleraciones ---
    const yaw = this.root.rotation.y;
    if (this.prevYaw != null && dt > 0) {
      const rate = angleDiff(this.prevYaw, yaw) / dt;
      this.yawRate += (rate - this.yawRate) * (1 - Math.exp(-dt * 10));
    }
    this.prevYaw = yaw;
    const accel = dt > 0 ? (sp - this.prevSpeed) / dt : 0;
    this.prevSpeed = sp;
    const moving = !over || over.name === this.clips.block;
    const leanZ = moving ? THREE.MathUtils.clamp(-this.yawRate * 0.045 * Math.min(1.4, sp + 0.2), -0.28, 0.28) : 0;
    const leanX = moving ? THREE.MathUtils.clamp(accel * 0.012, -0.12, 0.14) : 0;
    const kl = 1 - Math.exp(-dt * 8);
    this.lean.rotation.z += (leanZ - this.lean.rotation.z) * kl;
    this.lean.rotation.x += (leanX - this.lean.rotation.x) * kl;

    // --- mirada: cabeza (y algo el pecho) hacia el objetivo ---
    // el ángulo se mide desde los pies (estable, no desde la cabeza ya girada), con
    // margen para no entrar y salir en el límite, y sin mirar lo que está a la espalda
    // ni pegado al cuerpo
    let wantYaw = 0, wantPitch = 0;
    if (this.lookTarget && this.head && !(s.dead || s.roll != null)) {
      this.root.getWorldPosition(tmpV);
      tmpV2.copy(this.lookTarget).sub(tmpV);
      const hd = Math.hypot(tmpV2.x, tmpV2.z);
      const ang = angleDiff(yaw, Math.atan2(tmpV2.x, tmpV2.z));
      this.looking = hd > 0.8 && Math.abs(ang) < (this.looking ? 1.9 : 1.5);
      if (this.looking) {
        wantYaw = THREE.MathUtils.clamp(ang, -1.0, 1.0);
        const eye = (this.def.height ?? 1.85) * 0.88;
        wantPitch = THREE.MathUtils.clamp(Math.atan2(tmpV2.y - eye, Math.max(hd, 1.5)), -0.35, 0.35);
      }
    } else this.looking = false;
    const kk = 1 - Math.exp(-dt * 6);
    this.look.yaw += (wantYaw - this.look.yaw) * kk;
    this.look.pitch += (wantPitch - this.look.pitch) * kk;
    if (Math.abs(this.look.yaw) > 0.01 || Math.abs(this.look.pitch) > 0.01) {
      this.applyWorldYaw(this.chest, this.look.yaw * 0.3, 0);
      this.applyWorldYaw(this.head, this.look.yaw * 0.7, -this.look.pitch);
    }

    // --- destello ---
    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = Math.floor(this.flashT * 30) % 2 === 0 && this.flashT > 0;
      for (const m of this.materials) {
        if (on) { m.emissive.copy(this.flashColor); m.emissiveIntensity = 0.8; } else restoreEmissive(m);
      }
    }
  }

  /** Gira un hueso en el espacio del mundo (guiñada alrededor de la vertical y cabeceo lateral). */
  applyWorldYaw(bone, yaw, pitch) {
    if (!bone) return;
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(tmpQ);
    const rot = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    if (pitch) {
      const right = tmpV.set(1, 0, 0).applyAxisAngle(UP, this.root.rotation.y + yaw);
      rot.premultiply(tmpQ2.setFromAxisAngle(right, pitch));
    }
    // q_local' = inv(qParent) * rot * qParent * q_local
    const inv = tmpQ2.copy(tmpQ).invert();
    bone.quaternion.premultiply(tmpQ).premultiply(rot).premultiply(inv);
  }

  /** Posición mundial de la punta del arma (para estelas). */
  weaponTip(target) {
    return this.weapon.localToWorld(target.set(0, this.bladeLength * 0.92, 0));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.inst.scene);
    for (const m of this.materials) m.dispose();
  }
}

// Monstruo animado (Quaternius, modificado en gfx/Monsters.js). Usa toda la
// maquinaria de KayKitModel (mezcla de locomoción, acciones arrastradas con el
// tiempo del juego, mirada, inclinación) con los clips propios de su modelo, y
// añade proporciones propias: huesos agrandados o encogidos (cabezota del trasgo,
// brazos del golem...).
import * as THREE from 'three';
import { KayKitModel } from './KayKitModel.js';
import { instantiateMonster } from '../gfx/Monsters.js';

export class MonsterModel extends KayKitModel {
  /** def: { name, height, clips, headBone, chestBone, boneScale: { hueso: escala }, walkPace, runPace, scrub } */
  constructor(def) {
    super(def, instantiateMonster(def.name));
    this.monster = true;
    // el mezclador solo reescribe un hueso si su valor animado cambia: se guarda la
    // escala animada y se restaura antes de cada actualización para no acumular
    this.scaled = Object.entries(def.boneScale || {}).map(([name, k]) => {
      const bone = this.inst.scene.getObjectByName(name);
      return bone && { bone, k: new THREE.Vector3(...(typeof k === 'number' ? [k, k, k] : k)), posed: bone.scale.clone() };
    }).filter(Boolean);
  }

  animate(dt, s = {}) {
    for (const b of this.scaled) b.bone.scale.copy(b.posed);
    super.animate(dt, s);
    for (const b of this.scaled) { b.posed.copy(b.bone.scale); b.bone.scale.multiply(b.k); }
  }
}

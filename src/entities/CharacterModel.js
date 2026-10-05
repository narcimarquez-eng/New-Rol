// Personaje humanoide low-poly construido por código, con articulaciones
// (cabeza, brazos, piernas) animadas proceduralmente: idle, andar, correr,
// ataque en combo, bloqueo, voltereta, daño y muerte.
import * as THREE from 'three';
import { part, merge } from '../world/Props.js';

let grad = null;
function gradient() {
  if (grad) return grad;
  grad = new THREE.DataTexture(new Uint8Array([100, 100, 100, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  return grad;
}

export class CharacterModel {
  /**
   * @param {object} o colores y equipamiento
   */
  constructor(o = {}) {
    const c = {
      skin: 0xf1c27d, tunic: 0x2f9e44, belt: 0x6b4426, pants: 0xf3ead5, boots: 0x5a3a22,
      hair: 0xe3b23c, hat: 0x2f9e44, hatStyle: 'cap', eyes: 0x222222, scale: 1,
      sword: false, shield: false, club: false, beard: false, apron: null, ...o,
    };
    this.cfg = c;
    this.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient() });
    this.material.emissive = new THREE.Color(0x000000);
    const mat = this.material;
    const mesh = (geo) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };

    this.root = new THREE.Group();
    this.body = new THREE.Group(); // pivote para inclinaciones/voltereta (en la cadera)
    this.body.position.y = 0.95;
    this.root.add(this.body);

    // torso
    const torsoParts = [
      part(new THREE.BoxGeometry(0.7, 0.75, 0.45), c.tunic, { y: 0.42 }),
      part(new THREE.BoxGeometry(0.74, 0.12, 0.49), c.belt, { y: 0.1 }),
      part(new THREE.CylinderGeometry(0.42, 0.5, 0.35, 6), c.tunic, { y: -0.05 }), // faldón
    ];
    if (c.apron) torsoParts.push(part(new THREE.BoxGeometry(0.5, 0.7, 0.05), c.apron, { y: 0.25, z: 0.26 }));
    this.torso = mesh(merge(torsoParts));
    this.body.add(this.torso);

    // cabeza
    this.head = new THREE.Group();
    this.head.position.y = 1.08;
    this.body.add(this.head);
    const headParts = [
      part(new THREE.BoxGeometry(0.62, 0.6, 0.58), c.skin, { y: 0.28 }),
      part(new THREE.BoxGeometry(0.1, 0.14, 0.05), c.eyes, { x: -0.14, y: 0.3, z: 0.3 }),
      part(new THREE.BoxGeometry(0.1, 0.14, 0.05), c.eyes, { x: 0.14, y: 0.3, z: 0.3 }),
      part(new THREE.BoxGeometry(0.66, 0.2, 0.62), c.hair, { y: 0.56 }),
      part(new THREE.BoxGeometry(0.66, 0.35, 0.15), c.hair, { y: 0.42, z: -0.25 }),
      part(new THREE.ConeGeometry(0.09, 0.22, 4), c.skin, { x: -0.36, y: 0.3, rz: Math.PI / 2 }), // orejas
      part(new THREE.ConeGeometry(0.09, 0.22, 4), c.skin, { x: 0.36, y: 0.3, rz: -Math.PI / 2 }),
    ];
    if (c.hatStyle === 'cap') {
      headParts.push(part(new THREE.ConeGeometry(0.38, 0.9, 6), c.hat, { y: 0.75, z: -0.28, rx: -1.0 }));
    } else if (c.hatStyle === 'hood') {
      headParts.push(part(new THREE.BoxGeometry(0.7, 0.3, 0.66), c.hat, { y: 0.66 }));
    } else if (c.hatStyle === 'straw') {
      headParts.push(part(new THREE.CylinderGeometry(0.55, 0.65, 0.1, 10), c.hat, { y: 0.64 }));
      headParts.push(part(new THREE.CylinderGeometry(0.3, 0.35, 0.25, 10), c.hat, { y: 0.75 }));
    } else if (c.hatStyle === 'horns') {
      headParts.push(part(new THREE.ConeGeometry(0.08, 0.35, 4), 0xeeeecc, { x: -0.2, y: 0.75, rz: 0.4 }));
      headParts.push(part(new THREE.ConeGeometry(0.08, 0.35, 4), 0xeeeecc, { x: 0.2, y: 0.75, rz: -0.4 }));
    } else if (c.hatStyle === 'bun') {
      headParts.push(part(new THREE.IcosahedronGeometry(0.2, 0), c.hair, { y: 0.72, z: -0.15 }));
    }
    if (c.beard) headParts.push(part(new THREE.BoxGeometry(0.5, 0.35, 0.12), c.beard, { y: 0.06, z: 0.3 }));
    this.headMesh = mesh(merge(headParts));
    this.head.add(this.headMesh);

    // brazos (pivote en el hombro)
    const armGeo = () => merge([
      part(new THREE.BoxGeometry(0.22, 0.55, 0.22), c.tunic, { y: -0.2 }),
      part(new THREE.BoxGeometry(0.2, 0.22, 0.2), c.skin, { y: -0.55 }),
    ]);
    this.armL = new THREE.Group(); this.armL.position.set(-0.47, 0.75, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.47, 0.75, 0);
    this.armL.add(mesh(armGeo())); this.armR.add(mesh(armGeo()));
    this.body.add(this.armL, this.armR);

    // mano derecha: arma
    this.handR = new THREE.Group(); this.handR.position.set(0, -0.6, 0.05);
    this.armR.add(this.handR);
    if (c.sword) {
      this.weapon = mesh(merge([
        part(new THREE.BoxGeometry(0.08, 0.3, 0.08), 0x5a3a22, { y: 0 }),
        part(new THREE.BoxGeometry(0.45, 0.08, 0.12), 0xd4a537, { y: 0.17 }),
        part(new THREE.BoxGeometry(0.12, 1.15, 0.04), 0xdfe8f0, { y: 0.78 }),
        part(new THREE.ConeGeometry(0.085, 0.18, 4), 0xdfe8f0, { y: 1.44, ry: Math.PI / 4 }),
      ]));
      this.weapon.rotation.x = Math.PI / 2; // la hoja apunta hacia delante
      this.handR.add(this.weapon);
    } else if (c.club) {
      this.weapon = mesh(merge([
        part(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 5), 0x5a3a22, { y: 0.1 }),
        part(new THREE.CylinderGeometry(0.16, 0.09, 0.8, 6), c.clubColor || 0x8b5a2b, { y: 0.7 }),
      ]));
      this.weapon.rotation.x = Math.PI / 2;
      this.handR.add(this.weapon);
    }
    // brazo izquierdo: escudo
    if (c.shield) {
      this.shield = mesh(merge([
        part(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 8), c.shieldColor || 0x2d5fa8, { rx: Math.PI / 2 }),
        part(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8), 0xc8c8d0, { rx: Math.PI / 2, z: 0.01 }),
        part(new THREE.BoxGeometry(0.12, 0.35, 0.14), 0xd4a537, { z: 0.04 }),
      ]));
      this.shield.position.set(-0.16, -0.38, 0.12);
      this.shield.rotation.y = -Math.PI / 2;
      this.armL.add(this.shield);
    }

    // piernas (pivote en la cadera)
    const legGeo = () => merge([
      part(new THREE.BoxGeometry(0.26, 0.5, 0.26), c.pants, { y: -0.25 }),
      part(new THREE.BoxGeometry(0.3, 0.32, 0.38), c.boots, { y: -0.68, z: 0.04 }),
    ]);
    this.legL = new THREE.Group(); this.legL.position.set(-0.18, 0.05, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.18, 0.05, 0);
    this.legL.add(mesh(legGeo())); this.legR.add(mesh(legGeo()));
    this.body.add(this.legL, this.legR);

    this.root.scale.setScalar(c.scale);
    this.t = 0; this.walkPhase = 0; this.flashT = 0;
  }

  /** Destello rojo/blanco al recibir daño. */
  flash(dur = 0.25, color = 0xff3030) { this.flashT = dur; this.flashColor = color; }

  /**
   * Anima el modelo.
   * @param {number} dt
   * @param {object} s { speed (0..1+), attack:{t:0..1, combo}, block, roll:0..1, hurt, dead:0..1, talk }
   */
  animate(dt, s = {}) {
    this.t += dt;
    const sp = s.speed || 0;
    this.walkPhase += dt * (4 + sp * 8) * (sp > 0.05 ? 1 : 0);
    const sw = Math.sin(this.walkPhase) * Math.min(1, sp) * 0.9;
    const bob = Math.abs(Math.cos(this.walkPhase)) * Math.min(1, sp) * 0.12;
    const breathe = Math.sin(this.t * 2) * 0.02;

    // valores base
    this.body.position.y = 0.95 + bob + breathe;
    this.body.rotation.set(sp * 0.12, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.legL.rotation.set(sw, 0, 0);
    this.legR.rotation.set(-sw, 0, 0);
    this.armL.rotation.set(-sw * 0.8, 0, 0.1);
    this.armR.rotation.set(sw * 0.8, 0, -0.1);
    this.handR.rotation.set(0, 0, 0);

    if (s.talk) { this.head.rotation.x = Math.sin(this.t * 9) * 0.06; this.armR.rotation.x = -0.4 + Math.sin(this.t * 4) * 0.3; }

    if (s.block) {
      this.armL.rotation.set(-1.45, 0.6, 0.2);
      this.body.rotation.x = 0.15;
    }

    if (s.attack && s.attack.t < 1) {
      const t = s.attack.t;
      const combo = s.attack.combo || 0;
      // anticipación -> golpe -> recuperación
      const e = t < 0.25 ? t / 0.25 : t < 0.55 ? 1 + (t - 0.25) / 0.3 : 2 + (t - 0.55) / 0.45;
      if (combo === 1) {
        // revés horizontal
        const a = e < 1 ? e * 1.2 : e < 2 ? 1.2 - (e - 1) * 2.6 : -1.4 + (e - 2) * 1.4;
        this.armR.rotation.set(-1.5, a, 0);
        this.body.rotation.y = a * 0.4;
      } else if (combo === 2) {
        // estocada / golpe vertical fuerte
        const a = e < 1 ? -2.6 * e : e < 2 ? -2.6 + (e - 1) * 2.8 : 0.2 - (e - 2) * 0.2;
        this.armR.rotation.set(a, 0, -0.1);
        this.body.rotation.x = e > 1 && e < 2 ? 0.35 : 0.1;
      } else {
        // tajo diagonal
        const a = e < 1 ? -e * 1.2 : e < 2 ? -1.2 + (e - 1) * 2.6 : 1.4 - (e - 2) * 1.4;
        this.armR.rotation.set(-1.4, a, -0.3);
        this.body.rotation.y = a * 0.4;
      }
    }

    if (s.roll != null && s.roll < 1) {
      this.body.rotation.x = s.roll * Math.PI * 2;
      this.body.position.y = 0.6 + Math.sin(s.roll * Math.PI) * 0.2;
      this.legL.rotation.x = -1.2; this.legR.rotation.x = -1.2;
      this.armL.rotation.x = -1; this.armR.rotation.x = -1;
    }

    if (s.hurt) { this.body.rotation.x = -0.35; this.armL.rotation.z = 0.8; this.armR.rotation.z = -0.8; }

    if (s.dead) {
      this.body.rotation.x = -Math.min(1, s.dead) * Math.PI / 2;
      this.body.position.y = 0.95 - Math.min(1, s.dead) * 0.65;
    }

    // destello de daño
    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = Math.floor(this.flashT * 30) % 2 === 0;
      this.material.emissive.set(on ? this.flashColor : 0x000000);
      this.material.emissiveIntensity = 0.8;
      if (this.flashT <= 0) this.material.emissive.set(0x000000);
    }
  }

  /** Posición mundial aproximada de la punta del arma (para estelas). */
  weaponTip(target) {
    if (!this.weapon) return null;
    return this.weapon.localToWorld(target.set(0, 1.4, 0));
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.material.dispose();
  }
}

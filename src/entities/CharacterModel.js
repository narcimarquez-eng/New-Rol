// Personaje "chibi" construido por código: cabeza grande con cara pintada
// (parpadea), pelo y sombreros, cuerpo torneado, extremidades redondeadas y
// contorno de tinta. Articulaciones (cabeza, brazos, piernas) animadas
// proceduralmente: idle, andar, correr, combo, bloqueo, voltereta, daño, muerte.
import * as THREE from 'three';
import { spart, smerge, charMat, addOutline, faceDecal } from '../gfx/ModelKit.js';

const HIP = 0.85;

export class CharacterModel {
  /** @param {object} o colores, estilo de cara y equipamiento */
  constructor(o = {}) {
    const c = {
      skin: 0xf6c9a0, tunic: 0x2f9e44, belt: 0x6b4426, pants: 0xf3ead5, boots: 0x6b4426,
      hair: 0xf2c14e, hat: 0x2f9e44, hatStyle: 'cap', eyes: '#3b6fd8', face: 'npc', ears: 'round', scale: 1,
      sword: false, shield: false, club: false, beard: false, apron: null, outline: 0.022, ...o,
    };
    this.cfg = c;
    this.material = charMat();
    const mat = this.material;
    const mk = (geo) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      if (c.outline) addOutline(m, c.outline);
      return m;
    };

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = HIP;
    this.root.add(this.body);

    // ---- torso (perfil torneado: faldón -> cintura -> hombros) ----
    const prof = [[0.0, -0.2], [0.44, -0.2], [0.42, -0.05], [0.33, 0.15], [0.3, 0.4], [0.29, 0.55], [0.18, 0.66], [0.0, 0.7]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const torsoParts = [
      spart(new THREE.LatheGeometry(prof, 14), c.tunic, { ao: 0.3 }),
      spart(new THREE.TorusGeometry(0.335, 0.05, 6, 16), c.belt, { rx: Math.PI / 2, y: 0.14, ao: 0 }),
      spart(new THREE.BoxGeometry(0.12, 0.1, 0.06), 0xd4a537, { y: 0.14, z: 0.37, ao: 0 }),
    ];
    if (c.apron) torsoParts.push(spart(new THREE.CylinderGeometry(0.28, 0.36, 0.62, 10, 1, true, -0.9, 1.8), c.apron, { y: 0.15, ao: 0.1 }));
    if (c.cape) torsoParts.push(spart(new THREE.CylinderGeometry(0.3, 0.46, 0.8, 10, 1, true, Math.PI - 1.1, 2.2), c.cape, { y: 0.25, ao: 0.2 }));
    this.torso = mk(smerge(torsoParts));
    this.body.add(this.torso);

    // ---- cabeza ----
    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    this.body.add(this.head);
    const R = 0.4;
    const hy = 0.4; // centro de la esfera de la cabeza
    const headParts = [
      spart(new THREE.SphereGeometry(R, 20, 14), c.skin, { y: hy, sx: 1.04, sy: 0.96, ao: 0.12 }),
      spart(new THREE.SphereGeometry(0.06, 8, 6), c.skin, { y: hy - 0.06, z: R - 0.01, ao: 0 }),
    ];
    // orejas
    if (c.ears === 'pointy') {
      for (const s of [-1, 1]) headParts.push(spart(new THREE.ConeGeometry(0.08, 0.34, 6), c.skin, { x: s * (R + 0.08), y: hy + 0.02, rz: -s * Math.PI / 2.4, ao: 0 }));
    } else if (c.ears === 'big') {
      for (const s of [-1, 1]) headParts.push(spart(new THREE.ConeGeometry(0.12, 0.5, 6), c.skin, { x: s * (R + 0.14), y: hy + 0.06, rz: -s * Math.PI / 2.2, sz: 0.5, ao: 0 }));
    } else {
      for (const s of [-1, 1]) headParts.push(spart(new THREE.SphereGeometry(0.08, 8, 6), c.skin, { x: s * R, y: hy, sx: 0.6, ao: 0 }));
    }
    // pelo
    if (c.hatStyle !== 'bald') {
      headParts.push(spart(new THREE.SphereGeometry(R * 1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), c.hair, { y: hy + 0.02, z: -0.02, ao: 0.05 }));
      headParts.push(spart(new THREE.SphereGeometry(R * 1.05, 16, 10, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.45), c.hair, { y: hy, ao: 0.1 }));
      // flequillo
      for (const [bx, rot] of [[-0.18, 0.35], [0, 0], [0.18, -0.35]]) {
        headParts.push(spart(new THREE.ConeGeometry(0.1, 0.26, 6), c.hair, { x: bx, y: hy + 0.26, z: R * 0.82, rx: Math.PI * 0.92, rz: rot, ao: 0 }));
      }
    }
    switch (c.hatStyle) {
      case 'cap': // gorro largo que cae hacia atrás
        headParts.push(spart(new THREE.CylinderGeometry(R * 1.02, R * 1.08, 0.16, 18), c.hat, { y: hy + 0.26, ao: 0 }));
        headParts.push(spart(new THREE.ConeGeometry(R * 1.0, 0.62, 16), c.hat, { y: hy + 0.6, z: -0.08, rx: -0.45, ao: 0.1 }));
        headParts.push(spart(new THREE.ConeGeometry(0.2, 0.55, 12), c.hat, { y: hy + 0.62, z: -0.48, rx: -1.6, ao: 0.2 }));
        break;
      case 'hood':
        // capucha con abertura delantera para que se vea la cara
        headParts.push(spart(new THREE.SphereGeometry(R * 1.14, 18, 12, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.62), c.hat, { y: hy + 0.02, z: -0.04, ao: 0.1 }));
        headParts.push(spart(new THREE.SphereGeometry(R * 1.14, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), c.hat, { y: hy + 0.02, z: -0.04, ao: 0 }));
        break;
      case 'straw':
        headParts.push(spart(new THREE.CylinderGeometry(0.72, 0.78, 0.06, 20), c.hat, { y: hy + 0.3, ao: 0 }));
        headParts.push(spart(new THREE.CylinderGeometry(0.34, 0.4, 0.26, 16), c.hat, { y: hy + 0.42, ao: 0.1 }));
        headParts.push(spart(new THREE.CylinderGeometry(0.41, 0.41, 0.06, 16), 0xb5452b, { y: hy + 0.33, ao: 0 }));
        break;
      case 'horns':
        for (const s of [-1, 1]) headParts.push(spart(new THREE.ConeGeometry(0.08, 0.38, 8), 0xf1ead2, { x: s * 0.2, y: hy + 0.46, rz: -s * 0.45, ao: 0.3 }));
        break;
      case 'bun':
        headParts.push(spart(new THREE.SphereGeometry(0.17, 12, 8), c.hair, { y: hy + 0.36, z: -0.22, ao: 0 }));
        headParts.push(spart(new THREE.TorusGeometry(0.1, 0.03, 6, 12), 0xe63946, { y: hy + 0.32, z: -0.16, rx: 0.6, ao: 0 }));
        break;
      case 'helmet':
        headParts.push(spart(new THREE.SphereGeometry(R * 1.12, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), c.hat, { y: hy + 0.02, ao: 0.05 }));
        headParts.push(spart(new THREE.BoxGeometry(0.08, 0.3, 0.5), 0xd4a537, { y: hy + 0.42, ao: 0 }));
        break;
      default: break;
    }
    if (c.beard) {
      headParts.push(spart(new THREE.ConeGeometry(0.26, 0.55, 10), c.beard, { y: hy - 0.32, z: R * 0.6, rx: Math.PI + 0.25, ao: 0.1 }));
      headParts.push(spart(new THREE.SphereGeometry(0.2, 10, 8), c.beard, { y: hy - 0.12, z: R * 0.72, sx: 1.5, sy: 0.6, ao: 0 }));
    }
    this.headMesh = mk(smerge(headParts));
    this.head.add(this.headMesh);
    // cara pintada
    this.face = faceDecal(R, c.face, c.eyes);
    this.face.mesh.position.y = hy;
    this.face.mesh.scale.set(1.04, 0.96, 1);
    this.head.add(this.face.mesh);

    // ---- brazos (pivote en el hombro) ----
    const armGeo = () => smerge([
      spart(new THREE.CapsuleGeometry(0.1, 0.26, 4, 10), c.tunic, { y: -0.18, ao: 0.1 }),
      spart(new THREE.SphereGeometry(0.105, 10, 8), c.skin, { y: -0.44, ao: 0 }),
    ]);
    this.armL = new THREE.Group(); this.armL.position.set(-0.37, 0.56, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.37, 0.56, 0);
    this.armL.add(mk(armGeo())); this.armR.add(mk(armGeo()));
    this.body.add(this.armL, this.armR);

    // mano derecha: arma
    this.handR = new THREE.Group(); this.handR.position.set(0, -0.46, 0.04);
    this.armR.add(this.handR);
    if (c.sword) {
      this.weapon = mk(smerge([
        spart(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 8), 0x5a3a22, { ao: 0 }),
        spart(new THREE.SphereGeometry(0.06, 8, 6), 0xd4a537, { y: -0.16, ao: 0 }),
        spart(new THREE.BoxGeometry(0.42, 0.07, 0.1), 0xd4a537, { y: 0.16, ao: 0 }),
        spart(new THREE.BoxGeometry(0.11, 1.05, 0.035), 0xe6eef5, { y: 0.72, ao: 0, flat: true }),
        spart(new THREE.ConeGeometry(0.078, 0.2, 4), 0xe6eef5, { y: 1.34, ry: Math.PI / 4, sz: 0.4, ao: 0, flat: true }),
      ]));
      this.weapon.rotation.x = Math.PI / 2;
      this.handR.add(this.weapon);
    } else if (c.club) {
      this.weapon = mk(smerge([
        spart(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 8), 0x5a3a22, { y: 0.1, ao: 0 }),
        spart(new THREE.CylinderGeometry(0.17, 0.09, 0.75, 9), c.clubColor || 0x8b5a2b, { y: 0.66, ao: 0.2 }),
        spart(new THREE.ConeGeometry(0.05, 0.14, 5), 0xdddddd, { x: 0.15, y: 0.85, rz: -Math.PI / 2, ao: 0 }),
        spart(new THREE.ConeGeometry(0.05, 0.14, 5), 0xdddddd, { x: -0.15, y: 0.75, rz: Math.PI / 2, ao: 0 }),
      ]));
      this.weapon.rotation.x = Math.PI / 2;
      this.handR.add(this.weapon);
    } else if (c.staff) {
      this.weapon = mk(smerge([
        spart(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8), 0x7a5230, { y: 0.4, ao: 0 }),
        spart(new THREE.IcosahedronGeometry(0.13, 0), c.staff, { y: 1.25, ao: 0, flat: true }),
      ]));
      this.handR.add(this.weapon);
    }
    // brazo izquierdo: escudo
    if (c.shield) {
      this.shield = mk(smerge([
        spart(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 18), c.shieldColor || 0x2d5fa8, { rx: Math.PI / 2, ao: 0 }),
        spart(new THREE.TorusGeometry(0.39, 0.035, 6, 20), 0xc8ccd6, { ao: 0 }),
        spart(new THREE.ConeGeometry(0.16, 0.3, 3), 0xe8c547, { z: 0.05, rx: Math.PI / 2, ry: 0, rz: Math.PI, sz: 0.3, ao: 0 }),
        spart(new THREE.SphereGeometry(0.06, 8, 6), 0xe8c547, { z: 0.05, y: -0.12, ao: 0 }),
      ]));
      this.shield.position.set(-0.15, -0.34, 0.1);
      this.shield.rotation.y = -Math.PI / 2;
      this.armL.add(this.shield);
    }

    // ---- piernas (pivote en la cadera) ----
    const legGeo = () => smerge([
      spart(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), c.pants, { y: -0.27, ao: 0.1 }),
      spart(new THREE.CapsuleGeometry(0.13, 0.14, 4, 10), c.boots, { y: -0.66, z: 0.05, rx: Math.PI / 2, sx: 1, ao: 0.15 }),
      spart(new THREE.CylinderGeometry(0.15, 0.14, 0.14, 12), c.boots, { y: -0.54, ao: 0 }),
    ]);
    this.legL = new THREE.Group(); this.legL.position.set(-0.16, 0.0, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.16, 0.0, 0);
    this.legL.add(mk(legGeo())); this.legR.add(mk(legGeo()));
    this.body.add(this.legL, this.legR);

    this.root.scale.setScalar(c.scale);
    this.t = Math.random() * 10; this.walkPhase = 0; this.flashT = 0;
  }

  /** Destello al recibir daño. */
  flash(dur = 0.25, color = 0xff3030) { this.flashT = dur; this.flashColor = color; }

  /**
   * @param {number} dt
   * @param {object} s { speed, attack:{t,combo}, block, roll, hurt, dead, talk }
   */
  animate(dt, s = {}) {
    this.t += dt;
    this.face.blink(dt);
    const sp = s.speed || 0;
    this.walkPhase += dt * (4 + sp * 8) * (sp > 0.05 ? 1 : 0);
    const sw = Math.sin(this.walkPhase) * Math.min(1, sp) * 0.9;
    const bob = Math.abs(Math.cos(this.walkPhase)) * Math.min(1, sp) * 0.1;
    const breathe = Math.sin(this.t * 2.2) * 0.015;

    this.body.position.y = HIP + bob + breathe;
    this.body.rotation.set(sp * 0.14, 0, Math.sin(this.walkPhase) * Math.min(1, sp) * 0.05);
    this.head.rotation.set(-sp * 0.08 + Math.sin(this.t * 1.1) * 0.03, Math.sin(this.t * 0.7) * 0.06, 0);
    this.legL.rotation.set(sw, 0, 0);
    this.legR.rotation.set(-sw, 0, 0);
    this.armL.rotation.set(-sw * 0.8, 0, 0.12 + breathe * 2);
    this.armR.rotation.set(sw * 0.8, 0, -0.12 - breathe * 2);
    this.handR.rotation.set(0, 0, 0);

    if (s.talk) { this.head.rotation.x = Math.sin(this.t * 9) * 0.06; this.armR.rotation.x = -0.5 + Math.sin(this.t * 4) * 0.3; this.armR.rotation.z = -0.3; }

    if (s.block) {
      this.armL.rotation.set(-1.45, 0.6, 0.2);
      this.body.rotation.x = 0.15;
    }

    if (s.attack && s.attack.t < 1) {
      const t = s.attack.t;
      const combo = s.attack.combo || 0;
      const e = t < 0.25 ? t / 0.25 : t < 0.55 ? 1 + (t - 0.25) / 0.3 : 2 + (t - 0.55) / 0.45;
      if (combo === 1) {
        const a = e < 1 ? e * 1.2 : e < 2 ? 1.2 - (e - 1) * 2.6 : -1.4 + (e - 2) * 1.4;
        this.armR.rotation.set(-1.5, a, 0);
        this.body.rotation.y = a * 0.4;
      } else if (combo === 2) {
        const a = e < 1 ? -2.6 * e : e < 2 ? -2.6 + (e - 1) * 2.8 : 0.2 - (e - 2) * 0.2;
        this.armR.rotation.set(a, 0, -0.1);
        this.body.rotation.x = e > 1 && e < 2 ? 0.35 : 0.1;
      } else {
        const a = e < 1 ? -e * 1.2 : e < 2 ? -1.2 + (e - 1) * 2.6 : 1.4 - (e - 2) * 1.4;
        this.armR.rotation.set(-1.4, a, -0.3);
        this.body.rotation.y = a * 0.4;
      }
    }

    if (s.roll != null && s.roll < 1) {
      this.body.rotation.x = s.roll * Math.PI * 2;
      this.body.position.y = 0.55 + Math.sin(s.roll * Math.PI) * 0.2;
      this.legL.rotation.x = -1.2; this.legR.rotation.x = -1.2;
      this.armL.rotation.x = -1; this.armR.rotation.x = -1;
    }

    if (s.hurt) { this.body.rotation.x = -0.35; this.armL.rotation.z = 0.8; this.armR.rotation.z = -0.8; }

    if (s.dead) {
      this.body.rotation.x = -Math.min(1, s.dead) * Math.PI / 2;
      this.body.position.y = HIP - Math.min(1, s.dead) * 0.55;
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = Math.floor(this.flashT * 30) % 2 === 0;
      this.material.emissive.set(on ? this.flashColor : 0x000000);
      this.material.emissiveIntensity = 0.8;
      this.face.mat.emissive.copy(this.material.emissive);
      if (this.flashT <= 0) { this.material.emissive.set(0x000000); this.face.mat.emissive.set(0); }
    }
  }

  /** Posición mundial de la punta del arma (para estelas). */
  weaponTip(target) {
    if (!this.weapon) return null;
    return this.weapon.localToWorld(target.set(0, 1.35, 0));
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh && o.name !== 'outline') o.geometry.dispose(); });
    this.material.dispose();
    this.face.mat.map.dispose();
    this.face.mat.dispose();
  }
}

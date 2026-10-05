// Modelos procedurales de enemigos (con contorno de tinta y caras pintadas).
// build(def) devuelve las piezas que la IA anima: { root, body, mat, ...extras }.
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';
import { spart, smerge, charMat, addOutline, faceDecal, rockify } from '../gfx/ModelKit.js';

const lighten = (hex, l) => new THREE.Color(hex).offsetHSL(0, 0, l).getHex();

function mesh(geo, mat, outline = 0.025) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  if (outline) addOutline(m, outline);
  return m;
}

function slime(def) {
  const mat = charMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  const c = def.color;
  const parts = [
    spart(new THREE.SphereGeometry(0.8, 22, 14), c, { y: 0.6, sy: 0.75, ao: 0.35 }),
    spart(new THREE.SphereGeometry(0.16, 10, 8), 0xffffff, { x: -0.32, y: 1.02, z: 0.3, sy: 0.6, ao: 0 }),
  ];
  if (def.variant === 'ice') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(spart(new THREE.ConeGeometry(0.12, 0.45, 5), 0xe8fbff, { x: Math.cos(a) * 0.4, y: 1.05, z: Math.sin(a) * 0.4 - 0.1, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4, ao: 0, flat: true }));
    }
  }
  body.add(mesh(smerge(parts), mat, 0.03));
  const face = faceDecal(0.8, 'cute', '#1b1b2b', { width: 1.3, height: 0.9, center: 1.5 });
  face.mesh.position.y = 0.6; face.mesh.scale.y = 0.75;
  body.add(face.mesh);
  root.add(body);
  return { root, body, mat, face };
}

function bat(def) {
  const mat = charMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  const c = def.color;
  body.add(mesh(smerge([
    spart(new THREE.SphereGeometry(0.38, 14, 10), c, { ao: 0.25 }),
    spart(new THREE.ConeGeometry(0.11, 0.32, 6), c, { x: -0.2, y: 0.38, rz: 0.25, ao: 0 }),
    spart(new THREE.ConeGeometry(0.11, 0.32, 6), c, { x: 0.2, y: 0.38, rz: -0.25, ao: 0 }),
    spart(new THREE.ConeGeometry(0.035, 0.1, 4), 0xffffff, { x: -0.08, y: -0.2, z: 0.3, rx: Math.PI, ao: 0 }),
    spart(new THREE.ConeGeometry(0.035, 0.1, 4), 0xffffff, { x: 0.08, y: -0.2, z: 0.3, rx: Math.PI, ao: 0 }),
  ]), mat));
  const face = faceDecal(0.38, 'angry', def.variant === 'ice' ? '#7fe8ff' : '#ffd23a', { width: 1.5, height: 0.9, center: 1.45 });
  body.add(face.mesh);
  // ala festoneada
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.1); sh.lineTo(1.0, 0.25); sh.quadraticCurveTo(0.85, -0.05, 0.75, -0.25);
  sh.quadraticCurveTo(0.6, -0.05, 0.45, -0.25); sh.quadraticCurveTo(0.3, -0.05, 0.15, -0.2); sh.lineTo(0, -0.05);
  const wingGeo = spart(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), lighten(c, -0.12), { rx: Math.PI / 2, ao: 0 });
  const wl = mesh(wingGeo, mat, 0.02), wr = mesh(wingGeo, mat, 0.02);
  const pl = new THREE.Group(); pl.position.x = -0.25; pl.rotation.y = Math.PI; pl.add(wl);
  const pr = new THREE.Group(); pr.position.x = 0.25; pr.add(wr);
  body.add(pl, pr);
  root.add(body);
  return { root, body, mat, face, wings: [pl, pr] };
}

function plant(def) {
  const mat = charMat();
  const root = new THREE.Group();
  const leaves = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    leaves.push(spart(new THREE.SphereGeometry(0.5, 10, 6), 0x43a047, { x: Math.cos(a) * 0.55, y: 0.1, z: Math.sin(a) * 0.55, sx: 1.1, sy: 0.15, sz: 0.5, ry: -a, ao: 0 }));
  }
  root.add(mesh(smerge(leaves), mat, 0.02));
  const stalk = new THREE.Group(); stalk.position.y = 0.2;
  stalk.add(mesh(smerge([spart(new THREE.CylinderGeometry(0.1, 0.15, 1.3, 8), 0x388e3c, { y: 0.65, ao: 0.3 })]), mat));
  const head = new THREE.Group(); head.position.y = 1.35; stalk.add(head);
  const spots = [];
  for (const [x, y, z] of [[0.25, 0.3, 0.2], [-0.15, 0.4, -0.15], [-0.3, 0.2, 0.2], [0.1, 0.42, -0.3]]) spots.push(spart(new THREE.SphereGeometry(0.08, 6, 4), 0xffffff, { x, y, z, ao: 0 }));
  const top = mesh(smerge([
    spart(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), def.color, { ao: 0 }),
    ...[-0.25, 0, 0.25].map((x) => spart(new THREE.ConeGeometry(0.06, 0.2, 4), 0xffffff, { x, y: -0.06, z: 0.44, rx: Math.PI, ao: 0 })),
    ...spots,
  ]), mat);
  const bottom = mesh(smerge([
    spart(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xc2185b, { ao: 0.2 }),
    ...[-0.15, 0.15].map((x) => spart(new THREE.ConeGeometry(0.06, 0.2, 4), 0xffffff, { x, y: 0.06, z: 0.4, ao: 0 })),
  ]), mat);
  const jawTop = new THREE.Group(); jawTop.add(top);
  const jawBot = new THREE.Group(); jawBot.add(bottom);
  head.add(jawTop, jawBot);
  root.add(stalk);
  return { root, body: stalk, mat, head, jawTop, jawBot };
}

function goblin(def) {
  const king = def.model === 'goblinKing';
  const cm = new CharacterModel({
    skin: king ? 0x8fbf4f : 0x9ccc65, tunic: def.color, belt: 0x3e2723, pants: 0x5d4037, boots: 0x3e2723,
    hair: 0x3e2723, hatStyle: 'horns', face: 'angry', eyes: '#e53935', ears: 'big', club: true,
    clubColor: king ? 0x5d4037 : 0x8b5a2b, scale: king ? 2.1 : 0.95, outline: king ? 0.018 : 0.025,
  });
  if (king) {
    const crown = mesh(smerge([
      spart(new THREE.CylinderGeometry(0.34, 0.36, 0.2, 12, 1, true), 0xffd34d, { y: 0.76, ao: 0 }),
      ...[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return spart(new THREE.ConeGeometry(0.07, 0.22, 4), 0xffd34d, { x: Math.sin(a) * 0.32, y: 0.95, z: Math.cos(a) * 0.32, ao: 0 });
      }),
      spart(new THREE.IcosahedronGeometry(0.07, 0), 0xe63946, { z: 0.36, y: 0.78, ao: 0, flat: true }),
    ]), charMat({ side: THREE.DoubleSide }), 0);
    cm.head.add(crown);
  }
  return { root: cm.root, mat: cm.material, cm };
}

function wolf(def) {
  const mat = charMat();
  const c = def.color;
  const dark = lighten(c, -0.18);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.85;
  root.add(body);
  body.add(mesh(smerge([
    spart(new THREE.CapsuleGeometry(0.36, 0.8, 6, 12), c, { rx: Math.PI / 2, ao: 0.35 }),
    spart(new THREE.SphereGeometry(0.42, 12, 10), lighten(c, 0.08), { z: 0.38, y: 0.08, sx: 0.9, ao: 0.2 }), // pecho/melena
  ]), mat));
  // cabeza
  const head = new THREE.Group(); head.position.set(0, 0.3, 0.75);
  body.add(head);
  head.add(mesh(smerge([
    spart(new THREE.SphereGeometry(0.3, 14, 10), c, { ao: 0.15 }),
    spart(new THREE.ConeGeometry(0.17, 0.42, 10), c, { z: 0.36, y: -0.06, rx: Math.PI / 2, ao: 0 }),
    spart(new THREE.SphereGeometry(0.06, 8, 6), 0x222222, { z: 0.57, y: -0.04, ao: 0 }),
    spart(new THREE.ConeGeometry(0.1, 0.26, 6), dark, { x: -0.16, y: 0.3, z: -0.05, rz: 0.2, ao: 0 }),
    spart(new THREE.ConeGeometry(0.1, 0.26, 6), dark, { x: 0.16, y: 0.3, z: -0.05, rz: -0.2, ao: 0 }),
  ]), mat));
  const face = faceDecal(0.3, 'wolf', '#ffd23a', { width: 1.6, height: 0.8, center: 1.35 });
  head.add(face.mesh);
  // cola
  const tail = new THREE.Group(); tail.position.set(0, 0.15, -0.75);
  tail.add(mesh(smerge([spart(new THREE.ConeGeometry(0.14, 0.7, 8), lighten(c, 0.1), { y: 0.3, ao: 0.1 })]), mat));
  tail.rotation.x = -0.9;
  body.add(tail);
  // patas
  const legs = [];
  for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) {
    const g = new THREE.Group(); g.position.set(x, -0.15, z);
    g.add(mesh(smerge([
      spart(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), dark, { y: -0.3, ao: 0.2 }),
      spart(new THREE.SphereGeometry(0.11, 8, 6), dark, { y: -0.58, z: 0.04, sy: 0.6, ao: 0 }),
    ]), mat, 0.02));
    body.add(g); legs.push(g);
  }
  return { root, body, mat, face, head, tail, legs };
}

function spirit(def) {
  const mat = charMat({ transparent: true, opacity: 0.92 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(smerge([
    spart(new THREE.ConeGeometry(0.55, 1.3, 14, 1, true), def.color, { y: -0.35, rx: Math.PI, ao: -0.4 }),
    spart(new THREE.SphereGeometry(0.45, 16, 12), lighten(def.color, 0.15), { y: 0.35, ao: 0 }),
    spart(new THREE.ConeGeometry(0.5, 0.6, 14), lighten(def.color, -0.15), { y: 0.75, ao: 0 }),
  ]), mat, 0.02));
  const face = faceDecal(0.45, 'angry', '#9ff3ff', { width: 1.4, height: 0.8, center: 1.6 });
  face.mesh.position.y = 0.35;
  body.add(face.mesh);
  // fragmentos de hielo orbitando
  const shards = new THREE.Group();
  const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.2, 2.6), toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), shardMat);
    s.scale.y = 2;
    s.userData.a = (i / 3) * Math.PI * 2;
    shards.add(s);
  }
  body.add(shards);
  return { root, body, mat, face, shards };
}

function golem(def) {
  const mat = charMat();
  const c = def.color;
  const ice = 0xbdeeff;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 2.3;
  root.add(body);
  const torso = rockify(new THREE.IcosahedronGeometry(1.25, 1), 0.18, 3);
  body.add(mesh(smerge([
    spart(torso, c, { sy: 1.1, sx: 1.2, ao: 0.4, flat: true }),
    spart(rockify(new THREE.IcosahedronGeometry(0.7, 0), 0.1, 5), lighten(c, -0.08), { y: -1.0, sx: 1.4, sz: 1.2, ao: 0.3, flat: true }),
    ...[[-0.5, 1.1, -0.5, 0.3], [0.2, 1.3, -0.6, 0.45], [0.7, 1.0, -0.3, 0.3], [-0.1, 1.0, -0.9, 0.35]].map(([x, y, z, s]) =>
      spart(new THREE.ConeGeometry(s * 0.5, s * 2.4, 5), ice, { x, y, z, rx: -0.4 + x * 0.2, rz: -x * 0.5, ao: 0, flat: true })),
  ]), mat, 0.03));
  // cabeza
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.55);
  body.add(head);
  head.add(mesh(smerge([spart(rockify(new THREE.IcosahedronGeometry(0.55, 1), 0.12, 7), lighten(c, 0.05), { ao: 0.2, flat: true })]), mat, 0.03));
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 3.2), toneMapped: false });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.05), eyeMat);
    e.position.set(s * 0.2, 0.05, 0.5); e.rotation.z = s * 0.25;
    head.add(e);
  }
  // brazos
  const arm = () => {
    const g = new THREE.Group();
    g.add(mesh(smerge([
      spart(rockify(new THREE.IcosahedronGeometry(0.45, 1), 0.1, 9), c, { y: -0.6, sy: 1.5, ao: 0.2, flat: true }),
      spart(rockify(new THREE.IcosahedronGeometry(0.62, 1), 0.12, 11), lighten(c, -0.05), { y: -1.55, ao: 0.3, flat: true }),
      spart(new THREE.ConeGeometry(0.18, 0.6, 5), ice, { y: -1.5, z: 0.5, rx: Math.PI / 2, ao: 0, flat: true }),
    ]), mat, 0.03));
    return g;
  };
  const armL = arm(); armL.position.set(-1.45, 0.6, 0.1);
  const armR = arm(); armR.position.set(1.45, 0.6, 0.1);
  body.add(armL, armR);
  // piernas
  const legs = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.6, -1.0, 0);
    g.add(mesh(smerge([spart(rockify(new THREE.IcosahedronGeometry(0.5, 1), 0.1, 13 + s), lighten(c, -0.1), { y: -0.75, sy: 1.6, ao: 0.3, flat: true })]), mat, 0.03));
    body.add(g); legs.push(g);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.6, 3.0), toneMapped: false }));
  core.position.set(0, 0.1, 1.15);
  body.add(core);
  return { root, body, mat, head, armL, armR, legs, core };
}

const BUILDERS = { slime, bat, plant, goblin, goblinKing: goblin, wolf, spirit, golem };

export function buildEnemyModel(def) {
  const b = BUILDERS[def.model];
  if (!b) throw new Error(`Modelo de enemigo desconocido: ${def.model}`);
  return b(def);
}

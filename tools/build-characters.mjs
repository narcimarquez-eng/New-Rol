// Construye los modelos de personajes del juego a partir de los packs KayKit
// (Kay Lousberg, CC0): https://github.com/KayKit-Game-Assets
//
//  public/assets/chars/<nombre>.glb  malla + esqueleto + accesorios elegidos, sin animaciones
//  public/assets/chars/anims.glb     solo el esqueleto y los clips que usa el juego; todos los
//                                    personajes comparten el mismo esqueleto (41 huesos), así que
//                                    las animaciones se cargan una vez y sirven para todos
//  public/assets/chars/<arma>.glb    armas sueltas de los esqueletos
//
// Todo se comprime con meshopt (EXT_meshopt_compression).
// Uso: node tools/build-characters.mjs   (descarga los packs a .cache/kaykit si no están)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CACHE = '.cache/kaykit';
const OUT = 'public/assets/chars';
const PACKS = {
  adv: ['KayKit-Character-Pack-Adventures-1.0', 'addons/kaykit_character_pack_adventures'],
  skel: ['KayKit-Character-Pack-Skeletons-1.0', 'addons/kaykit_character_pack_skeletons'],
};

/** Personajes: archivo de origen y nodos que se conservan (el resto de accesorios se borran). */
const CHARACTERS = {
  rogue: { pack: 'adv', file: 'Rogue', keep: ['Rogue_Cape'] },
  rogue_hooded: { pack: 'adv', file: 'Rogue_Hooded', keep: ['Rogue_Cape', 'Knife', 'Knife_Offhand'] },
  knight: { pack: 'adv', file: 'Knight', keep: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield', 'Round_Shield'] },
  barbarian: { pack: 'adv', file: 'Barbarian', keep: ['Barbarian_Hat', 'Barbarian_Cape', '1H_Axe', '2H_Axe', 'Barbarian_Round_Shield', 'Mug'] },
  mage: { pack: 'adv', file: 'Mage', keep: ['Mage_Hat', 'Mage_Cape', '2H_Staff', 'Spellbook'] },
  skeleton_warrior: { pack: 'skel', file: 'Skeleton_Warrior', keep: ['Skeleton_Warrior_Helmet', 'Skeleton_Warrior_Cloak'] },
  skeleton_mage: { pack: 'skel', file: 'Skeleton_Mage', keep: ['Skeleton_Mage_Hat'] },
  skeleton_rogue: { pack: 'skel', file: 'Skeleton_Rogue', keep: ['Skeleton_Rogue_Hood', 'Skeleton_Rogue_Cape'] },
  skeleton_minion: { pack: 'skel', file: 'Skeleton_Minion', keep: ['Skeleton_Minion_Cloak'] },
};
/** Partes del cuerpo: siempre se conservan (nombre que contiene alguno de estos fragmentos). */
const BODY = ['ArmLeft', 'ArmRight', 'Body', 'Head', 'Skull', 'LegLeft', 'LegRight', 'Eyes', 'Jaw'];

const WEAPONS = ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Crossbow', 'Skeleton_Staff', 'Skeleton_Shield_Small_A', 'Skeleton_Shield_Large_A', 'Skeleton_Arrow'];

/** Clips que usa el juego (el pack de esqueletos contiene todos los del de aventureros y más). */
const CLIPS = [
  'Idle', 'Idle_Combat', 'Unarmed_Idle', 'Walking_A', 'Walking_Backwards', 'Walking_D_Skeletons', 'Running_A', 'Running_B', 'Running_C',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '1H_Melee_Attack_Jump_Chop',
  '2H_Melee_Idle', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Slice',
  'Block', 'Blocking', 'Block_Hit', 'Block_Attack', 'Dodge_Forward', 'Dodge_Backward',
  'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Death_C_Skeletons', 'Lie_Idle', 'Lie_StandUp',
  'Cheer', 'Interact', 'PickUp', 'Use_Item', 'Jump_Full_Short', 'Sit_Floor_Idle', 'Taunt',
  'Spellcast_Shoot', 'Spellcasting', 'Spellcast_Summon', 'Throw',
  '1H_Ranged_Aiming', '1H_Ranged_Shoot', '2H_Ranged_Aiming', '2H_Ranged_Shoot', '2H_Ranged_Reload',
  'Skeletons_Awaken_Floor', 'Skeletons_Inactive_Floor_Pose',
];

function ensurePacks() {
  for (const [repo] of Object.values(PACKS)) {
    const dir = `${CACHE}/${repo}`;
    if (!existsSync(dir)) {
      mkdirSync(CACHE, { recursive: true });
      execSync(`git clone --depth 1 https://github.com/KayKit-Game-Assets/${repo} ${dir}`, { stdio: 'inherit' });
    }
  }
}
const pathOf = (pack, sub) => `${CACHE}/${PACKS[pack][0]}/${PACKS[pack][1]}/${sub}`;

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/** Borra una animación con sus canales, muestreadores y datos. */
function disposeAnimation(a) {
  // (los datos huérfanos los elimina prune(); pueden estar compartidos entre clips)
  for (const smp of a.listSamplers()) smp.dispose();
  for (const ch of a.listChannels()) ch.dispose();
  a.dispose();
}

async function compressAndWrite(doc, file) {
  await doc.transform(dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(file, doc);
  return statSync(file).size;
}

ensurePacks();
mkdirSync(OUT, { recursive: true });

// --- personajes sin animaciones ---
for (const [name, c] of Object.entries(CHARACTERS)) {
  const doc = await io.read(pathOf(c.pack, `Characters/gltf/${c.file}.glb`));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) disposeAnimation(a);
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const n = node.getName();
    if (BODY.some((b) => n.includes(b)) || c.keep.includes(n)) continue;
    node.dispose();
  }
  const size = await compressAndWrite(doc, `${OUT}/${name}.glb`);
  console.log(`${name}.glb`.padEnd(24), (size / 1024).toFixed(0), 'KB');
}

// --- animaciones compartidas: el esqueleto del guerrero esqueleto y los clips elegidos ---
{
  const doc = await io.read(pathOf('skel', 'Characters/gltf/Skeleton_Warrior.glb'));
  const root = doc.getRoot();
  const missing = new Set(CLIPS);
  // solo los huesos que deforman la malla: los controles IK del rig no hacen falta en el juego
  const joints = new Set(root.listSkins()[0].listJoints());
  for (const a of root.listAnimations()) {
    if (!CLIPS.includes(a.getName())) { disposeAnimation(a); continue; }
    missing.delete(a.getName());
    for (const ch of a.listChannels()) {
      if (joints.has(ch.getTargetNode()) && ch.getTargetPath() !== 'scale') continue;
      const smp = ch.getSampler();
      ch.dispose();
      if (smp && !smp.listParents().some((p) => p.propertyType === 'AnimationChannel')) smp.dispose();
    }
  }
  if (missing.size) console.warn('clips no encontrados:', [...missing].join(', '));
  for (const node of root.listNodes()) if (node.getMesh()) node.dispose();
  for (const s of root.listSkins()) s.dispose();
  await doc.transform(resample({ tolerance: 5e-4 }));
  const size = await compressAndWrite(doc, `${OUT}/anims.glb`);
  console.log('anims.glb'.padEnd(24), (size / 1024).toFixed(0), 'KB', `(${CLIPS.length - missing.size} clips)`);
}

// --- armas sueltas de los esqueletos ---
for (const w of WEAPONS) {
  const doc = await io.read(pathOf('skel', `Assets/gltf/${w}.gltf`));
  const size = await compressAndWrite(doc, `${OUT}/${w.replace('Skeleton_', 'sk_').toLowerCase()}.glb`);
  console.log(`${w}`.padEnd(24), (size / 1024).toFixed(0), 'KB');
}

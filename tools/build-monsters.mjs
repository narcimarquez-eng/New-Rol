// Construye los monstruos del juego a partir del pack "Ultimate Monsters" de
// Quaternius (CC0, https://quaternius.com). Cada monstruo se recolorea con la
// paleta de su zona, se le quitan los nodos que no usa, se remuestrean sus
// animaciones y se comprime con meshopt:  public/assets/monsters/<nombre>.glb
// En el juego (src/entities/MonsterModel.js) se añaden además accesorios propios
// (corona, cristales de hielo, motas de la seta...), materiales especiales
// (gelatina translúcida, espíritu luminoso) y proporciones distintas.
//
// Uso: node tools/build-monsters.mjs [carpeta del pack]   (por defecto .cache/um)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { mkdirSync, statSync, existsSync } from 'node:fs';

const SRC = process.argv[2] || '.cache/um';
const OUT = 'public/assets/monsters';

/** Monstruo del juego -> modelo de origen y nuevos colores por material (sRGB). */
const MONSTERS = {
  slime: { file: 'Blob/glTF/GreenBlob', colors: { Green_Main: '#46c95e' } },
  iceslime: { file: 'Blob/glTF/PinkBlob', colors: { Pink_Main: '#7cc8f0', Pink_Secondary: '#e6f7ff' } },
  bat: { file: 'Flying/glTF/Demon', colors: { Demon_Main: '#5a2c86', Black: '#22142e' } },
  frostbat: { file: 'Flying/glTF/Demon', colors: { Demon_Main: '#5aa8dc', Black: '#e8f6ff' } },
  plant: { file: 'Blob/glTF/Mushnub_Evolved', colors: { MushroomKing_Secondary: '#c22a3a', Spikes: '#fff2d6', MushroomKing_Main: '#e6d2ae', Teeth: '#f2ead0' } },
  goblin: { file: 'Big/glTF/Orc', colors: { Orc_Main: '#6a9a3e', Orc_Secondary: '#7a4a2a', Orc_Hair: '#2e2016', Belt: '#4a3420', Gold: '#9a9a9a' } },
  goblinking: { file: 'Big/glTF/Orc', colors: { Orc_Main: '#4f7e34', Orc_Secondary: '#6a2a8a', Orc_Hair: '#141010', Belt: '#d4a020', Gold: '#ffd040' } },
  spirit: { file: 'Flying/glTF/Ghost', colors: { Ghost_Main: '#bfeaff' } },
  golem: { file: 'Big/glTF/Yeti', colors: { Yeti_Main: '#dcecf4', Yeti_Secondary: '#3f86b8', Tongue: '#3a5a8a' } },
};

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLinear = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
mkdirSync(OUT, { recursive: true });

for (const [name, def] of Object.entries(MONSTERS)) {
  const path = `${SRC}/${def.file}.gltf`;
  if (!existsSync(path)) throw new Error(`Falta ${path}: descarga el pack Ultimate Monsters de Quaternius (CC0)`);
  const doc = await io.read(path);
  for (const m of doc.getRoot().listMaterials()) {
    const hex = def.colors[m.getName()];
    if (hex) m.setBaseColorFactor([...hexLinear(hex), 1]);
    m.setMetallicFactor(0);
    m.setRoughnessFactor(m.getName().startsWith('Eye') ? 0.25 : 0.65);
  }
  // nombres de clip limpios ("Armature|Walk" -> "Walk")
  for (const a of doc.getRoot().listAnimations()) a.setName(a.getName().replace(/^.*\|/, ''));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(dedup(), resample({ tolerance: 5e-4 }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = `${OUT}/${name}.glb`;
  await io.write(out, doc);
  console.log(`${name.padEnd(11)} ${(statSync(out).size / 1024).toFixed(0).padStart(4)} KB  <- ${def.file}`);
}

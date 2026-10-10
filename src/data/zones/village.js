// ZONA 1 — Aldea Inicial.
// Todo el contenido de la zona es dato: mapa ASCII (ver src/world/tiles.js),
// paleta, música y entidades colocadas por casilla [columna, fila].
// Generado/editado con tools/genmaps.py.

import { COMPANIONS } from '../companions.js';

const NPC_LOOKS = {
  elder: { tunic: 0x6a4c93, hair: 0xeeeeee, hat: 0x6a4c93, hatStyle: 'hood', beard: 0xeeeeee, pants: 0x4b3a6b, face: 'old', staff: 0x9fe7ff },
  lucia: { tunic: 0xe76f51, hair: 0x6b3e26, hatStyle: 'bun', pants: 0xf4e1c1, apron: 0xffffff, face: 'girl', eyes: '#3a7d44' },
  farmer: { tunic: 0x588157, hair: 0x7f5539, hat: 0xe9c46a, hatStyle: 'straw', pants: 0x3a5a40, beard: 0x7f5539, face: 'npc', eyes: '#5a3a22' },
  smith: { tunic: 0x6c757d, hair: 0x222222, hatStyle: 'none', pants: 0x343a40, apron: 0x5a3a22, beard: 0x222222, scale: 1.1, face: 'npc', eyes: '#3a2a1a', skin: 0xe0a97e },
  merchant: { tunic: 0xf4a261, hair: 0xa8552a, hat: 0x2a9d8f, hatStyle: 'hood', pants: 0x264653, face: 'girl', eyes: '#7a4b2a' },
  kid: { tunic: 0x4895ef, hair: 0x3a2a1a, hatStyle: 'none', pants: 0x1d3557, scale: 0.75, face: 'kid', eyes: '#3a2a1a' },
  guard: { tunic: 0x9d0208, hair: 0x222222, hat: 0xb0b8c4, hatStyle: 'helmet', pants: 0x2b2d42, shield: true, shieldColor: 0x9d0208, face: 'npc', eyes: '#2b2118' },
};

export default {
  id: 'village',
  name: 'Aldea Inicial',
  subtitle: 'Un pueblo tranquilo al pie de las montañas',
  difficulty: 1.0,
  terrain: { amplitude: 0.9, seed: 3 },
  palette: {
    ground: { grass: 0x7cc35a, forest: 0x4f9a46, path: 0xd8b878, stone: 0xbfb6a6, sand: 0xe8d39a, water: 0x3d8fc6 },
    groundReal: { grass: 0x7d9a4a, forest: 0x5f7d36, path: 0x9c8466, stone: 0x99928a, sand: 0xb8a888, water: 0x5a5040 },
    trunk: 0x8b5a2b, leaf: 0x58b947, leaf2: 0x76d05a, pine: 0x2f7d4a, pine2: 0x3d9a59,
    rock: 0x9aa0a6, rock2: 0x80868c, bush: 0x4caf50, hedge: 0x3f8f3f, hedge2: 0x55a84a, cliffTop: 0x6cbf4f,
    wood: 0x8b5a2b, wood2: 0xa87442, grassTuft: 0x6dbb4f,
    skyTop: 0x3b8ee8, skyHorizon: 0xbfe6ff, skyBottom: 0xa8d8f0, fog: 0xbfe6ff,
    water: 0x58b7e8, waterDeep: 0x2a6fb0, mountain: 0x6b8fb8, mountainSnow: 0xffffff,
    sunColor: 0xfff1d0, hemiSky: 0xcfeaff, hemiGround: 0x6a8f4a, hemiIntensity: 1.1,
  },
  fog: { near: 60, far: 170 },
  // modo realista: tarde dorada con bruma suave
  atmosphere: { backdrop: { peak: 100, snowline: 60 }, elevation: 24, azimuth: 215, turbidity: 4.5, rayleigh: 1.8, mie: 0.005, haze: 0xd8cdb8, fogDensity: 0.0035,
    sunColor: 0xffdcae, waterColor: 0x23403e },
  trees: ['oak', 'cherry'],
  music: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], tempo: 92, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'square', pad: 'sine' },
  map: [
    '^^^^^^^^^^^^^^^^^==^^^^^^^^^^^^==^^^',
    '^..........######==######..F,,,,,,,^',
    '^..........######==######..F,,,,,,,^',
    '^..............T.==T...,...F,,,,,,,^',
    '^....,........,,.==.......,FFFF.FFF^',
    '^.T.,.....,..T..,==.T......,..,....^',
    '^....,....TT,....==................^',
    '^.....=.....,....==,.,...T.,.......^',
    '^.....=..........==....=......=....^',
    '^..===============================.^',
    '^...=...,........==.,..=.,.........^',
    '^...=.,.....T....==....=..FFFFFFFF.^',
    '^...=....,...oooooooooo=..F""""""F.^',
    '^.=====....,.oooooooooo===.""""""F.^',
    '^.=====,.....oooooooooo...F""""""F.^',
    '^.=====......oooooooooo...FFFFFFFF.^',
    '^.===========oooooooooo..........,.^',
    '^.=====......oooooooooo.........T..^',
    '^.=====T,.,..oooooooooo.T.,....T...^',
    '^.=====....T.....==.,..======......^',
    '^....,.,..T......==.,....~~~B~~~~..^',
    '^T..,,..,........==.....~~~~B~~~~..^',
    '^...,......,..T..==...T,~~~~B~~~~..^',
    '^................==.,...~~~~B~~~~..^',
    '^..............,.==.....~~~~B~~~~..^',
    '^...........,....==.....~~~~B~~~...^',
    '^................==...T............^',
    '^FFFFFFFFFFFFFFFF==FFFFFFFFFFFFFFFF^',
    '^######."......T.==............R.""^',
    '^######.b...."...==."..""".b...Rbb.^',
    '^#ggg%%.R....bT......".Rb.....b....^',
    '^#ggg##..."..."T......"...".......b^',
    '^######.b...b.R..........b."....b..^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  ],
  entities: [
    // --- puntos de aparición ---
    { type: 'spawn', id: 'start', tile: [17.5, 21], facing: Math.PI },
    { type: 'spawn', id: 'fromForest', tile: [17.5, 4], facing: 0 },
    { type: 'spawn', id: 'fromCastle', tile: [18, 16], facing: 0 },   // regreso desde el castillo (fase 5): la plaza
    { type: 'spawn', id: 'fromVolcano', tile: [31, 3], facing: 0 },   // regreso desde el volcán: la granja

    // --- casas ---
    { type: 'house', tile: [5, 5], size: [2, 2], roof: 0x3a6fc0 },
    { type: 'house', tile: [22, 6], size: [2, 2], roof: 0xc0473a },
    { type: 'house', tile: [29, 6], size: [2, 2], roof: 0xd08a2e, wall: 0xf7e7c6 },
    { type: 'house', tile: [8, 12], size: [2, 2], roof: 0x5d5d6b, wall: 0xd9cbb0 },

    // --- NPCs ---
    {
      type: 'npc', id: 'elder', name: 'Anciano Bruno', tile: [7, 8], look: NPC_LOOKS.elder, facing: Math.PI / 2,
      talk: [
        { when: { notFlag: 'met_elder' }, lines: [
          '¡Ah, por fin despiertas! Te esperaba.',
          'Una sombra se extiende desde el castillo del norte. Los bosques se oscurecen y los trasgos se envalentonan.',
          'Antes de dejarte salir de la aldea, demuéstrame que sabes usar esa espada.',
          'Ve a la zona de entrenamiento, al oeste, y golpea los tres muñecos.',
          '(Clic izquierdo o F: atacar · Clic derecho o R: bloquear · Espacio: esquivar · E: hablar/abrir)',
        ], do: [{ flag: 'met_elder' }] },
        { when: { notFlag: 'dummies_done' }, lines: ['Los muñecos están al oeste, en la explanada de tierra. ¡Golpea los tres!'] },
        { when: { notFlag: 'tutorial_done' }, lines: [
          '¡Excelente! Tienes buen brazo.',
          'Toma estas pociones. Pulsa Q para beber una cuando te falten corazones.',
          'He ordenado a la guardia que abra la puerta norte. Allí empieza el Bosque Encantado.',
          'En el corazón del bosque se esconde la Llave del Bosque. La necesitarás para seguir hacia las Cuevas Heladas.',
          '¡Que la luz te guíe!',
        ], do: [{ flag: 'tutorial_done' }, { give: ['potion', 2] }, { give: ['coin', 20] }] },
        { when: { notFlag: 'boss_forest' }, lines: ['El bosque está al norte. Si te pierdes en el laberinto, sigue las antorchas.', 'Y no olvides ayudar a los vecinos: siempre tienen algo que agradecerte.'] },
        { when: { flag: 'phase5_start' }, lines: ['El humo del volcán del noreste se ve desde la aldea. Los pájaros han dejado de cantar.', 'Ve con cuidado, y vuelve a casa cuando acabes.'] },
        { lines: ['¡Has derrotado al Rey Trasgo! La aldea entera habla de ti.', 'Las Cuevas Heladas te esperan más allá del bosque...'] },
      ],
    },
    { type: 'npc', id: 'lucia', name: 'Lucía', tile: [24, 8], look: NPC_LOOKS.lucia, facing: 0, quests: ['q_cat'],
      talk: [{ lines: ['¡Qué día tan bonito!'] }] },
    { type: 'npc', id: 'misi', name: 'Misi', tile: [33, 23], look: 'cat', facing: -Math.PI / 2,
      talk: [{ lines: ['Miau. (El gato te mira con desdén y sigue mirando el agua.)'] }] },
    { type: 'npc', id: 'granjero', name: 'Granjero Tomás', tile: [25, 14], look: NPC_LOOKS.farmer, facing: -Math.PI / 2, quests: ['q_slimes'],
      talk: [{ lines: ['Las calabazas de este año van a ser enormes... si los limos me dejan.'] }] },
    { type: 'npc', id: 'herrero', name: 'Herrero Gonzalo', tile: [10, 14.3], look: NPC_LOOKS.smith, facing: 0, quests: ['q_package', 'q_mineral'],
      talk: [{ lines: ['El martillo no descansa. ¡Clang, clang!', 'Si alguna vez ves un bloque de mineral raro en las cuevas, tráemelo.'] }] },
    { type: 'npc', id: 'mercader', name: 'Mercader Rosa', tile: [21, 13.3], look: NPC_LOOKS.merchant, facing: 0,
      shop: [
        { item: 'potion', price: 20 },
        { item: 'heart_container', price: 150, stock: 1, id: 'shop_v_heart' },
      ],
      talk: [{ lines: ['¡Bienvenido a la tienda de Rosa! Pociones frescas, recién hechas.'] }] },
    { type: 'npc', id: 'pablo', name: 'Pablo', tile: [15, 17], look: NPC_LOOKS.kid, facing: Math.PI, wander: 2,
      talk: [
        { when: { notFlag: 'tutorial_done' }, lines: ['¿Vas a ser un aventurero? ¡Yo también cuando sea mayor!', 'Dicen que en el seto del suroeste hay un hueco secreto... Pero yo no me atrevo.'] },
        { lines: ['¡Pssst! En el bosque, los árboles a veces esconden pasadizos. ¡Prueba a atravesar los que parecen raros!', 'Y los arbustos se pueden cortar con la espada. ¡A veces tienen monedas!'] },
      ] },
    { type: 'npc', id: 'guardia', name: 'Guardia Marta', tile: [20, 3.5], look: NPC_LOOKS.guard, facing: -Math.PI / 2,
      talk: [
        { when: { notFlag: 'tutorial_done' }, lines: ['Alto. Nadie cruza la puerta norte sin el permiso del Anciano Bruno.'] },
        { lines: ['El Anciano confía en ti. ¡Buena suerte en el bosque!', 'Cuidado con los trasgos: levantan la porra antes de golpear. ¡Bloquea o esquiva en ese momento!'] },
      ] },

    // --- compañeros que se quedan en la aldea tras su despedida (fase 5) ---
    // (al despedirse, cada uno ocupa su sitio exacto; estas posiciones son las de las siguientes visitas)
    { type: 'npc', id: 'kael', name: 'Kael', tile: [13, 13], kaykit: COMPANIONS.kael.look, facing: 0, when: { flag: 'farewell_kael' },
      look: { tunic: 0x3a3a4a, hair: 0x222222, hat: 0x3a3a4a, hatStyle: 'hood', pants: 0x2a2a2a, face: 'npc' },
      talk: [{ lines: ['Vigilo el camino del norte desde los tejados. Si el humo del volcán se acerca, avísame.'] }] },
    { type: 'npc', id: 'cedric', name: 'Sir Cedric', tile: [18, 18], kaykit: COMPANIONS.cedric.look, facing: Math.PI, when: { flag: 'farewell_cedric' },
      look: { tunic: 0x9aa4b0, hair: 0xe8c86a, pants: 0x5a5a6a, face: 'npc' },
      talk: [{ lines: ['Ayudo a Tomás con las calabazas. La cosecha no se detiene, ni aunque tiemble la montaña.'] }] },
    { type: 'npc', id: 'aldric', name: 'Sir Aldric', tile: [21, 17], kaykit: COMPANIONS.aldric.look, facing: -Math.PI / 2, when: { flag: 'farewell_aldric' },
      look: { tunic: 0x9aa4b0, hair: 0x6b4a2a, hat: 0x9aa4b0, hatStyle: 'helmet', pants: 0x5a5a6a, face: 'npc' },
      talk: [{ lines: ['La guardia de la aldea es mía ahora. Tú ve, que el volcán no espera.'] }] },
    { type: 'npc', id: 'borg', name: 'Borg', tile: [21, 15], kaykit: COMPANIONS.borg.look, facing: -Math.PI / 2, when: { flag: 'farewell_borg' },
      look: { tunic: 0x8a5a3a, hair: 0x6b3a1a, hatStyle: 'none', pants: 0x4a3a2a, beard: 0x6b3a1a, face: 'npc', scale: 1.1 },
      talk: [{ lines: ['La taberna abre cuando vuelvas. Mientras, ayudo a Rosa con los barriles.'] }] },

    // --- puertas y transiciones ---
    { type: 'door', id: 'v_gate', tile: [17, 2], span: 2, requires: { flag: 'tutorial_done' }, auto: true,
      lockedText: 'La puerta norte está cerrada. El Anciano Bruno tiene que dar permiso.' },
    { type: 'door', id: 'v_garden_door', tile: [31, 4], span: 1, requires: { item: 'key_small' }, consume: true,
      lockedText: 'Una puerta de jardín cerrada con llave. Necesitas una llave pequeña.' },
    { type: 'portal', tile: [17, 0], span: 2, to: 'forest', spawn: 'fromVillage', label: 'Bosque Encantado' },
    // sendero del volcán (fase 5): tras la granja, solo cuando los amigos se han despedido
    { type: 'portal', tile: [31, 0], span: 2, to: 'volcano', spawn: 'fromVillage', label: 'Volcán Ardiente', when: { flag: 'phase5_start' }, requires: { flag: 'farewell_done' },
      lockedText: 'El sendero del volcán está cubierto de ceniza. Antes, despídete de tus amigos.' },

    // --- cofres ---
    { type: 'chest', id: 'v_meadow', tile: [32, 31], item: 'key_small', facing: Math.PI },
    { type: 'chest', id: 'v_garden', tile: [33, 2], item: 'heart_container', facing: Math.PI / 2 },
    { type: 'chest', id: 'v_secret', tile: [3, 30.5], item: 'bag', facing: Math.PI / 2, secret: true },

    // --- entrenamiento ---
    { type: 'dummy', id: 'd1', tile: [3, 15] },
    { type: 'dummy', id: 'd2', tile: [5, 15] },
    { type: 'dummy', id: 'd3', tile: [4, 18] },

    // --- decoración con colisión ---
    { type: 'prop', kind: 'well', tile: [14, 16], radius: 1.5 },
    { type: 'prop', kind: 'statue', tile: [17.5, 14.5], radius: 1.3 },
    { type: 'prop', kind: 'stall', tile: [21, 12.3], box: [3.4, 1.4] },
    { type: 'prop', kind: 'anvil', tile: [11, 13.4], radius: 0.6 },
    { type: 'sign', tile: [19, 10.5], text: '↑ Norte: Bosque Encantado\n← Oeste: Zona de entrenamiento\n→ Este: Granja de Tomás' },
    { type: 'sign', tile: [7, 15.5], text: 'ZONA DE ENTRENAMIENTO\nAtaca: clic izq. / F · Combo: pulsa varias veces\nBloquea: clic der. / R · Esquiva: Espacio' },
    // --- estanque de la ballena (Perla salta sola de vez en cuando; se le puede silbar desde la orilla) ---
    { type: 'whale', name: 'Perla', tile: [28, 22.5], spots: [[25.5, 22.5], [30.5, 22.5]] },
    { type: 'sign', tile: [25, 19], text: 'ESTANQUE DE LA BALLENA\nAquí vive Perla, una ballena mágica que encogió para caber en el estanque.\nSilba desde la orilla y saltará para ti.' },
    { type: 'sign', tile: [19, 26], text: 'PRADO SUR\n¡Cuidado con los limos!\nCorta los arbustos: a veces esconden monedas.' },

    // --- antorchas (luces dinámicas) ---
    { type: 'torch', tile: [13, 12] }, { type: 'torch', tile: [22.6, 18.6] },
    { type: 'torch', tile: [13, 18.6] }, { type: 'torch', tile: [16, 3.3] },
    { type: 'torch', tile: [19.6, 3.6] }, { type: 'torch', tile: [7.4, 10.4] },
    { type: 'torch', tile: [16.2, 26.4] }, { type: 'torch', tile: [19.8, 26.4] },

    // --- enemigos del Prado Sur ---
    { type: 'enemy', kind: 'slime', tile: [10, 29] },
    { type: 'enemy', kind: 'slime', tile: [14, 31] },
    { type: 'enemy', kind: 'slime', tile: [24, 29] },
    { type: 'enemy', kind: 'slime', tile: [27, 31] },
    { type: 'enemy', kind: 'slime', tile: [20, 31] },
    { type: 'enemy', kind: 'slime', tile: [30, 30] },
    { type: 'enemy', kind: 'bat', tile: [12, 30] },
    { type: 'enemy', kind: 'bat', tile: [29, 29] },
    { type: 'enemy', kind: 'plant', tile: [23, 31] },
    { type: 'enemy', kind: 'plant', tile: [9, 32] },
  ],
};

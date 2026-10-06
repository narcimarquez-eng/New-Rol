// ZONA 3 — Cuevas Heladas (Fase 2).
// Campamento nevado, lago helado (puzle deslizante), sala de los bloques
// (empujar un bloque hasta la placa rúnica), sala secreta del oeste, valle de
// los lobos, refugio de Sven y la caverna del Golem de Hielo (mini-jefe), que
// guarda la Llave de Fuego. Los puzles están verificados con el solucionador
// de tools/genmaps.py (python3 tools/genmaps.py caves).

const LOOKS = {
  olaf: { tunic: 0x3d5a80, hair: 0xd4a373, hat: 0xc0392b, hatStyle: 'hood', beard: 0xd4a373, pants: 0x2b2d42, boots: 0x4a2f1e, face: 'npc', eyes: '#3a5a8a', scale: 1.08 },
  greta: { tunic: 0x6b4f3a, hair: 0x9c4a1a, hat: 0xe9c46a, hatStyle: 'helmet', pants: 0x3e3a36, apron: 0x8a6a4a, face: 'girl', eyes: '#5a3a22' },
  sven: { tunic: 0x2a6f97, hair: 0xf2d16b, hat: 0x2a6f97, hatStyle: 'hood', beard: 0xf2d16b, pants: 0x3a3a4a, face: 'npc', eyes: '#3b6fd8' },
};

export default {
  id: 'caves',
  name: 'Cuevas Heladas',
  subtitle: 'Donde el viento canta entre cristales',
  difficulty: 1.9,
  enterFlag: 'entered_caves',
  terrain: { amplitude: 0.35, seed: 21 },
  wallStyle: 'rock',
  ambient: 'snow',
  palette: {
    ground: { grass: 0xdfeaf3, forest: 0xd3e2ee, path: 0xb9c6d4, stone: 0x9aa8b8, sand: 0xd8e2ea, water: 0x6fa8c8, snow: 0xeef5fb, ice: 0xa9dcf2 },
    groundReal: { grass: 0xdde6ee, forest: 0xd0dbe6, path: 0x9aa4ae, stone: 0x8c96a2, sand: 0xc8d0d8, water: 0x5a6a78, snow: 0xeef3f8, ice: 0xbfdcea },
    trunk: 0x5a4636, leaf: 0x6f9a8a, leaf2: 0x8fb8a8, pine: 0x2f5d50, pine2: 0x3d7060, pineSnow: 0xffffff,
    rock: 0x6f7f95, rock2: 0x8a9bb0, bush: 0x6f9a8a, hedge: 0x5a6b80, hedge2: 0x7a8ba0, cliffTop: 0xf4f9fd, cliffIce: 0xbfefff,
    wood: 0x6b4426, wood2: 0x8b5a2b, grassTuft: 0xcfe0ec,
    crystal: 0x7fdcff, crystal2: 0xd6f7ff, crystalGlow: 0x2a7fa8, crystalLight: 0x6fd0ff,
    icePillar: 0xa8e6ff, icePillar2: 0xe0f8ff,
    skyTop: 0x4d6f98, skyHorizon: 0xcfe0ee, skyBottom: 0xb8cede, fog: 0xbcd2e4,
    water: 0x8fd8f0, waterDeep: 0x2f6f95, mountain: 0x7f95b0, mountainSnow: 0xffffff,
    sunColor: 0xe8f2ff, hemiSky: 0xdfefff, hemiGround: 0x7f8fa0, hemiIntensity: 1.15,
    cloudTint: 0.95, grassDensity: 0,
  },
  grade: { saturation: 1.02, contrast: 1.07, warmth: -0.025, vignette: 0.38, tint: 0xf2f8ff },
  bloom: { strength: 0.28, threshold: 0.97 },
  torchIntensity: 4.5,
  fog: { near: 30, far: 115 },
  atmosphere: { backdrop: { peak: 110, snowline: 14, colors: { meadow: 0xdde4ec, forest: 0x34443e, rock: 0x7f8a98, snow: 0xf4f7fb } }, elevation: 22, azimuth: 140, turbidity: 3, rayleigh: 2.6, mie: 0.004, haze: 0xc8d6e4, fogDensity: 0.0055,
    sunColor: 0xe8f0ff, waterColor: 0x22384a, groundBounce: 0xc8d4e0 },
  pineKind: 'snowPine',
  rockReal: 0x9aa4b0,
  music: { root: 62, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 70, prog: [0, 5, 2, 6, 0, 3, 4, 4], lead: 'sine', pad: 'triangle' },
  map: [
    '######################==######################',
    '######################nn######################',
    '###########nnnnnnnnnnnnnnnnnnnnnnnn###########',
    '##########cnnnnnnnnnnnnnnnnnnnnnnnnc##########',
    '#########nnnnnnnnnnnnnnnnnnnnnnnnnnnn#########',
    '#########nnnnnnnnnnnnnnnnnnnnnnnnnnnn#########',
    '#########nnnncnnnnnnnnnnnnnnnnnncnnnn#########',
    '#########nnnnnnnnnnnnnnnnnnnnnnnnnnnn#########',
    '#########nnnnnnnnnnnnnnnnnnnnnnnnnnnn#########',
    '#########nnnnnnnnnnnnnnnnnnnnnnnnnnnn#########',
    '##########cnnnnnnnnnnnnnnnnnnnnnnnnc##########',
    '###########nnnnnnnnnnnnnnnnnnnnnnnn###########',
    '######################nn######################',
    '######################nn######################',
    '######################nn######################',
    '######################nn######################',
    '######################nn######################',
    '######################nn######################',
    '##nnnnnnnnn#nnnnnnnnnnnnnnnnnnnn##nnnnnnnn####',
    '##niIIiIiin#nnnnnnnnnnnnnnnnnnnn##nnnnnnnn####',
    '##niiiiiIin#nniiiiiiiiiiiiiiIinn##nnnnnnnc####',
    '##nIiIiiiIn#nniiiiiiiiiiiiiiiinn##nnnnnnnn####',
    '##niiiiiiin%nniiiiiiiiiiIiiiiInn##nnnnnnnn####',
    '##niiiiiiin#nniiiiIiiiiiiiiiiinn##nnnnnnnc####',
    '##niiiiiiin#nniiiiIIiiiiiiiiiinn##nnnnnnnn####',
    '##niiiiiiin#nniiiiiiIiiiiiiiiinn##nncnnnnn####',
    '##niiiiiiin#nnnnnnnnnnnnnnnnnnnn##nnnnnnnn####',
    '##nnnnnnnnn#nnnnnnnnnnnnnnnnnnnn#####nn#######',
    '######################nn#############nn#######',
    '######################nn#############nn#######',
    '##nnnnnnnnnnn#nnnnnnnnnnnnnnnnnnnnPnnnnncnnn##',
    '##niiiiiiiiin#nnnnnRnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##niiiiiiiiin#nnnnnnnnnnnnnnnnnnnnnnnnnnnnPn##',
    '##niiiiiiiiin#nnnnnnnnnnnnnnnPnnnnnnnnnnnnnn##',
    '##niiiiiiiiin#nnnnnnnnnnnnnRnnnnnPnnnnnnnnnn##',
    '##niIiiiIIiin#nnnPnnnnnnnnnnnnnnnnnnnPnnnnnn##',
    '##niiiiiiIIin#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##niiiiiiiiinnnnnnnnnnnnnnnnnnnnnRnnnnnnnnnn##',
    '##niiiiiiiiinnnnnnnnnnnnnnPnnnnnnnnnnnnnnnnP##',
    '##niiIiIiIiIn#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##nnnnnnnnnnn#nnnnnnnnnnnnnnnnnnncnnnnnnnnnn##',
    '######################nn##########nnnnnnnnnn##',
    '##############Pnnnnnnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##########nnn#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##########nnn%nnnnnnnnnnnnnnnnnnnnnnnPnPnnnn##',
    '##########nnn#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##############nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn##',
    '##############nnnnnnnnnnnnnnnnnnnn############',
    '######################==######################',
    '######################==######################',
  ],
  entities: [
    // --- apariciones y salidas ---
    { type: 'spawn', id: 'fromForest', tile: [22.5, 47], facing: Math.PI },
    { type: 'spawn', id: 'fromDesert', tile: [22.5, 2.5], facing: 0 },
    { type: 'portal', tile: [22, 49], span: 2, to: 'forest', spawn: 'fromCaves', label: 'Bosque Encantado' },
    {
      type: 'portal', tile: [22, 0], span: 2, to: 'desert', spawn: 'fromCaves', label: 'Desierto Perdido', flag: 'phase2_complete',
      ending: {
        title: '¡Fase 2 completada!',
        tagline: 'Has derrotado al Golem de Hielo y el muro del norte se ha derretido.',
        text: 'Más allá de las cuevas, el viento trae arena caliente: te espera el <b>Desierto Perdido</b> y, después, el <b>Castillo Final</b>.<br/>Llegarán en las próximas fases.',
      },
    },

    // --- puertas ---
    { type: 'door', id: 'c_gateA', tile: [22, 29], span: 2, requires: { item: 'key_frost' }, consume: true, style: 'ice',
      lockedText: 'Una reja de hielo macizo. Su cerradura tiene forma de copo de nieve: necesitas la Llave de escarcha.' },
    { type: 'door', id: 'c_gateB', tile: [22, 17], span: 2, requires: { flag: 'c_plate1' }, auto: true, style: 'ice',
      lockedText: 'La reja no tiene cerradura. Quizá se abra con algún mecanismo de la sala...' },
    { type: 'door', id: 'c_north', tile: [22, 1], span: 2, requires: { item: 'key_fire' }, consume: true, style: 'icewall',
      lockedText: 'Un muro de hielo eterno bloquea el paso. Solo un fuego mágico podría derretirlo.' },

    // --- refugio y campamento ---
    { type: 'house', tile: [15, 42], size: [2, 2], roof: 0x9d0208, wall: 0x8a6a4a },
    { type: 'prop', kind: 'campfire', tile: [21, 45], radius: 0.9 },
    { type: 'prop', kind: 'log', tile: [19.2, 45.4], box: [2.2, 0.8] },

    // --- NPCs ---
    { type: 'npc', id: 'olaf', name: 'Montañero Olaf', tile: [19.5, 44], look: LOOKS.olaf, facing: Math.PI / 2, quests: ['q_soup', 'q_wolves'],
      talk: [{ lines: ['El hielo de este lago es traicionero: una vez que resbalas, no paras hasta chocar con algo.'] }] },
    { type: 'npc', id: 'greta', name: 'Minera Greta', tile: [36.5, 32], look: LOOKS.greta, facing: -Math.PI / 2, quests: ['q_crystals'],
      talk: [{ lines: ['Pico, pala y paciencia. Así se encuentran los mejores cristales.'] }] },
    { type: 'npc', id: 'sven', name: 'Explorador Sven', tile: [37.5, 20.5], look: LOOKS.sven, facing: Math.PI,
      talk: [
        { when: { notFlag: 'boss_caves' }, lines: ['Al norte de la sala de los bloques duerme un Golem de Hielo.', 'Cuando levanta los dos brazos va a aplastar el suelo: ¡aléjate! Cuando se agrieta, empieza a lanzar rocas.'] },
        { lines: ['¡Derrotaste al Golem! Dicen que su Llave de Fuego derrite cualquier hielo.'] },
      ] },

    // --- cofres ---
    { type: 'chest', id: 'c_lake', tile: [7, 35], item: 'key_frost', facing: Math.PI / 2 },
    { type: 'chest', id: 'c_west', tile: [6, 19], item: 'heart_container', facing: Math.PI, secret: true },
    { type: 'chest', id: 'c_mineral', tile: [11, 44], item: 'mineral', facing: Math.PI / 2, secret: true },
    { type: 'chest', id: 'c_big', tile: [22.5, 3.5], item: 'key_fire', big: true, facing: Math.PI, requires: { flag: 'boss_caves' }, flag: 'got_key_fire' },
    { type: 'chest', id: 'c_sven', tile: [40, 18.4], item: 'potion', facing: Math.PI },
    { type: 'chest', id: 'c_den', tile: [42.5, 45.5], item: 'bag', facing: -Math.PI / 2 },

    // --- puzle de bloques ---
    { type: 'iceblock', id: 'b1', group: 'g1', tile: [16, 26] },
    { type: 'plate', id: 'p1', tile: [27, 19], flag: 'c_plate1', block: 'b1', text: '¡Se oye un crujido: la reja de hielo del norte se abre!' },
    { type: 'resetstone', tile: [31, 27], group: 'g1', facing: -Math.PI / 2 },

    // --- cristales de escarcha (misión de Greta) ---
    { type: 'pickup', id: 'c_cr1', item: 'frost_crystal', tile: [3, 40] },
    { type: 'pickup', id: 'c_cr2', item: 'frost_crystal', tile: [40, 24] },
    { type: 'pickup', id: 'c_cr3', item: 'frost_crystal', tile: [43, 46] },
    { type: 'pickup', id: 'c_cr4', item: 'frost_crystal', tile: [30, 27] },
    { type: 'pickup', id: 'c_cr5', item: 'frost_crystal', tile: [3, 27] },
    { type: 'pickup', id: 'c_cr6', item: 'frost_crystal', tile: [16, 31] },
    { type: 'pickup', id: 'c_cr7', item: 'frost_crystal', tile: [12, 2.5] },

    // --- carteles ---
    { type: 'sign', tile: [24.6, 45.6], text: '↑ CUEVAS HELADAS\n← Lago helado  ·  → Valle de los lobos\n¡Cuidado: el hielo resbala!' },
    { type: 'sign', tile: [12.2, 35.8], text: 'LAGO HELADO\nSobre el hielo resbalas en línea recta hasta chocar con algo.\nPiensa antes de moverte.' },
    { type: 'sign', tile: [20.4, 26.6], text: 'SALA DE LOS BLOQUES\nCamina contra un bloque para empujarlo. Sobre el hielo se desliza.\nSi se atasca, toca la piedra rúnica.' },

    // --- antorchas ---
    { type: 'torch', tile: [21, 30.4] }, { type: 'torch', tile: [24, 30.4] },
    { type: 'torch', tile: [21, 18.4] }, { type: 'torch', tile: [24, 18.4] },
    { type: 'torch', tile: [21, 2.6] }, { type: 'torch', tile: [24, 2.6] },
    { type: 'torch', tile: [18, 43] }, { type: 'torch', tile: [27, 43] },

    // --- enemigos ---
    { type: 'enemy', kind: 'wolf', tile: [30, 34] },
    { type: 'enemy', kind: 'wolf', tile: [40, 36] },
    { type: 'enemy', kind: 'wolf', tile: [40, 44] },
    { type: 'enemy', kind: 'wolf', tile: [42, 42] },
    { type: 'enemy', kind: 'wolf', tile: [36, 45] },
    { type: 'enemy', kind: 'iceSlime', tile: [17, 33] },
    { type: 'enemy', kind: 'iceSlime', tile: [27, 38] },
    { type: 'enemy', kind: 'iceSlime', tile: [32, 31] },
    { type: 'enemy', kind: 'iceSlime', tile: [39, 25] },
    { type: 'enemy', kind: 'iceSlime', tile: [13, 19] },
    { type: 'enemy', kind: 'frostBat', tile: [25, 35] },
    { type: 'enemy', kind: 'frostBat', tile: [18, 39] },
    { type: 'enemy', kind: 'frostBat', tile: [22.5, 14] },
    { type: 'enemy', kind: 'frostSpirit', tile: [41, 31] },
    { type: 'enemy', kind: 'frostSpirit', tile: [34, 37] },
    // --- mini-jefe ---
    { type: 'enemy', kind: 'iceGolem', id: 'boss_caves', tile: [22.5, 7], flag: 'boss_caves', arena: [9, 2, 36, 11] },
  ],
};

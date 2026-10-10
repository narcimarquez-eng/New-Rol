// ZONA 6 — Volcán Ardiente (Fase 5).
// Tras la caída de Malakar, el volcán del noreste despierta. Se entra desde la
// Aldea Inicial (el sendero tras la granja) por la cuenca del sur. La lava solo
// se cruza por el puente del río; en el plateau están el campamento de Hana y
// Nuria, el explorador Teo y un muro falso con la Llave del Volcán. Al norte, tras
// la Puerta del Cráter y otro puente sobre el foso, espera Ignar, el Coloso de Magma.
// El mapa se dibuja con rectángulos (legenda en src/world/tiles.js): es fácil de editar.

// Mapa de 40 x 44 casillas, de sur a norte: cuenca de entrada (filas 35-42), ladera
// (27-34), río de lava con su puente (24-26), plateau del campamento (14-23), puerta
// del cráter (13) y cráter (2-12). Las regiones se dibujan como rectángulos.
function mapRows() {
  const W = 40, H = 44;
  const g = Array.from({ length: H }, () => Array(W).fill('^'));
  const fill = (c0, r0, c1, r1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
  const set = (c, r, ch) => { g[r][c] = ch; };
  fill(1, 14, 38, 23, '.');   // plateau de ceniza
  fill(1, 24, 38, 26, 'L');   // río de lava
  fill(18, 24, 19, 26, 'B');  // puente del río
  fill(1, 27, 38, 34, '.');   // ladera
  fill(2, 35, 37, 42, '.');   // cuenca de entrada
  fill(18, 43, 19, 43, '=');  // salida al sur (portal a la aldea)
  // pasadizo secreto: cámara con la llave, cerrada por un muro falso
  fill(1, 15, 3, 19, '^');
  fill(1, 16, 2, 18, '.');
  set(3, 17, '%');
  // cráter: foso de lava, arena del jefe y puente norte
  fill(8, 2, 31, 12, 'L');
  fill(11, 4, 28, 10, 'k');
  fill(18, 11, 19, 12, 'B');
  for (const [c, r] of [[13, 5], [26, 5], [13, 9], [26, 9]]) set(c, r, 'O');
  fill(18, 13, 19, 13, '=');  // hueco de la Puerta del Cráter
  // rocas de obsidiana
  for (const [c, r] of [[22, 16], [24, 20], [14, 22], [29, 18], [33, 22], [9, 29], [27, 30], [16, 33], [33, 32]]) set(c, r, 'R');
  // '.' se dibuja como ceniza ('a'): así no salen flores ni hierba de los suelos verdes
  return g.map((row) => row.join('').replace(/\./g, 'a'));
}

const LOOKS = {
  hana: { tunic: 0x8a3b2a, hair: 0x2a1a14, hatStyle: 'bun', pants: 0x3a2a24, apron: 0x2a2a2a, face: 'girl', eyes: '#3a2a1a' },
  nuria: { tunic: 0x5a6b7a, hair: 0xb0b0b8, hatStyle: 'hood', pants: 0x3a3a46, face: 'old', eyes: '#2a2a2a' },
  teo: { tunic: 0x3a7a5a, hair: 0x6b4a2a, hat: 0x8a6a3a, hatStyle: 'straw', pants: 0x4a4030, beard: 0x6b4a2a, face: 'npc', eyes: '#3a2a1a' },
};

const npcs = [
  { type: 'npc', id: 'hana', name: 'Hana, la forjadora', tile: [7, 16], look: LOOKS.hana, facing: 0, quests: ['q_ember', 'q_lava'],
    talk: [{ lines: [
      'Esta forja fue de mi familia durante tres generaciones. Hoy solo queda ceniza.',
      'Los puentes son el único paso seguro sobre el río de lava. No pises la lava: no perdona.',
    ] }] },
  { type: 'npc', id: 'nuria', name: 'Nuria', tile: [10, 21], look: LOOKS.nuria, facing: -Math.PI / 2, quests: ['q_flask'],
    talk: [{ lines: [
      'Huimos de la aldea del pie del volcán cuando empezó a llover ceniza.',
      'Aquí dentro estamos a salvo... de momento.',
    ] }] },
  { type: 'npc', id: 'teo', name: 'Explorador Teo', tile: [34, 16], look: LOOKS.teo, facing: Math.PI, quests: ['q_obsidian'],
    talk: [{ lines: [
      'Mido la temperatura de la lava con un palo largo. Hasta ahora no me ha ido mal... casi.',
      'Desde que cayó Malakar, la montaña respira fuego. Dicen que su última sombra se hundió en el cráter.',
      'Desde aquí se ve el cráter. Ahí dentro hay algo que late como un corazón, y cada latido levanta humo.',
    ] }] },
];

const entities = [
  // --- aparición y salidas ---
  { type: 'spawn', id: 'fromVillage', tile: [18, 40], facing: Math.PI },
  { type: 'portal', tile: [18, 43], span: 2, to: 'village', spawn: 'fromVolcano', label: 'Aldea Inicial' },
  { type: 'portal', tile: [18, 4], span: 2, to: 'credits', flag: 'volcano_complete', when: { flag: 'boss_volcano' }, label: 'Cima del volcán',
    ending: {
      title: '¡El volcán vuelve a dormir!',
      tagline: 'Ignar ha caído y la ceniza deja de caer sobre la aldea.',
      text: 'Desde la cima se ve la aldea, pequeña y tranquila. Kael, Borg, Sir Aldric y Sir Cedric te esperan abajo, cada uno en su puesto.<br/><b>¡Gracias por jugar a New Rol!</b>',
    } },

  // --- puerta del cráter: sellada hasta tener la llave ---
  { type: 'door', id: 'v_crater', tile: [18, 13], span: 2, requires: { item: 'key_volcano' }, consume: true, style: 'stone',
    lockedText: 'La Puerta del Cráter es de obsidiana y está sellada. Necesitas la Llave del Volcán.' },

  // --- cofres (el de la llave está tras un muro falso) ---
  { type: 'chest', id: 'v_key', tile: [1, 17], item: 'key_volcano', facing: Math.PI / 2, secret: true },
  { type: 'chest', id: 'v_east', tile: [36, 22], item: 'potion', facing: Math.PI },
  { type: 'chest', id: 'v_slope', tile: [2, 30], item: 'stamina_up', facing: Math.PI / 2 },

  // --- obsidiana repartida por la ladera (misión de Teo) ---
  { type: 'pickup', id: 'v_ob1', item: 'obsidian', tile: [6, 32] },
  { type: 'pickup', id: 'v_ob2', item: 'obsidian', tile: [30, 29] },
  { type: 'pickup', id: 'v_ob3', item: 'obsidian', tile: [22, 37] },

  // --- jefe final de la fase 5 ---
  { type: 'enemy', kind: 'ignar', id: 'boss_volcano', tile: [19, 7], flag: 'boss_volcano', arena: [11, 4, 28, 10] },

  // --- enemigos de la ladera y la cuenca ---
  { type: 'enemy', kind: 'lavaSlime', tile: [5, 28] },
  { type: 'enemy', kind: 'lavaSlime', tile: [12, 31] },
  { type: 'enemy', kind: 'lavaSlime', tile: [24, 28] },
  { type: 'enemy', kind: 'lavaSlime', tile: [31, 31] },
  { type: 'enemy', kind: 'lavaSlime', tile: [8, 34] },
  { type: 'enemy', kind: 'lavaSlime', tile: [10, 39] },
  { type: 'enemy', kind: 'ashBat', tile: [16, 29] },
  { type: 'enemy', kind: 'ashBat', tile: [28, 34] },
  { type: 'enemy', kind: 'ashBat', tile: [30, 40] },
  { type: 'enemy', kind: 'emberSpirit', tile: [20, 31] },
  { type: 'enemy', kind: 'emberSpirit', tile: [35, 28] },
  { type: 'enemy', kind: 'ashGoblin', tile: [3, 33] },
  { type: 'enemy', kind: 'ashGoblin', tile: [25, 37] },
  { type: 'enemy', kind: 'ashGoblin', tile: [36, 20] },

  // --- decoración, carteles y luces ---
  { type: 'sign', tile: [16, 38], text: 'VOLCÁN ARDIENTE\n↑ Norte: el río de lava y su puente\nLa lava quema: solo se cruza por los puentes.' },
  { type: 'prop', kind: 'campfire', tile: [9, 18], radius: 0.9 },
  { type: 'torch', tile: [17, 14] }, { type: 'torch', tile: [20, 14] },
  { type: 'torch', tile: [11, 4] }, { type: 'torch', tile: [28, 4] },
  { type: 'torch', tile: [11, 10] }, { type: 'torch', tile: [28, 10] },
  { type: 'torch', tile: [16, 41] }, { type: 'torch', tile: [21, 41] },

  ...npcs,
];

export default {
  id: 'volcano',
  name: 'Volcán Ardiente',
  subtitle: 'Donde la tierra todavía respira fuego',
  difficulty: 2.8,
  enterFlag: 'entered_volcano',
  terrain: { amplitude: 0.3, seed: 61, variant: 'castle', waterDepth: 0.9 },
  wallStyle: 'rock',
  cliffTop: 'sand', // cumbres de los acantilados cubiertas de ceniza (no de nieve)
  ambient: 'embers',
  palette: {
    ground: { ash: 0x4b4541, grass: 0x4b4541, forest: 0x3a332f, path: 0x6a5a4e, stone: 0x3e3a3d, flagstone: 0x2f2b2e, cobble: 0x4a4648, sand: 0x6a5a48, water: 0x8a1e08, clay: 0x5a4a40, snow: 0x6a6460, ice: 0x6a6460 },
    groundReal: { ash: 0x4a4440, grass: 0x4a4440, forest: 0x3a332f, path: 0x5e5048, stone: 0x3d3a3c, flagstone: 0x2c2a2c, cobble: 0x45414a, sand: 0x4d4642, water: 0x6a1a08, clay: 0x4f4238, snow: 0x5a5654, ice: 0x5a5654 },
    trunk: 0x3a2a20, leaf: 0x6a3a20, leaf2: 0x7a4a2a, pine: 0x3a2a24, pine2: 0x4a3028,
    rock: 0x5a5058, rock2: 0x463e44, bush: 0x5a3a24, hedge: 0x3a2e2c, hedge2: 0x4a3a36, cliffTop: 0x4a4048,
    wood: 0x4a3024, wood2: 0x5e3e2a, grassTuft: 0x6a4a30,
    skyTop: 0x2a1418, skyHorizon: 0xff7a40, skyBottom: 0x8a3a20, fog: 0x7a3a24,
    water: 0xff5a1a, waterDeep: 0x8a1400, mountain: 0x3a2a30, mountainSnow: 0x6a5a5a,
    sunColor: 0xff9a50, hemiSky: 0xffb08a, hemiGround: 0x4a2a20, hemiIntensity: 0.9,
    grassDensity: 0, crystalLight: 0xff8a3a,
  },
  fog: { near: 45, far: 150 },
  grade: { saturation: 1.1, contrast: 1.15, warmth: 0.06, vignette: 0.45 },
  gradeReal: { saturation: 1.05, contrast: 1.12, warmth: 0.05, vignette: 0.42 },
  // cielo de ceniza y brasas: el sol se filtra rojizo tras la columna de humo
  atmosphere: { backdrop: { peak: 120, snowline: 130, hills: 16 }, elevation: 12, azimuth: 200, turbidity: 9, rayleigh: 2.2, mie: 0.02, clouds: 0.15,
    haze: 0x7a3a24, hazeMix: 0.45, fogDensity: 0.006, sunColor: 0xff8a50, sunIntensity: 5, exposure: 0.68, hemiIntensity: 0.2, waterColor: 0x6a1a08, groundBounce: 0x7a3a20 },
  trees: ['oak'],
  torchIntensity: 10,
  music: { root: 45, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 84, prog: [0, 5, 3, 4, 0, 4, 5, 3], lead: 'sawtooth', pad: 'triangle' },
  map: mapRows(),
  entities,
};

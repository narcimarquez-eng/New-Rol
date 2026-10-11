// ZONA 6 — Volcán Ardiente (Fase 5), en cuatro actos.
// I · La cuenca: el campamento de refugiados de Nuria, los limos de la ladera y
//     la ceniza que flota (muñeco de Pipo, obsidiana, fragmentos de sombra).
// II · El río de lava: el puente está cerrado por una reja. Tres braseros de la
//     orilla, encendidos a la vez con el fuego eterno, la levantan.
// III · El plateau: la forja de Hana, el campamento de Teo, la forja antigua de
//     Ardea y la Llave del Volcán, tras un muro falso.
// IV · El cráter: la Puerta del Cráter, el puente sobre el foso y Ignar. Al vencerlo,
//     el espíritu de Ardea deja elegir: destruir la Brasa Negra o sellarla. Cada
//     elección abre una salida distinta.
// El mapa se dibuja con rectángulos (legenda en src/world/tiles.js). El volcán del
// horizonte es una silueta aparte (campo `landmark`, ver src/gfx/Landmark.js).

// Mapa de 44 x 60 casillas, de norte a sur: cráter (filas 2-12), puerta del cráter (13),
// plateau (14-23), río de lava con su puente (24-26), ladera con la reja (27-36) y
// cuenca de entrada (37-58). Las regiones se dibujan como rectángulos.
function mapRows() {
  const W = 44, H = 60;
  const g = Array.from({ length: H }, () => Array(W).fill('^'));
  const fill = (c0, r0, c1, r1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
  const set = (c, r, ch) => { g[r][c] = ch; };
  // cráter: foso de lava, arena de Ignar y puente norte
  fill(7, 2, 36, 12, 'L');
  fill(11, 4, 32, 10, 'k');
  fill(20, 11, 21, 12, 'B');
  fill(20, 13, 21, 13, '=');   // hueco de la Puerta del Cráter
  for (const [c, r] of [[13, 5], [30, 5], [13, 9], [30, 9]]) set(c, r, 'O');
  // plateau de la forja
  fill(1, 14, 42, 23, '.');
  fill(1, 15, 3, 19, '^');     // cámara secreta de la llave, al oeste
  fill(1, 16, 2, 18, '.');
  set(3, 17, '%');             // muro falso: se atraviesa
  for (const [c, r] of [[12, 15], [22, 16], [26, 21], [15, 22], [35, 23], [39, 18]]) set(c, r, 'R');
  // río de lava y su puente (la reja cierra el puente por el sur)
  fill(1, 24, 42, 26, 'L');
  fill(20, 24, 21, 26, 'B');
  // ladera: braseros del puente y rocas de obsidiana
  fill(1, 27, 42, 36, '.');
  for (const [c, r] of [[6, 29], [35, 28], [9, 34], [37, 33], [27, 35]]) set(c, r, 'R');
  // cuenca de entrada y campamento de refugiados
  fill(2, 37, 41, 58, '.');
  for (const [c, r] of [[8, 40], [36, 40], [14, 46], [28, 48], [37, 53], [5, 56], [38, 57]]) set(c, r, 'R');
  fill(20, 59, 21, 59, '=');   // salida al sur (portal a la aldea)
  // '.' se dibuja como ceniza ('a'): así no salen flores ni hierba de los suelos verdes
  return g.map((row) => row.join('').replace(/\./g, 'a'));
}

const LOOKS = {
  hana: { tunic: 0x8a3b2a, hair: 0x2a1a14, hatStyle: 'bun', pants: 0x3a2a24, apron: 0x2a2a2a, face: 'girl', eyes: '#3a2a1a' },
  nuria: { tunic: 0x5a6b7a, hair: 0xb0b0b8, hatStyle: 'hood', pants: 0x3a3a46, face: 'old', eyes: '#2a2a2a' },
  teo: { tunic: 0x3a7a5a, hair: 0x6b4a2a, hat: 0x8a6a3a, hatStyle: 'straw', pants: 0x4a4030, beard: 0x6b4a2a, face: 'npc', eyes: '#3a2a1a' },
  pipo: { tunic: 0xd8553a, hair: 0x3a2a1a, pants: 0x3a3a5a, face: 'npc', eyes: '#2a1a0a', scale: 0.72 },
  ardea: { tunic: 0xe0a070, hair: 0xf2e6d8, hatStyle: 'hood', pants: 0x5a4030, face: 'girl', eyes: '#ffb347' },
  ardeaSpirit: { tunic: 0xffb070, hair: 0xfff0e0, hatStyle: 'hood', pants: 0xa0603a, face: 'girl', eyes: '#ffd27a' },
};

const npcs = [
  { type: 'npc', id: 'nuria', name: 'Nuria', tile: [9, 50], look: LOOKS.nuria, facing: -Math.PI / 2, quests: ['q_flask'],
    talk: [{ lines: [
      'Aquí dentro estamos a salvo... de momento.',
      'Si ves a Pipo, dile que la cena está lista. Siempre anda despistado con sus cosas.',
    ] }] },
  { type: 'npc', id: 'pipo', name: 'Pipo', tile: [13, 52], look: LOOKS.pipo, facing: Math.PI / 2, quests: ['q_toy'],
    talk: [{ lines: ['Shhh... mamá está hablando con el explorador. ¿Tú eres un héroe de verdad?'] }] },
  { type: 'npc', id: 'hana', name: 'Hana, la forjadora', tile: [7, 16], look: LOOKS.hana, facing: 0, quests: ['q_ember', 'q_lava'],
    talk: [{ lines: [
      'Esta forja fue de mi familia durante tres generaciones. Hoy solo queda ceniza.',
      'Los puentes son el único paso seguro sobre el río de lava. No pises la lava: no perdona.',
    ] }] },
  { type: 'npc', id: 'teo', name: 'Explorador Teo', tile: [35, 20], look: LOOKS.teo, facing: Math.PI, quests: ['q_obsidian'],
    talk: [{ lines: [
      'Mido la temperatura de la lava con un palo largo. Hasta ahora no me ha ido mal... casi.',
      'Desde que cayó Malakar, la montaña respira fuego. Dicen que su última sombra se hundió en el cráter.',
      'Desde aquí se ve el cráter. Ahí dentro hay algo que late como un corazón, y cada latido levanta humo.',
    ] }] },
  { type: 'npc', id: 'ardea', name: 'Ardea, espíritu de la forja', tile: [37, 16], look: LOOKS.ardea, facing: Math.PI, quests: ['q_shards'],
    talk: [
      { when: { notFlag: 'ardea_lore' }, lines: [
        'Este era el taller de los sellos. Hace siglos, mis hermanos forjaron con brasa de este volcán los tres sellos de la Gran Puerta.',
        'Después dejamos a Ignar, nuestro coloso de magma, como guardián de la forja.',
        'Pero desde que cayó Malakar, su última sombra —la Brasa Negra— se hundió en el cráter y lo ha corrompido.',
      ], do: [{ flag: 'ardea_lore' }] },
      { lines: ['Ignar protegía esta forja. Cuando estés listo, sube al cráter. No lo subestimes.'] },
    ] },
];

// El espíritu de Ardea aparece en el cráter cuando cae Ignar, y allí se decide el final.
const ardeaSpirit = { type: 'npc', id: 'ardea_spirit', name: 'Ardea, espíritu de la forja', tile: [21, 6], look: LOOKS.ardeaSpirit, facing: Math.PI,
  when: { flag: 'boss_volcano' },
  talk: [
    { when: { notFlag: 'v_choice_done' }, lines: [
      'Ignar era nuestro guardián. La sombra de Malakar lo corrompió desde dentro.',
      'Ahí abajo, en el fondo del cráter, late la Brasa Negra: el último rastro de Malakar.',
      'Puedes destruirla. El volcán se apagará y la ceniza dejará de caer sobre la aldea.',
      'O sellarla en una urna de obsidiana, como hicimos con los sellos. El volcán dormirá, pero la brasa seguirá allí.',
      '¿Qué decides?',
    ], choices: [
      { label: 'Destruirla', do: [{ flag: 'v_destroy' }, { flag: 'v_choice_done' }] },
      { label: 'Sellarla', do: [{ flag: 'v_seal' }, { flag: 'v_choice_done' }] },
    ] },
    { when: { flag: 'v_destroy' }, lines: ['La brasa se ha deshecho en luz. La montaña respira tranquila por primera vez en días.', 'Sal por la salida del norte. Gracias, forastero.'] },
    { lines: ['La brasa duerme en su urna de obsidiana, bajo el cráter.', 'No la despiertes nunca más. Sal por la grieta del norte.'] },
  ] };

const entities = [
  // --- aparición y salidas ---
  { type: 'spawn', id: 'fromVillage', tile: [20, 56], facing: Math.PI },
  { type: 'portal', tile: [20, 59], span: 2, to: 'village', spawn: 'fromVolcano', label: 'Aldea Inicial' },
  // dos salidas del cráter: aparece una u otra según lo que decidas con la Brasa Negra
  { type: 'portal', tile: [14, 4], span: 2, to: 'credits', flag: 'volcano_complete', when: { flag: 'v_destroy' }, label: 'Cima del volcán',
    ending: {
      title: '¡El volcán se apaga!',
      tagline: 'La Brasa Negra se deshace en chispas y la ceniza deja de caer sobre la aldea.',
      text: 'Desde la cima se ve la aldea, pequeña y tranquila. Kael, Borg, Sir Aldric y Sir Cedric te esperan abajo, cada uno en su puesto.<br/><b>¡Gracias por jugar a New Rol!</b>',
    } },
  { type: 'portal', tile: [26, 4], span: 2, to: 'credits', flag: 'volcano_complete', when: { flag: 'v_seal' }, label: 'Grieta sellada',
    ending: {
      title: '¡El volcán duerme!',
      tagline: 'Ardea sella la brasa en una urna de obsidiana, bajo el cráter.',
      text: 'La ceniza deja de caer, pero bajo la montaña el fuego sigue vivo. Quizá algún día vuelva a despertar... Kael, Borg, Sir Aldric y Sir Cedric te esperan en la aldea.<br/><b>¡Gracias por jugar a New Rol!</b>',
    } },

  // --- puertas: la reja del puente se levanta con los braseros; la del cráter, con la llave ---
  { type: 'door', id: 'v_bridge', tile: [20, 27], span: 2, requires: { flag: 'v_bridge_open' }, auto: true, style: 'stone',
    lockedText: 'Una reja de hierro cierra el puente. Tres braseros de la orilla, encendidos a la vez, la levantarán.' },
  { type: 'door', id: 'v_crater', tile: [20, 13], span: 2, requires: { item: 'key_volcano' }, consume: true, style: 'stone',
    lockedText: 'La Puerta del Cráter es de obsidiana y está sellada. Necesitas la Llave del Volcán.' },

  // --- acertijo del puente: el fuego eterno enciende la espada; los tres braseros deben arder a la vez ---
  { type: 'brazier', id: 'v_eternal', tile: [20, 31], eternal: true },
  { type: 'brazier', id: 'v_b0', tile: [15, 30], group: 'v_fire', duration: 45, flag: 'v_bridge_open', text: '¡Los tres braseros arden a la vez! La reja del puente se levanta.' },
  { type: 'brazier', id: 'v_b1', tile: [26, 30], group: 'v_fire', duration: 45, flag: 'v_bridge_open', text: '¡Los tres braseros arden a la vez! La reja del puente se levanta.' },
  { type: 'brazier', id: 'v_b2', tile: [20, 34], group: 'v_fire', duration: 45, flag: 'v_bridge_open', text: '¡Los tres braseros arden a la vez! La reja del puente se levanta.' },

  // --- cofres (el de la llave está tras un muro falso) ---
  { type: 'chest', id: 'v_key', tile: [1, 17], item: 'key_volcano', facing: Math.PI / 2, secret: true },
  { type: 'chest', id: 'v_slope', tile: [2, 30], item: 'stamina_up', facing: Math.PI / 2 },
  { type: 'chest', id: 'v_east', tile: [38, 45], item: 'potion', facing: Math.PI },
  { type: 'chest', id: 'v_plat', tile: [5, 22], item: 'potion', facing: 0 },
  { type: 'chest', id: 'v_forge', tile: [41, 15], item: 'stamina_up', facing: -Math.PI / 2 },

  // --- objetos sueltos: obsidiana (Teo), muñeco (Pipo), fragmentos de sombra (Ardea) ---
  { type: 'pickup', id: 'v_ob1', item: 'obsidian', tile: [6, 33] },
  { type: 'pickup', id: 'v_ob2', item: 'obsidian', tile: [30, 38] },
  { type: 'pickup', id: 'v_ob3', item: 'obsidian', tile: [22, 44] },
  { type: 'pickup', id: 'v_doll', item: 'rag_doll', tile: [34, 41] },
  { type: 'pickup', id: 'v_shard1', item: 'shadow_shard', tile: [36, 31] },
  { type: 'pickup', id: 'v_shard2', item: 'shadow_shard', tile: [27, 18] },
  { type: 'pickup', id: 'v_shard3', item: 'shadow_shard', tile: [9, 45] },

  // --- jefe final de la fase 5 ---
  { type: 'enemy', kind: 'ignar', id: 'boss_volcano', tile: [19, 7], flag: 'boss_volcano', arena: [11, 4, 32, 10] },

  // --- enemigos: ladera, cuenca y plateau ---
  { type: 'enemy', kind: 'lavaSlime', tile: [5, 28] },
  { type: 'enemy', kind: 'lavaSlime', tile: [12, 33] },
  { type: 'enemy', kind: 'lavaSlime', tile: [30, 32] },
  { type: 'enemy', kind: 'lavaSlime', tile: [36, 30] },
  { type: 'enemy', kind: 'ashBat', tile: [16, 29] },
  { type: 'enemy', kind: 'ashBat', tile: [28, 34] },
  { type: 'enemy', kind: 'emberSpirit', tile: [33, 33] },
  { type: 'enemy', kind: 'ashGoblin', tile: [3, 33] },
  { type: 'enemy', kind: 'ashGoblin', tile: [24, 28] },
  { type: 'enemy', kind: 'lavaSlime', tile: [8, 44] },
  { type: 'enemy', kind: 'lavaSlime', tile: [30, 44] },
  { type: 'enemy', kind: 'lavaSlime', tile: [24, 52] },
  { type: 'enemy', kind: 'ashBat', tile: [16, 47] },
  { type: 'enemy', kind: 'ashBat', tile: [33, 58] },
  { type: 'enemy', kind: 'emberSpirit', tile: [34, 50] },
  { type: 'enemy', kind: 'ashGoblin', tile: [25, 38] },
  { type: 'enemy', kind: 'ashGoblin', tile: [5, 53] },
  { type: 'enemy', kind: 'ashGoblin', tile: [33, 46] },
  { type: 'enemy', kind: 'lavaSlime', tile: [12, 21] },
  { type: 'enemy', kind: 'ashGoblin', tile: [22, 18] },
  { type: 'enemy', kind: 'ashGoblin', tile: [31, 17] },
  { type: 'enemy', kind: 'emberSpirit', tile: [36, 22] },

  // --- decoración, carteles y luces ---
  { type: 'sign', tile: [18, 53], text: 'VOLCÁN ARDIENTE\nCampamento de refugiados al oeste.\nLa lava quema: solo se cruza por el puente.' },
  { type: 'sign', tile: [23, 32], text: 'PUENTE DE OBSIDIANA\nLa reja se cerró cuando el volcán despertó.\nPrende la espada en el fuego eterno (E) y enciende a la vez los tres braseros.' },
  { type: 'prop', kind: 'campfire', tile: [11, 49], radius: 0.9 },
  { type: 'prop', kind: 'campfire', tile: [9, 18], radius: 0.9 },
  { type: 'torch', tile: [17, 55] }, { type: 'torch', tile: [23, 55] },
  { type: 'torch', tile: [16, 42] }, { type: 'torch', tile: [24, 42] },
  { type: 'torch', tile: [17, 15] }, { type: 'torch', tile: [24, 15] },
  { type: 'torch', tile: [11, 4] }, { type: 'torch', tile: [32, 4] },
  { type: 'torch', tile: [11, 10] }, { type: 'torch', tile: [32, 10] },

  ...npcs,
  ardeaSpirit,
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
  // cámara un poco más baja que de costumbre: el horizonte sube y el volcán entra en el encuadre
  camera: { pitch: 0.2 },
  // el volcán del horizonte: no es parte del mapa; su cima queda a unos 85 sobre el suelo
  landmark: { x: -4, z: -290, base: 160, height: 85, rim: 24, depth: 16 },
  palette: {
    ground: { ash: 0x6e655f, grass: 0x6e655f, forest: 0x574d48, path: 0x857363, stone: 0x5e5854, flagstone: 0x5c5559, cobble: 0x625b5a, sand: 0x7a6b5b, water: 0x9a2a0a, clay: 0x6a5548, snow: 0x7a7470, ice: 0x7a7470 },
    groundReal: { ash: 0x6a615b, grass: 0x6a615b, forest: 0x544a45, path: 0x7e6d5d, stone: 0x5a5551, flagstone: 0x58525a, cobble: 0x5e5858, sand: 0x74655a, water: 0x7a200a, clay: 0x63524a, snow: 0x6e6a66, ice: 0x6e6a66 },
    trunk: 0x3a2a20, leaf: 0x6a3a20, leaf2: 0x7a4a2a, pine: 0x3a2a24, pine2: 0x4a3028,
    rock: 0x6a6068, rock2: 0x5a5058, bush: 0x5a3a24, hedge: 0x3a2e2c, hedge2: 0x4a3a36, cliffTop: 0x5a5058,
    wood: 0x4a3024, wood2: 0x5e3e2a, grassTuft: 0x6a4a30,
    skyTop: 0x3a2432, skyHorizon: 0xffa060, skyBottom: 0xa04e2a, fog: 0x9a4e2e,
    water: 0xff5a1a, waterDeep: 0x8a1400, mountain: 0x4a3a40, mountainSnow: 0x7a6a66,
    sunColor: 0xffb070, hemiSky: 0xffc8a8, hemiGround: 0x5a3a2a, hemiIntensity: 1.0,
    grassDensity: 0, crystalLight: 0xff8a3a,
  },
  fog: { near: 70, far: 210 },
  grade: { saturation: 1.08, contrast: 1.06, warmth: 0.05, vignette: 0.3 },
  gradeReal: { saturation: 1.05, contrast: 1.05, warmth: 0.04, vignette: 0.28 },
  // cielo de ceniza y brasas: el sol se filtra rojizo tras la columna de humo
  atmosphere: { backdrop: { peak: 55, snowline: 200, hills: 12, colors: { meadow: 0x4a403c, forest: 0x3a302c, rock: 0x5a4c48, snow: 0x7a6a64 } },
    elevation: 10, azimuth: 200, turbidity: 9, rayleigh: 1.4, mie: 0.02, clouds: 0.1,
    haze: 0xc08a68, hazeMix: 0.3, fogDensity: 0.0028, sunColor: 0xffa060, sunIntensity: 5.0, exposure: 0.7, hemiIntensity: 0.6, waterColor: 0x6a1a08, groundBounce: 0x7a4a2a },
  trees: ['oak'],
  torchIntensity: 12,
  music: { root: 45, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 84, prog: [0, 5, 3, 4, 0, 4, 5, 3], lead: 'sawtooth', pad: 'triangle' },
  map: mapRows(),
  entities,
};

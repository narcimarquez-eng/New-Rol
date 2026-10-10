// ZONA 5 — Castillo Final (Fase 4).
// Campamento ante el foso, patio de armas, jardín y cuarteles; el Ala del Cristal
// (barreras y bloques), la Torre de la Luz (espejos), el Ala de la Llama (braseros y
// runas) y la cripta. Con los tres sellos se abre la Gran Puerta de la sala del
// trono, donde espera Malakar. El mapa y las pruebas los genera y comprueba
// tools/gen_castle.py (castle_gen.js); aquí van los personajes y el ambiente.
import { map, entities } from './castle_gen.js';

const KK = {
  aldric: { model: 'knight', show: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield'], height: 1.95 },
  cedric: { model: 'knight', show: ['Knight_Cape', '1H_Sword', 'Round_Shield'], recolor: { '0,1': '#2f8a3a' }, height: 1.9 },
  bartolo: { model: 'barbarian', show: ['Mug'], recolor: { '2,2': '#f0f0f0' }, height: 1.8 },
  isolda: { model: 'mage', show: ['Mage_Cape', 'Spellbook'], height: 1.85 },
  mirela: { model: 'rogue_hooded', show: ['Rogue_Cape'], height: 1.75 },
};
// aspecto de reserva (modelos procedurales) si los KayKit no cargan
const LOOKS = {
  aldric: { tunic: 0x9aa4b0, hair: 0x6b4a2a, hat: 0x9aa4b0, hatStyle: 'helmet', pants: 0x5a5a6a, face: 'npc' },
  cedric: { tunic: 0x9aa4b0, hair: 0xe8c86a, pants: 0x5a5a6a, face: 'npc' },
  bartolo: { tunic: 0xf0f0f0, hair: 0x5a3a22, beard: 0x5a3a22, pants: 0x4a3a2a, apron: 0xffffff, face: 'npc', scale: 1.1 },
  isolda: { tunic: 0x5a3fa0, hair: 0xd0d0d0, hat: 0x5a3fa0, hatStyle: 'hood', pants: 0x3a2a5a, face: 'girl' },
  mirela: { tunic: 0x2f6a5a, hair: 0x1a1a1a, hat: 0x2f6a5a, hatStyle: 'hood', pants: 0x3a3a3a, face: 'girl' },
};

const npcs = [
  { type: 'npc', id: 'aldric', name: 'Sir Aldric', tile: [27.5, 57.6], kaykit: KK.aldric, look: LOOKS.aldric, facing: Math.PI,
    when: { notFlag: 'companion_aldric' },
    talk: [{ lines: [
      '¡Llegaste! Te esperábamos ante el foso.',
      'Ahí está el castillo de Malakar. Antes era nuestro hogar; ahora sus caballeros son sombras.',
      'La Gran Puerta de la sala del trono tiene tres sellos: el del Cristal, en el ala oeste; el de la Luz, en la torre de la biblioteca; y el de la Llama, en el ala este.',
      'Iré contigo. ¡Por el reino!',
    ], do: [{ recruit: 'aldric' }, { flag: 'met_aldric_castle' }] }] },
  { type: 'npc', id: 'cedric', name: 'Sir Cedric', tile: [24.5, 60.5], kaykit: KK.cedric, look: LOOKS.cedric, facing: Math.PI / 2, quests: ['q_banners'],
    when: { notFlag: 'companion_cedric' },
    talk: [{ lines: ['Los estandartes del reino deben volver a ondear.'] }] },
  { type: 'npc', id: 'mirela', name: 'Mercader Mirela', tile: [31.5, 60.5], kaykit: KK.mirela, look: LOOKS.mirela, facing: -Math.PI / 2,
    shop: [
      { item: 'potion', price: 25 },
      { item: 'heart_container', price: 260, stock: 1, id: 'shop_k_heart' },
      { item: 'stamina_up', price: 180, stock: 1, id: 'shop_k_stamina' },
    ],
    talk: [{ lines: ['He seguido al ejército del reino hasta aquí. Pociones, corazones... ¡lo que haga falta para el asalto!'] }] },
  { type: 'npc', id: 'bartolo', name: 'Bartolo el cocinero', tile: [50.5, 46.5], kaykit: KK.bartolo, look: LOOKS.bartolo, facing: -Math.PI / 2, quests: ['q_knights'],
    talk: [{ lines: ['¿Hambre? Cuando esto acabe, os haré un estofado de los que resucitan.'] }] },
  { type: 'npc', id: 'isolda', name: 'Bibliotecaria Isolda', tile: [12.5, 15.4], kaykit: KK.isolda, look: LOOKS.isolda, facing: Math.PI, quests: ['q_tome'],
    talk: [{ lines: [
      'Esta es la Torre de la Luz. El ídolo del sol guía su rayo a través de los espejos.',
      'Gira los espejos hasta que la luz llegue al cristal del rincón: eso abrirá el nicho del Sello de la Luz.',
    ] }] },
];

// Tras el final (Malakar derrotado), un portal aparece en la sala del trono y lleva
// de vuelta a la Aldea Inicial: el inicio de la fase 5 (el volcán).
const returnPortal = { type: 'portal', tile: [27, 11], span: 2, to: 'village', spawn: 'fromCastle', flag: 'phase5_start',
  when: { flag: 'game_complete' }, label: 'Aldea Inicial' };

export default {
  id: 'castle',
  name: 'Castillo Final',
  subtitle: 'Las torres negras de Malakar',
  difficulty: 2.8,
  enterFlag: 'entered_castle',
  terrain: { amplitude: 0.12, seed: 57, variant: 'castle' },
  wallStyle: 'castle',
  stoneTint: 0xc8c4c8,
  palette: {
    ground: { grass: 0x6f9a4e, forest: 0x5a7d3e, path: 0xb8a078, stone: 0x9a968e, flagstone: 0x9a9690, cobble: 0x8a8680, sand: 0xc8b48a, water: 0x3a6a8a },
    groundReal: { grass: 0x6a7d44, forest: 0x56683a, path: 0x8c7a62, stone: 0x8a8680, flagstone: 0x9c9890, cobble: 0x8a8580, sand: 0xa89878, water: 0x3a3a48 },
    trunk: 0x6b4a2a, leaf: 0x4a8a3a, leaf2: 0x5a9a44, pine: 0x2f5d40, pine2: 0x3d6a4a,
    rock: 0x8a8890, rock2: 0x70707a, bush: 0x4a8a3a, hedge: 0x3f7a3f, hedge2: 0x4a8a44, cliffTop: 0x5a7d44,
    wood: 0x6b4426, wood2: 0x8b5a2b, grassTuft: 0x5a8a3e,
    skyTop: 0x2a3a6a, skyHorizon: 0xe8a080, skyBottom: 0xc08870, fog: 0xb89088,
    water: 0x4a7aa0, waterDeep: 0x1a3a5a, mountain: 0x4a4a6a, mountainSnow: 0xe8e0f0,
    sunColor: 0xffb080, hemiSky: 0xd8c0d8, hemiGround: 0x5a5048, hemiIntensity: 1.0,
    grassDensity: 30,
  },
  grade: { saturation: 1.05, contrast: 1.1, warmth: 0.03, vignette: 0.42 },
  gradeReal: { saturation: 1.02, contrast: 1.1, warmth: 0.02, vignette: 0.4 },
  fog: { near: 50, far: 160 },
  // atardecer rojizo: el sol cae tras las torres de Malakar
  atmosphere: { backdrop: { peak: 95, snowline: 70, hills: 14 }, elevation: 15, azimuth: 250, turbidity: 6, rayleigh: 2.8, mie: 0.006, clouds: 0.25, haze: 0xd8a890, hazeMix: 0.3, fogDensity: 0.0038,
    sunColor: 0xffc49a, sunIntensity: 5.4, waterColor: 0x202838, groundBounce: 0x6a6058 },
  trees: ['oak'],
  torchIntensity: 9,
  music: { root: 50, scale: [0, 2, 3, 5, 7, 8, 11], tempo: 78, prog: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'sawtooth', pad: 'triangle' },
  map,
  entities: [...entities, ...npcs, returnPortal],
};

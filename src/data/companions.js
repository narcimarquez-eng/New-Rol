// Compañeros de aventura (personajes KayKit, CC0). Se unen al grupo con la
// acción de diálogo { recruit: 'id' } y desde entonces siguen al héroe por
// todas las zonas y atacan a los enemigos cercanos.
export const COMPANIONS = {
  kael: {
    name: 'Kael',
    title: 'el Encapuchado',
    look: { model: 'rogue_hooded', show: ['Rogue_Cape', 'Knife', 'Knife_Offhand'], height: 1.8 },
    attackClips: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Slice_Diagonal'],
    attackTime: 0.55, // duración del golpe (s)
    dmg: 1, cooldown: 0.9, range: 1.8, speed: 8,
    side: -1, // se coloca a la izquierda y algo detrás del héroe
    mapColor: '#3fc46f',
    lines: ['Rápido y en silencio. Así se cruza el desierto.', 'Te cubro la espalda.', 'Esos esqueletos no se quedan muertos mucho tiempo... ¡No bajes la guardia!'],
  },
  aldric: {
    name: 'Sir Aldric',
    title: 'capitán de la guardia',
    look: { model: 'knight', show: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield'], height: 1.95 },
    attackClips: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'],
    attackTime: 0.6,
    dmg: 2, cooldown: 1.2, range: 2.0, speed: 7.2,
    side: 1,
    mapColor: '#9fb4d8',
    lines: ['¡Por el reino!', 'Este castillo fue mi hogar. Lo recuperaremos.', 'Malakar espera en la sala del trono. Necesitamos los tres sellos.'],
  },
  cedric: {
    name: 'Sir Cedric',
    title: 'el Leal',
    look: { model: 'knight', show: ['Knight_Cape', '1H_Sword', 'Round_Shield'], recolor: { '0,1': '#2f8a3a' }, height: 1.9 },
    attackClips: ['1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'],
    attackTime: 0.55,
    dmg: 2, cooldown: 1.1, range: 2.0, speed: 7.4,
    side: -1,
    mapColor: '#5ad18a',
    lines: ['Mi familia sirvió en este castillo durante cinco generaciones.', '¡Con los estandartes del reino a nuestro lado!', 'Cuidado con los hechiceros: atacan de tres en tres.'],
  },
  borg: {
    name: 'Borg',
    title: 'el Bárbaro',
    look: { model: 'barbarian', show: ['Barbarian_Hat', 'Barbarian_Cape', '2H_Axe'], height: 1.95, clips: { idle: '2H_Melee_Idle' } },
    attackClips: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin'],
    attackTime: 0.8,
    dmg: 2, cooldown: 1.6, range: 2.3, speed: 6.8,
    side: 1,
    mapColor: '#d9853b',
    lines: ['¡JA! ¡Que vengan más!', 'Mi hacha tiene sed... de arena no, de esqueletos.', 'Cuando volvamos a la aldea, invito yo a la taberna.'],
  },
};

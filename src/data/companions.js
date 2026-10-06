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

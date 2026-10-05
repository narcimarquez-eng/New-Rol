// Definición de enemigos. La zona aplica un multiplicador de dificultad
// (vida, daño y velocidad) para escalar el reto zona a zona.
//   dmg en medios corazones · drops: tabla de botín [item, probabilidad]
//   ai: 'melee' | 'hop' | 'swoop' | 'bite' | 'lunge' | 'ranged' | 'boss' | 'golem'
//   freeze: segundos de congelación (ralentiza al jugador) al golpear
export const ENEMIES = {
  // ---------- Aldea y Bosque ----------
  slime: {
    name: 'Limo', model: 'slime', hp: 3, dmg: 1, speed: 2.4, sight: 9, attackRange: 1.3, radius: 0.7,
    cooldown: 1.2, knockback: 6, color: 0x5fd35f, drops: [['coin', 0.6], ['heart', 0.25]],
  },
  bat: {
    name: 'Murciélago', model: 'bat', hp: 2, dmg: 1, speed: 4.2, sight: 11, attackRange: 1.4, radius: 0.5,
    cooldown: 1.6, knockback: 8, flying: true, color: 0x7a4fb0, drops: [['coin', 0.5], ['heart', 0.2]],
  },
  plant: {
    name: 'Planta mordedora', model: 'plant', hp: 4, dmg: 2, speed: 0, sight: 6, attackRange: 2.6, radius: 0.8,
    cooldown: 1.5, knockback: 3, stationary: true, color: 0x3aa655, drops: [['coin5', 0.3], ['heart', 0.3]],
  },
  goblin: {
    name: 'Trasgo', model: 'goblin', hp: 6, dmg: 2, speed: 3.1, sight: 12, attackRange: 2.0, radius: 0.6,
    cooldown: 1.4, windup: 0.45, knockback: 5, color: 0xd9822b, drops: [['coin5', 0.4], ['coin', 0.5], ['heart', 0.25]],
  },
  goblinKing: {
    name: 'Rey Trasgo', model: 'goblinKing', hp: 34, dmg: 3, speed: 3.4, sight: 18, attackRange: 3.2, radius: 1.3,
    cooldown: 1.1, windup: 0.6, knockback: 1.5, boss: true, color: 0xb5452b, drops: [['heart_container', 1]],
    phase2Text: '¡El Rey Trasgo se enfurece!', summon: 'goblin',
  },

  // ---------- Cuevas Heladas ----------
  iceSlime: {
    name: 'Limo de hielo', model: 'slime', variant: 'ice', hp: 4, dmg: 1, speed: 2.6, sight: 10, attackRange: 1.4, radius: 0.7,
    cooldown: 1.2, knockback: 6, color: 0x7fd6ff, freeze: 1.4, drops: [['coin', 0.6], ['heart', 0.3]],
  },
  frostBat: {
    name: 'Murciélago de escarcha', model: 'bat', variant: 'ice', hp: 3, dmg: 1, speed: 4.8, sight: 12, attackRange: 1.4, radius: 0.5,
    cooldown: 1.4, knockback: 8, flying: true, freeze: 1.0, color: 0x5b7fc4, drops: [['coin', 0.5], ['heart', 0.25]],
  },
  wolf: {
    name: 'Lobo de las nieves', model: 'wolf', ai: 'lunge', hp: 6, dmg: 2, speed: 5.0, sight: 14, attackRange: 3.4, radius: 0.8,
    cooldown: 1.3, windup: 0.4, knockback: 4, color: 0xdfe7ef, drops: [['coin5', 0.45], ['heart', 0.3]],
  },
  frostSpirit: {
    name: 'Espíritu de escarcha', model: 'spirit', ai: 'ranged', hp: 5, dmg: 2, speed: 2.4, sight: 15, attackRange: 12, preferDist: 8,
    radius: 0.6, cooldown: 2.4, windup: 0.7, knockback: 5, flying: true, flyHeight: 1.3, color: 0x9fd8ff,
    projectile: { speed: 11, size: 0.32, color: 0x9ff3ff, freeze: 1.5 }, drops: [['coin5', 0.5], ['heart', 0.3]],
  },
  iceGolem: {
    name: 'Golem de Hielo', model: 'golem', ai: 'golem', hp: 52, dmg: 3, speed: 2.3, sight: 22, attackRange: 4.6, radius: 1.8,
    cooldown: 1.3, windup: 0.75, knockback: 0.4, boss: true, color: 0x7d8fa8, drops: [['heart_container', 1]],
    phase2Text: '¡El Golem de Hielo se agrieta y brilla con furia!', phase2Color: 0x9ff3ff, summon: 'iceSlime', summonCount: 2,
  },
};

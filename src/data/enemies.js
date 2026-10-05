// Definición de enemigos. La zona aplica un multiplicador de dificultad
// (vida, daño y velocidad) para escalar el reto zona a zona.
//   dmg en medios corazones. drops: tabla de botín [item, probabilidad].
export const ENEMIES = {
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
  },
};

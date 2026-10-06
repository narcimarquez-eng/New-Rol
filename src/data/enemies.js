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

  // ---------- Desierto Perdido ----------
  // Los esqueletos usan modelos KayKit (CC0) con el esqueleto y las animaciones compartidas.
  //   shield: probabilidad de parar un golpe de frente (el remate del combo rompe la guardia)
  //   dormant: enterrado en la arena hasta que el héroe se acerca (wake = distancia)
  //   poison: segundos de veneno al golpear
  scorpion: {
    name: 'Escorpión', model: 'scorpion', ai: 'melee', hp: 6, dmg: 2, speed: 3.8, sight: 11, attackRange: 2.0, radius: 0.9,
    cooldown: 1.3, windup: 0.45, knockback: 4, color: 0x4a2e1c, poison: 4.5, drops: [['coin5', 0.4], ['heart', 0.3]],
  },
  skeletonWarrior: {
    name: 'Esqueleto guerrero', model: 'kaykit', ai: 'melee', hp: 9, dmg: 2, speed: 3.4, sight: 12, attackRange: 2.1, radius: 0.6,
    cooldown: 1.3, windup: 0.5, knockback: 3, shield: 0.6,
    kaykit: { model: 'skeleton_warrior', show: ['Skeleton_Warrior_Helmet', 'Skeleton_Warrior_Cloak'], props: { r: 'sk_blade', l: 'sk_shield_small_a' }, height: 1.9, clips: { idle: 'Idle_Combat', death: 'Death_C_Skeletons' } },
    clips: { attack: '1H_Melee_Attack_Chop' }, drops: [['coin5', 0.5], ['heart', 0.3]],
  },
  skeletonArcher: {
    name: 'Esqueleto ballestero', model: 'kaykit', ai: 'ranged', hp: 5, dmg: 2, speed: 3.0, sight: 16, attackRange: 15, preferDist: 10, radius: 0.55,
    cooldown: 2.1, windup: 0.8, knockback: 5, shootHeight: 1.35,
    projectile: { speed: 19, size: 0.07, color: 0x7a5a36, arrow: true },
    kaykit: { model: 'skeleton_rogue', show: ['Skeleton_Rogue_Hood', 'Skeleton_Rogue_Cape'], props: { r: 'sk_crossbow' }, height: 1.85, clips: { death: 'Death_C_Skeletons' } },
    clips: { shoot: '1H_Ranged_Shoot', windupSplit: 0.3 }, drops: [['coin5', 0.5], ['heart', 0.3]],
  },
  skeletonMage: {
    name: 'Esqueleto hechicero', model: 'kaykit', ai: 'ranged', hp: 6, dmg: 2, speed: 2.6, sight: 15, attackRange: 13, preferDist: 9, radius: 0.55,
    cooldown: 2.8, windup: 0.9, knockback: 5, shootHeight: 1.5,
    projectile: { speed: 9, size: 0.34, color: 0xc070ff, burst: 3, spread: 0.32 },
    kaykit: { model: 'skeleton_mage', show: ['Skeleton_Mage_Hat'], props: { r: 'sk_staff' }, height: 1.9, clips: { death: 'Death_C_Skeletons' } },
    clips: { shoot: 'Spellcast_Shoot', windupSplit: 0.4 }, drops: [['coin5', 0.6], ['heart', 0.35]],
  },
  skeletonMinion: {
    name: 'Esqueleto enterrado', model: 'kaykit', ai: 'melee', hp: 4, dmg: 1, speed: 3.9, sight: 12, attackRange: 1.9, radius: 0.55,
    cooldown: 1.2, windup: 0.4, knockback: 6, dormant: true, wake: 7, awakenTime: 1.6,
    kaykit: { model: 'skeleton_minion', show: ['Skeleton_Minion_Cloak'], props: { r: 'sk_axe' }, height: 1.75, clips: { death: 'Death_C_Skeletons', walk: 'Walking_D_Skeletons' } },
    clips: { attack: '1H_Melee_Attack_Slice_Diagonal' }, drops: [['coin', 0.6], ['heart', 0.25]],
  },
  sandKing: {
    name: 'Rey de las Arenas', model: 'kaykit', ai: 'boss', hp: 72, dmg: 3, speed: 3.6, sight: 24, attackRange: 3.8, radius: 1.5,
    cooldown: 1.1, windup: 0.65, knockback: 0.5, boss: true,
    kaykit: {
      model: 'skeleton_warrior', show: ['Skeleton_Warrior_Helmet', 'Skeleton_Warrior_Cloak'], props: { r: 'sk_axe', l: 'sk_shield_large_a' }, height: 4.4,
      recolor: { '2,2': '#7b2fa0', '4,0': '#e0b030', '6,2': '#e0b030' }, clips: { idle: 'Idle_Combat', death: 'Death_C_Skeletons' },
    },
    clips: { swing: '1H_Melee_Attack_Chop', slam: '1H_Melee_Attack_Jump_Chop', taunt: 'Taunt' },
    phase2Text: '¡El Rey de las Arenas levanta a sus súbditos de la arena!', phase2Color: 0xe0b030, summon: 'skeletonMinion', summonCount: 3,
    drops: [['heart_container', 1]],
  },
};

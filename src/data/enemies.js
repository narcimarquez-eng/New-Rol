// Definición de enemigos. La zona aplica un multiplicador de dificultad
// (vida, daño y velocidad) para escalar el reto zona a zona.
//   dmg en medios corazones · drops: tabla de botín [item, probabilidad]
//   ai: 'melee' | 'hop' | 'swoop' | 'bite' | 'lunge' | 'ranged' | 'boss' | 'golem'
//   freeze: segundos de congelación (ralentiza al jugador) al golpear
export const ENEMIES = {
  // ---------- Aldea y Bosque ----------
  slime: {
    name: 'Limo', model: 'slime', hp: 3, dmg: 1, speed: 2.4, sight: 9, attackRange: 1.3, radius: 0.7,
    cooldown: 1.2, knockback: 6, color: 0x5fd35f,
    monster: { name: 'slime', height: 1.15, headBone: null, chestBone: null, walkPace: 0.3, runPace: 0.3, hop: 0.8, puff: 0x7fe08f, clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', hurt: 'HitRecieve', death: 'Death' } },
    clips: { attack: 'Bite_Front' },
    drops: [['coin', 0.6], ['heart', 0.25]],
  },
  bat: {
    name: 'Murciélago', model: 'bat', hp: 2, dmg: 1, speed: 4.2, sight: 11, attackRange: 1.4, radius: 0.5,
    cooldown: 1.6, knockback: 8, flying: true, color: 0x7a4fb0,
    monster: { name: 'bat', height: 1.0, headBone: 'Head', chestBone: null, walkPace: 0.6, runPace: 0.6, puff: 0x6a4a8a, clips: { idle: 'Flying_Idle', walk: 'Fast_Flying', run: 'Fast_Flying', hurt: 'HitReact', death: 'Death' } },
    clips: { attack: 'Headbutt' },
    drops: [['coin', 0.5], ['heart', 0.2]],
  },
  plant: {
    name: 'Planta mordedora', model: 'plant', hp: 4, dmg: 2, speed: 0, sight: 6, attackRange: 2.6, radius: 0.8,
    cooldown: 1.5, knockback: 3, stationary: true, color: 0x3aa655,
    monster: { name: 'plant', height: 1.7, headBone: null, chestBone: null, puff: 0xd04050, clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', hurt: 'HitRecieve', death: 'Death' } },
    clips: { attack: 'Bite_Front' },
    drops: [['coin5', 0.3], ['heart', 0.3]],
  },
  goblin: {
    name: 'Trasgo', model: 'goblin', hp: 6, dmg: 2, speed: 3.1, sight: 12, attackRange: 2.0, radius: 0.6,
    cooldown: 1.4, windup: 0.45, knockback: 5, color: 0xd9822b,
    monster: { name: 'goblin', height: 1.6, headBone: 'Head', chestBone: 'Torso', walkPace: 0.22, runPace: 0.5, boneScale: { Head: 1.18 }, puff: 0x8a9a6a, clips: { idle: 'Idle', walk: 'Walk', run: 'Run', hurt: 'HitReact', death: 'Death' } },
    clips: { attack: 'Weapon' },
    drops: [['coin5', 0.4], ['coin', 0.5], ['heart', 0.25]],
  },
  goblinKing: {
    name: 'Rey Trasgo', model: 'goblinKing', hp: 34, dmg: 3, speed: 3.4, sight: 18, attackRange: 3.2, radius: 1.3,
    cooldown: 1.1, windup: 0.6, knockback: 1.5, boss: true, color: 0xb5452b,
    monster: { name: 'goblinking', height: 3.5, headBone: 'Head', chestBone: 'Torso', walkPace: 0.3, runPace: 0.75, boneScale: { Torso: [1.12, 1, 1.12] }, puff: 0x9a6aaa, clips: { idle: 'Idle', walk: 'Walk', run: 'Run', hurt: 'HitReact', death: 'Death' } },
    clips: { swing: 'Weapon', slam: 'Punch', taunt: 'Yes' },
    drops: [['heart_container', 1]],
    phase2Text: '¡El Rey Trasgo se enfurece!', summon: 'goblin',
  },

  // ---------- Cuevas Heladas ----------
  iceSlime: {
    name: 'Limo de hielo', model: 'slime', variant: 'ice', hp: 4, dmg: 1, speed: 2.6, sight: 10, attackRange: 1.4, radius: 0.7,
    cooldown: 1.2, knockback: 6, color: 0x7fd6ff, freeze: 1.4,
    monster: { name: 'iceslime', height: 1.25, headBone: null, chestBone: null, walkPace: 0.3, runPace: 0.3, hop: 0.8, puff: 0xbfefff, clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', hurt: 'HitRecieve', death: 'Death' } },
    clips: { attack: 'Bite_Front' },
    drops: [['coin', 0.6], ['heart', 0.3]],
  },
  frostBat: {
    name: 'Murciélago de escarcha', model: 'bat', variant: 'ice', hp: 3, dmg: 1, speed: 4.8, sight: 12, attackRange: 1.4, radius: 0.5,
    cooldown: 1.4, knockback: 8, flying: true, freeze: 1.0, color: 0x5b7fc4,
    monster: { name: 'frostbat', height: 1.1, headBone: 'Head', chestBone: null, walkPace: 0.65, runPace: 0.65, puff: 0xdff6ff, clips: { idle: 'Flying_Idle', walk: 'Fast_Flying', run: 'Fast_Flying', hurt: 'HitReact', death: 'Death' } },
    clips: { attack: 'Headbutt' },
    drops: [['coin', 0.5], ['heart', 0.25]],
  },
  wolf: {
    name: 'Lobo de las nieves', model: 'wolf', ai: 'lunge', hp: 6, dmg: 2, speed: 5.0, sight: 14, attackRange: 3.4, radius: 0.8,
    cooldown: 1.3, windup: 0.4, knockback: 4, color: 0xdfe7ef, drops: [['coin5', 0.45], ['heart', 0.3]],
  },
  frostSpirit: {
    name: 'Espíritu de escarcha', model: 'spirit', ai: 'ranged', hp: 5, dmg: 2, speed: 2.4, sight: 15, attackRange: 12, preferDist: 8,
    radius: 0.6, cooldown: 2.4, windup: 0.7, knockback: 5, flying: true, flyHeight: 1.3, color: 0x9fd8ff,
    projectile: { speed: 11, size: 0.32, color: 0x9ff3ff, freeze: 1.5 },
    monster: { name: 'spirit', height: 1.7, headBone: 'Head', chestBone: null, walkPace: 0.3, runPace: 0.3, trail: 0xcff6ff, puff: 0xcff6ff, clips: { idle: 'Flying_Idle', walk: 'Fast_Flying', run: 'Fast_Flying', hurt: 'HitReact', death: 'Death' } },
    clips: { shoot: 'Punch', windupSplit: 0.4 },
    drops: [['coin5', 0.5], ['heart', 0.3]],
  },
  iceGolem: {
    name: 'Golem de Hielo', model: 'golem', ai: 'golem', hp: 52, dmg: 3, speed: 2.3, sight: 22, attackRange: 4.6, radius: 1.8,
    cooldown: 1.3, windup: 0.75, knockback: 0.4, boss: true, color: 0x7d8fa8,
    monster: { name: 'golem', height: 4.6, headBone: 'Head', chestBone: 'Torso', walkPace: 0.3, runPace: 0.9, boneScale: { ShoulderL: 1.15, ShoulderR: 1.15 }, puff: 0xbfefff, clips: { idle: 'Idle', walk: 'Walk', run: 'Run', hurt: 'HitReact', death: 'Death' } },
    clips: { swing: 'Punch', slam: 'Weapon', throw: 'Weapon' },
    drops: [['heart_container', 1]],
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
  // ---------------------------------------------------------------- Castillo Final
  darkKnight: {
    name: 'Caballero oscuro', model: 'kaykit', ai: 'melee', hp: 11, dmg: 2, speed: 3.7, sight: 13, attackRange: 2.2, radius: 0.6,
    cooldown: 1.2, windup: 0.5, knockback: 3, shield: 0.5,
    kaykit: { model: 'knight', show: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield'], tint: 0x5a5068, height: 1.95, clips: { idle: 'Idle_Combat' } },
    clips: { attack: '1H_Melee_Attack_Slice_Diagonal' }, drops: [['coin5', 0.6], ['heart', 0.35]],
  },
  darkMage: {
    name: 'Hechicero oscuro', model: 'kaykit', ai: 'ranged', hp: 7, dmg: 2, speed: 3.0, sight: 16, attackRange: 14, preferDist: 9, radius: 0.55,
    cooldown: 2.4, windup: 0.8, knockback: 5, shootHeight: 1.6,
    projectile: { speed: 10, size: 0.36, color: 0x9a50ff, burst: 3, spread: 0.3 },
    kaykit: { model: 'mage', show: ['Mage_Hat', 'Mage_Cape'], props: { r: 'sk_staff' }, tint: 0x6a5880, height: 1.9 },
    clips: { shoot: 'Spellcast_Shoot', windupSplit: 0.4 }, drops: [['coin5', 0.6], ['heart', 0.4]],
  },
  skeletonRogue: {
    name: 'Esqueleto pícaro', model: 'kaykit', ai: 'lunge', hp: 6, dmg: 2, speed: 4.6, sight: 12, attackRange: 3.2, radius: 0.5,
    cooldown: 1.6, windup: 0.4, knockback: 5,
    kaykit: { model: 'skeleton_rogue', show: ['Skeleton_Rogue_Hood', 'Skeleton_Rogue_Cape'], props: { r: 'sk_blade' }, height: 1.8, clips: { death: 'Death_C_Skeletons' } },
    clips: { attack: '1H_Melee_Attack_Stab' }, drops: [['coin5', 0.5], ['heart', 0.3]],
  },
  brute: {
    name: 'Bruto acorazado', model: 'kaykit', ai: 'brute', hp: 22, dmg: 3, speed: 3.0, sight: 12, attackRange: 2.6, radius: 0.85,
    cooldown: 1.6, windup: 0.7, knockback: 1.5,
    kaykit: { model: 'barbarian', show: ['Barbarian_Hat', '2H_Axe'], tint: 0x6a5a6a, height: 2.6, clips: { idle: '2H_Melee_Idle' } },
    clips: { swing: '2H_Melee_Attack_Chop', slam: '2H_Melee_Attack_Spin' }, drops: [['heart', 1], ['coin5', 1]],
  },
  malakar: {
    name: 'Malakar, el Rey Sombrío', model: 'kaykit', ai: 'darklord', hp: 120, dmg: 3, speed: 3.8, sight: 30, attackRange: 3.6, radius: 1.4,
    cooldown: 1.1, windup: 0.6, knockback: 0.4, boss: true, stunTime: 5,
    projectile: { speed: 11, size: 0.5, color: 0x9a50ff, burst: 5, spread: 0.26 },
    kaykit: { model: 'knight', show: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Round_Shield'], tint: 0x3a2e4a, height: 4.8, clips: { idle: 'Idle_Combat' } },
    clips: { swing: '1H_Melee_Attack_Slice_Horizontal', slam: '1H_Melee_Attack_Jump_Chop', taunt: 'Taunt', shoot: 'Spellcast_Shoot', teleport: 'Spellcasting', windupSplit: 0.35 },
    shieldText: '¡Malakar se envuelve en un escudo de sombras! Rompe los cuatro cristales oscuros.',
    breakText: '¡El escudo de Malakar se rompe! ¡Está aturdido, ataca!',
    phase3Text: '¡Malakar se enfurece! Sus sombras arden.',
    phase3Summon: ['darkKnight', 'darkKnight'],
    drops: [['heart_container', 1]],
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

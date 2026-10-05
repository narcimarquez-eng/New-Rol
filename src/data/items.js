// Catálogo de objetos. El motor no conoce objetos concretos: todo sale de aquí.
//   kind: 'currency' | 'consumable' | 'key' | 'upgrade' | 'quest' | 'instant'
export const ITEMS = {
  coin: { name: 'Moneda', kind: 'currency', color: 0xffd34d, icon: '🪙' },
  coin5: { name: '5 monedas', kind: 'currency', amount: 5, color: 0x5ad1ff, icon: '🪙' },
  bag: { name: 'Bolsa de monedas', kind: 'currency', amount: 50, color: 0xffd34d, icon: '💰', desc: '¡50 monedas!' },
  heart: { name: 'Corazón', kind: 'instant', heal: 2, color: 0xff4d6d, icon: '❤️' },
  potion: { name: 'Poción roja', kind: 'consumable', heal: 8, max: 5, color: 0xe0405a, icon: '🧪', desc: 'Restaura 4 corazones. Pulsa Q para beberla.' },
  key_small: { name: 'Llave pequeña', kind: 'key', color: 0xc0c0c0, icon: '🗝️', desc: 'Abre una puerta cerrada de la aldea.' },
  key_maze: { name: 'Llave del Laberinto', kind: 'key', color: 0x6fd36f, icon: '🗝️', desc: 'Abre la puerta del laberinto del bosque.' },
  key_forest: { name: 'Llave del Bosque', kind: 'key', color: 0x2fbf71, icon: '🔑', desc: 'Una llave antigua tallada en madera viva. Abre el paso norte del bosque.' },
  heart_container: { name: 'Contenedor de corazón', kind: 'upgrade', color: 0xff4d6d, icon: '💖', desc: '¡Tu vida máxima aumenta en un corazón!' },
  stamina_up: { name: 'Elixir de vigor', kind: 'upgrade', color: 0x7ee081, icon: '🍃', desc: '¡Tu resistencia máxima aumenta!' },
  sword_up: { name: 'Espada del Hada', kind: 'upgrade', color: 0x9fe7ff, icon: '🗡️', desc: 'Una espada bendecida por las hadas: más daño y un brillo mágico.' },
  package: { name: 'Paquete del herrero', kind: 'quest', color: 0xb8864b, icon: '📦', desc: 'Entrégaselo al granjero Tomás.' },
  axe: { name: 'Hacha del leñador', kind: 'quest', color: 0x9a9a9a, icon: '🪓', desc: 'El hacha perdida de Íñigo.' },
  wisp: { name: 'Luz del bosque', kind: 'quest', color: 0x9fffd0, icon: '✨', desc: 'Una lucecita cálida. El hada Lys las colecciona.' },
};

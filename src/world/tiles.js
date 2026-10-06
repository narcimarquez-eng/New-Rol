// Leyenda global de casillas para los mapas ASCII de las zonas.
// Cada zona describe su mapa con estos caracteres; el motor decide malla y colisión.
//   solid: 'box' bloquea la casilla entera, 'circle' bloquea un círculo central.
//   tall: bloquea también la cámara y la línea de visión.
//   ground: clave de color del suelo (ver paleta de la zona).

export const TILE = 4; // tamaño de casilla en unidades de mundo

export const TILES = {
  '.': { ground: 'grass' },
  ',': { ground: 'grass', decor: 'flowers' },
  '"': { ground: 'grass', decor: 'tallgrass' },
  'g': { ground: 'forest' },
  '=': { ground: 'path' },
  'o': { ground: 'stone' },
  's': { ground: 'sand' },
  '#': { ground: 'forest', solid: 'box', tall: true, height: 5.5, prop: 'wall' },
  '%': { ground: 'forest', prop: 'wall', secret: true }, // pasadizo secreto: parece muro
  '^': { ground: 'stone', solid: 'box', tall: true, height: 7, prop: 'cliff' },
  'T': { ground: 'grass', solid: 'circle', radius: 1.2, tall: true, height: 5.5, prop: 'tree' },
  'P': { ground: 'forest', solid: 'circle', radius: 1.1, tall: true, height: 5.5, prop: 'pine' },
  'R': { ground: 'grass', solid: 'circle', radius: 1.3, prop: 'rock' },
  'b': { ground: 'grass', solid: 'box', prop: 'bush', cuttable: true },
  '~': { ground: 'water', solid: 'box', water: true },
  'B': { ground: 'water', prop: 'bridge', bridge: true },
  'F': { ground: 'grass', solid: 'box', prop: 'fence' },
  // ---- Cuevas Heladas ----
  'n': { ground: 'snow' },
  'i': { ground: 'ice', ice: true },
  'c': { ground: 'snow', solid: 'circle', radius: 1.0, tall: true, height: 3, prop: 'crystal' },
  'I': { ground: 'ice', solid: 'box', tall: true, height: 4, prop: 'icepillar' },
  // ---- Desierto Perdido ----
  'h': { ground: 'sand', decor: 'scrub' },
  'x': { ground: 'clay' },
  'k': { ground: 'flagstone' },
  'W': { ground: 'sand', solid: 'box', tall: true, height: 5.5, prop: 'ruin' },
  '&': { ground: 'flagstone', prop: 'ruin', secret: true }, // muro en ruinas que se puede atravesar
  'O': { ground: 'flagstone', solid: 'circle', radius: 0.95, tall: true, height: 6, prop: 'column' },
  'C': { ground: 'sand', solid: 'circle', radius: 0.6, prop: 'cactus' },
  'p': { ground: 'grass', solid: 'circle', radius: 0.55, tall: true, height: 7, prop: 'palm' },
};

export const DEFAULT_TILE = TILES['.'];
export const tileInfo = (ch) => TILES[ch] || DEFAULT_TILE;

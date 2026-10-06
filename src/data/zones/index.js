// Registro de zonas. Para añadir una zona nueva basta con crear su archivo
// de datos e importarlo aquí: el motor no necesita cambios.
import village from './village.js';
import forest from './forest.js';
import caves from './caves.js';
import desert from './desert.js';
import shrineForest from './shrine_forest.js';
import shrineIce from './shrine_ice.js';
import shrineSun from './shrine_sun.js';
import castle from './castle.js';

export const ZONES = {
  village, forest, caves, desert, castle,
  // santuarios de las pruebas mágicas
  shrine_forest: shrineForest, shrine_ice: shrineIce, shrine_sun: shrineSun,
};
export const START_ZONE = 'village';

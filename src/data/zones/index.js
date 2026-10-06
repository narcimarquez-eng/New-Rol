// Registro de zonas. Para añadir una zona nueva basta con crear su archivo
// de datos e importarlo aquí: el motor no necesita cambios.
import village from './village.js';
import forest from './forest.js';
import caves from './caves.js';
import desert from './desert.js';

export const ZONES = { village, forest, caves, desert };
export const START_ZONE = 'village';

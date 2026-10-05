// Historia principal: la lista de objetivos se evalúa en orden y el HUD
// muestra el primero cuya condición aún no se cumple.
export const STORY = [
  { until: { flag: 'met_elder' }, text: 'Habla con el Anciano Bruno (casa azul, al noroeste de la aldea).' },
  { until: { flag: 'dummies_done' }, text: 'Golpea los 3 muñecos de entrenamiento (oeste de la aldea).' },
  { until: { flag: 'tutorial_done' }, text: 'Vuelve a hablar con el Anciano Bruno.' },
  { until: { flag: 'entered_forest' }, text: 'Cruza la puerta norte hacia el Bosque Encantado.' },
  { until: { any: [{ has: 'key_maze' }, { flag: 'opened_f_maze_gate' }] }, text: 'Encuentra la Llave del Laberinto (claro del oeste del bosque).' },
  { until: { flag: 'opened_f_maze_gate' }, text: 'Abre la puerta del laberinto, al norte del camino.' },
  { until: { flag: 'boss_forest' }, text: 'Llega al corazón del laberinto y derrota a su guardián.' },
  { until: { any: [{ has: 'key_forest' }, { flag: 'opened_f_north_gate' }] }, text: 'Abre el gran cofre del corazón del laberinto.' },
  { until: { flag: 'opened_f_north_gate' }, text: 'Usa la Llave del Bosque en la puerta norte del laberinto.' },
  { until: { flag: 'phase1_complete' }, text: 'Cruza el portal del norte.' },
  { until: null, text: '¡Fase 1 completada! Las Cuevas Heladas llegarán pronto...' },
];

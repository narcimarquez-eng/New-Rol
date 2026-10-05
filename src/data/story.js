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
  { until: { any: [{ flag: 'phase1_complete' }, { flag: 'entered_caves' }] }, text: 'Cruza el portal del norte hacia las Cuevas Heladas.' },
  // ---- Fase 2: Cuevas Heladas ----
  { until: { any: [{ has: 'key_frost' }, { flag: 'opened_c_gateA' }] }, text: 'Consigue la Llave de escarcha en el lago helado (al oeste del campamento).' },
  { until: { flag: 'opened_c_gateA' }, text: 'Abre la puerta de hielo al norte de la explanada.' },
  { until: { flag: 'c_plate1' }, text: 'Empuja el bloque de hielo hasta la placa rúnica de la sala.' },
  { until: { flag: 'boss_caves' }, text: 'Derrota al guardián de la caverna del norte.' },
  { until: { any: [{ has: 'key_fire' }, { flag: 'opened_c_north' }] }, text: 'Abre el gran cofre de la caverna.' },
  { until: { flag: 'opened_c_north' }, text: 'Derrite el muro de hielo del norte con la Llave de Fuego.' },
  { until: { flag: 'phase2_complete' }, text: 'Cruza el paso del norte hacia el Desierto Perdido.' },
  { until: null, text: '¡Fase 2 completada! El Desierto Perdido llegará pronto...' },
];

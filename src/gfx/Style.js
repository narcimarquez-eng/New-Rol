// Estilo gráfico global. Realista por defecto; `?toon` recupera el estilo de
// dibujo animado (contornos de tinta y sombreado por bandas) para comparar.
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const REALISTIC = !params.has('toon');

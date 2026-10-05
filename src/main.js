// Punto de entrada: arranca el juego cuando el DOM está listo.
import { Game } from './core/Game.js';

function boot() {
  try {
    new Game(document.getElementById('app'));
  } catch (err) {
    console.error(err);
    const el = document.getElementById('loading');
    if (el) el.textContent = 'No se pudo iniciar el juego (¿WebGL desactivado?).';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// Punto de entrada: arranca el juego cuando el DOM está listo.
import { Game } from './core/Game.js';
import { preloadCharacters } from './gfx/Characters.js';

async function boot() {
  // personajes KayKit (modelos y animaciones); si fallan, se usan los modelos procedurales
  try { await preloadCharacters(); } catch (err) { console.warn('Personajes KayKit no disponibles:', err); }
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

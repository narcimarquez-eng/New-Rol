// Punto de entrada: arranca el juego cuando el DOM está listo.
import { Game } from './core/Game.js';
import { preloadCharacters } from './gfx/Characters.js';
import { preloadMonsters } from './gfx/Monsters.js';

async function boot() {
  // personajes KayKit (modelos y animaciones); si fallan, se usan los modelos procedurales
  // y monstruos animados (Quaternius); se cargan a la vez
  await Promise.all([
    preloadCharacters().catch((err) => console.warn('Personajes KayKit no disponibles:', err)),
    preloadMonsters().catch((err) => console.warn('Monstruos animados no disponibles:', err)),
  ]);
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

// ---------------------------------------------------------------- instalar (sin tienda)
// El service worker (generado al compilar) guarda el juego para jugar sin conexión.
if ('serviceWorker' in navigator && import.meta.env.PROD && !navigator.webdriver) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Sin modo sin conexión:', e)));
}
const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
let installEvent = null;
// Android / Chrome / Edge: el navegador avisa de que se puede instalar
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  const btn = document.getElementById('btn-install');
  if (btn) btn.hidden = false;
});
window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('btn-install');
  if (btn) btn.hidden = true;
});
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-install');
  btn?.addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    btn.hidden = true;
  });
  // iPhone / iPad: Safari no tiene botón automático; se explica cómo hacerlo
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const hint = document.getElementById('install-hint');
  if (ios && !standalone && hint) {
    hint.textContent = '📲 Para instalarlo: botón Compartir de Safari → «Añadir a pantalla de inicio».';
    hint.hidden = false;
  }
});

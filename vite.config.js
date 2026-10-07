import { defineConfig } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Genera dist/sw.js al compilar: el service worker que permite instalar el juego en
 * el móvil ("Añadir a pantalla de inicio") y jugar sin conexión. Guarda en caché
 * todos los archivos del build; cada compilación tiene su versión, así que los
 * jugadores reciben la nueva al volver a abrir el juego.
 */
function serviceWorker() {
  let outDir = 'dist';
  return {
    name: 'new-rol-sw',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = [];
      const walk = (d) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js' && !f.startsWith('assets/kaykit-preview/')).map((f) => (f === 'index.html' ? './' : `./${f}`));
      const version = new Date().toISOString();
      writeFileSync(join(outDir, 'sw.js'), `// Generado al compilar (vite.config.js). Versión: ${version}
const CACHE = 'new-rol-${version}';
const FILES = ${JSON.stringify(list)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // la página: primero la red (para recibir actualizaciones), si no hay conexión, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./', { ignoreVary: true })));
    return;
  }
  // fuentes de Google: copia guardada y se refresca en segundo plano
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open(CACHE + '-fonts').then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // archivos del juego: de la caché (sin esperar a la red)
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
`);
    },
  };
}

// base relativa para que el build funcione en GitHub Pages (/New-Rol/)
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});

// Prueba de humo del estilo realista: carga el juego sin ?toon, empieza una
// partida y visita cada zona comprobando que se construyen el cielo físico y
// las montañas del fondo, que no hay errores de consola y que la cámara no
// queda bajo el terreno. Guarda una captura por zona en test-results/real-*.png.
// En CI el renderizado es por software (SwiftShader): el tiempo de carga que se
// imprime aquí es orientativo, mucho mayor que con una GPU real.
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const PORT = 4179;
const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failures++;
};

if (!process.env.SKIP_BUILD) execSync('npx vite build', { stdio: 'inherit' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview no arrancó')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const SLOW = 300000; // SwiftShader compila y dibuja los sombreadores PBR muy despacio

try {
  await page.goto(`http://localhost:${PORT}/?fixeddt`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: SLOW, polling: 500 });
  const loadMs = await page.evaluate(() => Math.round(window.__game.firstFrameAt));
  console.log(`  primer fotograma realista en ${loadMs} ms (renderizado por software; con GPU es muy inferior)`);
  await page.click('#btn-new', { timeout: SLOW });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__game.mode === 'play'), 'empieza la partida en estilo realista');

  for (const zone of ['village', 'forest', 'caves']) {
    const info = await page.evaluate((zone) => {
      const g = window.__game;
      if (g.zone.id !== zone) g.loadZone(zone, 'start', { silent: true });
      g.mode = 'play';
      g.noRender = true; for (let k = 0; k < 20; k++) g.step(1 / 60); g.noRender = false;
      const names = new Set();
      g.zone.group.traverse((o) => { if (o.name) names.add(o.name); });
      const cam = g.camera;
      return {
        id: g.zone.id,
        sky: names.has('sky'),
        backdrop: names.has('backdrop'),
        env: !!g.scene.environment,
        fog: g.scene.fog?.isFogExp2 === true,
        camAbove: cam.position.y > g.zone.height(cam.position.x, cam.position.z),
      };
    }, zone);
    ok(info.id === zone, `zona ${zone} cargada`);
    ok(info.sky && info.backdrop, `${zone}: cielo físico y montañas del fondo presentes`);
    ok(info.env && info.fog, `${zone}: iluminación ambiental (IBL) y niebla de distancia activas`);
    ok(info.camAbove, `${zone}: la cámara queda por encima del terreno`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/real-${zone}.png`, timeout: SLOW });
  }
  ok(errors.length === 0, `sin errores de consola${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
} catch (e) {
  console.error(e);
  failures++;
}

await browser.close();
server.kill();
console.log(failures ? `\n${failures} comprobaciones fallidas` : '\nprueba de humo realista superada');
process.exit(failures ? 1 : 0);

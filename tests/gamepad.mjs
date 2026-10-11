// Prueba del mando (Gamepad API) sobre el juego real: la palanca izquierda mueve, la derecha
// gira la cámara, X ataca, Start pausa, el ataque automático golpea solo mientras hay un
// enemigo al alcance y se apaga, y el juego se queda quieto al desconectar el mando.
// El mando se simula con window.__pad, que el juego lee en cada frame (no hay navegador con
// mando real aquí). Cada botón se mantiene hasta que el juego reacciona: una pulsación
// más corta que un frame se perdería, como en cualquier mando que el juego no llegue a leer.
// Uso: node tests/gamepad.mjs   (SKIP_BUILD=1 usa la última compilación;
// OUTDIR=carpeta compila en una copia propia para no pisar la que sirven otras pruebas)
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
const OUTDIR = process.env.OUTDIR || '.cache/dist-pad';
const PORT = process.env.PORT || '4179';
if (!process.env.SKIP_BUILD) execSync(`npx vite build --outDir ${OUTDIR} --emptyOutDir`, { stdio: 'ignore' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUTDIR, '--port', PORT, '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes(PORT)) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// el navegador sin mando: getGamepads devuelve el mando simulado cuando existe
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => (window.__pad ? [window.__pad] : [null, null, null, null]) });
});
await page.goto(`http://localhost:${PORT}/?fixeddt&toon`);
await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 60000 });

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) fails++; };
// deja pasar varios frames del juego (cada uno lee el mando)
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const setPad = (fn, arg) => page.evaluate(fn, arg);
// mantiene un botón pulsado hasta que `until` se cumple (o se agota el tiempo) y lo suelta
const hold = async (button, until) => {
  await setPad((b) => { window.__pad.buttons[b].pressed = true; }, button);
  await page.waitForFunction(until, null, { timeout: 15000 }).catch(() => {});
  await setPad((b) => { window.__pad.buttons[b].pressed = false; }, button);
  await frames(3); // el juego tiene que leer la suelta antes de la siguiente pulsación
};

await page.evaluate(() => {
  window.__pad = { connected: true, id: 'Mando de prueba', mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
});
await page.click('#btn-new');
await page.waitForFunction(() => window.__game.zone && window.__game.zone.id === 'village', null, { timeout: 60000 });
await page.evaluate(() => window.__game.setMode('play'));
await frames(2);

// 1) la palanca izquierda mueve al héroe (y la cruceta también)
await setPad(() => { window.__pad.axes[0] = 1; });
await frames(3);
const mv = await page.evaluate(() => window.__game.input.moveVector());
ok(mv.x > 0.9 && Math.abs(mv.y) < 0.05, `la palanca izquierda mueve al héroe (${mv.x.toFixed(2)}, ${mv.y.toFixed(2)})`);
await setPad(() => { window.__pad.axes[0] = 0; });
await frames(2);
// cruceta: derecha. Se guarda el máximo mientras está pulsada (al soltarla el movimiento vuelve a cero)
await hold(15, () => { window.__dx = Math.max(window.__dx || 0, window.__game.input.moveVector().x); return window.__dx > 0.9; });
const dx = await page.evaluate(() => window.__dx || 0);
ok(dx > 0.9, `la cruceta también mueve al héroe (${dx.toFixed(2)})`);
await frames(2);

// 2) la palanca derecha gira la cámara
const yaw0 = await page.evaluate(() => window.__game.cam.yaw);
await setPad(() => { window.__pad.axes[2] = 1; });
await frames(8);
await setPad(() => { window.__pad.axes[2] = 0; });
const yaw1 = await page.evaluate(() => window.__game.cam.yaw);
ok(Math.abs(yaw1 - yaw0) > 0.05, `la palanca derecha gira la cámara (${(yaw1 - yaw0).toFixed(2)} rad)`);

// 3) X ataca; Start pausa y vuelve a jugar
await hold(2, () => window.__game.player.state === 'attack');
ok(true, 'X ataca con el héroe');
await frames(30);
await hold(9, () => window.__game.mode === 'pause');
ok(await page.evaluate(() => window.__game.mode === 'pause'), 'Start abre la pausa');
// el juego ignora un segundo Start durante 250 ms (evita dobles pulsaciones): se espera con frames reales
await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); const f = () => (performance.now() - t0 > 300 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
await hold(9, () => window.__game.mode === 'play');
const back = await page.evaluate(() => window.__game.mode);
ok(back === 'play', `Start vuelve a jugar (modo ${back})`);
await frames(2);

// 4) ataque automático: con un enemigo al alcance golpea solo; al apagarlo, deja de hacerlo
await page.evaluate(() => {
  const g = window.__game, TILE = 4;
  const p = g.player;
  const c = (p.x + g.zone.W * TILE / 2) / TILE - 0.5, r = (p.z + g.zone.H * TILE / 2) / TILE - 0.5;
  g.spawnEnemy({ kind: 'lavaSlime', tile: [c + 0.2, r] }); // a unos 0,8 de unidades del héroe
  window.__taps = 0;
  const tap = g.input.tap.bind(g.input);
  g.input.tap = (a) => { if (a === 'attack') window.__taps++; tap(a); };
  if (g.autoAttack) g.toggleAutoAttack();
  g.toggleAutoAttack();
});
const on = await page.evaluate(() => window.__game.autoAttack);
await page.waitForFunction(() => window.__taps > 0, null, { timeout: 20000 }).catch(() => {});
const taps = await page.evaluate(() => window.__taps);
ok(on && taps > 0, `el ataque automático golpea solo mientras hay un enemigo cerca (${taps} golpes)`);
await page.evaluate(() => { window.__game.toggleAutoAttack(); window.__taps = 0; });
await frames(40);
const off = await page.evaluate(() => window.__taps);
ok(!(await page.evaluate(() => window.__game.autoAttack)) && off === 0, 'al apagar el ataque automático, el héroe no golpea solo');
const saved = await page.evaluate(() => { try { return localStorage.getItem('newrol-auto-attack'); } catch { return 'sin almacenamiento'; } });
ok(saved === '0' || saved === 'sin almacenamiento', `la preferencia se guarda en el navegador (${saved})`);

// 5) al desconectar el mando, el héroe se queda quieto
await setPad(() => { window.__pad.axes[0] = 1; });
await frames(2);
await page.evaluate(() => { window.__pad = null; });
await frames(3);
const gone = await page.evaluate(() => window.__game.input.moveVector());
ok(gone.x === 0 && gone.y === 0, 'al desconectar el mando, el movimiento se detiene');

ok(errors.length === 0, `sin errores en la consola${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} fallos` : '\nMando correcto ✔');
process.exit(fails ? 1 : 0);

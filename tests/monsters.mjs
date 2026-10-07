// Galería de los monstruos animados: para cada enemigo hace capturas en reposo,
// preparando el ataque y atacando (estilo realista), comprueba que usa el modelo
// animado y junta todo en test-results/monstruos.png. No es un test de
// aprobado/fallo salvo por los errores de consola y los modelos que no cargan.
// Uso: node tests/monsters.mjs    (QS=&toon para el estilo de dibujos)
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const PORT = 4176;
const QS = process.env.QS ?? '&low';
mkdirSync('test-results', { recursive: true });
if (!process.env.SKIP_BUILD) execSync('npx vite build', { stdio: 'ignore' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/?fixeddt${QS}`, { waitUntil: 'commit', timeout: 60000 });
await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 300000, polling: 500 });
await page.click('#btn-new', { timeout: 300000 });
await page.waitForTimeout(300);

// [enemigo, zona, casilla libre, distancia de cámara]
const LIST = (process.env.ONLY ? process.env.ONLY.split(',') : null);
const ALL = [
  ['slime', 'forest', 4.5], ['plant', 'forest', 5.5], ['bat', 'forest', 5],
  ['goblin', 'forest', 5.5], ['goblinKing', 'forest', 10],
  ['iceSlime', 'caves', 4.5], ['frostBat', 'caves', 5], ['frostSpirit', 'caves', 6], ['iceGolem', 'caves', 12.5],
];
const POSES = (process.env.POSES || 'reposo,ataque').split(',');
const files = [];
let failures = 0;
for (const [kind, zone, dist] of ALL.filter((a) => !LIST || LIST.includes(a[0]))) {
  for (const pose of POSES) {
    const info = await page.evaluate(({ kind, zone, dist, pose }) => {
      const g = window.__game;
      if (g.zone.id !== zone) g.loadZone(zone, 'start', { silent: true });
      g.mode = 'play';
      for (const e of g.enemies) { g.scene.remove(e.root); }
      g.enemies.length = 0;
      const p = g.player;
      const f = 2.2;
      p.place(p.x, p.z, f);
      p.root.scale.setScalar(1e-4); // el héroe no tapa al monstruo
      for (const c of g.companions || []) c.root.scale.setScalar(1e-4);
      const T = 4; // TILE
      const c = (p.x + g.zone.W * T / 2) / T - 0.5, r = (p.z + g.zone.H * T / 2) / T - 0.5;
      const e = g.spawnEnemy({ kind, tile: [c, r] });
      e.update = () => {};
      document.getElementById('hud').style.visibility = 'hidden';
      g.cam.snapBehind(p);
      g.cam.yaw += 0.15; g.cam.pitch = 0.2; g.cam.wantDistance = g.cam.distance = g.cam.curDistance = dist;
      const set = (state, t, type) => { e.state = state; e.stateT = t; e.attackType = type; };
      const type = e.ai === 'golem' || e.ai === 'boss' ? 'swing' : e.ai === 'ranged' ? 'shoot' : 'swing';
      g.noRender = true;
      for (let k = 0; k < 60; k++) {
        if (pose === 'reposo') set('idle', k / 60, null);
        if (pose === 'carga') set('windup', (k / 60) * (e.def.windup || 0.4), type);
        if (pose === 'ataque') set('attack', Math.min(0.2, k / 60 * 0.4), type);
        // de cara a la cámara, un poco ladeado
        e.facing = Math.atan2(g.camera.position.x - e.pos.x, g.camera.position.z - e.pos.z) + 0.45;
        e.animate(1 / 60, 0);
        g.step(1 / 60);
      }
      g.noRender = false;
      return { monster: !!e.kk?.monster, clips: [...(e.kk?.actions?.keys() || [])] };
    }, { kind, zone, dist, pose });
    if (!info.monster) { console.log(`✘ ${kind}: no usa el modelo animado`); failures++; }
    await page.waitForTimeout(250);
    const file = `test-results/mon-${kind}-${pose}.png`;
    await page.screenshot({ path: file, timeout: 300000 });
    files.push([kind, pose, file]);
    console.log(`${kind} ${pose}: ${info.clips.join(', ')}`);
  }
}

// lámina con todas las capturas (una fila por monstruo)
const imgs = files.map(([k, p, f]) => [k, p, 'data:image/png;base64,' + readFileSync(f).toString('base64')]);
const consoleErrors = errors.length;
await page.setContent(`<title>${POSES.length}</title><canvas id="c"></canvas>`);
await page.evaluate(async (imgs) => {
  const W = 320, H = 240, cols = Number(document.title) || 2;
  const cv = document.getElementById('c');
  cv.width = W * cols; cv.height = H * Math.ceil(imgs.length / cols);
  const c = cv.getContext('2d');
  for (const [i, [k, p, src]] of imgs.entries()) {
    const im = new Image(); im.src = src; await im.decode();
    const x = (i % cols) * W, y = Math.floor(i / cols) * H;
    c.drawImage(im, x, y, W, H);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, y, W, 22);
    c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(`${k} · ${p}`, x + 6, y + 16);
  }
}, imgs);
await page.locator('#c').screenshot({ path: 'test-results/monstruos.png' });
errors.length = consoleErrors; // lo que pase tras cerrar el juego no cuenta
console.log(errors.length ? `errores de consola:\n${errors.join('\n')}` : 'sin errores de consola');
await browser.close();
server.kill();
process.exit(failures || errors.length ? 1 : 0);

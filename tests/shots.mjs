// Capturas rápidas para revisar el aspecto visual (no es un test de aprobado/fallo).
// Uso: node tests/shots.mjs [zona] [col,fila,orientación,distancia] ...
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const PORT = 4175;
const QS = process.env.QS ?? '';
mkdirSync('test-results', { recursive: true });
if (!process.env.SKIP_BUILD) execSync('npx vite build', { stdio: 'ignore' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(`http://localhost:${PORT}/?fixeddt${QS}`, { waitUntil: 'commit', timeout: 60000 });
await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 300000, polling: 500 });
await page.click('#btn-new', { timeout: 300000 });
await page.waitForTimeout(300);
const shots = JSON.parse(process.argv[2] || '[]');
for (const [i, s] of shots.entries()) {
  await page.evaluate((s) => {
    const g = window.__game;
    if (s.zone && g.zone.id !== s.zone) g.loadZone(s.zone, s.spawn || 'start', { silent: true });
    g.mode = 'play';
    g.ui.show('zone-name', true);
    document.getElementById('zone-name').classList.remove('show');
    const [x, z] = g.zone.tileToWorld(s.c, s.r);
    g.player.place(x, z, s.f ?? Math.PI);
    g.cam.snapBehind(g.player);
    if (s.yaw != null) g.cam.yaw = s.yaw;
    g.cam.pitch = s.pitch ?? 0.42; g.cam.wantDistance = g.cam.distance = g.cam.curDistance = s.dist ?? 9;
    g.noRender = true; for (let k = 0; k < 30; k++) g.step(1 / 60); g.noRender = false;
    if (s.eval) eval(s.eval);
  }, s);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/shot-${s.name || i}.png`, timeout: 300000 });
  console.log('shot', s.name || i);
}
console.log(errors.slice(0, 10).join('\n') || 'sin errores');
await browser.close();
server.kill();
process.exit(0);

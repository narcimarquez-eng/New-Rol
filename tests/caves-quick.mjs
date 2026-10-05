// Test rápido de los puzles de las Cuevas Heladas (traza paso a paso).
// Uso: node tests/caves-quick.mjs
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
if (!process.env.SKIP_BUILD) execSync('npx vite build', { stdio: 'ignore' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', '4177', '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('4177')) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e));
await page.goto('http://localhost:4177/?fixeddt&low');
await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 60000 });
await page.click('#btn-new');
await page.evaluate(() => {
  const g = window.__game;
  window.__t = {
    tp(c, r, f = Math.PI) { const [x, z] = g.zone.tileToWorld(c, r); g.player.place(x, z, f); g.cam.snapBehind(g.player); },
    sim(s) { g.noRender = true; for (let i = 0; i < s * 60; i++) g.step(1 / 60); g.noRender = false; },
  };
  g.loadZone('caves', 'fromForest');
});
  // ejecutor de movimientos del solucionador sobre el juego real
  await page.evaluate(() => {
    const g = window.__game;
    const KEY = { N: 'up', S: 'down', W: 'left', E: 'right' };
    const D = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
    const tileNow = () => g.zone.collision.tileOf(g.player.x, g.player.z);
    const sim = (sec) => { g.noRender = true; for (let i = 0; i < sec * 60; i++) { g.cam.yaw = 0; g.cam.idleLook = 0; g.step(1 / 60); g.input.endFrame(); } g.noRender = false; };
    window.__t.exec = (moves) => {
      g.godMode = true;
      for (const m of moves) {
        const [c, r] = tileNow();
        const [dc, dr] = D[m];
        const n = [c + dc, r + dr];
        const block = g.interactables.find((i) => i.kind === 'iceblock' && i.tile[0] === n[0] && i.tile[1] === n[1]);
        const ice = g.zone.isIceTile(c, r) || g.zone.isIceTile(n[0], n[1]);
        if (block) {
          g.input.down.add(KEY[m]); sim(0.5);
          for (let k = 0; k < 40 && !block.moving; k++) sim(0.05);
          g.input.down.delete(KEY[m]);
          for (let k = 0; k < 120 && block.moving; k++) sim(0.05);
          sim(0.1);
          // tras empujar, volver al centro de la casilla (el jugador no se mueve en el solucionador)
          const [x, z] = g.zone.tileToWorld(c, r); g.player.pos.x = x; g.player.pos.z = z;
        } else if (ice) {
          // desde la nieve se camina hasta pisar el hielo; sobre el hielo basta un toque
          g.input.down.add(KEY[m]);
          for (let k = 0; k < 60; k++) {
            sim(1 / 60);
            const [tc, tr] = tileNow();
            if (g.player.slide || (tc === n[0] && tr === n[1]) || g.zone.isIceTile(c, r)) break;
          }
          sim(0.1); g.input.down.delete(KEY[m]);
          for (let k = 0; k < 160 && g.player.slide; k++) sim(0.05);
          sim(0.1);
        } else {
          const [x, z] = g.zone.tileToWorld(n[0], n[1]); g.player.place(x, z, g.player.facing);
          sim(0.05);
        }
      }
      return tileNow();
    };
  });


const sol = ['W', 'W', 'W', 'W', 'W', 'W', 'N', 'E', 'N', 'N', 'W', 'W', 'W', 'W', 'W', 'W', 'N', 'W', 'S', 'W', 'S', 'S', 'E', 'E', 'E', 'S', 'E', 'N', 'N'];
const trace = await page.evaluate((sol) => {
  const g = window.__game; g.mode = 'play'; window.__t.tp(22, 27, Math.PI);
  const b = g.interactables.find((i) => i.kind === 'iceblock');
  const out = [];
  for (const m of sol) { const p = window.__t.exec([m]); out.push(m + ':' + p.join(',') + '/b' + b.tile.join(',')); }
  return out;
}, sol);
console.log(trace.join('\n'));
console.log('placa', await page.evaluate(() => window.__game.progress.flags.has('c_plate1')));
await browser.close(); server.kill(); process.exit(0);

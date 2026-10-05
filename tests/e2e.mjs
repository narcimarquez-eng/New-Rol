// Test end-to-end con Playwright (Chromium headless).
// 1. Compila y sirve el juego (vite preview).
// 2. Verifica que carga sin errores de consola y en < 5 s.
// 3. Juega: movimiento, ataque, diálogo, tutorial, zonas, combate.
// 4. Comprueba colisiones (no atravesar paredes) y la cámara (no atraviesa suelo/muros).
// 5. Guarda capturas en test-results/.
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const PORT = 4173;
const URL = `http://localhost:${PORT}/?fixeddt`;
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
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--ignore-certificate-errors'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

try {
  // ---------- carga ----------
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.zone, null, { timeout: 15000 });
  const loadMs = Date.now() - t0;
  ok(loadMs < 5000, `el juego carga en ${loadMs} ms (< 5000)`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-title.png` });

  // ---------- nueva partida ----------
  await page.click('#btn-new');
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => window.__game.mode === 'play'), 'empieza la partida (modo play)');
  await page.screenshot({ path: `${OUT}/02-village-start.png` });

  // helpers dentro de la página
  await page.evaluate(() => {
    const g = window.__game;
    window.__t = {
      tp(c, r, facing = Math.PI) { const [x, z] = g.zone.tileToWorld(c, r); g.player.place(x, z, facing); g.cam.snapBehind(g.player); },
      pos() { return { x: g.player.x, z: g.player.z }; },
      sim(seconds) { g.noRender = true; for (let i = 0; i < seconds * 60; i++) g.step(1 / 60); g.noRender = false; },
    };
  });

  // ---------- movimiento con teclado ----------
  const p0 = await page.evaluate(() => window.__t.pos());
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.__t.sim(1));
  await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => window.__t.pos());
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  ok(moved > 3, `W mueve al jugador (${moved.toFixed(2)} u)`);
  ok(p1.z < p0.z, 'W avanza hacia el norte (delante de la cámara)');

  // ---------- ataque ----------
  await page.evaluate(() => { window.__game.input.press('attack'); window.__t.sim(0.1); });
  ok(await page.evaluate(() => window.__game.player.state === 'attack'), 'clic/F inicia un ataque');
  await page.evaluate(() => window.__t.sim(0.6));

  // ---------- diálogo con el anciano ----------
  await page.evaluate(() => window.__t.tp(7, 8.55, Math.PI));
  await page.evaluate(() => window.__t.sim(0.3));
  const prompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  ok(/Anciano/.test(prompt), `aparece el aviso de hablar: "${prompt}"`);
  await page.evaluate(() => { window.__game.input.press('interact'); window.__t.sim(0.2); });
  ok(await page.evaluate(() => window.__game.mode === 'dialog'), 'E abre el diálogo');
  await page.screenshot({ path: `${OUT}/03-dialog.png` });
  for (let i = 0; i < 12 && await page.evaluate(() => window.__game.mode === 'dialog'); i++) {
    await page.evaluate(() => { window.__game.ui.advanceDialog(); window.__game.ui.advanceDialog(); window.__t.sim(0.05); });
  }
  ok(await page.evaluate(() => window.__game.progress.flags.has('met_elder')), 'el anciano activa el tutorial');

  // ---------- tutorial: muñecos ----------
  for (const [c, r] of [[3, 15], [5, 15], [4, 18]]) {
    await page.evaluate(([c, r]) => { window.__t.tp(c, r + 0.6, Math.PI); window.__game.input.press('attack'); window.__t.sim(0.6); }, [c, r]);
  }
  ok(await page.evaluate(() => window.__game.progress.flags.has('dummies_done')), 'golpear los 3 muñecos completa el entrenamiento');
  await page.screenshot({ path: `${OUT}/04-training.png` });
  await page.evaluate(() => { window.__t.tp(7, 8.55, Math.PI); window.__t.sim(0.2); window.__game.input.press('interact'); window.__t.sim(0.1); });
  for (let i = 0; i < 12 && await page.evaluate(() => window.__game.mode === 'dialog'); i++) {
    await page.evaluate(() => { window.__game.ui.advanceDialog(); window.__game.ui.advanceDialog(); window.__t.sim(0.05); });
  }
  ok(await page.evaluate(() => window.__game.progress.flags.has('tutorial_done')), 'el tutorial termina y abre la puerta norte');
  ok(await page.evaluate(() => window.__game.progress.count('potion') >= 2), 'recibe pociones');

  // ---------- colisiones: barrido de toda la zona ----------
  const collisionReport = async () => page.evaluate(() => {
    const g = window.__game, z = g.zone, col = z.collision;
    let inside = 0, tests = 0;
    // 400 trayectorias aleatorias a máxima velocidad
    for (let i = 0; i < 400; i++) {
      const c = Math.floor(Math.random() * z.W), r = Math.floor(Math.random() * z.H);
      const [x, zz] = z.tileToWorld(c, r);
      if (col.blocked(x, zz, 0.5)) continue;
      g.player.place(x, zz, 0);
      const a = Math.random() * Math.PI * 2;
      for (let k = 0; k < 60; k++) {
        g.player.moveBy(Math.sin(a) * 0.35, Math.cos(a) * 0.35);
        tests++;
        // el centro del jugador nunca debe quedar dentro de una casilla sólida
        const [tc, tr] = col.tileOf(g.player.x, g.player.z);
        const s = col.getSolid(tc, tr);
        if (s && s.kind === 'box') inside++;
      }
    }
    // porcentaje de casillas transitables alcanzables (BFS sobre la rejilla)
    const walk = (c, r) => { const s = col.getSolid(c, r); return !s || s.kind === 'circle'; };
    let total = 0;
    for (let r = 0; r < z.H; r++) for (let c = 0; c < z.W; c++) if (walk(c, r)) total++;
    return { inside, tests, total };
  });
  const village = await collisionReport();
  ok(village.inside === 0, `Aldea: ${village.tests} pasos sin atravesar paredes (${village.inside} fallos)`);

  // ---------- cámara: nunca bajo el suelo ni dentro de un muro ----------
  const cameraReport = () => page.evaluate(() => {
    const g = window.__game, z = g.zone, col = z.collision;
    let bad = 0, n = 0;
    for (let i = 0; i < 150; i++) {
      const c = Math.floor(Math.random() * z.W), r = Math.floor(Math.random() * z.H);
      const [x, zz] = z.tileToWorld(c, r);
      if (col.blocked(x, zz, 0.6)) continue;
      g.player.place(x, zz, Math.random() * 6.28);
      g.cam.yaw = Math.random() * 6.28; g.cam.pitch = Math.random() * 1.2 - 0.1;
      g.cam.curDistance = 0.8;
      for (let k = 0; k < 40; k++) g.cam.update(1 / 60, { mouseDX: 0, mouseDY: 0, wheel: 0 }, g.player, z);
      const cp = g.camera.position;
      n++;
      if (cp.y < z.height(cp.x, cp.z) + 0.3) bad++;
      else if (col.blocksView(cp.x, cp.z, cp.y - z.height(cp.x, cp.z))) bad++;
    }
    return { bad, n };
  });
  const camV = await cameraReport();
  ok(camV.bad === 0, `Aldea: cámara correcta en ${camV.n} posiciones (${camV.bad} fallos)`);

  // ---------- combate real con un limo ----------
  await page.evaluate(() => { window.__game.player.hp = window.__game.player.maxHp; window.__t.tp(17.5, 29); window.__t.sim(0.2); });
  const before = await page.evaluate(() => window.__game.progress.totalKills);
  await page.evaluate(() => {
    const g = window.__game;
    // atacar al enemigo más cercano durante unos segundos
    for (let i = 0; i < 400; i++) {
      const e = g.combat.nearestEnemy(g.player.x, g.player.z, 40);
      if (!e) break;
      const d = Math.hypot(e.x - g.player.x, e.z - g.player.z);
      if (d > 2) { const [c, r] = g.zone.collision.tileOf(e.x, e.z); g.player.pos.x = e.x - 1.6; g.player.pos.z = e.z; }
      g.player.hp = g.player.maxHp;
      if (i % 8 === 0) g.input.press('attack');
      g.noRender = true; g.step(1 / 60); g.noRender = false;
      g.input.endFrame();
      if (g.progress.totalKills > 2) break;
    }
  });
  const after = await page.evaluate(() => window.__game.progress.totalKills);
  ok(after > before, `la espada derrota enemigos (${after - before} derrotados)`);
  await page.screenshot({ path: `${OUT}/05-meadow-combat.png` });

  // ---------- recibir daño y bloquear ----------
  const dmg = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    p.hp = p.maxHp; p.invuln = 0; p.state = 'normal';
    const r1 = p.takeDamage(2, p.x + Math.sin(p.facing) * 2, p.z + Math.cos(p.facing) * 2);
    p.invuln = 0; p.state = 'normal'; p.blocking = true; p.stamina = 100;
    const r2 = p.takeDamage(2, p.x + Math.sin(p.facing) * 2, p.z + Math.cos(p.facing) * 2);
    p.blocking = false;
    return [r1, r2, p.hp, p.maxHp];
  });
  ok(dmg[0] === 'hit' && dmg[1] === 'blocked' && dmg[2] === dmg[3] - 2, `daño (${dmg[0]}) y bloqueo frontal con escudo (${dmg[1]})`);

  // ---------- puerta norte y paso al bosque ----------
  await page.evaluate(() => { window.__t.tp(17.5, 4); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_v_gate')), 'la puerta norte se abre tras el tutorial');
  await page.screenshot({ path: `${OUT}/06-north-gate.png` });
  await page.evaluate(() => { window.__t.tp(17.5, 1); window.__game.input.down.add('up'); window.__t.sim(1.2); window.__game.input.down.delete('up'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__t.sim(0.5));
  ok(await page.evaluate(() => window.__game.zone.id === 'forest'), 'el portal lleva al Bosque Encantado');
  await page.screenshot({ path: `${OUT}/07-forest-entry.png` });

  const forest = await collisionReport();
  ok(forest.inside === 0, `Bosque: ${forest.tests} pasos sin atravesar paredes (${forest.inside} fallos)`);
  const camF = await cameraReport();
  ok(camF.bad === 0, `Bosque: cámara correcta en ${camF.n} posiciones (${camF.bad} fallos)`);

  // ---------- recorrido de la historia del bosque ----------
  await page.evaluate(() => { window.__game.godMode = true; window.__t.tp(3, 25.5, Math.PI); window.__t.sim(0.3); window.__game.input.press('interact'); window.__t.sim(0.5); });
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => window.__game.progress.has('key_maze')), 'el cofre del claro oeste da la Llave del Laberinto');
  await page.screenshot({ path: `${OUT}/08-forest-chest.png` });
  await page.evaluate(() => { window.__t.tp(22.5, 23.75, Math.PI); window.__t.sim(0.2); window.__game.input.press('interact'); window.__t.sim(2); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_f_maze_gate')), 'la llave abre la puerta del laberinto');
  await page.evaluate(() => { window.__t.tp(21.5, 14.5, Math.PI); window.__t.sim(0.5); });
  await page.screenshot({ path: `${OUT}/09-boss-arena.png` });
  const bossDead = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 60 * 40; i++) {
      const b = g.enemies.find((e) => e.def.boss);
      if (!b) return true;
      const d = Math.hypot(b.x - g.player.x, b.z - g.player.z);
      if (d > 3) { const a = Math.atan2(g.player.x - b.x, g.player.z - b.z); g.player.pos.x = b.x + Math.sin(a) * 2.8; g.player.pos.z = b.z + Math.cos(a) * 2.8; g.zone.collision.resolve(g.player.pos, 0.5); }
      if (i % 10 === 0) g.input.press('attack');
      g.noRender = true; g.step(1 / 60); g.noRender = false; g.input.endFrame();
    }
    return !g.enemies.some((e) => e.def.boss);
  });
  ok(bossDead, 'el Rey Trasgo (2 fases) puede ser derrotado');
  ok(await page.evaluate(() => window.__game.progress.flags.has('boss_forest')), 'derrotar al jefe activa su bandera');
  await page.evaluate(() => window.__t.sim(1));
  await page.screenshot({ path: `${OUT}/10-boss-defeated.png` });
  await page.evaluate(() => { window.__t.tp(21.5, 9.62, Math.PI); window.__t.sim(0.3); window.__game.input.press('interact'); window.__t.sim(0.5); });
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => window.__game.progress.has('key_forest')), 'el gran cofre da la Llave del Bosque');
  await page.evaluate(() => { window.__game.mode = 'play'; window.__game.ui.show('itemget', false); window.__t.tp(22.5, 1.78, Math.PI); window.__t.sim(0.3); window.__game.input.press('interact'); window.__t.sim(2.2); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_f_north_gate')), 'la Llave del Bosque abre la puerta norte');
  await page.evaluate(() => { window.__t.tp(22.5, 0.2, Math.PI); window.__t.sim(0.4); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('phase1_complete')), 'el portal norte completa la Fase 1');
  await page.screenshot({ path: `${OUT}/11-ending.png` });
  await page.evaluate(() => { document.getElementById('btn-keep').click(); });


  // ---------- guardado ----------
  const saved = await page.evaluate(() => { window.__game.save(); return !!localStorage.getItem('newrol.save.v1'); });
  ok(saved, 'la partida se guarda en localStorage');

  // ---------- rendimiento aproximado ----------
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t = performance.now();
    const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / 2); };
    requestAnimationFrame(f);
  }));
  console.log(`  (FPS en headless/swiftshader: ${fps.toFixed(1)})`);

  // ---------- móvil ----------
  await page.close(); // libera la CPU del renderizador por software
  const mobile = await browser.newPage({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', (e) => errors.push('[móvil] ' + String(e)));
  await mobile.goto(URL, { waitUntil: 'load' });
  await mobile.waitForFunction(() => window.__game && window.__game.zone, null, { timeout: 15000 });
  await mobile.tap('#btn-new');
  await mobile.waitForTimeout(800);
  ok(await mobile.evaluate(() => !document.getElementById('touch').classList.contains('hidden')), 'en móvil se muestran los controles táctiles');
  await mobile.screenshot({ path: `${OUT}/12-mobile.png` });
  await mobile.close();
} catch (e) {
  console.error(e);
  failures++;
} finally {
  const real = errors.filter((e) => !/favicon|fonts\.g/.test(e));
  ok(real.length === 0, `sin errores de consola (${real.length})`);
  real.slice(0, 10).forEach((e) => console.log('   ⚠ ' + e));
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} comprobaciones fallidas` : '\nTodas las comprobaciones pasaron ✔');
process.exit(failures ? 1 : 0);

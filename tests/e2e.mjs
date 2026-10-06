// Test end-to-end con Playwright (Chromium headless).
// 1. Compila y sirve el juego (vite preview).
// 2. Verifica que carga sin errores de consola y en < 5 s.
// 3. Juega: movimiento, ataque, diálogo, tutorial, zonas, combate.
// 4. Comprueba colisiones (no atravesar paredes) y la cámara (no atraviesa suelo/muros).
// 5. Guarda capturas en test-results/.
// La lógica se prueba con el estilo ilustrado (?toon), que es rápido de dibujar
// en el renderizador por software de CI; el estilo realista tiene su propia
// prueba de humo (tests/real-smoke.mjs). STYLE=real ejecuta todo en realista.
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const PORT = 4173;
const URL = `http://localhost:${PORT}/?fixeddt${process.env.STYLE === 'real' ? '' : '&toon'}`;
const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

let failures = 0;
// capturas de ayuda (no son comprobaciones): si el renderizado por software va lento, se omiten
let page;
const shot = async (opts) => { try { await page.screenshot({ ...opts, timeout: 60000 }); } catch (e) { console.log(`  (captura omitida: ${String(e.message).split('\n')[0]})`); } };
const waitTrue = async (page, fn, ms = 20000) => {
  try { await page.waitForFunction(fn, null, { timeout: ms, polling: 200 }); return true; } catch { return false; }
};
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
page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

try {
  // ---------- carga ----------
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 30000, polling: 50 });
  const loadMs = await page.evaluate(() => Math.round(window.__game.firstFrameAt));
  ok(loadMs < 5000, `el juego carga y dibuja su primer fotograma en ${loadMs} ms (< 5000)`);
  console.log(`  (tiempo total incluyendo el arranque del navegador: ${Date.now() - t0} ms)`);
  await page.waitForTimeout(500);
  await shot({ path: `${OUT}/01-title.png` });

  // ---------- nueva partida ----------
  await page.click('#btn-new');
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => window.__game.mode === 'play'), 'empieza la partida (modo play)');
  await shot({ path: `${OUT}/02-village-start.png` });

  // helpers dentro de la página
  await page.evaluate(() => {
    const g = window.__game;
    window.__t = {
      // movimientos estrictos por casillas (N/S/E/W; H = golpear el cristal más cercano):
      // falla si el héroe choca con un muro, una barrera levantada o un bloque que no se mueve
      run(moves) {
        g.godMode = true;
        const D = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }, KEY = { N: 'up', S: 'down', W: 'left', E: 'right' };
        const sim = (sec) => { g.noRender = true; for (let i = 0; i < Math.max(1, Math.round(sec * 60)); i++) { g.cam.yaw = 0; g.cam.idleLook = 0; g.step(1 / 60); g.input.endFrame(); } g.noRender = false; };
        const tileNow = () => g.zone.collision.tileOf(g.player.x, g.player.z);
        for (const [k, m] of moves.entries()) {
          const [c, r] = tileNow();
          const [x0, z0] = g.zone.tileToWorld(c, r);
          if (m === 'H') {
            const sw = g.interactables.filter((i) => i.kind === 'switch').sort((a, b) => Math.hypot(a.x - x0, a.z - z0) - Math.hypot(b.x - x0, b.z - z0))[0];
            const s0 = g.switchState, a = Math.atan2(x0 - sw.x, z0 - sw.z);
            g.player.place(sw.x + Math.sin(a) * 1.8, sw.z + Math.cos(a) * 1.8, a + Math.PI);
            sim(0.05); g.input.press('interact'); sim(0.6);
            g.player.place(x0, z0, g.player.facing); sim(0.05);
            if (g.switchState === s0) return { fail: k, why: 'el cristal no cambia' };
            continue;
          }
          const n = [c + D[m][0], r + D[m][1]];
          const block = g.interactables.find((i) => (i.kind === 'iceblock' || i.kind === 'stoneblock') && i.tile[0] === n[0] && i.tile[1] === n[1]);
          if (block) {
            g.input.down.add(KEY[m]); sim(0.5);
            for (let j = 0; j < 40 && !block.moving; j++) sim(0.05);
            g.input.down.delete(KEY[m]);
            for (let j = 0; j < 120 && block.moving; j++) sim(0.05);
            if (block.tile[0] === n[0] && block.tile[1] === n[1]) return { fail: k, why: `el bloque de ${n} no se mueve` };
          } else {
            const [x, z] = g.zone.tileToWorld(n[0], n[1]);
            if (g.zone.collision.blocked(x, z, 0.45)) return { fail: k, why: `paso bloqueado en ${n}` };
          }
          const [x, z] = g.zone.tileToWorld(n[0], n[1]); g.player.place(x, z, g.player.facing); sim(0.03);
        }
        return { tile: tileNow() };
      },
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
  await shot({ path: `${OUT}/03-dialog.png` });
  for (let i = 0; i < 12 && await page.evaluate(() => window.__game.mode === 'dialog'); i++) {
    await page.evaluate(() => { window.__game.ui.advanceDialog(); window.__game.ui.advanceDialog(); window.__t.sim(0.05); });
  }
  ok(await page.evaluate(() => window.__game.progress.flags.has('met_elder')), 'el anciano activa el tutorial');

  // ---------- tutorial: muñecos ----------
  for (const [c, r] of [[3, 15], [5, 15], [4, 18]]) {
    await page.evaluate(([c, r]) => { window.__t.tp(c, r + 0.6, Math.PI); window.__game.input.press('attack'); window.__t.sim(0.6); }, [c, r]);
  }
  ok(await page.evaluate(() => window.__game.progress.flags.has('dummies_done')), 'golpear los 3 muñecos completa el entrenamiento');
  await shot({ path: `${OUT}/04-training.png` });
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
    // casillas que activan un portal: el jugador nunca se queda ahí (cambia de zona al instante)
    const portals = g.interactables.filter((it) => it.constructor.name === 'Portal' || it.data?.type === 'portal');
    const onPortal = (x, zz) => portals.some((pt) => Math.abs(x - pt.x) < pt.width / 2 + 0.6 && Math.abs(zz - pt.z) < 2.8);
    for (let i = 0; i < 150; i++) {
      const c = Math.floor(Math.random() * z.W), r = Math.floor(Math.random() * z.H);
      const [x, zz] = z.tileToWorld(c, r);
      if (col.blocked(x, zz, 0.6) || onPortal(x, zz)) continue;
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
  await shot({ path: `${OUT}/05-meadow-combat.png` });

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
  await shot({ path: `${OUT}/06-north-gate.png` });
  await page.evaluate(() => { window.__t.tp(17.5, 1); window.__game.input.down.add('up'); window.__t.sim(1.2); window.__game.input.down.delete('up'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__t.sim(0.5));
  ok(await page.evaluate(() => window.__game.zone.id === 'forest'), 'el portal lleva al Bosque Encantado');
  await shot({ path: `${OUT}/07-forest-entry.png` });

  const forest = await collisionReport();
  ok(forest.inside === 0, `Bosque: ${forest.tests} pasos sin atravesar paredes (${forest.inside} fallos)`);
  const camF = await cameraReport();
  ok(camF.bad === 0, `Bosque: cámara correcta en ${camF.n} posiciones (${camF.bad} fallos)`);

  // ---------- recorrido de la historia del bosque ----------
  await page.evaluate(() => { window.__game.godMode = true; window.__t.tp(3, 25.5, Math.PI); window.__t.sim(0.3); window.__game.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('key_maze')), 'el cofre del claro oeste da la Llave del Laberinto');
  await shot({ path: `${OUT}/08-forest-chest.png` });

  // ---------- Santuario de las Luciérnagas: braseros con tiempo y runas ----------
  ok(await page.evaluate(() => {
    const g = window.__game;
    window.__t.tp(22.5, 23.75, Math.PI); window.__t.sim(0.2); g.input.press('interact'); window.__t.sim(1);
    if (g.ui.dialog) g.ui.closeDialog();
    g.mode = 'play';
    return !g.progress.flags.has('opened_f_maze_gate') && g.progress.has('key_maze');
  }), 'la verja del laberinto no se abre solo con la llave (falta el Emblema del Bosque)');
  await page.evaluate(() => { window.__t.tp(40.5, 36, Math.PI); window.__t.sim(0.3); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'shrine_forest' && !window.__game.transitioning, 30000), 'el arco del claro lleva al Santuario de las Luciérnagas');
  const fire = await page.evaluate(() => {
    const g = window.__game, p = g.player, t = window.__t;
    g.mode = 'play'; g.godMode = true;
    const br = (id) => g.interactables.find((i) => i.id === id);
    const near = (b) => { p.place(b.x, b.z + 2.2, Math.PI); t.sim(0.1); g.input.press('interact'); t.sim(0.2); };
    const res = {};
    near(br('sf_b2')); res.noFire = !br('sf_b2').lit;
    near(br('sf_eternal')); res.flame = p.flameT > 10;
    near(br('sf_b2')); res.lit = br('sf_b2').lit;
    t.sim(33); res.out = !br('sf_b2').lit; res.flameOut = !(p.flameT > 0);
    near(br('sf_eternal')); near(br('sf_b0')); near(br('sf_b1')); near(br('sf_b2'));
    res.solved = g.progress.flags.has('sf_fire_done');
    t.sim(40); res.stays = ['sf_b0', 'sf_b1', 'sf_b2'].every((id) => br(id).lit);
    return res;
  });
  ok(fire.noFire && fire.flame && fire.lit && fire.out && fire.flameOut, `braseros: sin fuego no prenden, la llama eterna prende la espada y todo se apaga con el tiempo (${JSON.stringify(fire)})`);
  ok(fire.solved && fire.stays, 'los tres braseros encendidos a la vez quedan ardiendo y abren la puerta de las runas');
  await page.evaluate(() => { window.__t.tp(14.5, 17.4, Math.PI); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_sf_doorA')), 'la puerta de piedra se abre al acercarse');
  await shot({ path: `${OUT}/20-shrine-runes.png` });
  const runes = await page.evaluate(() => {
    const g = window.__game, t = window.__t;
    const step = (c, r) => { const [x, z] = g.zone.tileToWorld(c, r); g.player.place(x, z, Math.PI); t.sim(0.15); };
    const tab = g.interactables.find((i) => i.kind === 'runetablet');
    step(14, 9);
    const wrong = tab.progress === 0 && !g.progress.flags.has('sf_runes_done');
    step(19, 12); const first = tab.progress;
    for (const [c, r] of [[9, 9], [9, 12], [19, 9], [14, 12]]) step(c, r);
    return { wrong, first, solved: g.progress.flags.has('sf_runes_done') };
  });
  ok(runes.wrong && runes.first === 1 && runes.solved, `runas: un paso en falso las apaga y el orden de la tablilla las despierta (${JSON.stringify(runes)})`);
  await page.evaluate(() => { const g = window.__game; window.__t.tp(14.5, 7.6, Math.PI); window.__t.sim(2.5); window.__t.tp(14.5, 3.6, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('emblem_forest')), 'el gran cofre del santuario da el Emblema del Bosque');
  ok(await page.evaluate(() => { const g = window.__game; const [x, z] = g.zone.tileToWorld(4, 11); return !g.zone.collision.blocked(x, z, 0.45); }), 'el muro falso del santuario lleva a la sala secreta');
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(14.5, 31, 0); window.__t.sim(0.3); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'forest' && !window.__game.transitioning, 30000), 'la salida del santuario vuelve al bosque');
  await page.evaluate(() => { window.__t.tp(22.5, 23.75, Math.PI); window.__t.sim(0.2); window.__game.input.press('interact'); window.__t.sim(2); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_f_maze_gate')), 'la llave abre la puerta del laberinto');
  await page.evaluate(() => { window.__t.tp(21.5, 14.5, Math.PI); window.__t.sim(0.5); });
  await shot({ path: `${OUT}/09-boss-arena.png` });
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
  await shot({ path: `${OUT}/10-boss-defeated.png` });
  await page.evaluate(() => { window.__t.tp(21.5, 9.62, Math.PI); window.__t.sim(0.3); window.__game.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('key_forest')), 'el gran cofre da la Llave del Bosque');
  await page.evaluate(() => { window.__game.mode = 'play'; window.__game.ui.show('itemget', false); window.__t.tp(22.5, 1.78, Math.PI); window.__t.sim(0.3); window.__game.input.press('interact'); window.__t.sim(2.2); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_f_north_gate')), 'la Llave del Bosque abre la puerta norte');
  await page.evaluate(() => { window.__t.tp(22.5, 0.2, Math.PI); window.__t.sim(0.4); });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__t.sim(0.3));
  ok(await page.evaluate(() => window.__game.zone.id === 'caves'), 'el portal norte del bosque lleva a las Cuevas Heladas');
  ok(await page.evaluate(() => window.__game.progress.flags.has('entered_caves')), 'se registra la entrada en las cuevas');
  await shot({ path: `${OUT}/11-caves-entry.png` });

  // =================== FASE 2: CUEVAS HELADAS ===================
  const caves = await collisionReport();
  ok(caves.inside === 0, `Cuevas: ${caves.tests} pasos sin atravesar paredes (${caves.inside} fallos)`);
  const camC = await cameraReport();
  ok(camC.bad === 0, `Cuevas: cámara correcta en ${camC.n} posiciones (${camC.bad} fallos)`);

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
        const block = g.interactables.find((i) => (i.kind === 'iceblock' || i.kind === 'stoneblock') && i.tile[0] === n[0] && i.tile[1] === n[1]);
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

  // --- puzle 1: lago helado (solución del solucionador: N W N W W W W S) ---
  const lakeEnd = await page.evaluate(() => { window.__t.tp(12, 37, Math.PI); return window.__t.exec(['N', 'W', 'N', 'W', 'W', 'W', 'W', 'S']); });
  ok(Math.abs(lakeEnd[0] - 7) + Math.abs(lakeEnd[1] - 35) === 1, `el deslizamiento sobre hielo sigue la solución del lago (acaba en ${lakeEnd})`);
  await shot({ path: `${OUT}/12-ice-lake.png` });
  await page.evaluate(() => { const g = window.__game; g.input.press('interact'); window.__t.sim(0.4); });
  ok(await waitTrue(page, () => window.__game.progress.has('key_frost')), 'el cofre de la isla da la Llave de escarcha');

  // --- nada de quedarse atrapado: desde cualquier casilla del lago se puede salir ---
  // (comprobado exhaustivamente por tools/genmaps.py; aquí una muestra)
  const stuck = await page.evaluate(() => {
    const g = window.__game;
    window.__t.tp(5, 38, Math.PI);
    return window.__t.exec(['E', 'N', 'E', 'S']);
  });
  ok(Array.isArray(stuck), 'moverse por el lago no bloquea el juego');

  // --- puerta A ---
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.tp(22.5, 29.8, Math.PI); window.__t.sim(0.2); g.input.press('interact'); window.__t.sim(2.2); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_c_gateA')), 'la Llave de escarcha abre la puerta de hielo');

  // --- puzle 2: bloque hasta la placa (29 pasos del solucionador) ---
  const blockSol = ['W', 'W', 'W', 'W', 'W', 'W', 'N', 'E', 'N', 'N', 'W', 'W', 'W', 'W', 'W', 'W', 'N', 'W', 'S', 'W', 'S', 'S', 'E', 'E', 'E', 'S', 'E', 'N', 'N'];
  await page.evaluate((sol) => { window.__t.tp(22, 27, Math.PI); window.__t.exec(sol); }, blockSol);
  await shot({ path: `${OUT}/13-block-puzzle.png` });
  ok(await page.evaluate(() => window.__game.progress.flags.has('c_plate1')), 'empujar el bloque de hielo hasta la placa resuelve el puzle');
  await page.evaluate(() => { window.__t.tp(22.5, 18.6, Math.PI); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_c_gateB')), 'la placa abre la reja del norte');

  // --- piedra rúnica: reinicia un bloque no resuelto (prueba con el estado actual: ya resuelto, no se mueve) ---
  const blockStays = await page.evaluate(() => {
    const g = window.__game;
    const b = g.interactables.find((i) => i.kind === 'iceblock');
    const stone = g.interactables.find((i) => i.kind === 'resetstone');
    stone.interact();
    return b.tile[0] === 27 && b.tile[1] === 19;
  });
  ok(blockStays, 'un bloque ya colocado en su placa no se reinicia');

  // --- Santuario de Cristal: barreras rojas/azules y bloques de piedra ---
  ok(await page.evaluate(() => { const g = window.__game; const [x, z] = g.zone.tileToWorld(22.5, 14); return !g.progress.flags.has('opened_c_emblem') && g.zone.collision.blocked(x, z, 0.45); }), 'la reja de la caverna sigue cerrada sin el Emblema de Cristal');
  await page.evaluate(() => { window.__game.mode = 'play'; window.__t.tp(35.5, 24, Math.PI); window.__t.sim(0.3); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'shrine_ice' && !window.__game.transitioning, 30000), 'la sala del este lleva al Santuario de Cristal');
  const barr = await page.evaluate((moves) => {
    const g = window.__game;
    g.mode = 'play';
    const bar = (c, r) => g.interactables.find((i) => i.kind === 'barrier' && i.tileRC[0] === c && i.tileRC[1] === r);
    const s0 = { red: bar(6, 24).collider.enabled, blue: bar(21, 24).collider.enabled };
    window.__t.tp(14, 30);
    const res = window.__t.run(moves);
    return { s0, res, state: g.switchState };
  }, ["N", "N", "N", "N", "W", "W", "W", "W", "W", "W", "W", "W", "W", "H", "N", "E", "N", "N", "N", "N", "N", "W", "W", "H", "E", "E", "E", "E", "E", "N", "N", "N"]);
  ok(barr.s0.red && !barr.s0.blue, 'al empezar, las barreras rojas están levantadas y las azules bajadas');
  ok(barr.res.tile && barr.res.tile[0] === 9 && barr.res.tile[1] === 17, `golpeando los cristales se cruza el laberinto de barreras (${JSON.stringify(barr.res)})`);
  await shot({ path: `${OUT}/21-shrine-crystal.png` });
  const sok = await page.evaluate((moves) => { window.__t.tp(14, 14); return window.__t.run(moves); }, ["N", "N", "N", "W", "W", "W", "N", "W", "W", "W", "W", "N", "N", "W", "N", "E", "E", "E", "E", "E", "E", "E", "S", "S", "E", "E", "E", "E", "E", "S", "E", "E", "E", "E", "S", "S", "E", "S", "W", "W", "W", "W", "W", "W", "W"]);
  ok(!sok.fail && await page.evaluate(() => ['si_plate1', 'si_plate2'].every((f) => window.__game.progress.flags.has(f))), `los dos bloques de piedra llegan a sus placas (${JSON.stringify(sok)})`);
  await page.evaluate(() => { const g = window.__game; window.__t.tp(14.5, 6.6, Math.PI); window.__t.sim(2.5); window.__t.tp(14.5, 2.9, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('emblem_ice')), 'el gran cofre del santuario da el Emblema de Cristal');
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(14.5, 33, 0); window.__t.sim(0.3); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'caves' && !window.__game.transitioning, 30000), 'la salida del santuario vuelve a las cuevas');
  await page.evaluate(() => { window.__game.mode = 'play'; window.__t.tp(22.5, 16.2, Math.PI); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_c_emblem')), 'con el Emblema de Cristal la reja de la caverna se abre sola');

  // --- Golem de Hielo (2 fases) ---
  await page.evaluate(() => { window.__t.tp(22.5, 10, Math.PI); window.__t.sim(0.5); });
  await shot({ path: `${OUT}/14-golem.png` });
  const golemDead = await page.evaluate(() => {
    const g = window.__game;
    g.godMode = true;
    let sawProjectile = false, sawPhase2 = false;
    for (let i = 0; i < 60 * 60; i++) {
      const b = g.enemies.find((e) => e.def.boss);
      if (!b) break;
      if (b.phase === 2) sawPhase2 = true;
      if (g.projectiles.list.length) sawProjectile = true;
      const d = Math.hypot(b.x - g.player.x, b.z - g.player.z);
      if (d > 3.6) { const a = Math.atan2(g.player.x - b.x, g.player.z - b.z); g.player.pos.x = b.x + Math.sin(a) * 3.4; g.player.pos.z = b.z + Math.cos(a) * 3.4; g.zone.collision.resolve(g.player.pos, 0.5); }
      // a veces alejarse para provocar lanzamientos
      if (b.phase === 2 && i % 400 < 60) { g.player.pos.x = b.x + 10; g.zone.collision.resolve(g.player.pos, 0.5); }
      if (i % 10 === 0) g.input.press('attack');
      g.noRender = true; g.step(1 / 60); g.noRender = false; g.input.endFrame();
    }
    return { dead: !g.enemies.some((e) => e.def.boss), sawPhase2, sawProjectile };
  });
  ok(golemDead.dead, 'el Golem de Hielo puede ser derrotado');
  ok(golemDead.sawPhase2, 'el Golem entra en su segunda fase');
  ok(golemDead.sawProjectile, 'el Golem lanza rocas de hielo en la segunda fase');
  await page.evaluate(() => window.__t.sim(1));
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.tp(22.5, 4.6, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('key_fire')), 'el gran cofre da la Llave de Fuego');
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(22.5, 1.78, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(3); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_c_north')), 'la Llave de Fuego derrite el muro de hielo');
  // --- misión de entrega: la sopa de Olaf para Sven ---
  const soup = await page.evaluate(() => {
    const g = window.__game;
    const talk = (id) => { const n = g.interactables.find((i) => i.id === id); g.talkTo(n); for (let k = 0; k < 20 && g.ui.dialog; k++) { g.ui.advanceDialog(); g.ui.advanceDialog(); } };
    talk('olaf');
    const got = g.progress.has('termo');
    talk('sven');
    return [got, g.progress.questState('q_soup')];
  });
  ok(soup[0] && soup[1] === 'done', `misión "Sopa caliente": aceptar, entregar y completar (${soup})`);

  // ======================= FASE 3: DESIERTO PERDIDO =======================
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.tp(22.5, 0.2, Math.PI); window.__t.sim(0.4); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'desert' && !window.__game.transitioning, 30000), 'el paso del norte lleva al Desierto Perdido');
  ok(await page.evaluate(() => window.__game.progress.flags.has('entered_desert')), 'se registra la llegada al desierto');
  await page.evaluate(() => window.__t.sim(0.5));
  await shot({ path: `${OUT}/16-desert.png` });

  // helpers del desierto
  await page.evaluate(() => {
    const g = window.__game;
    window.__t.talk = (id) => { const n = g.interactables.find((i) => i.id === id); if (!n) return false; g.talkTo(n); for (let k = 0; k < 30 && g.ui.dialog; k++) { g.ui.advanceDialog(); g.ui.advanceDialog(); } g.mode = 'play'; return true; };
    window.__t.enemies = (kind) => g.enemies.filter((e) => e.kind === kind && e.alive);
    window.__t.spawnNear = (kind, dx, dz) => { const p = g.player; const c = (p.x + dx + g.zone.W * 2) / 4 - 0.5, r = (p.z + dz + g.zone.H * 2) / 4 - 0.5; return g.spawnEnemy({ kind, tile: [c, r] }); };
  });

  // --- Kael se une al grupo y sigue al héroe ---
  const kael = await page.evaluate(() => {
    const g = window.__game;
    const had = g.interactables.some((i) => i.id === 'kael');
    window.__t.talk('kael');
    window.__t.sim(0.3);
    return { had, comp: g.companions.map((c) => c.id), npcGone: !g.interactables.some((i) => i.id === 'kael' && !i.removed) };
  });
  ok(kael.had && kael.comp.includes('kael') && kael.npcGone, `Kael el Encapuchado se une al grupo (${kael.comp})`);
  const follow = await page.evaluate(() => {
    const g = window.__game;
    window.__t.tp(23.5, 36, Math.PI);
    window.__t.sim(4);
    const c = g.companions[0];
    return Math.hypot(c.x - g.player.x, c.z - g.player.z);
  });
  ok(follow < 6, `el compañero sigue al héroe (a ${follow.toFixed(1)} u)`);
  // Kael conserva la cabeza (su malla se llama Rogue_Head_Hooded) y no da vueltas
  // alrededor del héroe cuando éste cambia de dirección en zigzag
  const calm = await page.evaluate(() => {
    const g = window.__game, c = g.companions[0];
    const head = c.model.root.getObjectByName('Rogue_Head_Hooded');
    let rot = 0, hero = 0, f = c.facing, hf = g.player.facing;
    for (let i = 0; i < 240; i++) {
      g.input.down.clear();
      g.input.down.add(Math.floor(i / 20) % 2 ? 'left' : 'right'); g.input.down.add('up');
      window.__t.sim(1 / 60);
      const d = Math.abs(Math.atan2(Math.sin(c.facing - f), Math.cos(c.facing - f)));
      if (!c.target) rot += d; // solo mientras sigue al héroe (no al luchar)
      hero += Math.abs(Math.atan2(Math.sin(g.player.facing - hf), Math.cos(g.player.facing - hf)));
      f = c.facing; hf = g.player.facing;
    }
    g.input.down.clear();
    return { head: !!head && head.visible, rot: Math.round(rot * 57.3), hero: Math.round(hero * 57.3) };
  });
  ok(calm.head, 'Kael se ve con cabeza (capucha)');
  ok(calm.rot < 400, `el compañero no da vueltas al seguir al héroe en zigzag (gira ${calm.rot}°, el héroe ${calm.hero}°)`);
  // con el héroe parado al lado, la cabeza del compañero le mira sin girar sin parar
  // (el giro de la mirada no debe acumularse cuando la animación de reposo apenas cambia)
  const headCalm = await page.evaluate(() => {
    const g = window.__game, c = g.companions[0], p = g.player, m = c.model;
    const a = c.facing - Math.PI * 0.6;
    p.place(c.x + Math.sin(a) * 2.5, c.z + Math.cos(a) * 2.5, 0);
    c.moving = false; c.turning = false;
    window.__t.sim(0.2);
    const Q = m.head.quaternion.constructor, V = m.head.position.constructor;
    const dir = () => { m.root.updateMatrixWorld(true); const r = m.root.getWorldQuaternion(new Q()).invert(); return new V(0, 0, 1).applyQuaternion(r.multiply(m.head.getWorldQuaternion(new Q()))); };
    let prev = dir(), sum = 0;
    for (let i = 0; i < 240; i++) { window.__t.sim(1 / 60); const v = dir(); sum += Math.acos(Math.min(1, Math.max(-1, v.dot(prev)))); prev = v; }
    return { deg: Math.round(sum * 57.3), looking: !!m.looking };
  });
  ok(headCalm.deg < 120, `la cabeza del compañero no da vueltas con el héroe parado (${headCalm.deg}° en 4 s, mirando: ${headCalm.looking})`);

  // --- el compañero lucha solo contra un enemigo cercano ---
  const helps = await page.evaluate(() => {
    const g = window.__game;
    g.godMode = true;
    window.__t.tp(23.5, 38, Math.PI);
    const e = window.__t.spawnNear('scorpion', 3, -3);
    const hp0 = e.hp;
    window.__t.sim(8);
    g.godMode = false;
    return { hit: !e.alive || e.hp < hp0, state: g.companions[0].state };
  });
  ok(helps.hit, 'el compañero ataca a los enemigos sin ayuda del héroe');

  // --- esqueleto enterrado: se levanta al acercarse (invulnerable mientras tanto) ---
  const awake = await page.evaluate(() => {
    const g = window.__game;
    const e = window.__t.enemies('skeletonMinion').find((m) => m.dormant);
    if (!e) return null;
    const s0 = e.state;
    // el héroe no apunta a enemigos enterrados (no se ven)
    const aimHidden = g.combat.nearestEnemy(e.x + 1.5, e.z, 4.5) === e;
    g.player.place(e.x + 4, e.z, 0);
    window.__t.sim(0.2);
    const s1 = e.state;
    const ign = e.hurt(5, g.player.x, g.player.z);
    window.__t.sim(2.2);
    return { s0, s1, ign, s2: e.state, alive: e.alive, aimHidden };
  });
  ok(awake && !awake.aimHidden, 'el héroe no apunta a los esqueletos enterrados');
  ok(awake && awake.s0 === 'dormant' && awake.s1 === 'awaken' && awake.ign === 'ignored' && awake.alive, `un esqueleto enterrado despierta al acercarse (${JSON.stringify(awake)})`);

  // --- escudo del guerrero: para golpes de frente, el remate del combo rompe la guardia ---
  const shield = await page.evaluate(() => {
    const g = window.__game;
    const e = window.__t.spawnNear('skeletonWarrior', 0, -3);
    e.state = 'chase'; e.facing = Math.atan2(g.player.x - e.x, g.player.z - e.z);
    const rnd = Math.random; Math.random = () => 0;
    const a = e.hurt(1, g.player.x, g.player.z);
    e.state = 'chase';
    const b = e.hurt(1, g.player.x, g.player.z, { heavy: true });
    Math.random = rnd;
    e.die();
    return [a, b];
  });
  ok(shield[0] === 'blocked' && shield[1] === 'hit', `el escudo del esqueleto para golpes de frente y el remate lo rompe (${shield})`);

  // --- veneno del escorpión: quita vida poco a poco sin matar; la poción lo cura ---
  const poison = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    g.godMode = true; // que ningún enemigo cercano reste vida durante la medida
    p.hp = p.maxHp; p.invuln = 0;
    p.poison(3.2);
    window.__t.sim(3.3);
    const lost = p.maxHp - p.hp;
    g.godMode = false;
    p.poison(5); g.progress.add('potion', 1);
    g.usePotion();
    return { lost, cured: !(p.poisonT > 0) };
  });
  ok(poison.lost === 2 && poison.cured, `el veneno resta vida con el tiempo y la poción lo cura (${JSON.stringify(poison)})`);

  // --- ballestero: dispara flechas desde lejos ---
  const arrows = await page.evaluate(() => {
    const g = window.__game;
    g.godMode = true;
    window.__t.tp(23.5, 38, Math.PI);
    const e = window.__t.spawnNear('skeletonArcher', 0, -9);
    let saw = false;
    for (let i = 0; i < 60 * 8 && !saw; i++) { window.__t.sim(1 / 60); saw = g.projectiles.list.some((p) => p.arrow && !p.dead); }
    e.die();
    g.godMode = false;
    return saw;
  });
  ok(arrows, 'los esqueletos ballesteros disparan flechas');

  // --- tormenta de arena ---
  const storm = await page.evaluate(() => {
    const g = window.__game;
    const d0 = g.scene.fog.density ?? g.scene.fog.far;
    g.storm.start();
    window.__t.sim(4);
    const d1 = g.scene.fog.density ?? g.scene.fog.far;
    const lvl = g.storm.level;
    // los enemigos ven menos durante la tormenta
    const e = window.__t.spawnNear('scorpion', 0, -8.5);
    const sees = e.canSee(g.player);
    e.die();
    g.storm.level = 0; g.storm.t = -60; g.storm.apply();
    return { lvl, thicker: g.scene.fog.isFogExp2 ? d1 > d0 * 3 : d1 < d0, sees };
  });
  ok(storm.lvl > 0.6 && storm.thicker && !storm.sees, `la tormenta de arena espesa la niebla y reduce la vista de los enemigos (${JSON.stringify(storm)})`);

  // --- mapa del desierto: colisiones y cámara ---
  const desertCol = await collisionReport();
  ok(desertCol.inside === 0, `Desierto: ${desertCol.tests} pasos sin atravesar paredes (${desertCol.inside} fallos)`);
  const camD = await cameraReport();
  ok(camD.bad === 0, `Desierto: cámara correcta en ${camD.n} posiciones (${camD.bad} fallos)`);

  // --- historia: Sir Aldric, la Llave del Sol y la puerta del templo ---
  await page.evaluate(() => window.__t.talk('aldric'));
  ok(await page.evaluate(() => window.__game.progress.flags.has('met_aldric')), 'Sir Aldric cuenta dónde está la Llave del Sol');
  const locked = await page.evaluate(() => {
    const g = window.__game;
    window.__t.tp(23.5, 16.85, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.3);
    const open = g.progress.flags.has('opened_d_temple');
    if (g.ui.dialog) g.ui.closeDialog();
    g.mode = 'play';
    return open;
  });
  ok(!locked, 'la puerta del templo no se abre sin la Llave del Sol');
  await page.evaluate(() => { const g = window.__game; g.godMode = true; window.__t.tp(6.5, 12.3, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.6); });
  ok(await waitTrue(page, () => window.__game.progress.has('key_sun')), 'el cofre de las ruinas da la Llave del Sol');
  ok(await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'play'; g.ui.show('itemget', false);
    window.__t.tp(23.5, 16.85, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5);
    if (g.ui.dialog) g.ui.closeDialog();
    g.mode = 'play';
    return !g.progress.flags.has('opened_d_temple') && g.progress.has('key_sun');
  }), 'la Llave del Sol sola no abre el templo (falta el Emblema del Sol)');

  // --- Santuario del Sol: braseros en cadena y espejos ---
  await page.evaluate(() => { window.__t.tp(41.5, 13, Math.PI); window.__t.sim(0.3); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'shrine_sun' && !window.__game.transitioning, 30000), 'el cañón lleva al Santuario del Sol');
  const sun = await page.evaluate(() => {
    const g = window.__game, p = g.player, t = window.__t;
    g.mode = 'play'; g.godMode = true;
    const br = (id) => g.interactables.find((i) => i.id === id);
    const near = (b) => { p.place(b.x, b.z + 2.2, Math.PI); t.sim(0.1); g.input.press('interact'); t.sim(0.2); };
    const res = {};
    near(br('ss_eternal')); t.sim(13); near(br('ss_b0')); res.flameDies = !br('ss_b0').lit;
    near(br('ss_eternal')); near(br('ss_b2')); near(br('ss_b2')); near(br('ss_b0'));
    near(br('ss_eternal')); near(br('ss_b3')); near(br('ss_b3')); near(br('ss_b1'));
    res.fire = g.progress.flags.has('ss_fire_done');
    t.tp(16, 18.6); t.sim(2.5);
    res.door = g.progress.flags.has('opened_ss_doorA');
    const idol = g.interactables.find((i) => i.kind === 'beamsource');
    t.sim(0.2);
    res.beamOn = !!idol.path && idol.path.pts.length > 2;
    res.notYet = !g.progress.flags.has('ss_beam_done');
    const mirror = (c, r) => g.interactables.find((i) => i.kind === 'mirror' && i.tileRC[0] === c && i.tileRC[1] === r);
    const turn = (c, r) => { const m = mirror(c, r); p.place(m.x, m.z + 2.6, Math.PI); t.sim(0.1); g.input.press('interact'); t.sim(0.4); return m.orient; };
    const fixed0 = mirror(12, 7).orient; turn(12, 7); res.fixed = mirror(12, 7).orient === fixed0;
    for (const [c, r] of [[5, 15], [5, 7], [12, 10], [21, 10]]) turn(c, r);
    t.sim(0.5);
    res.beam = g.progress.flags.has('ss_beam_done');
    return res;
  });
  ok(sun.flameDies, 'el fuego de la espada se apaga si se tarda demasiado entre llamas');
  ok(sun.fire && sun.door, `encendiendo los braseros en cadena se abre la sala de los espejos (${JSON.stringify(sun)})`);
  ok(sun.beamOn && sun.notYet && sun.fixed, 'el ídolo dispara el rayo, pero no llega al cristal; el espejo de bronce no gira');
  ok(sun.beam, 'girando los espejos el rayo de sol alcanza el cristal');
  await shot({ path: `${OUT}/22-shrine-sun.png` });
  await page.evaluate(() => { const g = window.__game; window.__t.tp(15.5, 6.6, Math.PI); window.__t.sim(2.5); window.__t.tp(15.5, 2.9, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('emblem_sun')), 'el gran cofre del santuario da el Emblema del Sol');
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(15.5, 35, 0); window.__t.sim(0.3); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'desert' && !window.__game.transitioning, 30000), 'la salida del santuario vuelve al desierto');
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(23.5, 16.85, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_d_temple')), 'la Llave y el Emblema del Sol abren la puerta del Templo del Sol');

  // --- Rey de las Arenas (2 fases, invoca esqueletos de la arena) ---
  await page.evaluate(() => { window.__t.tp(24, 13, Math.PI); window.__t.sim(0.5); });
  await shot({ path: `${OUT}/17-sand-king.png` });
  const king = await page.evaluate(() => {
    const g = window.__game;
    g.godMode = true;
    let sawPhase2 = false, sawRise = false;
    for (let i = 0; i < 60 * 80; i++) {
      const b = g.enemies.find((e) => e.def.boss);
      if (!b) break;
      if (b.phase === 2) sawPhase2 = true;
      if (g.enemies.some((e) => e.state === 'awaken')) sawRise = true;
      // los súbditos invocados también caen
      for (const m of g.enemies) if (!m.def.boss && m.alive && m.state !== 'awaken' && Math.random() < 0.01) m.die();
      const d = Math.hypot(b.x - g.player.x, b.z - g.player.z);
      if (d > 3.8) { const a = Math.atan2(g.player.x - b.x, g.player.z - b.z); g.player.pos.x = b.x + Math.sin(a) * 3.6; g.player.pos.z = b.z + Math.cos(a) * 3.6; g.zone.collision.resolve(g.player.pos, 0.5); }
      if (i % 10 === 0) g.input.press('attack');
      g.noRender = true; g.step(1 / 60); g.noRender = false; g.input.endFrame();
    }
    const b = g.enemies.find((e) => e.def.boss);
    return { dead: !b, sawPhase2, sawRise, hp: b?.hp, st: b?.state, storm: +g.storm.level.toFixed(2), player: g.player.state, comp: g.companions.map((c) => `${c.id}:${c.state}:${c.target?.kind ?? '-'}`).join(',') };
  });
  ok(king.dead, `el Rey de las Arenas puede ser derrotado (${JSON.stringify(king)})`);
  ok(king.sawPhase2 && king.sawRise, `el Rey de las Arenas entra en su segunda fase y levanta esqueletos (${JSON.stringify(king)})`);
  await page.evaluate(() => window.__t.sim(1));
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.tp(24, 4.1, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('key_castle')), 'el gran cofre del templo da la Llave del Castillo');

  // --- misiones secundarias del desierto ---
  const quests3 = await page.evaluate(() => {
    const g = window.__game, pr = g.progress, t = window.__t;
    g.mode = 'play'; g.ui.show('itemget', false);
    const res = {};
    // Borg: 4 esqueletos enterrados -> se une al grupo
    t.tp(14.5, 30.6, Math.PI); t.talk('borg');
    for (let k = 0; k < 4; k++) { const e = t.spawnNear('skeletonMinion', 30, 0); e.die(); }
    res.borgReady = pr.questState('q_borg');
    t.talk('borg');
    res.borg = pr.questState('q_borg');
    // Zahir: 5 escorpiones
    t.tp(20.5, 29.6, Math.PI); t.talk('zahra');
    for (let k = 0; k < 5; k++) { const e = t.spawnNear('scorpion', 30, 0); e.die(); }
    t.talk('zahra');
    res.scorp = pr.questState('q_scorpions');
    // Cedric: el amuleto está tras un muro falso de las ruinas
    t.tp(32.6, 22.4, Math.PI); t.talk('cedric');
    const [wx, wz] = g.zone.tileToWorld(6, 20);
    res.secretPassable = !g.zone.collision.blocked(wx, wz, 0.5);
    t.tp(4.8, 20, -Math.PI / 2); t.sim(0.3); g.input.press('interact'); t.sim(0.5);
    // Aldric: 3 fragmentos solares
    t.tp(21.5, 19.8, Math.PI); t.talk('aldric');
    for (const [c, r] of [[38, 12], [3, 42], [35, 47]]) { t.tp(c, r, 0); t.sim(0.4); }
    t.tp(21.5, 19.8, Math.PI); t.talk('aldric');
    res.shards = pr.questState('q_shards');
    return res;
  });
  // el cofre entrega el amuleto con un pequeño retardo (setTimeout): se espera fuera de la página
  await waitTrue(page, () => window.__game.progress.has('amulet'));
  quests3.amulet = await page.evaluate(() => {
    const g = window.__game, t = window.__t;
    g.mode = 'play'; g.ui.show('itemget', false);
    t.tp(32.6, 22.4, Math.PI); t.talk('cedric');
    return g.progress.questState('q_amulet');
  });
  ok(quests3.borgReady === 'ready' && quests3.borg === 'done', `misión "Huesos en la arena" (${quests3.borgReady}, ${quests3.borg})`);
  ok(await waitTrue(page, () => window.__game.companions.some((c) => c.id === 'borg')), 'Borg el Bárbaro se une al grupo al completar su misión');
  ok(quests3.scorp === 'done', `misión "Plaga de escorpiones" (${quests3.scorp})`);
  ok(quests3.secretPassable && quests3.amulet === 'done', `misión "El amuleto de la familia" con el pasadizo secreto (${quests3.secretPassable}, ${quests3.amulet})`);
  ok(quests3.shards === 'done', `misión "Fragmentos de sol" (${quests3.shards})`);
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.tp(23.5, 12, Math.PI); window.__t.sim(1); });
  await shot({ path: `${OUT}/18-party.png` });

  // --- salida norte: el templo lleva al Castillo Final (fin de la Fase 3) ---
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(23.5, 0.2, Math.PI); window.__t.sim(0.4); });
  ok(await waitTrue(page, () => window.__game.zone.id === 'castle' && !window.__game.transitioning, 30000), 'la salida norte del templo lleva al Castillo Final');
  ok(await page.evaluate(() => window.__game.progress.flags.has('phase3_complete')), 'cruzar al castillo completa la Fase 3');

  // ======================= FASE 4: CASTILLO FINAL =======================
  const C = {"barriers": {"start": [8, 41], "moves": ["N", "N", "E", "E", "E", "E", "E", "E", "H", "W", "W", "W", "W", "W", "W", "W", "W", "W", "N", "N", "N", "N", "W", "W", "H", "E", "E", "E", "E", "N", "N", "N", "N", "N", "W", "W", "W"]}, "blocks": {"start": [4, 28], "moves": ["N", "N", "E", "N", "N", "W", "N", "E", "E", "E", "E", "S", "S", "S", "S", "E", "E", "E", "E", "N", "W", "N", "E", "S", "E", "N", "N", "S", "W", "W", "N", "N", "E", "E"]}, "mirrors": [[15, 12], [8, 12], [8, 9]], "runes": [[46, 25], [46, 22], [51, 25], [41, 22], [51, 22], [41, 25]], "crypt": {"start": [46, 15], "moves": ["N", "N", "N", "E", "N", "N", "N", "E", "N", "W", "W", "W", "W", "W"]}};
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.sim(0.5); });
  await shot({ path: `${OUT}/23-castle.png` });
  const aldric = await page.evaluate(() => { window.__t.talk('aldric'); window.__t.sim(0.3); return window.__game.companions.map((c) => c.id); });
  ok(aldric.includes('aldric'), `Sir Aldric se une al grupo ante el puente (${aldric})`);
  const castleCol = await collisionReport();
  ok(castleCol.inside === 0, `Castillo: ${castleCol.tests} pasos sin atravesar paredes (${castleCol.inside} fallos)`);
  const camK = await cameraReport();
  ok(camK.bad === 0, `Castillo: cámara correcta en ${camK.n} posiciones (${camK.bad} fallos)`);
  ok(await page.evaluate(() => {
    const g = window.__game;
    g.mode = 'play';
    window.__t.tp(27.5, 17.85, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5);
    const locked = !!g.ui.dialog;
    if (g.ui.dialog) g.ui.closeDialog();
    g.mode = 'play';
    return locked && !g.progress.flags.has('opened_k_gate');
  }), 'la Gran Puerta no se abre sin los tres sellos');

  // --- Ala del Cristal: barreras y bloques -> Sello del Cristal ---
  const kw = await page.evaluate((C) => {
    const g = window.__game, t = window.__t;
    t.tp(...C.barriers.start);
    const bar = t.run(C.barriers.moves);
    t.tp(...C.blocks.start);
    const blk = t.run(C.blocks.moves);
    return { bar, blk, plates: ['kw_plate1', 'kw_plate2'].every((f) => g.progress.flags.has(f)) };
  }, C);
  ok(kw.bar.tile && kw.bar.tile[0] === 4 && kw.bar.tile[1] === 30, `Ala del Cristal: los cristales abren paso entre las barreras (${JSON.stringify(kw.bar)})`);
  ok(!kw.blk.fail && kw.plates, `Ala del Cristal: los dos bloques llegan a sus placas (${JSON.stringify(kw.blk)})`);
  await page.evaluate(() => { const g = window.__game; window.__t.tp(8.5, 22.6, Math.PI); window.__t.sim(2.5); window.__t.tp(8.5, 19.4, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('seal_crystal')), 'el cofre del ala oeste da el Sello del Cristal');

  // --- Torre de la Luz: espejos -> Sello de la Luz ---
  const kl = await page.evaluate((turns) => {
    const g = window.__game, p = g.player, t = window.__t;
    g.mode = 'play'; g.ui.show('itemget', false);
    t.tp(8.5, 18.4, Math.PI); t.sim(2.5);
    const door = g.progress.flags.has('opened_kw_lib');
    const before = g.progress.flags.has('kl_beam_done');
    const mirror = (c, r) => g.interactables.find((i) => i.kind === 'mirror' && i.tileRC[0] === c && i.tileRC[1] === r);
    for (const [c, r] of turns) { const m = mirror(c, r); p.place(m.x, m.z + 2.6, Math.PI); t.sim(0.1); g.input.press('interact'); t.sim(0.4); }
    t.sim(0.5);
    return { door, before, beam: g.progress.flags.has('kl_beam_done') };
  }, C.mirrors);
  ok(kl.door && !kl.before && kl.beam, `Torre de la Luz: con el Sello del Cristal se entra y los espejos llevan el rayo al cristal (${JSON.stringify(kl)})`);
  await shot({ path: `${OUT}/24-castle-library.png` });
  await page.evaluate(() => { const g = window.__game; window.__t.tp(8.5, 4.6, Math.PI); window.__t.sim(2.5); window.__t.tp(8.5, 2.2, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('seal_light')), 'el nicho de la biblioteca da el Sello de la Luz');

  // --- Ala de la Llama: braseros con tiempo y runas -> Sello de la Llama ---
  const ke = await page.evaluate((runes) => {
    const g = window.__game, p = g.player, t = window.__t;
    g.mode = 'play'; g.ui.show('itemget', false); g.godMode = true;
    const br = (id) => g.interactables.find((i) => i.id === id);
    const near = (b) => { p.place(b.x, b.z + 2.2, Math.PI); t.sim(0.1); g.input.press('interact'); t.sim(0.2); };
    near(br('ke_eternal'));
    for (const id of ['ke_b2', 'ke_b0', 'ke_b3', 'ke_b1']) { near(br(id)); near(br('ke_eternal')); }
    const fire = g.progress.flags.has('ke_fire_done');
    t.tp(46.5, 30.4, Math.PI); t.sim(2.5);
    const doorA = g.progress.flags.has('opened_ke_doorA');
    const step = (c, r) => { const [x, z] = g.zone.tileToWorld(c, r); p.place(x, z, Math.PI); t.sim(0.15); };
    for (const [c, r] of runes) step(c, r);
    return { fire, doorA, runes: g.progress.flags.has('ke_runes_done') };
  }, C.runes);
  ok(ke.fire && ke.doorA, `Ala de la Llama: los cuatro braseros a tiempo abren la sala de las runas (${JSON.stringify(ke)})`);
  ok(ke.runes, 'Ala de la Llama: las seis runas en orden abren la sala del sello');
  await page.evaluate(() => { const g = window.__game; window.__t.tp(46.5, 21.4, Math.PI); window.__t.sim(2.5); window.__t.tp(46.5, 19.3, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('seal_flame')), 'el cofre del ala este da el Sello de la Llama');

  // --- Cripta: bloque y placa -> tomo; sala secreta ---
  const kc = await page.evaluate((C) => {
    const g = window.__game, t = window.__t;
    g.mode = 'play'; g.ui.show('itemget', false);
    t.tp(46.5, 18.4, Math.PI); t.sim(2.5);
    const door = g.progress.flags.has('opened_ke_crypt');
    t.tp(...C.crypt.start);
    const blk = t.run(C.crypt.moves);
    const [sx, sz] = g.zone.tileToWorld(51, 5);
    return { door, blk, plate: g.progress.flags.has('kc_plate'), secret: !g.zone.collision.blocked(sx, sz, 0.45) };
  }, C);
  ok(kc.door && kc.plate && !kc.blk.fail, `Cripta: con el Sello de la Llama se entra y el bloque abre la cámara del tomo (${JSON.stringify(kc)})`);
  ok(kc.secret, 'Cripta: un muro falso lleva a la sala secreta');
  await page.evaluate(() => { const g = window.__game; window.__t.tp(42, 7.2, Math.PI); window.__t.sim(2.5); window.__t.tp(42, 4, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(0.5); });
  ok(await waitTrue(page, () => window.__game.progress.has('lost_tome')), 'la cámara de la cripta guarda el Tomo de los sellos');

  // --- misiones secundarias del castillo ---
  const quests4 = await page.evaluate(() => {
    const g = window.__game, pr = g.progress, t = window.__t;
    g.mode = 'play'; g.ui.show('itemget', false);
    const res = {};
    // Isolda: el tomo
    t.tp(12.5, 16.6, Math.PI); t.talk('isolda'); t.talk('isolda');
    res.tome = pr.questState('q_tome');
    // Bartolo: 6 caballeros oscuros
    t.tp(48.5, 46.5, Math.PI); t.talk('bartolo');
    for (let k = 0; k < 6; k++) { const e = t.spawnNear('darkKnight', 30, 0); e.die(); }
    t.talk('bartolo');
    res.knights = pr.questState('q_knights');
    // Cedric: 3 estandartes -> se une al grupo
    t.tp(24.5, 62, 0); t.talk('cedric');
    for (const [c, r] of [[3, 48], [53, 51], [52, 8]]) { t.tp(c, r, 0); t.sim(0.4); }
    t.tp(24.5, 62, 0); t.talk('cedric');
    res.banners = pr.questState('q_banners');
    return res;
  });
  ok(quests4.tome === 'done', `misión "El tomo de los sellos" (${quests4.tome})`);
  ok(quests4.knights === 'done', `misión "Caballeros caídos" (${quests4.knights})`);
  ok(quests4.banners === 'done', `misión "Los estandartes del reino" (${quests4.banners})`);
  ok(await waitTrue(page, () => window.__game.companions.some((c) => c.id === 'cedric')), 'Sir Cedric se une al grupo con los estandartes');

  // --- la Gran Puerta y Malakar ---
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; g.ui.show('itemget', false); window.__t.tp(27.5, 17.85, Math.PI); window.__t.sim(0.3); g.input.press('interact'); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_k_gate')), 'los tres sellos abren la Gran Puerta');
  await page.evaluate(() => { window.__t.tp(27.5, 15, Math.PI); window.__t.sim(0.5); });
  await shot({ path: `${OUT}/25-malakar.png` });
  const fight = await page.evaluate(() => {
    const g = window.__game, p = g.player;
    g.godMode = true;
    const res = { shield: false, blocked: false, stun: false, phase3: false, pylonsSeen: 0 };
    for (let i = 0; i < 60 * 180; i++) {
      const b = g.enemies.find((e) => e.def.boss);
      if (!b) break;
      if (b.shielded) {
        res.shield = true;
        if (!res.blocked) res.blocked = b.hurt(1, p.x, p.z) === 'blocked';
      }
      if (b.state === 'stun') res.stun = true;
      if (b.phase === 3) res.phase3 = true;
      res.pylonsSeen = Math.max(res.pylonsSeen, g.interactables.filter((it) => it.kind === 'pylon' && !it.removed).length);
      for (const m of g.enemies) if (!m.def.boss && m.alive && m.state !== 'awaken' && Math.random() < 0.02) m.die();
      let tx = b.x, tz = b.z, rad = b.radius;
      const py = b.shielded && g.interactables.find((it) => it.kind === 'pylon' && !it.removed);
      if (py) { tx = py.x; tz = py.z; rad = 0.9; }
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d > rad + 2.4) { const a = Math.atan2(p.x - tx, p.z - tz); p.pos.x = tx + Math.sin(a) * (rad + 1.9); p.pos.z = tz + Math.cos(a) * (rad + 1.9); g.zone.collision.resolve(p.pos, 0.5); }
      p.facing = Math.atan2(tx - p.x, tz - p.z);
      if (i % 10 === 0) g.input.press('attack');
      g.noRender = true; g.step(1 / 60); g.noRender = false; g.input.endFrame();
    }
    const b = g.enemies.find((e) => e.def.boss);
    return { ...res, dead: !b, hp: b?.hp, st: b?.state, phase: b?.phase };
  });
  ok(fight.shield && fight.blocked && fight.pylonsSeen === 4, `Malakar se protege con un escudo que para los golpes y alimentan 4 cristales oscuros (${JSON.stringify(fight)})`);
  ok(fight.stun, 'al romper los cristales, el escudo cae y Malakar queda aturdido');
  ok(fight.phase3, 'Malakar entra en su fase de furia');
  ok(fight.dead, 'Malakar puede ser derrotado');
  await page.evaluate(() => { const g = window.__game; g.mode = 'play'; window.__t.sim(1); window.__t.tp(27.5, 2.6, Math.PI); window.__t.sim(2.5); });
  ok(await page.evaluate(() => window.__game.progress.flags.has('opened_k_balcony')), 'tras la victoria se abre la puerta del balcón');
  await page.evaluate(() => { const g = window.__game; window.__t.tp(27.5, 0.2, Math.PI); window.__t.sim(0.4); });
  ok(await waitTrue(page, () => window.__game.progress.flags.has('game_complete')), 'salir al balcón completa el juego');
  ok(await page.evaluate(() => /salvado el reino/.test(document.querySelector('#ending h1').textContent)), 'se muestra la pantalla final del juego');
  await shot({ path: `${OUT}/26-ending.png` });
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

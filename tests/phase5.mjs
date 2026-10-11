// Prueba de la fase 5 sobre el juego real: el atajo «Ir al Volcán» del menú, el final del
// balcón y el portal de regreso (sin recargar la zona), la despedida de los compañeros en
// la aldea, el sendero del volcán, la salida del cráter tras el jefe y la vuelta a la aldea.
// Uso: node tests/phase5.mjs   (SKIP_BUILD=1 para usar la última compilación;
// OUTDIR=carpeta para compilar y servir otra copia distinta de dist/)
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { QUESTS } from '../src/data/quests.js';
const OUTDIR = process.env.OUTDIR || 'dist';
if (!process.env.SKIP_BUILD) execSync(`npx vite build --outDir ${OUTDIR} --emptyOutDir`, { stdio: 'ignore' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUTDIR, '--port', '4178', '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('4178')) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4178/?fixeddt&toon');
await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 60000 });

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) fails++; };

// 1) atajo del menú: el héroe empieza en la sala del trono, con Malakar vencido y el final pendiente
await page.click('#btn-volcano');
await page.waitForFunction(() => window.__game.zone && window.__game.zone.id === 'castle' && window.__game.mode === 'play', null, { timeout: 30000 });
const start = await page.evaluate(() => {
  const g = window.__game, f = g.progress.flags;
  return {
    boss: f.has('boss_castle'), finished: f.has('game_complete'), party: g.companions.length,
    hp: g.player.maxHp, sword: g.player.swordDamage, coins: g.progress.coins,
    quests: Object.values(g.progress.quests).filter((q) => q.state === 'done').length,
    returnPortal: g.interactables.some((i) => i.data && i.data.to === 'village'),
    objective: g.currentObjective(),
  };
});
const phase14 = Object.keys(QUESTS).filter((id) => QUESTS[id].zone !== 'volcano').length;
ok(start.boss && !start.finished, 'el atajo empieza con Malakar vencido y el final del balcón pendiente');
ok(start.party === 4, `los cuatro compañeros acompañan al héroe (${start.party})`);
ok(start.hp === 22 && start.sword === 3 && start.coins === 150, `el héroe lleva el equipo de final de fase 4 (vida ${start.hp}, daño ${start.sword}, monedas ${start.coins})`);
ok(start.quests === phase14, `las misiones de las fases 1 a 4 están terminadas (${start.quests}/${phase14})`);
ok(!start.returnPortal, 'el portal de regreso aún no aparece: lo abre el final del balcón');
ok(/balcón/i.test(start.objective), `el objetivo es subir al balcón (${start.objective})`);

// 2) el balcón completa el final y el portal de regreso aparece sin recargar la zona
await page.evaluate(() => { const g = window.__game; const b = g.interactables.find((i) => i.data && i.data.to === 'credits'); g.player.place(b.x, b.z + 0.5, 0); });
await page.waitForFunction(() => window.__game.progress.flags.has('game_complete'), null, { timeout: 60000 });
ok(await page.evaluate(() => !document.getElementById('ending').classList.contains('hidden')), 'el balcón muestra la pantalla final');
await page.click('#btn-keep');
await page.waitForFunction(() => window.__game.interactables.some((i) => i.data && i.data.to === 'village'), null, { timeout: 20000 });
ok(true, 'tras el final aparece el portal de regreso a la aldea (sin recargar la zona)');
const portal = await page.evaluate(() => {
  const g = window.__game;
  const p = g.interactables.find((i) => i.data && i.data.to === 'village');
  if (p) g.player.place(p.x, p.z + 0.5, Math.PI);
  return !!p;
});
ok(portal, 'el portal de regreso se puede cruzar');

// 3) cruzar el portal: vuelve a la aldea y los compañeros se despiden uno a uno
await page.waitForFunction(() => window.__game.zone.id === 'village' && window.__game.ui.dialog, null, { timeout: 30000 });
const farewellNames = [];
for (let n = 0; n < 200; n++) {
  const done = await page.evaluate(() => !window.__game.ui.dialog);
  if (done) break;
  const name = await page.evaluate(() => window.__game.ui.dialog && window.__game.ui.dialog.name);
  if (name && farewellNames[farewellNames.length - 1] !== name) farewellNames.push(name);
  await page.evaluate(() => window.__game.ui.advanceDialog());
}
ok(farewellNames.join('|') === 'Kael|Sir Aldric|Sir Cedric|Borg', `la despedida sigue el orden del grupo (${farewellNames.join(', ')})`);

const after = await page.evaluate(() => {
  const g = window.__game, f = g.progress.flags;
  return {
    done: f.has('farewell_done'),
    left: ['kael', 'aldric', 'cedric', 'borg'].every((id) => f.has(`farewell_${id}`)),
    party: g.companions.length,
    npcs: ['kael', 'aldric', 'cedric', 'borg'].map((id) => g.interactables.some((i) => i.id === id)),
    mode: g.mode,
    objective: g.currentObjective(),
  };
});
ok(after.done && after.left, 'al terminar, los cuatro quedan marcados como despedidos');
ok(after.party === 0, 'el héroe ya no va acompañado');
ok(after.npcs.every(Boolean), 'los compañeros se quedan en la aldea como habitantes');
ok(after.mode === 'play', 'el juego vuelve al modo de juego tras la despedida');
ok(/volcán|sendero/i.test(after.objective), `el objetivo principal apunta al volcán (${after.objective})`);

// 4) el sendero del volcán está abierto y lleva al volcán
const vol = await page.evaluate(() => {
  const g = window.__game;
  const p = g.interactables.find((i) => i.data && i.data.to === 'volcano');
  if (p) g.player.place(p.x, p.z + 0.5, 0);
  return !!p;
});
ok(vol, 'el portal del sendero del volcán existe en la aldea');
await page.waitForFunction(() => window.__game.zone.id === 'volcano', null, { timeout: 30000 });
const inVolcano = await page.evaluate(() => {
  const g = window.__game;
  return {
    flag: g.progress.flags.has('entered_volcano'),
    boss: g.enemies.some((e) => e.spawn && e.spawn.kind === 'ignar'),
    door: g.interactables.some((i) => i.data && i.data.id === 'v_crater'),
    objective: g.currentObjective(),
  };
});
ok(inVolcano.flag, 'entrar en el volcán registra la zona');
ok(inVolcano.boss, 'el jefe Ignar está en el cráter');
ok(inVolcano.door, 'la Puerta del Cráter está en el mapa');
ok(/río de lava|llave/i.test(inVolcano.objective), `el objetivo es cruzar el río y buscar la llave (${inVolcano.objective})`);

// 5) al vencer a Ignar, la salida del cráter aparece sin recargar la zona
await page.evaluate(() => { window.__game.progress.flags.add('boss_volcano'); });
await page.waitForFunction(() => window.__game.interactables.some((i) => i.data && i.data.to === 'credits'), null, { timeout: 20000 });
ok(true, 'tras el jefe aparece la salida del cráter (sin recargar la zona)');

// 6) volver a la aldea desde el volcán: la despedida ya no se repite y los amigos siguen en la plaza
const back = await page.evaluate(() => {
  const g = window.__game;
  const p = g.interactables.find((i) => i.data && i.data.to === 'village');
  if (p) g.player.place(p.x, p.z - 0.5, 0);
  return !!p;
});
ok(back, 'el portal de salida del volcán lleva a la aldea');
await page.waitForFunction(() => window.__game.zone.id === 'village' && !window.__game.transitioning, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const again = await page.evaluate(() => {
  const g = window.__game;
  return {
    dialog: !!g.ui.dialog,
    npcs: ['kael', 'aldric', 'cedric', 'borg'].filter((id) => g.interactables.some((i) => i.id === id)).length,
    party: g.companions.length,
  };
});
ok(!again.dialog, 'al volver a la aldea no se repite la despedida');
ok(again.npcs === 4 && again.party === 0, `los cuatro siguen en la aldea y el héroe sigue solo (${again.npcs} NPC, ${again.party} acompañantes)`);

ok(errors.length === 0, `sin errores en la consola${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} fallos` : '\nFase 5 correcta ✔');
process.exit(fails ? 1 : 0);

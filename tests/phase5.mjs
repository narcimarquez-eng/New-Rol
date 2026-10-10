// Prueba de la fase 5 sobre el juego real: el regreso desde el castillo, la
// despedida de los compañeros en la aldea, el sendero del volcán y el jefe.
// Uso: node tests/phase5.mjs   (SKIP_BUILD=1 para usar la última compilación;
// OUTDIR=carpeta para compilar y servir otra copia distinta de dist/)
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { STORY } from '../src/data/story.js';
const OUTDIR = process.env.OUTDIR || 'dist';
if (!process.env.SKIP_BUILD) execSync(`npx vite build --outDir ${OUTDIR} --emptyOutDir`, { stdio: 'ignore' });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUTDIR, '--port', '4178', '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('4178')) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4178/?fixeddt&low&toon');
await page.waitForFunction(() => window.__game && window.__game.firstFrameAt, null, { timeout: 60000 });
await page.click('#btn-new');
await page.waitForFunction(() => window.__game.mode === 'play', null, { timeout: 20000 });

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) fails++; };

// banderas de las fases 1-4 (las que marca la historia antes de la fase 5)
const earlier = [];
const collect = (cond) => { if (!cond) return; for (const k of ['flag', 'notFlag', 'has']) if (typeof cond[k] === 'string') earlier.push(cond[k]); for (const k of ['any', 'all']) (cond[k] || []).forEach(collect); };
for (const s of STORY) { if (s.until?.flag === 'phase5_start') break; collect(s.until); }

// 1) partida con el castillo ya vencido y los cuatro compañeros en el grupo
await page.evaluate((flags) => {
  const g = window.__game;
  for (const f of flags) g.progress.flags.add(f);
  for (const id of ['kael', 'aldric', 'cedric', 'borg']) g.progress.flags.add(`companion_${id}`);
  g.progress.flags.add('game_complete');
  g.loadZone('castle', 'fromDesert');
}, [...new Set(earlier.filter((f) => !f.startsWith('companion_')))]);
const portal = await page.evaluate(() => {
  const g = window.__game;
  const p = g.interactables.find((i) => i.data && i.data.to === 'village');
  if (p) g.player.place(p.x, p.z + 0.5, Math.PI);
  return { exists: !!p, companions: g.companions.length };
});
ok(portal.exists, 'el portal de regreso aparece en la sala del trono tras el final');
ok(portal.companions === 4, `los cuatro compañeros acompañan al héroe (${portal.companions})`);

// 2) cruzar el portal: vuelve a la aldea y los compañeros se despiden uno a uno
await page.waitForFunction(() => window.__game.zone.id === 'village' && window.__game.ui.dialog, null, { timeout: 30000 });
const farewellNames = [];
for (let n = 0; n < 200; n++) {
  const done = await page.evaluate(() => {
    const g = window.__game;
    if (!g.ui.dialog) return true;
    return false;
  });
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

// 3) el sendero del volcán está abierto y lleva al volcán
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

// 4) volver a la aldea desde el volcán: la despedida ya no se repite y los amigos siguen en la plaza
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

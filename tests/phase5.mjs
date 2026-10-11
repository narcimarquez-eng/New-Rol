// Prueba de la fase 5 sobre el juego real: el atajo «Ir al Volcán» del menú, el final del
// balcón y el portal de regreso (sin recargar la zona), la despedida de los compañeros en
// la aldea, el volcán (reja y braseros del puente, misiones de Nuria, Pipo, Hana y Ardea),
// el jefe, la elección del espíritu de Ardea y la vuelta a la aldea.
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
// habla con un NPC y elige la opción `pick` si el diálogo ofrece elegir (misiones, el espíritu de Ardea)
const talk = (id, pick = 0) => page.evaluate(([id, pick]) => {
  const g = window.__game;
  const npc = g.interactables.find((i) => i.id === id);
  if (!npc) return 'sin NPC';
  g.talkTo(npc);
  for (let n = 0; n < 500 && g.ui.dialog; n++) {
    const d = g.ui.dialog;
    if (d.opts.choices && d.full) { g.ui.choose(pick); break; }
    g.ui.advanceDialog();
  }
  return g.ui.dialog ? 'sigue abierto' : 'ok';
}, [id, pick]);
const quest = (id) => page.evaluate((id) => window.__game.progress.questState(id), id);

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

// 4) el sendero del volcán lleva a la cuenca; al entrar, el objetivo es hablar con Nuria
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
    gate: g.interactables.some((i) => i.data && i.data.id === 'v_bridge' && !i.open),
    door: g.interactables.some((i) => i.data && i.data.id === 'v_crater'),
    braziers: g.interactables.filter((i) => i.kind === 'brazier' && i.data.group === 'v_fire').length,
    objective: g.currentObjective(),
  };
});
ok(inVolcano.flag, 'entrar en el volcán registra la zona');
ok(inVolcano.boss, 'el jefe Ignar está en el cráter');
ok(inVolcano.gate, 'la reja del puente empieza cerrada');
ok(inVolcano.door, 'la Puerta del Cráter está en el mapa');
ok(inVolcano.braziers === 3, `los tres braseros del puente están en la orilla (${inVolcano.braziers})`);
ok(/Nuria/.test(inVolcano.objective), `el objetivo es hablar con Nuria (${inVolcano.objective})`);

// 5) el puente: la reja se levanta cuando los tres braseros arden a la vez
await page.evaluate(() => { window.__game.interactables.filter((i) => i.kind === 'brazier' && i.data.group === 'v_fire').forEach((b) => b.ignite()); });
await page.waitForFunction(() => window.__game.progress.flags.has('v_bridge_open'), null, { timeout: 15000 });
await page.evaluate(() => { const g = window.__game; const [x, z] = g.zone.tileToWorld(20, 29); g.player.place(x, z, Math.PI); });
await page.waitForFunction(() => window.__game.progress.flags.has('opened_v_bridge'), null, { timeout: 30000 });
ok(true, 'los tres braseros encendidos a la vez levantan la reja del puente');

// 6) misiones de la cuenca y el plateau: Nuria ofrece el frasco, Pipo el muñeco, Hana la forja
await talk('nuria', 0);
ok((await quest('q_flask')) === 'active' && (await page.evaluate(() => window.__game.progress.flags.has('spoke_nuria'))), 'Nuria ofrece el frasco de agua para Teo y queda hablada');
await talk('pipo', 0);
ok((await quest('q_toy')) === 'active', 'Pipo encarga el muñeco de trapo');
await page.evaluate(() => window.__game.progress.add('rag_doll', 1));
ok((await quest('q_toy')) === 'ready', 'al tener el muñeco, la misión de Pipo está lista para entregar');
await talk('pipo');
ok((await quest('q_toy')) === 'done', 'Pipo recibe su muñeco y la misión queda terminada');
await talk('hana', 0);
ok((await quest('q_ember')) === 'active' && (await page.evaluate(() => window.__game.progress.flags.has('spoke_hana'))), 'Hana ofrece la misión de las brasas');

// 7) Ardea: primero cuenta la historia de la forja; después encarga los fragmentos de sombra
await talk('ardea');
ok(await page.evaluate(() => window.__game.progress.flags.has('ardea_lore')), 'Ardea cuenta la historia de la forja y los sellos');
await talk('ardea', 0);
ok((await quest('q_sombras')) === 'active', 'Ardea encarga recoger tres fragmentos de sombra');
await page.evaluate(() => window.__game.progress.add('shadow_shard', 3));
ok((await quest('q_sombras')) === 'ready', 'con los tres fragmentos, la misión de Ardea está lista');
await talk('ardea');
ok((await quest('q_sombras')) === 'done', 'Ardea recibe los fragmentos y la misión queda terminada');

// 8) el cráter: al vencer a Ignar aparece el espíritu de Ardea, y su elección abre una salida
await page.evaluate(() => { window.__game.progress.flags.add('opened_v_crater'); window.__game.progress.flags.add('boss_volcano'); });
await page.waitForFunction(() => window.__game.interactables.some((i) => i.id === 'ardea_spirit'), null, { timeout: 20000 });
ok(true, 'tras el jefe aparece el espíritu de Ardea (sin recargar la zona)');
const exitsBefore = await page.evaluate(() => window.__game.interactables.filter((i) => i.data && i.data.to === 'credits').length);
ok(exitsBefore === 0, 'todavía no hay salidas: la decisión abre una');
// los seis cristales de hielo de la misión de Ardea (el dragón los necesita para congelarse)
await page.evaluate(() => window.__game.progress.add('frost_crystal', 6));
await talk('ardea_spirit', 0);
// tras la elección nace el dragón de brasa; la salida elegida espera a que caiga
await page.waitForFunction(() => window.__game.enemies.some((e) => e.kind === 'dragon'), null, { timeout: 20000 });
ok(true, 'tras la elección, el dragón de brasa nace del volcán (sin recargar la zona)');
const exitsAlive = await page.evaluate(() => window.__game.interactables.filter((i) => i.data && i.data.to === 'credits').length);
ok(exitsAlive === 0, 'mientras el dragón vive, la salida todavía no aparece');
// la espada no le hiere mientras no está congelado; un cristal de hielo lo congela
ok(await page.evaluate(() => { const g = window.__game; return g.enemies.find((e) => e.kind === 'dragon').hurt(3, g.player.x, g.player.z); }) === 'blocked',
  'la espada no hiere al dragón de brasa sin congelarlo');
await page.evaluate(() => window.__game.enemies.find((e) => e.kind === 'dragon').frost(1));
ok(await page.evaluate(() => window.__game.enemies.find((e) => e.kind === 'dragon').frozenT > 0), 'un cristal de hielo lo congela (y la espada le hace daño mientras dure)');
// derrota: se abre la salida que se eligió
await page.evaluate(() => window.__game.enemies.find((e) => e.kind === 'dragon').frost(999));
await page.waitForFunction(() => window.__game.interactables.some((i) => i.data && i.data.to === 'credits'), null, { timeout: 20000 });
const exits = await page.evaluate(() => window.__game.interactables.filter((i) => i.data && i.data.to === 'credits').map((i) => i.data.label));
ok(exits.join('|') === 'Cima del volcán', `vencido el dragón, se abre la Cima del volcán (${exits.join(', ')})`);
ok(await page.evaluate(() => /salida/i.test(window.__game.currentObjective())), 'el objetivo pide salir por la salida elegida');

// 9) volver a la aldea desde el volcán: la despedida ya no se repite y los amigos siguen en la plaza
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

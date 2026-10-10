// Validación estática de los datos de las zonas (sin navegador):
// filas del mapa coherentes, entidades sobre casillas transitables,
// misiones bien definidas y requisitos de diseño (3 misiones y 3 tipos de enemigo por zona).
import { ZONES } from '../src/data/zones/index.js';
import { QUESTS } from '../src/data/quests.js';
import { ITEMS } from '../src/data/items.js';
import { ENEMIES } from '../src/data/enemies.js';
import { TILES } from '../src/world/tiles.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) fails++; };

for (const z of Object.values(ZONES)) {
  const W = z.map[0].length;
  ok(z.map.every((r) => r.length === W), `${z.id}: todas las filas miden ${W}`);
  const unknown = new Set(z.map.join('').split('').filter((ch) => !TILES[ch]));
  ok(unknown.size === 0, `${z.id}: sin caracteres desconocidos ${[...unknown].join('')}`);
  const at = (c, r) => TILES[z.map[Math.floor(r)]?.[Math.floor(c)]] || { solid: 'box' };
  for (const e of z.entities) {
    if (!['npc', 'chest', 'enemy', 'pickup', 'spawn', 'dummy', 'sign', 'torch', 'brazier', 'mirror', 'beamsource', 'beamtarget', 'switch', 'barrier', 'rune', 'runetablet', 'stoneblock', 'plate', 'resetstone'].includes(e.type)) continue;
    const t = at(e.tile[0] + 0.5, e.tile[1] + 0.5);
    const walk = !t.solid || t.cuttable;
    ok(walk, `${z.id}: ${e.type} ${e.id || e.kind || ''} en casilla transitable [${e.tile}]`);
    if (e.item) ok(!!ITEMS[e.item], `${z.id}: objeto ${e.item} existe`);
    if (e.kind && e.type === 'enemy') ok(!!ENEMIES[e.kind], `${z.id}: enemigo ${e.kind} existe`);
  }
  // los santuarios son zonas pequeñas de acertijos: sin misiones propias
  const shrine = z.id.startsWith('shrine_');
  if (shrine) {
    ok(z.entities.some((e) => e.type === 'chest' && /^emblem_/.test(e.item)), `${z.id}: guarda un emblema`);
    continue;
  }
  const quests = Object.values(QUESTS).filter((q) => q.zone === z.id);
  ok(quests.length >= 3, `${z.id}: ${quests.length} misiones secundarias (>= 3)`);
  for (const q of quests) {
    const npcs = z.entities.filter((e) => e.type === 'npc').map((e) => e.id);
    ok(npcs.includes(q.giver), `${z.id}: ${q.name} tiene NPC que la da (${q.giver})`);
    if (q.target) ok(npcs.includes(q.target), `${z.id}: ${q.name} tiene NPC objetivo (${q.target})`);
  }
  const kinds = new Set(z.entities.filter((e) => e.type === 'enemy' && !ENEMIES[e.kind].boss).map((e) => e.kind));
  ok(kinds.size >= 3, `${z.id}: ${kinds.size} tipos de enemigo (>= 3)`);
  ok(z.entities.some((e) => e.type === 'chest' && e.secret), `${z.id}: tiene cofres secretos`);
}
// accesibilidad (fase 5): desde la aparición se llega a todo lo que hay que visitar.
// Puertas y muros falsos cuentan como paso (se abren o se atraviesan en la partida).
for (const id of ['volcano']) {
  const z = ZONES[id];
  const cell = (c, r) => TILES[z.map[r]?.[c]] || { solid: 'box' };
  const pass = (c, r) => { const t = cell(c, r); return !t.solid || !!t.cuttable; };
  const sp = z.entities.find((e) => e.type === 'spawn');
  const key = (c, r) => `${c},${r}`;
  const seen = new Set([key(Math.floor(sp.tile[0]), Math.floor(sp.tile[1]))]);
  const queue = [[Math.floor(sp.tile[0]), Math.floor(sp.tile[1])]];
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nr >= z.map.length || nc >= z.map[0].length || seen.has(key(nc, nr)) || !pass(nc, nr)) continue;
      seen.add(key(nc, nr)); queue.push([nc, nr]);
    }
  }
  for (const e of z.entities) {
    if (!['npc', 'chest', 'enemy', 'pickup', 'sign', 'portal', 'door'].includes(e.type)) continue;
    const cands = [[Math.floor(e.tile[0]), Math.floor(e.tile[1])], [Math.floor(e.tile[0] + 0.5), Math.floor(e.tile[1] + 0.5)]];
    ok(cands.some(([c, r]) => seen.has(key(c, r))), `${z.id}: ${e.type} ${e.id || e.kind || e.to || ''} alcanzable desde la aparición`);
  }
}
console.log(fails ? `\n${fails} fallos` : '\nDatos correctos ✔');
process.exit(fails ? 1 : 0);

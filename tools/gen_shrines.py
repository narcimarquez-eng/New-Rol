"""Santuarios de los acertijos mágicos (Fase 4: el juego más largo).

Cada santuario es una zona pequeña con dos pruebas mágicas y un emblema al final,
necesario para avanzar en la zona de la que sale:
  - shrine_forest  Santuario de las Luciérnagas: braseros con tiempo + runas.
  - shrine_ice     Santuario de Cristal: barreras rojas/azules + bloques de piedra.
  - shrine_sun     Santuario del Sol: cadena de braseros + espejos y rayo de sol.

El script dibuja los mapas, comprueba con solucionadores que cada prueba tiene
solución (y que no viene resuelta), que todo es alcanzable, y escribe
src/data/zones/shrine_*.js.
Uso: python3 tools/gen_shrines.py
"""
import json
from collections import deque

SOLID = set('M^#WOUCpTPRbF~Ic')   # casillas que bloquean el paso
TILE = 4
WALK = 7 / TILE                    # casillas por segundo andando
CARRY = 12                         # segundos de fuego en la espada


class Grid:
    def __init__(self, w, h, fill='M'):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def set(self, c, r, ch):
        if 0 <= c < self.w and 0 <= r < self.h:
            self.g[r][c] = ch

    def get(self, c, r):
        return self.g[r][c] if 0 <= c < self.w and 0 <= r < self.h else 'M'

    def rect(self, c0, r0, c1, r1, ch):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                self.set(c, r, ch)

    def rows(self):
        return [''.join(r) for r in self.g]


def free(grid, c, r, blocked=()):
    return grid.get(c, r) not in SOLID and (c, r) not in blocked


def bfs(grid, start, blocked=(), extra_free=()):
    dist = {start: 0}
    q = deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n in dist:
                continue
            if not (free(grid, *n, blocked) or n in extra_free):
                continue
            dist[n] = dist[(c, r)] + 1
            q.append(n)
    return dist


def adj_dist(dist, tile):
    """Distancia a una casilla bloqueada (p. ej. un brasero): la de su vecina más cercana."""
    c, r = tile
    ds = [dist[n] for n in ((c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1)) if n in dist]
    return min(ds) if ds else None


def need(cond, msg):
    if not cond:
        raise SystemExit('ERROR: ' + msg)
    print('  ok:', msg)


# ------------------------------------------------------------------ solucionadores
def beam_path(grid, src, d, mirrors, target, blockers=()):
    """Traza el rayo. mirrors: {(c,r): '/'|'\\'}. Devuelve (llega, casillas recorridas)."""
    c, r = src
    dc, dr = d
    path = []
    for _ in range(400):
        c += dc; r += dr
        path.append((c, r))
        if (c, r) == target:
            return True, path
        if (c, r) in mirrors:
            dc, dr = (-dr, -dc) if mirrors[(c, r)] == '/' else (dr, dc)
            continue
        if (c, r) in blockers or grid.get(c, r) in SOLID:
            return False, path
    return False, path


def solve_mirrors(grid, src, d, mirrors, fixed, target, blockers=()):
    """Busca combinaciones de orientaciones (los fijos no cambian). Devuelve la de menos giros."""
    keys = [k for k in mirrors if k not in fixed]
    best = None
    for mask in range(1 << len(keys)):
        m = dict(mirrors)
        flips = 0
        for i, k in enumerate(keys):
            if mask >> i & 1:
                m[k] = '\\' if m[k] == '/' else '/'
                flips += 1
        ok, _ = beam_path(grid, src, d, m, target, blockers)
        if ok and (best is None or flips < best[0]):
            best = (flips, m)
    return best


def solve_switches(grid, start, goal, barriers, switches):
    """BFS sobre (casilla, estado). barriers: {(c,r): 'red'|'blue'}; golpear un cristal
    adyacente ('H') alterna el estado (0: rojas levantadas). Devuelve (nº de cambios, movimientos)."""
    D = {(0, -1): 'N', (0, 1): 'S', (1, 0): 'E', (-1, 0): 'W'}

    def passable(t, s):
        if t in barriers:
            return (barriers[t] == 'red') != (s == 0)
        return free(grid, *t, set(switches))

    def raised_at(t, s):
        return t in barriers and (barriers[t] == 'red') == (s == 0)

    start_s = (start, 0)
    prev = {start_s: None}
    q = deque([start_s])
    while q:
        cur = q.popleft()
        (c, r), s = cur
        if (c, r) == goal:
            moves, toggles = [], 0
            while prev[cur]:
                pcur, m = prev[cur]
                moves.append(m)
                toggles += m == 'H'
                cur = pcur
            return toggles, moves[::-1]
        nxt = []
        for d, m in D.items():
            t = (c + d[0], r + d[1])
            if passable(t, s):
                nxt.append(((t, s), m))
        if any(abs(c - sc) <= 1 and abs(r - sr) <= 1 for sc, sr in switches) and not raised_at((c, r), 1 - s):
            nxt.append((((c, r), 1 - s), 'H'))
        for n, m in nxt:
            if n not in prev:
                prev[n] = (cur, m)
                q.append(n)
    return None


def walk_path(grid, a, b, blocked):
    """Camino más corto (lista de 'N','S','E','W') entre dos casillas evitando `blocked`."""
    if a == b:
        return []
    prev = {a: None}
    q = deque([a])
    D = {(0, -1): 'N', (0, 1): 'S', (1, 0): 'E', (-1, 0): 'W'}
    while q:
        cur = q.popleft()
        if cur == b:
            break
        for d in D:
            n = (cur[0] + d[0], cur[1] + d[1])
            if n not in prev and free(grid, *n, blocked):
                prev[n] = (cur, D[d])
                q.append(n)
    if b not in prev:
        return None
    out = []
    cur = b
    while prev[cur]:
        cur, m = prev[cur]
        out.append(m)
    return out[::-1]


def solve_sokoban(grid, start, blocks, plates, max_states=300000):
    """Empujes de bloques sobre suelo normal. Devuelve (nº de empujes, movimientos del héroe)."""
    plates = set(plates)
    D = {(0, -1): 'N', (0, 1): 'S', (1, 0): 'E', (-1, 0): 'W'}

    def key(p, bl):
        return (min(bfs(grid, p, blocked=set(bl))), bl)

    b0 = tuple(sorted(blocks))
    k0 = key(start, b0)
    parent = {k0: None}
    q = deque([(start, b0, k0)])
    while q and len(parent) < max_states:
        p, bl, k = q.popleft()
        bset = set(bl)
        if plates <= bset:
            # reconstrucción: lista de (pos. antes, casilla donde ponerse, dirección)
            steps = []
            while parent[k]:
                pk, stand, d, pp = parent[k]
                steps.append((pp, stand, d))
                k = pk
            steps.reverse()
            moves = []
            cur = start
            bl_now = set(blocks)
            for pp, stand, d in steps:
                moves += walk_path(grid, cur, stand, bl_now)
                moves.append(D[d])
                blk = (stand[0] + d[0], stand[1] + d[1])
                bl_now.discard(blk)
                bl_now.add((blk[0] + d[0], blk[1] + d[1]))
                cur = blk
            return len(steps), moves
        reach = bfs(grid, p, blocked=bset)
        for b in bl:
            if b in plates:
                continue  # en el juego, un bloque que se para sobre una placa queda fijo
            for d in D:
                stand = (b[0] - d[0], b[1] - d[1])
                if stand not in reach:
                    continue
                nb = (b[0] + d[0], b[1] + d[1])
                if not free(grid, *nb, bset - {b}) or nb in bset:
                    continue
                nbl = tuple(sorted((bset - {b}) | {nb}))
                nk = key(b, nbl)
                if nk in parent:
                    continue
                parent[nk] = (k, stand, d, p)
                q.append((b, nbl, nk))
    return None


# ------------------------------------------------------------------ utilidades de salida
def js(v):
    return json.dumps(v, ensure_ascii=False)


def write_zone(path, header, base_import, fields, rows, entities):
    ents = ',\n'.join('    ' + js(e) for e in entities)
    rows_js = ',\n'.join("    '" + r + "'" for r in rows)
    out = f"""{header}
// Generado por tools/gen_shrines.py (que comprueba que los acertijos tienen solución).
{base_import}

export default {{
{fields}
  map: [
{rows_js},
  ],
  entities: [
{ents},
  ],
}};
"""
    open(path, 'w').write(out)
    print('  escrito', path)


# =================================================================== santuario del bosque
def shrine_forest():
    print('Santuario de las Luciérnagas')
    W, H = 30, 32
    g = Grid(W, H)
    g.rect(10, 1, 19, 5, 'k')                 # santuario del emblema
    g.rect(14, 6, 15, 6, 'k')                 # puerta B
    g.rect(5, 7, 24, 15, 'k')                 # sala de las runas
    g.rect(1, 9, 3, 13, 'k'); g.set(4, 11, 'm')  # sala secreta
    g.rect(14, 16, 15, 16, 'k')               # puerta A
    g.rect(1, 17, 28, 26, 'k')                # sala del fuego
    g.rect(8, 17, 8, 21, 'M'); g.rect(22, 17, 22, 21, 'M')
    g.rect(1, 22, 3, 22, 'M'); g.rect(6, 22, 8, 22, 'M')
    g.rect(22, 22, 24, 22, 'M'); g.rect(27, 22, 28, 22, 'M')
    g.rect(11, 27, 18, 29, 'k'); g.rect(13, 30, 16, 30, 'k'); g.rect(14, 31, 15, 31, 'k')
    for c, r in ((11, 2), (18, 2), (11, 5), (18, 5), (5, 8), (24, 8), (5, 15), (24, 15), (12, 24), (17, 24), (12, 20), (17, 20)):
        g.set(c, r, 'O')
    # musgo en las salas
    for c, r in ((2, 18), (3, 19), (26, 25), (25, 26), (9, 26), (20, 18), (6, 10), (23, 13)):
        g.set(c, r, 'g')
    rows = g.rows()

    spawn = (14.5, 28.5)
    eternal = (14.5, 23)
    braziers = [(2, 18), (27, 18), (14.5, 18)]
    runes = {(9, 9): 0, (14, 9): 3, (19, 9): 1, (9, 12): 4, (14, 12): 5, (19, 12): 2}
    seq = [2, 0, 4, 1, 5]

    blocked = {(int(b[0]), b[1]) for b in braziers} | {(14, 23), (15, 23)} | {(14, 14), (15, 14)}
    doors = {(14, 16), (15, 16), (14, 6), (15, 6)}
    d0 = bfs(g, (14, 28), blocked | doors)
    need((14, 1) not in d0, 'el santuario está cerrado hasta resolver las pruebas (las puertas bloquean)')
    # distancias entre llamas (casillas) para el tiempo del grupo
    pts = {'eterna': (14, 23), 'oeste': (2, 18), 'este': (27, 18), 'norte': (14, 18)}
    def dist(a, b):
        return adj_dist(bfs(g, pts[a], blocked - {pts[a]}), pts[b])
    legs = {k: dist(*k.split('-')) for k in ('eterna-oeste', 'eterna-este', 'eterna-norte', 'oeste-este', 'norte-este', 'oeste-norte')}
    print('   distancias:', legs)
    for k, v in legs.items():
        if 'eterna' in k:
            need(v / WALK < CARRY, f'el fuego de la espada llega andando de {k} ({v / WALK:.1f} s)')
    # buen orden: oeste -> (eterna) -> norte -> (eterna) -> este, todo dentro del tiempo del grupo
    route = legs['eterna-oeste'] + 2 * legs['eterna-norte'] + legs['eterna-este']
    duration = 32
    need(route / WALK < duration * 0.85, f'el orden oeste→norte→este cabe en {duration} s andando ({route / WALK:.1f} s)')
    need(legs['oeste-este'] / WALK > CARRY, 'el fuego no basta para ir de un extremo al otro sin pasar por otra llama')
    # runas alcanzables con la puerta A abierta
    d1 = bfs(g, (14, 28), {(int(b[0]), b[1]) for b in braziers} | {(14, 23), (15, 23), (14, 14), (15, 14), (14, 6), (15, 6)})
    for t in runes:
        need(t in d1, f'runa {t} alcanzable')
    need((2, 11) in d1, 'sala secreta alcanzable por el muro falso')

    ents = [
        {'type': 'spawn', 'id': 'fromForest', 'tile': [14.5, 29.5], 'facing': 3.14159},
        {'type': 'portal', 'tile': [14, 31], 'span': 2, 'to': 'forest', 'spawn': 'fromShrine', 'label': 'Bosque Encantado'},
        {'type': 'sign', 'tile': [12, 28], 'text': 'Santuario de las Luciérnagas.\nLa llama eterna nunca se apaga: acerca la espada y lleva su fuego.\nLos braseros solo arden un tiempo... enciéndelos todos a la vez.'},
        {'type': 'brazier', 'id': 'sf_eternal', 'tile': list(eternal), 'eternal': True},
    ]
    for i, b in enumerate(braziers):
        ents.append({'type': 'brazier', 'id': f'sf_b{i}', 'tile': list(b), 'group': 'sf_fire', 'duration': duration,
                     'flag': 'sf_fire_done', 'text': '¡Los tres braseros arden a la vez! La puerta de las runas se abre.'})
    ents += [
        {'type': 'door', 'id': 'sf_doorA', 'tile': [14, 16], 'span': 2, 'requires': {'flag': 'sf_fire_done'}, 'auto': True, 'style': 'stone',
         'lockedText': 'Una puerta de piedra. Sobre ella hay tres cuencos de fuego grabados.'},
        {'type': 'runetablet', 'tile': [14.5, 14], 'group': 'sf_runes', 'sequence': seq, 'flag': 'sf_runes_done', 'facing': 0,
         'text': '¡Las runas responden y la puerta del emblema se abre!',
         'lines': ['Cinco runas brillan en la piedra: el árbol, el sol, el ojo, la luna y la estrella.', 'Pisa las losas del suelo en ese orden. Si te equivocas, se apagarán.']},
    ]
    for (c, r), s in runes.items():
        ents.append({'type': 'rune', 'tile': [c, r], 'group': 'sf_runes', 'symbol': s})
    ents += [
        {'type': 'door', 'id': 'sf_doorB', 'tile': [14, 6], 'span': 2, 'requires': {'flag': 'sf_runes_done'}, 'auto': True, 'style': 'stone',
         'lockedText': 'Las runas del suelo deben despertar antes.'},
        {'type': 'chest', 'id': 'sf_emblem', 'tile': [14.5, 2.5], 'item': 'emblem_forest', 'big': True, 'facing': 0, 'flag': 'got_emblem_forest'},
        {'type': 'chest', 'id': 'sf_secret', 'tile': [2, 10], 'item': 'heart_container', 'facing': 1.5708, 'secret': True},
        {'type': 'torch', 'tile': [11, 28]}, {'type': 'torch', 'tile': [18, 28]},
        {'type': 'torch', 'tile': [10, 1]}, {'type': 'torch', 'tile': [19, 1]},
        {'type': 'enemy', 'kind': 'slime', 'tile': [4, 25]}, {'type': 'enemy', 'kind': 'slime', 'tile': [25, 24]},
        {'type': 'enemy', 'kind': 'goblin', 'tile': [20, 10]}, {'type': 'enemy', 'kind': 'bat', 'tile': [8, 13]},
    ]
    fields = """  id: 'shrine_forest',
  name: 'Santuario de las Luciérnagas',
  subtitle: 'Donde el fuego aprende a esperar',
  difficulty: 1.3,
  enterFlag: 'entered_shrine_forest',
  terrain: { amplitude: 0.08, seed: 41, variant: 'castle' },
  wallStyle: 'castle',
  stoneTint: 0xc4d0b4,
  palette: { ...forest.palette, grassDensity: 0, ground: { ...forest.palette.ground, flagstone: 0x9a9a8a, cobble: 0x8a8a7a }, groundReal: { ...forest.palette.groundReal, flagstone: 0xa8a898, cobble: 0x989888, forest: 0x6a7a4a } },
  grade: forest.grade,
  gradeReal: forest.gradeReal,
  fog: forest.fog,
  atmosphere: { ...forest.atmosphere, fogDensity: 0.006 },
  torchIntensity: 7,
  music: { root: 57, scale: [0, 2, 3, 5, 7, 9, 10], tempo: 66, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'sine', pad: 'triangle' },"""
    write_zone('src/data/zones/shrine_forest.js', '// SANTUARIO de las Luciérnagas (bosque): braseros con tiempo y runas en orden.',
               "import forest from './forest.js';", fields, rows, ents)


# =================================================================== santuario de cristal
def shrine_ice():
    print('Santuario de Cristal')
    W, H = 30, 34
    g = Grid(W, H)
    # sala del emblema
    g.rect(11, 1, 18, 4, 'n'); g.rect(14, 5, 15, 5, 'n')
    # sala de los bloques (filas 6-14)
    g.rect(5, 6, 24, 14, 'n')
    g.set(12, 10, 'I'); g.set(17, 10, 'I')          # pilares de hielo
    g.rect(14, 15, 15, 15, 'n')                     # puerta de los bloques
    # sala de las barreras (filas 16-30)
    g.rect(2, 16, 27, 30, 'n')
    g.rect(2, 19, 27, 19, 'M'); g.rect(2, 24, 27, 24, 'M'); g.rect(14, 20, 14, 23, 'M')
    barriers = {}
    for c in (6, 7):
        barriers[(c, 24)] = 'red'
    for c in (21, 22):
        barriers[(c, 24)] = 'blue'
    barriers[(14, 22)] = 'red'
    for c in (9, 10):
        barriers[(c, 19)] = 'blue'
    for (c, r) in barriers:
        g.set(c, r, 'n')
    g.rect(14, 16, 15, 18, 'n')
    g.rect(11, 31, 18, 31, 'n'); g.rect(14, 32, 15, 33, 'n')
    rows = g.rows()

    switches = [(4, 27), (25, 21), (3, 21)]
    start = (14, 30)
    goal = (9, 17)
    swsol = solve_switches(g, start, goal, barriers, switches)
    need(swsol is not None and swsol[0] >= 2, f'el laberinto de barreras se resuelve con {swsol[0] if swsol else None} cambios de color')
    print('   movimientos barreras (para e2e):', json.dumps(swsol[1]))
    d0 = bfs(g, start, set(barriers) | set(switches))
    need(goal not in d0, 'sin cambiar de color no se pasa')

    # bloques de piedra -> placas
    blocks = [(7, 9), (22, 11)]
    plates = [(14, 7), (15, 13)]
    sol = solve_sokoban(g, (14, 14), blocks, plates)
    need(sol is not None and sol[0] >= 6, f'los bloques llegan a las placas ({sol[0] if sol else None} empujes como mínimo)')
    print('   movimientos (para e2e):', json.dumps(sol[1]))

    ents = [
        {'type': 'spawn', 'id': 'fromCaves', 'tile': [14.5, 31], 'facing': 3.14159},
        {'type': 'portal', 'tile': [14, 33], 'span': 2, 'to': 'caves', 'spawn': 'fromShrine', 'label': 'Cuevas Heladas'},
        {'type': 'sign', 'tile': [12, 30], 'text': 'Santuario de Cristal.\nGolpea los cristales con la espada: las barreras rojas y azules se alternan.'},
    ]
    for (c, r), col in barriers.items():
        ents.append({'type': 'barrier', 'tile': [c, r], 'color': col})
    for c, r in switches:
        ents.append({'type': 'switch', 'tile': [c, r]})
    ents += [
        {'type': 'sign', 'tile': [12, 16], 'text': 'Dos bloques de piedra, dos placas.\nSi un bloque se atasca contra la pared, toca la piedra rúnica.'},
        {'type': 'stoneblock', 'id': 'si_b1', 'group': 'si_g', 'tile': list(blocks[0])},
        {'type': 'stoneblock', 'id': 'si_b2', 'group': 'si_g', 'tile': list(blocks[1])},
        {'type': 'plate', 'id': 'si_p1', 'tile': list(plates[0]), 'flag': 'si_plate1', 'block': 'si_b1', 'text': '¡Una placa se hunde! Falta la otra.'},
        {'type': 'plate', 'id': 'si_p2', 'tile': list(plates[1]), 'flag': 'si_plate2', 'block': 'si_b2', 'text': '¡Una placa se hunde! Falta la otra.'},
        {'type': 'resetstone', 'tile': [17, 16], 'group': 'si_g', 'facing': 3.14159},
        {'type': 'door', 'id': 'si_door', 'tile': [14, 5], 'span': 2, 'requires': {'all': [{'flag': 'si_plate1'}, {'flag': 'si_plate2'}]}, 'auto': True, 'style': 'ice',
         'lockedText': 'Una reja de hielo. Hay dos placas grabadas en el suelo de la sala.'},
        {'type': 'chest', 'id': 'si_emblem', 'tile': [14.5, 2], 'item': 'emblem_ice', 'big': True, 'facing': 0, 'flag': 'got_emblem_ice'},
        {'type': 'chest', 'id': 'si_potion', 'tile': [26, 17], 'item': 'potion', 'facing': -1.5708},
        {'type': 'torch', 'tile': [11, 31]}, {'type': 'torch', 'tile': [18, 31]}, {'type': 'torch', 'tile': [11, 1]}, {'type': 'torch', 'tile': [18, 1]},
        {'type': 'enemy', 'kind': 'frostBat', 'tile': [20, 27]}, {'type': 'enemy', 'kind': 'frostBat', 'tile': [6, 21]},
        {'type': 'enemy', 'kind': 'wolf', 'tile': [22, 17]},
    ]
    fields = """  id: 'shrine_ice',
  name: 'Santuario de Cristal',
  subtitle: 'Rojo y azul, nunca a la vez',
  difficulty: 1.9,
  enterFlag: 'entered_shrine_ice',
  terrain: { amplitude: 0.08, seed: 43, variant: 'castle' },
  wallStyle: 'castle',
  stoneTint: 0xc8d8ec,
  ambient: 'snow',
  palette: { ...caves.palette, ground: { ...caves.palette.ground, flagstone: 0xa0b0c4, cobble: 0x9aaabe }, groundReal: { ...caves.palette.groundReal, flagstone: 0xaab4c0, cobble: 0x9aa4b0 } },
  grade: caves.grade,
  bloom: caves.bloom,
  fog: caves.fog,
  atmosphere: { ...caves.atmosphere, fogDensity: 0.0065 },
  pineKind: caves.pineKind,
  rockReal: caves.rockReal,
  torchIntensity: 5,
  music: { root: 64, scale: [0, 2, 3, 5, 7, 8, 11], tempo: 62, prog: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'sine', pad: 'triangle' },"""
    write_zone('src/data/zones/shrine_ice.js', '// SANTUARIO de Cristal (cuevas): cristales que alternan barreras y bloques de piedra sobre hielo.',
               "import caves from './caves.js';", fields, rows, ents)


# =================================================================== santuario del sol
def shrine_sun():
    print('Santuario del Sol')
    W, H = 32, 36
    g = Grid(W, H)
    g.rect(12, 1, 19, 4, 'k'); g.rect(15, 5, 16, 5, 'k')          # sala del emblema
    # sala de los espejos (filas 6-17)
    g.rect(3, 6, 28, 17, 'k')
    for c, r in ((8, 9), (8, 14), (23, 9), (23, 14), (15, 11), (16, 11)):
        g.set(c, r, 'O')
    g.rect(11, 13, 13, 13, 'M'); g.rect(19, 8, 20, 8, 'M')
    g.rect(15, 18, 16, 18, 'k')                                     # puerta del rayo
    # sala de los braseros (filas 19-32)
    g.rect(2, 19, 29, 31, 'k')
    g.rect(2, 25, 11, 25, 'M'); g.rect(20, 25, 29, 25, 'M')
    g.rect(11, 19, 11, 24, 'M'); g.rect(20, 19, 20, 24, 'M')
    g.rect(6, 25, 7, 25, 'k'); g.rect(24, 25, 25, 25, 'k')
    for c, r in ((14, 22), (17, 22), (14, 28), (17, 28)):
        g.set(c, r, 'O')
    g.rect(13, 32, 18, 33, 'k'); g.rect(15, 34, 16, 35, 'k')
    rows = g.rows()

    # --- braseros en cadena: la llama eterna está en la entrada; cada brasero encendido sirve de relevo
    eternal = (15, 32)
    braziers = [(3, 20), (28, 20), (8, 30), (23, 30)]
    blocked = set(braziers) | {eternal}
    pts = {'e': eternal, 'b0': braziers[0], 'b1': braziers[1], 'b2': braziers[2], 'b3': braziers[3]}
    def dist(a, b):
        return adj_dist(bfs(g, pts[a], blocked - {pts[a]}), pts[b])
    print('   distancias:', {k: dist(*k.split('-')) for k in ('e-b2', 'e-b3', 'b2-b0', 'b3-b1', 'e-b0', 'e-b1')})
    need(dist('e', 'b0') / WALK > CARRY, 'el brasero del noroeste no se alcanza directamente desde la llama eterna')
    need(dist('e', 'b2') / WALK < CARRY and dist('b2', 'b0') / WALK < CARRY, 'pero sí haciendo relevo en el brasero del suroeste')
    need(dist('e', 'b3') / WALK < CARRY and dist('b3', 'b1') / WALK < CARRY, 'y lo mismo por el este')

    # --- espejos: el ídolo (activado por los braseros) dispara hacia el norte
    src, d = (15, 17), (0, -1)
    target = (26, 7)
    mirrors = {(15, 15): '\\', (5, 15): '/', (5, 7): '\\', (12, 7): '\\', (12, 10): '/', (21, 10): '\\', (21, 7): '/'}
    fixed = {(12, 7)}
    ok0, _ = beam_path(g, src, d, mirrors, target)
    need(not ok0, 'el rayo no llega al cristal con los espejos como empiezan')
    best = solve_mirrors(g, src, d, mirrors, fixed, target)
    need(best is not None and best[0] >= 3, f'girando espejos el rayo llega al cristal ({best[0] if best else None} giros como mínimo)')
    sol = best[1]
    _, path = beam_path(g, src, d, sol, target)
    print('   solución:', {k: v for k, v in sol.items() if v != mirrors[k]})
    print('   recorrido:', path)
    dm = bfs(g, (15, 18), set(mirrors) | {src, target})
    for m in mirrors:
        need(adj_dist(dm, m) is not None, f'espejo {m} alcanzable')

    ents = [
        {'type': 'spawn', 'id': 'fromDesert', 'tile': [15.5, 33], 'facing': 3.14159},
        {'type': 'portal', 'tile': [15, 35], 'span': 2, 'to': 'desert', 'spawn': 'fromShrine', 'label': 'Desierto Perdido'},
        {'type': 'sign', 'tile': [13, 32], 'text': 'Santuario del Sol.\nEl fuego de la espada dura poco: los braseros encendidos también dan fuego.\nCuando ardan los cuatro, el ídolo del sol despertará.'},
        {'type': 'brazier', 'id': 'ss_eternal', 'tile': list(eternal), 'eternal': True},
    ]
    for i, b in enumerate(braziers):
        ents.append({'type': 'brazier', 'id': f'ss_b{i}', 'tile': list(b), 'group': 'ss_fire', 'flag': 'ss_fire_done',
                     'text': '¡Los cuatro braseros arden! El ídolo del sol despierta.'})
    ents += [
        {'type': 'door', 'id': 'ss_doorA', 'tile': [15, 18], 'span': 2, 'requires': {'flag': 'ss_fire_done'}, 'auto': True, 'style': 'stone',
         'lockedText': 'Cuatro soles apagados están grabados en la puerta.'},
        {'type': 'beamsource', 'id': 'ss_idol', 'tile': list(src), 'dir': 'N', 'requires': {'flag': 'ss_fire_done'}},
        {'type': 'beamtarget', 'id': 'ss_crystal', 'tile': list(target), 'flag': 'ss_beam_done', 'text': '¡El rayo de sol alcanza el cristal! La puerta del emblema se abre.'},
        {'type': 'sign', 'tile': [13, 17], 'text': 'Gira los espejos (E) para llevar la luz del ídolo hasta el cristal solar.\nEl espejo de bronce oscuro no se mueve.'},
    ]
    for (c, r), o in mirrors.items():
        e = {'type': 'mirror', 'tile': [c, r], 'orient': o}
        if (c, r) in fixed:
            e['fixed'] = True
        ents.append(e)
    ents += [
        {'type': 'door', 'id': 'ss_doorB', 'tile': [15, 5], 'span': 2, 'requires': {'flag': 'ss_beam_done'}, 'auto': True, 'style': 'stone',
         'lockedText': 'Un sol dorado en relieve. Parece esperar la luz.'},
        {'type': 'chest', 'id': 'ss_emblem', 'tile': [15.5, 2], 'item': 'emblem_sun', 'big': True, 'facing': 0, 'flag': 'got_emblem_sun'},
        {'type': 'chest', 'id': 'ss_bag', 'tile': [27, 16], 'item': 'bag', 'facing': -1.5708},
        {'type': 'torch', 'tile': [13, 33]}, {'type': 'torch', 'tile': [18, 33]}, {'type': 'torch', 'tile': [12, 1]}, {'type': 'torch', 'tile': [19, 1]},
        {'type': 'enemy', 'kind': 'scorpion', 'tile': [5, 22]}, {'type': 'enemy', 'kind': 'scorpion', 'tile': [26, 22]},
        {'type': 'enemy', 'kind': 'skeletonWarrior', 'tile': [10, 16]}, {'type': 'enemy', 'kind': 'skeletonMinion', 'tile': [20, 15]},
    ]
    fields = """  id: 'shrine_sun',
  name: 'Santuario del Sol',
  subtitle: 'La luz siempre encuentra el camino',
  difficulty: 2.4,
  enterFlag: 'entered_shrine_sun',
  terrain: { amplitude: 0.08, seed: 47, variant: 'castle' },
  wallStyle: 'castle',
  stoneTint: 0xf0dcb8,
  palette: { ...desert.palette, ground: { ...desert.palette.ground, cobble: 0xc8a878 }, groundReal: { ...desert.palette.groundReal, flagstone: 0xd8c4a0, cobble: 0xc8b090 } },
  grade: desert.grade,
  gradeReal: desert.gradeReal,
  fog: desert.fog,
  atmosphere: { ...desert.atmosphere, fogDensity: 0.004 },
  rockReal: desert.rockReal,
  torchIntensity: 6,
  music: { root: 62, scale: [0, 1, 4, 5, 7, 8, 10], tempo: 72, prog: [0, 1, 0, 6, 0, 1, 5, 4], lead: 'triangle', pad: 'sine' },"""
    write_zone('src/data/zones/shrine_sun.js', '// SANTUARIO del Sol (desierto): cadena de braseros y espejos que guían un rayo de sol.',
               "import desert from './desert.js';", fields, rows, ents)


if __name__ == '__main__':
    shrine_forest()
    shrine_ice()
    shrine_sun()

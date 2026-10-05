"""Generador auxiliar de mapas ASCII para las zonas de New Rol.

Dibuja cada zona con primitivas (rectángulos, caminos, laberintos) y vuelca
el mapa resultante como array de strings listo para pegar en src/data/zones/*.js.
Uso: python3 tools/genmaps.py village|forest
"""
import random
import sys


class Grid:
    def __init__(self, w, h, fill='.'):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def set(self, c, r, ch):
        if 0 <= c < self.w and 0 <= r < self.h:
            self.g[r][c] = ch

    def get(self, c, r):
        return self.g[r][c] if 0 <= c < self.w and 0 <= r < self.h else None

    def rect(self, c0, r0, c1, r1, ch):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                self.set(c, r, ch)

    def frame(self, c0, r0, c1, r1, ch):
        for c in range(c0, c1 + 1):
            self.set(c, r0, ch); self.set(c, r1, ch)
        for r in range(r0, r1 + 1):
            self.set(c0, r, ch); self.set(c1, r, ch)

    def scatter(self, c0, r0, c1, r1, ch, n, rnd, only='.'):
        k = 0
        tries = 0
        while k < n and tries < n * 50:
            tries += 1
            c, r = rnd.randint(c0, c1), rnd.randint(r0, r1)
            if self.get(c, r) in only:
                self.set(c, r, ch); k += 1

    def dump(self):
        return '\n'.join("    '" + ''.join(row) + "'," for row in self.g)


def village():
    rnd = random.Random(7)
    g = Grid(36, 34)
    g.frame(0, 0, 35, 33, '^')
    # salida norte con setos
    g.rect(11, 1, 16, 2, '#'); g.rect(19, 1, 24, 2, '#')
    g.rect(17, 0, 18, 27, '=')
    # jardín cerrado (requiere llave pequeña)
    g.rect(28, 1, 34, 3, ','); g.rect(27, 1, 27, 4, 'F'); g.rect(27, 4, 34, 4, 'F'); g.set(31, 4, '.')
    # camino este-oeste
    g.rect(3, 9, 33, 9, '=')
    g.rect(6, 7, 6, 8, '=')            # puerta del anciano
    g.rect(23, 8, 23, 8, '=')          # puerta de Lucía
    g.rect(30, 8, 30, 8, '=')          # granjero
    # plaza
    g.rect(13, 12, 22, 18, 'o'); g.rect(17, 10, 18, 11, '=')
    # zona de entrenamiento
    g.rect(2, 13, 6, 19, '='); g.rect(7, 16, 12, 16, '=')
    g.rect(4, 10, 4, 12, '=')
    # granja vallada
    g.frame(26, 11, 33, 15, 'F'); g.rect(27, 12, 32, 14, '"'); g.set(26, 13, '.')
    g.rect(23, 13, 25, 13, '='); g.rect(23, 10, 23, 12, '=')
    # estanque con puente
    g.rect(24, 20, 32, 25, '~'); g.rect(24, 20, 24, 20, '.'); g.rect(32, 25, 32, 25, '.')
    g.rect(28, 20, 28, 25, 'B'); g.rect(23, 19, 28, 19, '=')
    # valla sur que separa el prado
    g.rect(1, 27, 34, 27, 'F'); g.set(17, 27, '='); g.set(18, 27, '=')
    # prado sur
    g.rect(17, 28, 18, 29, '=')
    # bolsillo secreto en el seto (suroeste)
    g.rect(1, 28, 6, 32, '#'); g.rect(2, 30, 4, 31, 'g'); g.set(5, 30, '%'); g.set(6, 30, '%')
    # decoración
    g.scatter(1, 3, 34, 26, ',', 40, rnd)
    g.scatter(1, 3, 34, 26, 'T', 22, rnd)
    g.scatter(8, 28, 34, 32, 'b', 12, rnd)
    g.scatter(8, 28, 34, 32, 'R', 5, rnd)
    g.scatter(8, 28, 34, 32, 'T', 6, rnd)
    g.scatter(8, 28, 34, 32, '"', 14, rnd)
    # mantener libres huecos de casas/objetos (se limpian a mano tras ver el mapa)
    for (c0, r0, c1, r1) in [(4, 4, 8, 8), (21, 5, 24, 8), (28, 5, 31, 8), (7, 11, 11, 15), (13, 11, 22, 19), (2, 13, 6, 19),
                             (29, 1, 33, 3), (32, 30, 33, 31), (16, 28, 19, 32), (20, 16, 23, 19), (33, 22, 34, 24)]:
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                if g.get(c, r) in ('T', 'b', 'R'):
                    g.set(c, r, '.')
    check(g, (17, 26), [(17, 1), (30, 2), (3, 30), (32, 31), (33, 23), (5, 8), (28, 13)])
    print(g.dump())


def maze(g, c0, r0, nx, ny, rnd, wall='#', floor='g', pitch=3):
    """Laberinto de pasillos de (pitch-1) casillas. Devuelve función celda->tile."""
    g.rect(c0, r0, c0 + nx * pitch, r0 + ny * pitch, wall)
    seen = set()
    stack = [(0, 0)]
    seen.add((0, 0))

    def carve_cell(x, y):
        g.rect(c0 + x * pitch + 1, r0 + y * pitch + 1, c0 + x * pitch + pitch - 1, r0 + y * pitch + pitch - 1, floor)

    carve_cell(0, 0)
    while stack:
        x, y = stack[-1]
        nbrs = [(x + dx, y + dy, dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                if 0 <= x + dx < nx and 0 <= y + dy < ny and (x + dx, y + dy) not in seen]
        if not nbrs:
            stack.pop(); continue
        nx2, ny2, dx, dy = rnd.choice(nbrs)
        carve_cell(nx2, ny2)
        # abrir el muro entre celdas
        if dx:
            wc = c0 + max(x, nx2) * pitch
            g.rect(wc, r0 + y * pitch + 1, wc, r0 + y * pitch + pitch - 1, floor)
        else:
            wr = r0 + max(y, ny2) * pitch
            g.rect(c0 + x * pitch + 1, wr, c0 + x * pitch + pitch - 1, wr, floor)
        seen.add((nx2, ny2)); stack.append((nx2, ny2))
    # algunos lazos extra para que no sea un árbol perfecto
    for _ in range(nx * ny // 6):
        x, y = rnd.randrange(nx - 1), rnd.randrange(ny)
        wc = c0 + (x + 1) * pitch
        g.rect(wc, r0 + y * pitch + 1, wc, r0 + y * pitch + pitch - 1, floor)


def forest():
    rnd = random.Random(11)
    W, H = 44, 46
    g = Grid(W, H, 'g')
    g.frame(0, 0, W - 1, H - 1, '#')
    # --- laberinto norte: celdas 3x3 (pasillos de 2) ---
    # 14 celdas * 3 + 1 = 43 columnas -> cols 0..42 ; 7 celdas -> filas 1..22
    maze(g, 0, 1, 14, 7, rnd)
    g.rect(0, 0, W - 1, 0, '#'); g.rect(W - 1, 0, W - 1, 22, '#')
    # arena central del jefe
    g.rect(16, 8, 26, 15, 'g')
    g.frame(15, 7, 27, 16, '#')
    # entradas de la arena (sur y norte) alineadas con pasillos de celdas
    g.rect(19, 16, 20, 16, 'g'); g.rect(22, 7, 23, 7, 'g')
    # salida norte (puerta con llave del bosque)
    g.rect(22, 0, 23, 1, '=')
    g.rect(22, 2, 23, 3, 'g')
    # entrada sur del laberinto (puerta con llave del laberinto)
    g.rect(22, 22, 23, 22, '=')
    g.rect(22, 20, 23, 21, 'g')
    # --- bosque bajo ---
    g.rect(1, 23, W - 2, H - 2, 'g')
    g.rect(1, 23, W - 2, 23, '#')
    g.rect(22, 23, 23, 23, '=')
    # caminos
    g.rect(22, 24, 23, H - 1, '=')          # norte-sur hacia la aldea
    g.rect(6, 33, 38, 33, '=')              # este-oeste
    g.rect(6, 26, 6, 33, '=')               # hacia el claro oeste (llave del laberinto)
    g.rect(38, 33, 38, 40, '=')             # hacia la fuente de las hadas
    # arboleda densa en bloques
    for (c0, r0, c1, r1) in [(9, 25, 17, 30), (26, 25, 34, 30), (9, 36, 17, 41), (26, 36, 33, 41), (1, 39, 5, 44), (40, 24, 42, 30)]:
        g.rect(c0, r0, c1, r1, '#')
    # claro oeste con la llave del laberinto
    g.rect(2, 24, 8, 30, 'g')
    # hueco secreto en el bloque NE: pasadizo hacia el hacha perdida
    g.rect(29, 27, 31, 28, 'g'); g.set(32, 28, '%'); g.set(33, 28, '%'); g.set(34, 28, '%')
    # fuente de las hadas (este)
    g.rect(35, 38, 41, 44, 'g'); g.rect(37, 41, 40, 43, '~')
    # cabaña del leñador (oeste)
    g.rect(2, 34, 8, 38, 'g')
    # bolsillo secreto bajo izquierda
    g.rect(2, 41, 4, 43, 'g'); g.set(5, 42, '%')
    # decoración: pinos y árboles sueltos, arbustos
    g.scatter(1, 24, W - 2, H - 2, 'P', 40, rnd, only='g')
    g.scatter(1, 24, W - 2, H - 2, 'T', 10, rnd, only='g')
    g.scatter(1, 24, W - 2, H - 2, 'b', 16, rnd, only='g')
    g.scatter(1, 24, W - 2, H - 2, 'R', 8, rnd, only='g')
    g.scatter(1, 24, W - 2, H - 2, '"', 30, rnd, only='g')
    g.scatter(1, 2, W - 2, 21, 'b', 10, rnd, only='g')
    # despejar zonas de objetos clave
    for (c0, r0, c1, r1) in [(19, 30, 24, 35), (2, 24, 8, 30), (2, 34, 8, 38), (35, 36, 41, 44), (21, 40, 24, 45), (20, 24, 25, 26), (29, 27, 31, 28), (37, 32, 39, 34)]:
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                if g.get(c, r) in ('P', 'T', 'b', 'R'):
                    g.set(c, r, 'g')
    # salida sur hacia la aldea
    g.rect(22, H - 1, 23, H - 1, '=')
    check(g, (22, 44), [(22, 21), (20, 12), (22, 1), (3, 42), (30, 27), (38, 40), (4, 27)])
    print(g.dump())


def check(g, start, targets):
    """BFS: verifica que los objetivos son alcanzables (arbustos y pasadizos cuentan como transitables)."""
    from collections import deque
    ok = set('.,"g=osB%bni')
    seen = {start}
    q = deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n not in seen and g.get(*n) in ok:
                seen.add(n); q.append(n)
    for t in targets:
        print(('OK   ' if t in seen else 'FAIL ') + str(t), file=sys.stderr)




# ---------------------------------------------------------------- Cuevas Heladas
SOLID = set('#^IcF~TPRb')


def ice_solver(rows, start, goal, blocks=(), max_states=400000):
    """BFS con las reglas del juego: el hielo 'i' desliza al jugador y a los
    bloques hasta chocar; fuera del hielo se avanza casilla a casilla.
    goal(player, blocks) -> bool. Devuelve la lista de movimientos o None."""
    from collections import deque
    H, W = len(rows), len(rows[0])
    def ch(c, r):
        return rows[r][c] if 0 <= r < H and 0 <= c < W else '#'
    def free(p, blocks):
        return ch(*p) not in SOLID and p not in blocks
    ice = lambda p: ch(*p) == 'i'
    dirs = {'E': (1, 0), 'W': (-1, 0), 'S': (0, 1), 'N': (0, -1)}
    s0 = (start, tuple(sorted(blocks)))
    prev = {s0: None}
    q = deque([s0])
    while q:
        st = q.popleft()
        p, bl = st
        if goal(p, bl):
            path = []
            while prev[st]:
                st, m = prev[st]
                path.append(m)
            return path[::-1]
        for name, (dc, dr) in dirs.items():
            n = (p[0] + dc, p[1] + dr)
            if n in bl:
                bn = (n[0] + dc, n[1] + dr)
                if not free(bn, bl):
                    continue
                rest = tuple(b for b in bl if b != n)
                while ice(bn):
                    nx = (bn[0] + dc, bn[1] + dr)
                    if not free(nx, rest) or nx == p:
                        break
                    bn = nx
                ns = (p, tuple(sorted(rest + (bn,))))
            else:
                if not free(n, bl):
                    continue
                cur = n
                while ice(cur):
                    nx = (cur[0] + dc, cur[1] + dr)
                    if not free(nx, bl):
                        break
                    cur = nx
                ns = (cur, bl)
            if ns not in prev:
                prev[ns] = (st, name)
                if len(prev) > max_states:
                    return None
                q.append(ns)
    return None


def reachable_states(rows, start, blocks=()):
    """Todos los estados alcanzables (jugador, bloques) desde el inicio."""
    seen = {}
    ice_solver_states = []
    def goal(p, b):
        ice_solver_states.append((p, b))
        return False
    ice_solver(rows, start, goal, blocks)
    return ice_solver_states


def no_softlock(rows, start, safe):
    """Desde cualquier posición alcanzable sobre el hielo se puede volver a 'safe'."""
    states = reachable_states(rows, start)
    for p, b in states:
        if ice_solver(rows, p, lambda q, bb: q in safe, b) is None:
            return False
    return True


def ice_field(g, rnd, c0, r0, c1, r1, pillars):
    g.rect(c0, r0, c1, r1, 'i')
    k = 0
    while k < pillars:
        c, r = rnd.randint(c0, c1), rnd.randint(r0, r1)
        if g.get(c, r) == 'i':
            g.set(c, r, 'I'); k += 1


def caves():
    W, H = 46, 50
    g = Grid(W, H, '#')
    # entrada sur y campamento
    g.rect(22, 48, 23, 49, '=')
    g.rect(14, 42, 33, 47, 'n')
    g.rect(22, 41, 23, 41, 'n')
    # explanada central y valle este
    g.rect(14, 30, 43, 40, 'n')
    g.rect(34, 41, 43, 46, 'n')
    # refugio de Sven (noreste)
    g.rect(34, 18, 41, 26, 'n')
    g.rect(37, 27, 38, 29, 'n')
    # puerta A -> sala de los bloques
    g.rect(22, 28, 23, 29, 'n')
    g.rect(12, 18, 31, 27, 'n')
    # puerta B -> pasillo -> arena del golem
    g.rect(22, 12, 23, 17, 'n')
    g.rect(9, 2, 36, 11, 'n')
    for (c, r) in [(9, 2), (10, 2), (9, 3), (36, 2), (35, 2), (36, 3), (9, 11), (10, 11), (9, 10), (36, 11), (35, 11), (36, 10)]:
        g.set(c, r, '#')
    # salida norte (muro de hielo)
    g.rect(22, 0, 23, 1, 'n'); g.rect(22, 0, 23, 0, '=')
    # lago helado (oeste)
    g.rect(2, 30, 12, 40, 'n')
    g.rect(13, 37, 13, 38, 'n')
    # sala oeste (secreta) unida a la sala de bloques por un pasadizo
    g.rect(2, 18, 10, 27, 'n')
    g.set(11, 22, '%')

    base = [row[:] for row in g.g]
    rows_of = lambda: [''.join(r) for r in g.g]

    # ---- puzle 1: lago helado, cofre en el centro (7,35)
    best = None
    for seed in range(400):
        g.g = [row[:] for row in base]
        rnd = random.Random(1000 + seed)
        ice_field(g, rnd, 3, 31, 11, 39, 9)
        g.set(7, 35, 'I')  # el cofre actúa como obstáculo (se coloca encima como entidad)
        rows = rows_of()
        sol = ice_solver(rows, (12, 37), lambda p, b: abs(p[0] - 7) + abs(p[1] - 35) == 1)
        if not sol or len(sol) < 6:
            continue
        safe = {(c, r) for r in range(30, 41) for c in range(2, 14) if rows[r][c] == 'n'}
        if not no_softlock(rows, (12, 37), safe):
            continue
        if not best or len(sol) > len(best[1]):
            best = (seed, sol, [row[:] for row in g.g])
            if len(sol) >= 8:
                break
    print('lago:', best[0], best[1], file=sys.stderr)
    base = best[2]
    base[35][7] = 'i'  # bajo el cofre hay hielo

    # ---- puzle 2: sala de los bloques; bloque en (15,26) -> placa en (27,19)
    best = None
    for seed in range(600):
        g.g = [row[:] for row in base]
        rnd = random.Random(2000 + seed)
        ice_field(g, rnd, 14, 20, 29, 25, 7)
        rows = rows_of()
        if rows[19][27] != 'n':
            continue
        sol = ice_solver(rows, (22, 27), lambda p, b: (27, 19) in b, blocks=[(16, 26)])
        if not sol:
            continue
        pushes = len(sol)
        if not best or pushes > len(best[1]):
            best = (seed, sol, [row[:] for row in g.g])
            if pushes >= 14:
                break
    print('bloques:', best[0], len(best[1]), best[1], file=sys.stderr)
    base = best[2]

    # ---- puzle 3: sala oeste, cofre del corazón en (6,19)
    best = None
    for seed in range(400):
        g.g = [row[:] for row in base]
        rnd = random.Random(3000 + seed)
        ice_field(g, rnd, 3, 19, 9, 26, 7)
        g.set(6, 19, 'I')
        rows = rows_of()
        sol = ice_solver(rows, (10, 22), lambda p, b: abs(p[0] - 6) + abs(p[1] - 19) == 1)
        if not sol or len(sol) < 6:
            continue
        safe = {(c, r) for r in range(18, 28) for c in range(2, 12) if rows[r][c] in 'n%'}
        if not no_softlock(rows, (10, 22), safe):
            continue
        if not best or len(sol) > len(best[1]):
            best = (seed, sol, [row[:] for row in g.g])
            if len(sol) >= 8:
                break
    print('oeste:', best[0], best[1], file=sys.stderr)
    base = best[2]
    base[19][6] = 'i'
    g.g = base

    # escondite secreto del mineral (oeste del campamento)
    g.rect(10, 43, 12, 45, 'n'); g.set(13, 44, '%')
    # decoración: pinos nevados, rocas y cristales en zonas abiertas
    rnd = random.Random(5)
    g.scatter(14, 30, 43, 40, 'P', 14, rnd, only='n')
    g.scatter(14, 30, 43, 40, 'R', 5, rnd, only='n')
    g.scatter(14, 42, 33, 47, 'P', 6, rnd, only='n')
    g.scatter(34, 41, 43, 46, 'P', 5, rnd, only='n')
    g.scatter(14, 30, 43, 46, 'c', 6, rnd, only='n')
    g.scatter(34, 18, 41, 26, 'c', 3, rnd, only='n')
    for (c, r) in [(10, 3), (35, 3), (10, 10), (35, 10), (13, 6), (32, 6)]:
        g.set(c, r, 'c')
    for (c0, r0, c1, r1) in [(20, 30, 25, 41), (14, 36, 21, 39), (12, 30, 14, 40), (36, 26, 39, 33), (35, 38, 41, 42),
                             (18, 42, 27, 48), (15, 42, 19, 45), (24, 30, 31, 31), (36, 18, 39, 21)]:
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                if g.get(c, r) in ('P', 'R', 'c'):
                    g.set(c, r, 'n')
    check(g, (22, 48), [(22, 30), (7, 30), (38, 30), (37, 22), (22, 27), (22, 17), (22, 5), (22, 1), (10, 22), (40, 45), (11, 44)])
    print(g.dump())


if __name__ == '__main__':
    {'village': village, 'forest': forest, 'caves': caves}[sys.argv[1]]()

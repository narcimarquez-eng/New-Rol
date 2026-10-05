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
    ok = set('.,"g=osB%b')
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


if __name__ == '__main__':
    {'village': village, 'forest': forest}[sys.argv[1]]()

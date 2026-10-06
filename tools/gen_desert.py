#!/usr/bin/env python3
"""Genera el mapa ASCII del Desierto Perdido y comprueba que todo es alcanzable.

Uso: python3 tools/gen_desert.py            -> imprime el mapa (para src/data/zones/desert.js)
     python3 tools/gen_desert.py --check    -> solo la comprobación de alcance

Leyenda: ^ acantilado/meseta · s arena · h arena con matorral · x tierra agrietada
         = camino · k losas · W muro en ruinas · & ruina falsa (pasadizo secreto)
         O columna · C cactus · p palmera · . , césped del oasis · ~ agua · R roca
"""
import random, sys
from collections import deque

W, H = 48, 52
random.seed(7)
g = [['s'] * W for _ in range(H)]

def rect(c0, r0, c1, r1, ch):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            if 0 <= r < H and 0 <= c < W: g[r][c] = ch

def put(c, r, ch):
    if 0 <= r < H and 0 <= c < W: g[r][c] = ch

def border():
    for r in range(H):
        g[r][0] = g[r][W - 1] = '^'
    for c in range(W):
        g[0][c] = g[H - 1][c] = '^'

# ---------------- dunas base con matorrales y tierra agrietada
for r in range(1, H - 1):
    for c in range(1, W - 1):
        v = random.random()
        g[r][c] = 'h' if v < 0.1 else ('x' if v < 0.13 else 's')
border()

# ---------------- entrada sur (desde las Cuevas) y camino principal hacia el norte
rect(23, 17, 24, 51, '=')
g[H - 1][23] = g[H - 1][24] = '='          # hueco del portal sur
rect(20, 44, 27, 50, 's')
rect(23, 44, 24, 51, '=')

# ---------------- cruce central (mercader) y caminos a oeste y este
rect(19, 27, 28, 32, 'x')
rect(23, 27, 24, 32, '=')
rect(8, 29, 22, 30, '=')                  # al oasis
rect(25, 29, 40, 30, '=')                 # a las dunas del este
rect(30, 18, 31, 30, '=')                 # al cañón

# ---------------- oasis (oeste-centro)
rect(2, 31, 17, 43, '.')
for r in range(31, 44):
    for c in range(2, 18):
        if random.random() < 0.22: g[r][c] = ','
rect(6, 35, 11, 39, '~')
put(5, 37, '~'); put(12, 36, '~'); put(8, 34, '~'); put(9, 40, '~')
for (c, r) in [(4, 33), (13, 34), (5, 41), (12, 41), (3, 36), (14, 38), (10, 33), (7, 42), (15, 32), (2, 40)]:
    put(c, r, 'p')
put(14, 43, 'R'); put(2, 32, 'R')
# campamento de Borg (al noreste del oasis)
rect(12, 27, 18, 32, 's')
rect(13, 28, 17, 30, 'x')

# ---------------- dunas del este: escorpiones, cactus, rocas y mesetas
for (c, r) in [(33, 34), (38, 33), (42, 38), (35, 41), (40, 43), (31, 39), (44, 35), (36, 37), (29, 44)]:
    put(c, r, 'C')
for (c, r) in [(34, 36), (41, 41), (39, 35)]:
    put(c, r, 'R')
rect(41, 31, 46, 34, '^')                  # meseta con un hueco y un cofre detrás
put(41, 33, 's'); put(42, 33, 's')
rect(44, 32, 45, 33, 's')
rect(43, 33, 43, 33, 's')
rect(37, 45, 46, 50, '^')                  # meseta sureste
rect(1, 45, 6, 50, '^')                    # meseta suroeste

# ---------------- ruinas del oeste (Llave del Sol)
rect(2, 7, 17, 25, 'k')
for r in range(7, 26):
    for c in range(2, 18):
        if random.random() < 0.18: g[r][c] = 's'   # arena que invade las losas
# muros exteriores rotos
for c in range(2, 18):
    if c not in (9, 10): put(c, 7, 'W')
    if c not in (9, 10, 11): put(c, 25, 'W')
for r in range(7, 26):
    if r not in (15, 16): put(17, r, 'W')
    put(2, r, 'W')
# sala interior (cofre de la Llave del Sol)
for c in range(4, 10):
    put(c, 10, 'W'); put(c, 14, 'W')
for r in range(10, 15):
    put(4, r, 'W'); put(9, r, 'W')
put(7, 14, 'k'); put(6, 14, 'k')           # entrada de la sala
rect(5, 11, 8, 13, 'k')
# cámara secreta (amuleto) tras un muro falso
for c in range(2, 7):
    put(c, 18, 'W'); put(c, 22, 'W')
for r in range(18, 23):
    put(6, r, 'W')
put(6, 20, '&')
rect(3, 19, 5, 21, 'k')
for (c, r) in [(12, 9), (15, 9), (12, 12), (15, 12), (12, 19), (15, 19), (12, 22), (15, 22)]:
    put(c, r, 'O')

# ---------------- cañón del este
rect(32, 1, 46, 26, '^')
rect(34, 6, 44, 24, 's')                   # fondo del cañón
for r in range(6, 25):
    for c in range(34, 45):
        if random.random() < 0.12: g[r][c] = 'x'
rect(36, 8, 38, 11, '^'); rect(40, 14, 42, 18, '^'); rect(35, 19, 36, 21, '^')  # pilares de roca
rect(32, 22, 34, 24, 's'); rect(30, 18, 34, 22, 's')  # boca del cañón (oeste)
rect(30, 18, 31, 26, '=')
put(43, 8, 'C'); put(38, 22, 'C'); put(44, 21, 'R')

# ---------------- templo del sol (norte)
rect(18, 1, 30, 16, 'k')
for c in range(18, 31):
    put(c, 1, 'W'); put(c, 16, 'W')
for r in range(1, 17):
    put(18, r, 'W'); put(30, r, 'W')
put(23, 16, 'k'); put(24, 16, 'k')         # puerta del templo (entidad door)
put(23, 1, 'k'); put(24, 1, 'k')           # salida norte (portal al castillo)
g[0][23] = g[0][24] = 'k'
for (c, r) in [(20, 4), (28, 4), (20, 8), (28, 8), (20, 12), (28, 12)]:
    put(c, r, 'O')
# explanada delante del templo
rect(19, 17, 29, 20, 'x')
rect(23, 17, 24, 22, '=')

border()
g[H - 1][23] = g[H - 1][24] = '='
g[0][23] = g[0][24] = 'k'

# ---------------- comprobación de alcance
SOLID = set('^W~OCpR')
def passable(c, r):
    return 0 <= c < W and 0 <= r < H and g[r][c] not in SOLID

def reach(start, extra_block=()):
    seen = {start}
    q = deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n in seen or not passable(*n) or n in extra_block: continue
            seen.add(n); q.append(n)
    return seen

start = (23, 48)
door = {(23, 16), (24, 16)}
before = reach(start, door)
after = reach(start)
targets = {
    'llave del sol (6,12)': (6, 12), 'amuleto (4,20)': (4, 20), 'oasis (9,33)': (9, 33),
    'Borg (15,29)': (15, 29), 'cofre del este (44,33)': (44, 33), 'cañón (40,10)': (40, 10),
    'mercader (21,28)': (21, 28), 'Aldric (21,18)': (21, 18), 'cofre del templo (24,3)': (24, 3), 'portal norte (23,0)': (23, 0),
}
ok = True
for name, t in targets.items():
    need_door = name.startswith('cofre del templo') or name.startswith('portal norte')
    pool = after if need_door else before
    if t not in pool:
        print('NO ALCANZABLE:', name); ok = False
total = sum(1 for r in range(H) for c in range(W) if passable(c, r))
print(f'alcanzable {len(after)}/{total} casillas transitables ({100*len(after)/total:.1f}%)', file=sys.stderr)
if '--check' not in sys.argv:
    for row in g:
        print("    '" + ''.join(row) + "',")
sys.exit(0 if ok else 1)

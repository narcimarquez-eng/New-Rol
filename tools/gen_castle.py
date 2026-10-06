"""Castillo Final (Fase 4).

Mapa del castillo de Malakar, con todas las pruebas mágicas combinadas:
  - Ala del Cristal (oeste): laberinto de barreras rojas/azules + bloques de piedra -> Sello del Cristal.
  - Torre de la Luz (biblioteca, noroeste): espejos que guían el rayo del ídolo -> Sello de la Luz.
  - Ala de la Llama (este): braseros con tiempo + runas -> Sello de la Llama.
  - Cripta (noreste): esqueletos enterrados, bloque y placa -> el tomo perdido (misión).
  - Gran Puerta (antesala): se abre con los tres sellos. Sala del trono: Malakar.

Comprueba con los solucionadores de tools/gen_shrines.py que todo tiene solución y
escribe src/data/zones/castle.js (y los movimientos para las pruebas e2e).
Uso: python3 tools/gen_castle.py
"""
import json
import importlib.util
import os

spec = importlib.util.spec_from_file_location('gs', os.path.join(os.path.dirname(__file__), 'gen_shrines.py'))
gs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gs)
Grid, bfs, need, adj_dist = gs.Grid, gs.bfs, gs.need, gs.adj_dist
WALK, CARRY = gs.WALK, gs.CARRY

W, H = 56, 66
g = Grid(W, H, 'M')
E2E = {}

# ------------------------------------------------------------------ exterior
g.rect(0, 55, 55, 65, '^')
g.rect(1, 55, 54, 56, '~'); g.rect(27, 55, 28, 56, 'B')                 # foso y puente
g.rect(1, 57, 54, 64, 's')
for c0, r0, c1, r1 in ((3, 58, 12, 63), (42, 58, 52, 63), (20, 60, 25, 63), (31, 60, 36, 63)):
    g.rect(c0, r0, c1, r1, '.')
g.rect(26, 57, 29, 64, '=')                                               # camino
g.rect(27, 65, 28, 65, '=')
for c, r in ((2, 58), (4, 62), (9, 59), (13, 63), (44, 59), (50, 61), (53, 58), (47, 63), (16, 58), (39, 58)):
    g.set(c, r, 'T')
for c, r in ((18, 63), (37, 63), (6, 57)):
    g.set(c, r, 'R')

# ------------------------------------------------------------------ castillo
g.rect(18, 30, 37, 52, 'q')                                               # patio de armas
g.rect(27, 53, 28, 54, 'q')                                               # portón
for c0, r0, c1, r1 in ((20, 44, 23, 50), (32, 44, 35, 50)):
    g.rect(c0, r0, c1, r1, '.')
g.set(21, 46, 'T'); g.set(34, 46, 'T'); g.set(21, 49, 'T'); g.set(34, 49, 'T')
g.rect(2, 43, 16, 52, '.')                                                # jardín
for c, r in ((3, 44), (6, 50), (11, 44), (15, 51), (3, 51), (14, 45)):
    g.set(c, r, 'T')
for c, r in ((5, 46), (8, 48), (12, 49), (10, 46)):
    g.set(c, r, ',')
g.rect(17, 47, 17, 48, 'q')
g.rect(39, 43, 53, 52, 'k')                                               # cuarteles
g.rect(38, 47, 38, 48, 'q')
g.rect(20, 18, 35, 28, 'k'); g.rect(26, 29, 29, 29, 'k')                  # antesala
g.rect(27, 17, 28, 17, 'k')                                               # Gran Puerta
g.rect(19, 2, 36, 16, 'k')                                                # sala del trono
g.rect(27, 0, 28, 1, 'k')                                                 # balcón (salida final)
for c, r in ((21, 4), (34, 4), (21, 9), (34, 9), (21, 14), (34, 14), (22, 20), (33, 20), (22, 26), (33, 26)):
    g.set(c, r, 'O')
for c, r in ((0, 54), (55, 54), (25, 54), (30, 54), (0, 0), (55, 0), (17, 29), (38, 29)):
    g.set(c, r, 'U')

# ------------------------------------------------------------------ Ala del Cristal (oeste)
g.rect(8, 42, 9, 42, 'k')                                                 # entrada desde el jardín
g.rect(2, 30, 16, 41, 'k')
g.rect(2, 38, 16, 38, 'M'); g.rect(9, 30, 9, 37, 'M'); g.rect(2, 34, 8, 34, 'M')
barriers = {(4, 38): 'red', (5, 38): 'red', (12, 38): 'blue', (13, 38): 'blue', (9, 36): 'red', (7, 34): 'blue'}
for t in barriers:
    g.set(*t, 'k')
switches = [(15, 40), (15, 31), (2, 36)]
g.rect(4, 29, 5, 29, 'k')                                                 # paso a la sala de los bloques
g.rect(2, 22, 16, 28, 'k')
g.set(7, 25, 'O'); g.set(12, 24, 'O')
g.rect(8, 21, 9, 21, 'k')                                                 # puerta de las placas
g.rect(5, 18, 12, 20, 'k')                                                # sala del sello
g.rect(8, 17, 9, 17, 'k')                                                 # puerta de la biblioteca

# ------------------------------------------------------------------ Torre de la Luz (biblioteca)
g.rect(2, 4, 16, 16, 'k')
g.rect(7, 1, 10, 2, 'k'); g.rect(8, 3, 9, 3, 'k')                         # nicho del sello + puerta
for c, r in ((5, 7), (12, 7), (9, 11), (5, 13)):
    g.set(c, r, 'O')
g.rect(13, 10, 14, 10, 'M')

# ------------------------------------------------------------------ Ala de la Llama (este)
g.rect(46, 42, 47, 42, 'k')
g.rect(39, 30, 53, 41, 'k')
g.rect(43, 30, 43, 36, 'M'); g.rect(50, 30, 50, 36, 'M')
g.rect(39, 36, 41, 36, 'M'); g.rect(52, 36, 53, 36, 'M')
g.rect(46, 29, 47, 29, 'k')                                               # puerta de los braseros
g.rect(39, 21, 53, 28, 'k')
g.rect(46, 20, 47, 20, 'k')                                               # puerta de las runas
g.rect(42, 18, 51, 19, 'k')                                               # sala del sello
g.rect(46, 17, 47, 17, 'k')                                               # puerta de la cripta

# ------------------------------------------------------------------ Cripta (noreste)
g.rect(39, 2, 53, 16, 'k')
g.rect(39, 6, 45, 6, 'M'); g.rect(45, 2, 45, 5, 'M')                      # cámara del tomo
g.set(42, 6, 'k')                                                         # su puerta
g.rect(49, 5, 53, 5, 'M'); g.rect(49, 2, 49, 4, 'M'); g.set(51, 5, 'm')    # sala secreta
for c, r in ((41, 9), (44, 9), (50, 9), (41, 13), (47, 13), (51, 13)):
    g.set(c, r, 'O')

rows = g.rows()

# =================================================================== comprobaciones
print('Castillo Final')
blocked_static = set()
door_tiles = {
    'gate': {(27, 17), (28, 17)}, 'balcony': {(27, 1), (28, 1)},
    'w_plates': {(8, 21), (9, 21)}, 'w_lib': {(8, 17), (9, 17)}, 'lib_seal': {(8, 3), (9, 3)},
    'e_fire': {(46, 29), (47, 29)}, 'e_runes': {(46, 20), (47, 20)}, 'e_crypt': {(46, 17), (47, 17)},
    'crypt_tomb': {(42, 6)},
}
all_doors = set().union(*door_tiles.values())
start = (27, 63)
d0 = bfs(g, start, all_doors | set(barriers) | set(switches))
for name, t in (('patio', (27, 40)), ('jardín', (8, 46)), ('cuarteles', (46, 46)), ('antesala', (27, 22)),
                ('Ala del Cristal (entrada)', (8, 40)), ('Ala de la Llama (entrada)', (46, 40))):
    need(t in d0, f'{name} alcanzable desde el campamento')
for name, t in (('sala del trono', (27, 10)), ('biblioteca', (8, 10)), ('cripta', (46, 10)), ('sala de los bloques', (8, 25))):
    need(t not in d0, f'{name} cerrada al principio')

# --- barreras
swsol = gs.solve_switches(g, (8, 41), (4, 30), barriers, switches)
need(swsol is not None and swsol[0] >= 2, f'Ala del Cristal: barreras resueltas con {swsol[0] if swsol else None} cambios')
E2E['barriers'] = {'start': [8, 41], 'moves': swsol[1]}

# --- bloques de piedra
blocks = [(5, 25), (12, 26)]
plates = [(9, 23), (14, 23)]
sok = gs.solve_sokoban(g, (4, 28), blocks, plates)
need(sok is not None and sok[0] >= 6, f'Ala del Cristal: bloques en las placas ({sok[0] if sok else None} empujes)')
E2E['blocks'] = {'start': [4, 28], 'moves': sok[1]}

# --- espejos de la biblioteca
src, sdir = (15, 15), (0, -1)
target = (3, 5)
mirrors0 = {(15, 12): '\\', (8, 12): '\\', (8, 9): '\\', (3, 9): '\\', (15, 5): '/', (11, 5): '\\', (11, 9): '/'}
fixed = {(11, 5)}


def flips_needed(m):
    b = gs.solve_mirrors(g, src, sdir, m, fixed, target)
    return b[0] if b else None


keys = [k for k in mirrors0 if k not in fixed]
choice, most = None, -1
for mask in range(1 << len(keys)):
    m = dict(mirrors0)
    for i, k in enumerate(keys):
        if mask >> i & 1:
            m[k] = '\\' if m[k] == '/' else '/'
    n = flips_needed(m)
    if n is not None and n > most:
        choice, most = m, n
need(most >= 3, f'la colocación inicial de los espejos exige {most} giros')
mirrors = choice
best = gs.solve_mirrors(g, src, sdir, mirrors, fixed, target)
sol_turns = [list(k) for k, v in best[1].items() if v != mirrors[k]]
print('   giros:', sol_turns)
E2E['mirrors'] = sol_turns
dlib = bfs(g, (8, 16), set(mirrors) | {src, target} | door_tiles['lib_seal'])
for mtile in mirrors:
    need(adj_dist(dlib, mtile) is not None, f'espejo {mtile} alcanzable')

# --- braseros del Ala de la Llama
eternal = (46, 38)
braziers = [(40, 31), (52, 31), (40, 40), (52, 40)]
bl = set(braziers) | {eternal, (47, 38)}
pts = {'e': eternal, 'nw': braziers[0], 'ne': braziers[1], 'sw': braziers[2], 'se': braziers[3]}


def bdist(a, b):
    return adj_dist(bfs(g, pts[a], bl - {pts[a]}), pts[b])


legs = {k: bdist(*k.split('-')) for k in ('e-nw', 'e-ne', 'e-sw', 'e-se', 'sw-nw', 'se-ne', 'nw-ne')}
print('   distancias braseros:', legs)
for k in ('e-sw', 'e-se', 'sw-nw', 'se-ne'):
    need(legs[k] / WALK < CARRY, f'tramo {k} cabe en el fuego de la espada')
need(legs['e-nw'] / WALK > CARRY * 0.9 or legs['nw-ne'] / WALK > CARRY, 'hay que encadenar las llamas para llegar a todos')
route = legs['e-sw'] + legs['sw-nw'] + legs['sw-nw'] + legs['e-sw'] + legs['e-se'] + legs['se-ne']
duration = 45
need(route / WALK < duration * 0.85, f'ruta completa {route / WALK:.1f} s dentro de {duration} s')

# --- runas
runes = {(41, 22): 3, (46, 22): 0, (51, 22): 5, (41, 25): 1, (46, 25): 4, (51, 25): 2}
seq = [4, 0, 2, 3, 5, 1]
dr = bfs(g, (46, 28), {(46, 27), (47, 27)} | door_tiles['e_runes'])
for t in runes:
    need(t in dr, f'runa {t} alcanzable')
E2E['runes'] = [list(next(k for k, v in runes.items() if v == s)) for s in seq]

# --- cripta: un bloque hasta la placa abre la cámara del tomo
cblocks = [(47, 11)]
cplates = [(42, 8)]
csok = gs.solve_sokoban(g, (46, 15), cblocks, cplates)
need(csok is not None and csok[0] >= 4, f'cripta: bloque en la placa ({csok[0] if csok else None} empujes)')
E2E['crypt'] = {'start': [46, 15], 'moves': csok[1]}
need((51, 3) in bfs(g, (51, 7)), 'la sala secreta de la cripta se alcanza por el muro falso')

json.dump(E2E, open('tools/castle_e2e.json', 'w'))
print('  escrito tools/castle_e2e.json')

# =================================================================== entidades
ents = []
add = ents.append
add({'type': 'spawn', 'id': 'fromDesert', 'tile': [27.5, 63], 'facing': 3.14159})
add({'type': 'portal', 'tile': [27, 65], 'span': 2, 'to': 'desert', 'spawn': 'fromCastle', 'label': 'Desierto Perdido'})
# campamento
add({'type': 'prop', 'kind': 'tent', 'tile': [22, 61.5], 'color': 0x2e4a8a, 'rot': 0.3, 'radius': 1.6})
add({'type': 'prop', 'kind': 'tent', 'tile': [33, 61.5], 'color': 0x8a2e2e, 'rot': -0.3, 'radius': 1.6})
add({'type': 'prop', 'kind': 'campfire', 'tile': [27.5, 60], 'radius': 0.7})
add({'type': 'prop', 'kind': 'banner', 'style': 'royal', 'tile': [24.8, 58], 'rot': 0})
add({'type': 'prop', 'kind': 'banner', 'style': 'royal', 'tile': [30.2, 58], 'rot': 0})
add({'type': 'sign', 'tile': [25, 64], 'text': 'CASTILLO DE MALAKAR\nLa Gran Puerta solo se abre con tres sellos: Cristal, Luz y Llama.'})
# patio, antesala, sala del trono
add({'type': 'prop', 'kind': 'carpet', 'tile': [27.5, 22.5], 'size': [1, 11]})
add({'type': 'prop', 'kind': 'carpet', 'tile': [27.5, 9.5], 'size': [1, 14]})
for c, r, rot in ((23, 19, 0), (32, 19, 0), (23, 27, 3.14159), (32, 27, 3.14159), (24, 32, 0), (31, 32, 0)):
    add({'type': 'prop', 'kind': 'knight', 'tile': [c, r], 'rot': rot, 'pose': 'Idle', 't': 0.3, 'box': [2.2, 2.2]})
for c, r in ((20.6, 17.6), (34.4, 17.6), (24, 1.6), (31, 1.6), (19.6, 29.6), (35.4, 29.6)):
    add({'type': 'prop', 'kind': 'banner', 'style': 'shadow', 'tile': [c, r], 'rot': 0})
add({'type': 'prop', 'kind': 'throne', 'tile': [27.5, 3], 'rot': 0, 'box': [3.2, 2.6]})
for c, r in ((26, 50), (29, 50), (19, 31), (36, 31), (24, 17.8), (31, 17.8), (20, 3), (35, 3), (20, 15), (35, 15)):
    add({'type': 'torch', 'tile': [c, r]})
# biblioteca: estanterías contra las paredes
for c, r in ((3, 4), (6, 4), (12, 4), (15, 4)):
    add({'type': 'prop', 'kind': 'bookshelf', 'tile': [c, r - 0.3], 'rot': 0, 'box': [3.4, 0.9]})
# puertas
add({'type': 'door', 'id': 'k_gate', 'tile': [27, 17], 'span': 2, 'style': 'stone',
     'requires': {'all': [{'item': 'seal_crystal'}, {'item': 'seal_light'}, {'item': 'seal_flame'}]},
     'lockedText': 'La Gran Puerta. Tres huecos brillan en la piedra: uno con forma de cristal, otro de sol y otro de llama.'})
add({'type': 'door', 'id': 'k_balcony', 'tile': [27, 1], 'span': 2, 'style': 'stone', 'requires': {'flag': 'boss_castle'}, 'auto': True,
     'lockedText': 'Una puerta sellada por la magia de Malakar.'})
add({'type': 'portal', 'tile': [27, 0], 'span': 2, 'to': 'credits', 'flag': 'game_complete', 'label': 'Balcón del reino',
     'ending': {'title': '¡Has salvado el reino!', 'tagline': 'Malakar ha caído y la luz vuelve al castillo.',
                'text': 'Desde el balcón, el reino entero celebra tu victoria. Kael, Borg, Sir Aldric y Sir Cedric levantan sus armas en tu honor.<br/><b>¡Gracias por jugar a New Rol!</b>'}})
# Ala del Cristal
add({'type': 'sign', 'tile': [10, 41], 'text': 'ALA DEL CRISTAL\nGolpea los cristales: las barreras rojas y azules se alternan.\nDespués, dos bloques y dos placas.'})
for (c, r), col in barriers.items():
    add({'type': 'barrier', 'tile': [c, r], 'color': col})
for c, r in switches:
    add({'type': 'switch', 'tile': [c, r]})
add({'type': 'stoneblock', 'id': 'kw_b1', 'group': 'kw_g', 'tile': list(blocks[0])})
add({'type': 'stoneblock', 'id': 'kw_b2', 'group': 'kw_g', 'tile': list(blocks[1])})
add({'type': 'plate', 'id': 'kw_p1', 'tile': list(plates[0]), 'flag': 'kw_plate1', 'block': 'kw_b1', 'text': '¡Una placa se hunde!'})
add({'type': 'plate', 'id': 'kw_p2', 'tile': list(plates[1]), 'flag': 'kw_plate2', 'block': 'kw_b2', 'text': '¡Una placa se hunde!'})
add({'type': 'resetstone', 'tile': [15, 28], 'group': 'kw_g', 'facing': -1.5708})
add({'type': 'door', 'id': 'kw_door', 'tile': [8, 21], 'span': 2, 'style': 'stone', 'auto': True,
     'requires': {'all': [{'flag': 'kw_plate1'}, {'flag': 'kw_plate2'}]}, 'lockedText': 'Dos placas grabadas en el suelo de la sala abren esta puerta.'})
add({'type': 'chest', 'id': 'kw_seal', 'tile': [8.5, 18.5], 'item': 'seal_crystal', 'big': True, 'facing': 0})
add({'type': 'door', 'id': 'kw_lib', 'tile': [8, 17], 'span': 2, 'style': 'stone', 'auto': True, 'requires': {'item': 'seal_crystal'},
     'lockedText': 'La puerta de la Torre de la Luz. Reconoce el Sello del Cristal.'})
# Torre de la Luz
add({'type': 'beamsource', 'id': 'kl_idol', 'tile': list(src), 'dir': 'N'})
add({'type': 'beamtarget', 'id': 'kl_crystal', 'tile': list(target), 'flag': 'kl_beam_done', 'text': '¡El rayo alcanza el cristal! El nicho del Sello de la Luz se abre.'})
for (c, r), o in mirrors.items():
    e = {'type': 'mirror', 'tile': [c, r], 'orient': o}
    if (c, r) in fixed:
        e['fixed'] = True
    add(e)
add({'type': 'door', 'id': 'kl_door', 'tile': [8, 3], 'span': 2, 'style': 'stone', 'auto': True, 'requires': {'flag': 'kl_beam_done'},
     'lockedText': 'Un sol de oro en relieve. Espera la luz.'})
add({'type': 'chest', 'id': 'kl_seal', 'tile': [8.5, 1.4], 'item': 'seal_light', 'big': True, 'facing': 0})
# Ala de la Llama
add({'type': 'sign', 'tile': [44, 41], 'text': 'ALA DE LA LLAMA\nCuatro braseros que se apagan pronto. La llama eterna nunca.\nLos braseros encendidos también dan fuego.'})
add({'type': 'brazier', 'id': 'ke_eternal', 'tile': [46.5, 38], 'eternal': True})
for i, b in enumerate(braziers):
    add({'type': 'brazier', 'id': f'ke_b{i}', 'tile': list(b), 'group': 'ke_fire', 'duration': duration, 'flag': 'ke_fire_done',
         'text': '¡Los cuatro braseros arden! Se abre la sala de las runas.'})
add({'type': 'door', 'id': 'ke_doorA', 'tile': [46, 29], 'span': 2, 'style': 'stone', 'auto': True, 'requires': {'flag': 'ke_fire_done'},
     'lockedText': 'Cuatro llamas grabadas en la piedra.'})
add({'type': 'runetablet', 'tile': [46.5, 27], 'group': 'ke_runes', 'sequence': seq, 'flag': 'ke_runes_done', 'facing': 0,
     'text': '¡Las seis runas despiertan! La sala del Sello de la Llama se abre.',
     'lines': ['Seis runas brillan en la tablilla: el ojo, el sol, el árbol, el agua, la estrella y la luna.', 'Písalas en ese orden. Un error y se apagan todas.']})
for (c, r), s in runes.items():
    add({'type': 'rune', 'tile': [c, r], 'group': 'ke_runes', 'symbol': s})
add({'type': 'door', 'id': 'ke_doorB', 'tile': [46, 20], 'span': 2, 'style': 'stone', 'auto': True, 'requires': {'flag': 'ke_runes_done'},
     'lockedText': 'Las runas deben despertar antes.'})
add({'type': 'chest', 'id': 'ke_seal', 'tile': [46.5, 18.4], 'item': 'seal_flame', 'big': True, 'facing': 0})
add({'type': 'door', 'id': 'ke_crypt', 'tile': [46, 17], 'span': 2, 'style': 'stone', 'auto': True, 'requires': {'item': 'seal_flame'},
     'lockedText': 'La puerta de la cripta. Reconoce el Sello de la Llama.'})
# Cripta
add({'type': 'stoneblock', 'id': 'kc_b', 'group': 'kc_g', 'tile': list(cblocks[0])})
add({'type': 'plate', 'id': 'kc_p', 'tile': list(cplates[0]), 'flag': 'kc_plate', 'block': 'kc_b', 'text': '¡La losa de la cámara del tomo se abre!'})
add({'type': 'resetstone', 'tile': [52, 15], 'group': 'kc_g', 'facing': -1.5708})
add({'type': 'door', 'id': 'kc_tomb', 'tile': [42, 6], 'span': 1, 'style': 'stone', 'auto': True, 'requires': {'flag': 'kc_plate'},
     'lockedText': 'Una losa con un libro tallado. Debe de haber una placa cerca.'})
add({'type': 'chest', 'id': 'kc_tome', 'tile': [42, 3], 'item': 'lost_tome', 'facing': 0})
add({'type': 'chest', 'id': 'kc_secret', 'tile': [51.5, 3], 'item': 'heart_container', 'facing': 0, 'secret': True})
# estandartes (misión de Cedric)
add({'type': 'pickup', 'id': 'k_banner1', 'item': 'royal_banner', 'tile': [3, 48]})
add({'type': 'pickup', 'id': 'k_banner2', 'item': 'royal_banner', 'tile': [53, 51]})
add({'type': 'pickup', 'id': 'k_banner3', 'item': 'royal_banner', 'tile': [52, 8]})
add({'type': 'chest', 'id': 'k_garden', 'tile': [15, 43], 'item': 'bag', 'facing': -1.5708, 'secret': True})
add({'type': 'chest', 'id': 'k_barracks', 'tile': [52, 44], 'item': 'potion', 'facing': -1.5708})
# enemigos
for kind, c, r in (('darkKnight', 22, 36), ('darkKnight', 33, 36), ('darkKnight', 27, 44), ('darkKnight', 24, 48), ('skeletonArcher', 20, 32), ('skeletonArcher', 35, 32), ('darkMage', 27, 33),
                   ('skeletonRogue', 6, 45), ('skeletonRogue', 12, 50), ('darkKnight', 42, 46), ('darkKnight', 49, 49), ('brute', 45, 50),
                   ('skeletonRogue', 12, 33), ('skeletonRogue', 4, 40), ('darkMage', 52, 34), ('skeletonRogue', 41, 24),
                   ('darkMage', 14, 13), ('skeletonRogue', 4, 15),
                   ('skeletonWarrior', 43, 12), ('skeletonWarrior', 49, 15),
                   ('brute', 27, 24), ('darkKnight', 24, 21), ('darkKnight', 31, 21)):
    add({'type': 'enemy', 'kind': kind, 'tile': [c, r]})
for c, r in ((40, 11), (46, 8), (52, 11), (44, 15), (48, 4), (40, 15)):
    add({'type': 'enemy', 'kind': 'skeletonMinion', 'tile': [c, r]})
add({'type': 'enemy', 'kind': 'malakar', 'id': 'boss_castle', 'tile': [27.5, 7], 'flag': 'boss_castle', 'arena': [19, 2, 36, 16],
     'pylons': [[23, 5], [32, 5], [23, 13], [32, 13]]})

# =================================================================== salida
rows_js = ',\n'.join("  '" + r + "'" for r in rows)
ents_js = ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in ents)
open('src/data/zones/castle_gen.js', 'w').write(f"""// Mapa y entidades del Castillo Final. GENERADO por tools/gen_castle.py (que comprueba
// con solucionadores que todas las pruebas tienen solución). No editar a mano.
export const map = [
{rows_js},
];

export const entities = [
{ents_js},
];
""")
print('  escrito src/data/zones/castle_gen.js')

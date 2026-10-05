# New Rol

Aventura de acción 3D low-poly para el navegador, inspirada en los Zelda clásicos.
Hecha con **Three.js**, sin assets externos: modelos, animaciones, música y efectos
de sonido se generan por código.

**▶ Jugar:** https://narcimarquez-eng.github.io/new-rol/

> Fases completadas: **1** (motor, Aldea Inicial, Bosque Encantado) y **2** (renovación gráfica y Cuevas Heladas).
> Próximas fases: Desierto Perdido y Castillo Final.

## Controles

| Acción | Teclado y ratón | Móvil |
|---|---|---|
| Moverse | WASD / flechas | Joystick izquierdo |
| Cámara | Ratón (clic en el juego para capturarlo), rueda = zoom | Arrastrar en la pantalla |
| Atacar (combo de 3) | Clic izquierdo / F | ⚔️ |
| Bloquear con escudo | Clic derecho (mantener) / R | 🛡️ |
| Esquivar (voltereta) | Espacio | 💨 |
| Correr | Mayús | Empujar el joystick a fondo |
| Hablar / abrir / leer | E / Enter | E |
| Beber poción | Q | 🧪 |
| Menú (inventario, misiones, mapa) | Tab / I | ☰ |
| Pausa | Esc / P | ☰ |

## Cómo se juega

- **Vida** en corazones (se pierde de medio en medio). Recupérala con corazones que
  sueltan enemigos y arbustos, con pociones o en la Fuente de las Hadas.
- **Resistencia** (barra verde): atacar, esquivar, correr y bloquear golpes la gastan.
  Si se vacía, quedas agotado unos segundos.
- Los trasgos **brillan en amarillo** justo antes de atacar: ese es el momento de
  bloquear o esquivar.
- Corta **arbustos** con la espada: a veces esconden monedas o corazones.
- Algunos árboles y setos **no son sólidos**… busca pasadizos secretos.
- El **minimapa** se va descubriendo a medida que exploras.
- La partida se **guarda automáticamente** (al cambiar de zona, abrir puertas,
  completar misiones y cada 30 s).
- Sobre el **hielo** resbalas en línea recta hasta chocar con algo. Los **bloques de
  hielo** se empujan caminando contra ellos y también se deslizan. Si un bloque se
  atasca, toca la **piedra rúnica** para devolverlo a su sitio.
- Algunos enemigos de las cuevas **congelan**: te ralentizan unos segundos.
- Los proyectiles se pueden **bloquear con el escudo** o **romper con la espada**.

### Contenido de la Fase 1

- **Aldea Inicial**: tutorial con el Anciano Bruno, tienda de pociones, 3 misiones
  secundarias (El gato perdido, Recado del herrero, Plaga de limos), un jardín cerrado
  con llave, un escondite secreto y el Prado Sur con limos, murciélagos y plantas.
- **Bosque Encantado**: bosque con claros y secretos, un laberinto de setos, el mini-jefe
  **Rey Trasgo** (2 fases), la **Llave del Bosque**, 3 misiones secundarias
  (Cazadora de trasgos, El hacha perdida, Luces del bosque) y la Fuente de las Hadas.

- **Cuevas Heladas**: campamento de Olaf, lago helado (puzle deslizante), sala de los
  bloques (empujar un bloque hasta la placa rúnica), sala secreta, valle de los lobos,
  refugio de Sven y el mini-jefe **Golem de Hielo** (2 fases: golpes, ondas de choque,
  rocas lanzadas y refuerzos). Recompensa: la **Llave de Fuego**, que derrite el muro
  del norte. 3 misiones (Sopa caliente, Lobos hambrientos, Cristales de escarcha) y una
  más para el herrero de la aldea (Mineral de las cuevas → Espada de acero).

### Gráficos

Todo se genera por código en Three.js (sin modelos externos), con un estilo de
dibujo animado:

- personajes "chibi" con caras pintadas que parpadean y contornos de tinta;
- hierba instanciada que se mece con el viento y se aparta al pasar;
- árboles y arbustos con balanceo, rocas y acantilados deformados con ruido;
- terreno con mezcla suave de colores y oclusión ambiental horneada junto a los muros;
- agua con espuma en la orilla, hielo brillante con grietas, nieve y cristales luminosos;
- post-procesado: oclusión ambiental (GTAO), bloom, etalonaje por zona y viñeta;
- calidad adaptativa: si los FPS bajan, se desactivan efectos automáticamente
  (`?low` fuerza la calidad baja).

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # compila a dist/
npm test           # test end-to-end en Chromium headless (Playwright): Fases 1 y 2 completas
node tests/data.mjs  # validación de los datos de las zonas
node tests/caves-quick.mjs   # traza rápida del puzle de bloques de las cuevas
node tests/shots.mjs '[{"zone":"caves","c":22,"r":45}]'   # capturas para revisión visual
python3 tools/genmaps.py caves   # regenera el mapa de las cuevas y verifica los puzles
```

Parámetros de URL útiles: `?low` (calidad baja), `?god` (invulnerable, para pruebas).

### Arquitectura

```
src/
  core/      Game (bucle y modos), Renderer (post-procesado), Input, Audio, Save
  gfx/       ModelKit (geometría suave, contornos, caras pintadas, viento)
  world/     Zone (construye una zona desde datos), Terrain, Collision, Props, Sky, tiles
  entities/  Player, Enemy (IA + jefes), EnemyModels, CharacterModel (animación procedural),
             Interactables (NPCs, cofres, puertas, bloques de hielo, placas...)
  systems/   Combat, Projectiles, CameraController, Particles, Progress (inventario/misiones)
  ui/        UI (HUD, diálogos, tienda, menús, minimapa), Touch
  data/      items, enemies, quests, story, zones/*  ← todo el contenido del juego
tools/genmaps.py   generador de mapas ASCII con comprobación de conectividad y
                   solucionador de puzles de hielo (garantiza solución y que no haya atascos)
tests/             e2e.mjs (Playwright) y data.mjs (validación de datos)
```

**Data-driven:** cada zona es un archivo en `src/data/zones/` con su mapa ASCII
(leyenda en `src/world/tiles.js`), paleta de colores, música generativa, niebla,
dificultad y lista de entidades (NPCs con diálogos, enemigos, cofres, puertas con
llave, portales, antorchas…). Para añadir una zona nueva basta con crear su archivo y
registrarlo en `src/data/zones/index.js`; el motor no necesita cambios.

### Por qué Three.js directamente (y no Blender)

Blender brilla cuando un artista modela y anima a mano. Aquí todo el contenido se
genera por código y por datos, así que la calidad visual depende de las técnicas de
render (contornos, viento, oclusión, etalonaje) y de unos modelos procedurales bien
diseñados, no de la herramienta. Mantenerlo todo en Three.js deja el juego ligero
(carga en ~2 s), sin archivos binarios pesados y fácil de ampliar con nuevas zonas.

### Despliegue

El workflow `.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada
push a `main`. Hay que activarlo una vez en **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

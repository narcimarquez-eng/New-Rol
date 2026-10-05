# New Rol

Aventura de acción 3D low-poly para el navegador, inspirada en los Zelda clásicos.
Hecha con **Three.js**, sin assets externos: modelos, animaciones, música y efectos
de sonido se generan por código.

**▶ Jugar:** https://narcimarquez-eng.github.io/new-rol/

> Fase 1 (actual): motor base, Aldea Inicial y Bosque Encantado.
> Próximas fases: Cuevas Heladas, Desierto Perdido y Castillo Final.

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

### Contenido de la Fase 1

- **Aldea Inicial**: tutorial con el Anciano Bruno, tienda de pociones, 3 misiones
  secundarias (El gato perdido, Recado del herrero, Plaga de limos), un jardín cerrado
  con llave, un escondite secreto y el Prado Sur con limos, murciélagos y plantas.
- **Bosque Encantado**: bosque con claros y secretos, un laberinto de setos, el mini-jefe
  **Rey Trasgo** (2 fases), la **Llave del Bosque**, 3 misiones secundarias
  (Cazadora de trasgos, El hacha perdida, Luces del bosque) y la Fuente de las Hadas.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # compila a dist/
npm test           # test end-to-end en Chromium headless (Playwright)
node tests/data.mjs  # validación de los datos de las zonas
```

Parámetros de URL útiles: `?low` (calidad baja), `?god` (invulnerable, para pruebas).

### Arquitectura

```
src/
  core/      Game (bucle y modos), Renderer (post-procesado), Input, Audio, Save
  world/     Zone (construye una zona desde datos), Terrain, Collision, Props, Sky, tiles
  entities/  Player, Enemy (IA + jefe), CharacterModel (animación procedural), Interactables
  systems/   Combat, CameraController, Particles, Progress (inventario/misiones)
  ui/        UI (HUD, diálogos, tienda, menús, minimapa), Touch
  data/      items, enemies, quests, story, zones/*  ← todo el contenido del juego
tools/genmaps.py   generador de mapas ASCII con comprobación de conectividad
tests/             e2e.mjs (Playwright) y data.mjs (validación de datos)
```

**Data-driven:** cada zona es un archivo en `src/data/zones/` con su mapa ASCII
(leyenda en `src/world/tiles.js`), paleta de colores, música generativa, niebla,
dificultad y lista de entidades (NPCs con diálogos, enemigos, cofres, puertas con
llave, portales, antorchas…). Para añadir una zona nueva basta con crear su archivo y
registrarlo en `src/data/zones/index.js`; el motor no necesita cambios.

### Despliegue

El workflow `.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada
push a `main`. Hay que activarlo una vez en **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

# New Rol

Aventura de acción 3D para el navegador, inspirada en los Zelda clásicos.
Hecha con **Three.js**: escenarios, árboles, montañas, música y efectos de sonido se
generan por código. Los personajes (héroe, compañeros y esqueletos) son los packs
libres **KayKit** con sus animaciones, y unas pocas texturas de corteza, hojas, césped
y tierra también vienen de fuera (todo libre, ver [Créditos](#créditos)).

**▶ Jugar:** https://narcimarquez-eng.github.io/new-rol/

> **Juego completo**: Fase **1** (motor, Aldea Inicial, Bosque Encantado), **2** (Cuevas Heladas),
> **3** (Desierto Perdido, héroe animado y compañeros) y **4** (pruebas mágicas, tres
> santuarios y el **Castillo Final** con el jefe Malakar).
> Estilo visual realista (PBR) por defecto; añade `?toon` a la URL para el estilo ilustrado.

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
- **Compañeros**: Kael el Encapuchado y Borg el Bárbaro se unen al grupo en el desierto.
  Te siguen por todas las zonas y atacan solos a los enemigos que se te acercan.
- En el desierto, los **esqueletos guerreros** paran los golpes de frente con el escudo:
  el tercer golpe del combo rompe su guardia. Los **esqueletos enterrados** se levantan
  de la arena al acercarte, y el aguijón de los **escorpiones** envenena (la poción lo cura).
- Las **tormentas de arena** llegan cada poco: casi no se ve, el viento frena si caminas
  contra él… y los enemigos tampoco te ven bien ni aciertan sus disparos.

### Pruebas mágicas

- **Braseros y fuego**: acerca la espada a una llama (E) y arderá unos segundos. Con ella
  enciendes braseros apagados (E o un espadazo). Los braseros encendidos también prenden la
  espada, así que puedes encadenar llamas. Algunos grupos se **apagan solos** al poco
  tiempo: hay que encenderlos todos a la vez.
- **Rayo de sol**: un ídolo dispara un rayo de luz que viaja en línea recta. Los
  **espejos** giran con E y lo desvían 90°; los muros, columnas, bloques y puertas lo
  cortan. Cuando llega al **cristal solar**, algo se abre. Los espejos de bronce oscuro
  no se mueven.
- **Cristales de cambio**: golpéalos (o pulsa E) y las **barreras rojas y azules** se
  alternan. Nunca están levantadas las dos a la vez.
- **Runas**: la tablilla muestra una secuencia de símbolos (al leerla, las losas destellan
  en orden). Písalas en ese orden; un paso en falso las apaga todas.
- **Bloques de piedra**: como los de hielo, se empujan caminando contra ellos y se quedan
  fijos sobre su placa. La piedra rúnica los devuelve a su sitio.

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

### Contenido de la Fase 3

- **Nuevo héroe**: el explorador rubio de túnica verde (personaje KayKit) con 49
  animaciones reales compartidas: combo de tres tajos, voltereta, bloqueo, golpes,
  muerte y celebración. Encima, una capa dinámica: transiciones suaves por peso, pasos
  sincronizados con la velocidad, inclinación en giros y arranques, y la cabeza que
  sigue al enemigo más cercano o a quien te habla.
- **Desierto Perdido**: dunas, oasis con palmeras y el campamento de Borg, ruinas del
  oeste (Llave del Sol y una cámara tras un muro falso), dunas del este con cactus y
  escorpiones, el cañón de los hechiceros y el **Templo del Sol**, donde el
  **Rey de las Arenas** (jefe de 2 fases que levanta esqueletos de la arena) guarda la
  **Llave del Castillo**.
- 5 tipos de enemigo: escorpión, esqueleto guerrero (escudo), ballestero, hechicero
  (orbes de tres en tres) y esqueleto enterrado.
- 4 misiones: Huesos en la arena (Borg se une al grupo), Plaga de escorpiones,
  El amuleto de la familia y Fragmentos de sol. Personajes: Kael, Borg, el mercader
  Zahir y los caballeros Sir Aldric y Sir Cedric.

### Contenido de la Fase 4

- **Tres santuarios** (zonas nuevas con dos pruebas mágicas cada una). Su emblema es
  necesario para llegar al jefe de su zona:
  - **Santuario de las Luciérnagas** (claro del este del bosque): braseros con tiempo y
    runas. Abre la verja del laberinto junto a la Llave del Laberinto.
  - **Santuario de Cristal** (sala del este de las cuevas): laberinto de barreras rojas y
    azules y dos bloques de piedra. Abre la reja de la caverna del Golem.
  - **Santuario del Sol** (cañón del desierto): braseros en cadena y espejos que guían el
    rayo de sol. Abre el Templo del Sol junto a la Llave del Sol.
- **Castillo Final**: campamento ante el foso, puente, patio de armas, jardín y cuarteles.
  - **Ala del Cristal**: barreras rojas y azules y dos bloques → **Sello del Cristal**.
  - **Torre de la Luz** (biblioteca): espejos y rayo → **Sello de la Luz**.
  - **Ala de la Llama**: cuatro braseros con tiempo y seis runas → **Sello de la Llama**.
  - **Cripta**: esqueletos enterrados, un bloque que abre la cámara del tomo y una sala secreta.
  - La **Gran Puerta** se abre con los tres sellos. En la sala del trono espera
    **Malakar, el Rey Sombrío**, el jefe final:
    1. espada, pisotón y hechizos;
    2. se envuelve en un **escudo de sombras** que para todos los golpes: hay que romper los
       cuatro **cristales oscuros** de la sala y, al caer el escudo, queda aturdido;
    3. furia final, con cargas, ráfagas de cinco orbes y refuerzos.

    Al vencerle, el balcón del trono da paso al final del juego.
  - Enemigos: caballero oscuro (escudo), hechicero oscuro, esqueleto pícaro, bruto acorazado
    y los esqueletos de la cripta.
  - **Compañeros**: Sir Aldric se une ante el puente; Sir Cedric, al recuperar los
    estandartes del reino. El grupo completo son cinco héroes.
  - 3 misiones: Los estandartes del reino, Caballeros caídos y El tomo de los sellos.
- Los mapas de santuarios y castillo los generan `tools/gen_shrines.py` y
  `tools/gen_castle.py`, que **comprueban con solucionadores** que cada prueba tiene solución
  (y que no viene resuelta) y sacan la secuencia de movimientos que usan los tests.

### Gráficos

Hay dos estilos visuales con el mismo juego por debajo:

**Realista (por defecto)**, renderizado físico (PBR) al estilo de las demos de
paisajes de Three.js:

- cielo físico con dispersión atmosférica (Rayleigh/Mie) y nubes procedurales;
  la luz ambiental y los reflejos se calculan a partir de ese mismo cielo (IBL con PMREM);
- sol direccional alineado con el cielo, sombras de 4096 px y tone mapping ACES;
- niebla de distancia con el color real del horizonte (se mide al cargar la zona),
  así el valle se funde con el cielo y las montañas lejanas se ven azuladas;
- cordilleras de 1,4 km alrededor del mapa con ruido de crestas: prados y bosque
  abajo, roca en las laderas y nieve por encima de la cota;
- árboles procedurales [ez-tree](https://github.com/dgreenheck/ez-tree) instanciados
  (robles, cerezos, pinos, arbustos y setos), con corteza PBR, hojas recortadas
  que proyectan sombra y balanceo con el viento;
- terreno con 4 capas texturizadas (césped, tierra, adoquines, nieve) y materiales
  triplanares para rocas, acantilados, madera, yeso y tejas;
- roca procedural con lajas facetadas, fracturas y estratos (sin texturas externas);
- hielo del lago con barniz que refleja el cielo, escarcha, burbujas y grietas;
- fuego de sombreador (llama animada con ruido y chispas que suben) en antorchas y hogueras;
- agua con reflejos planos y oleaje; post-procesado con GTAO, bloom y etalonaje.

**Ilustrado** (`?toon`), el estilo de dibujo animado de las primeras fases: personajes
con caras pintadas y contornos de tinta, árboles low-poly y colores planos. Es mucho
más ligero y es el que usan los tests de lógica.

En los dos: hierba instanciada que se mece y se aparta al pasar, calidad adaptativa
(si los FPS bajan se desactivan efectos) y `?low` para forzar la calidad baja.

Desierto: arena con ondulaciones de viento, losas de arenisca, tierra agrietada, dunas en
el propio terreno, mesetas escalonadas al fondo, palmeras, cactus, ruinas y columnas, todo
procedural.

Los personajes son los modelos estilizados KayKit (low-poly con esqueleto y animaciones).
Para personajes realistas harían falta modelos 3D hechos por un artista (o de una
librería como Mixamo); el sistema de animación ya está preparado para cambiarlos.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # compila a dist/
npm test           # test end-to-end en Chromium headless (Playwright): el juego completo (estilo ?toon)
node tests/real-smoke.mjs    # prueba de humo del estilo realista: todas las zonas, sin errores
python3 tools/gen_shrines.py  # genera y verifica los santuarios (acertijos con solución)
python3 tools/gen_castle.py   # genera y verifica el Castillo Final
node tools/build-characters.mjs   # regenera los personajes KayKit optimizados (descarga los packs)
python3 tools/gen_desert.py --check   # comprueba que todo el desierto es alcanzable
node tests/data.mjs  # validación de los datos de las zonas
node tests/caves-quick.mjs   # traza rápida del puzle de bloques de las cuevas
node tests/shots.mjs '[{"zone":"caves","c":22,"r":45}]'   # capturas para revisión visual
python3 tools/genmaps.py caves   # regenera el mapa de las cuevas y verifica los puzles
```

Parámetros de URL útiles: `?toon` (estilo ilustrado), `?low` (calidad baja),
`?god` (invulnerable, para pruebas).

### Arquitectura

```
src/
  core/      Game (bucle y modos), Renderer (post-procesado), Input, Audio, Save
  gfx/       ModelKit (geometría suave, contornos, caras pintadas, viento),
             Environment (cielo físico, IBL, agua), Backdrop (montañas), Vegetation (ez-tree),
             Materials (triplanar, terreno por capas), Textures (carga y texturas procedurales)
  vendor/    ez-tree (generador de árboles, MIT)
  world/     Zone (construye una zona desde datos), Terrain, Collision, Props, Sky, tiles
  entities/  Player, Enemy (IA + jefes), EnemyModels, CharacterModel (animación procedural),
             Interactables (NPCs, cofres, puertas, bloques de hielo, placas...)
  systems/   Combat, Projectiles, CameraController, Particles, Progress (inventario/misiones)
  ui/        UI (HUD, diálogos, tienda, menús, minimapa), Touch
  data/      items, enemies, quests, story, zones/*  ← todo el contenido del juego
tools/genmaps.py   generador de mapas ASCII con comprobación de conectividad y
                   solucionador de puzles de hielo (garantiza solución y que no haya atascos)
tests/             e2e.mjs (Playwright), real-smoke.mjs (estilo realista) y data.mjs (validación de datos)
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
(unos 3 MB de texturas en total), sin archivos binarios pesados y fácil de ampliar
con nuevas zonas.

### Despliegue

El workflow `.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada
push a `main`. Hay que activarlo una vez en **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

## Créditos

- Generador de árboles **ez-tree** de Daniel Greenheck (MIT), copiado en `src/vendor/ez-tree/`.
  Del mismo paquete salen las texturas de hojas, corteza (que ez-tree toma de
  [Poly Haven](https://polyhaven.com) y [TextureCan](https://www.texturecan.com), CC0),
  césped y tierra de `public/assets/`.
- `waternormals.jpg` y los objetos `Sky` y `Water` de los ejemplos de
  [Three.js](https://threejs.org) (MIT).
- Personajes y armas: packs **KayKit Adventurers** y **KayKit Skeletons** de
  [Kay Lousberg](https://www.kaylousberg.com) (CC0), optimizados con
  `tools/build-characters.mjs` (modelos sin animaciones + un archivo de animaciones compartido).
- Todo lo demás (escenarios, texturas de adoquín, yeso, madera, tejas, roca, nieve, arena
  y arenisca, música y sonido) se genera por código en este repositorio.

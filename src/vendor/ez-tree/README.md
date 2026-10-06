# ez-tree (vendorizado)

Generador procedural de árboles de Daniel Greenheck — https://github.com/dgreenheck/ez-tree
Licencia MIT (ver LICENSE). Copia de `src/lib` de la versión 1.1.0 con dos cambios:
`textures.js` y `trellis.js` son versiones mínimas, porque el juego crea sus propios
materiales PBR instanciados con viento (src/gfx/Vegetation.js) y carga las texturas
desde `public/assets/`.

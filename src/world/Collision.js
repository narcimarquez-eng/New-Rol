// Colisiones 2D (plano XZ) contra la rejilla de casillas y colliders dinámicos.
// El jugador y los enemigos son círculos; casas, puertas, cofres son cajas AABB.
import { TILE, tileInfo } from './tiles.js';

export class Collision {
  constructor(zone) {
    this.zone = zone;
    this.W = zone.W; this.H = zone.H;
    this.originX = -this.W * TILE / 2; this.originZ = -this.H * TILE / 2;
    // estado de solidez por casilla (puede cambiar: arbustos cortados)
    this.solid = new Array(this.W * this.H);
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
      const t = tileInfo(zone.charAt(c, r));
      // los muros de roca (estilo 'rock') son más altos que los setos
      const h = t.prop === 'wall' && zone.data.wallStyle === 'rock' ? 8.5 : t.height || 5;
      this.solid[r * this.W + c] = t.solid ? { kind: t.solid, radius: t.radius || 0, tall: !!t.tall, height: h } : null;
    }
    this.colliders = new Set(); // {type:'box'|'circle', ..., tall, enabled}
  }

  tileOf(x, z) { return [Math.floor((x - this.originX) / TILE), Math.floor((z - this.originZ) / TILE)]; }
  tileCenter(c, r) { return [this.originX + (c + 0.5) * TILE, this.originZ + (r + 0.5) * TILE]; }

  getSolid(c, r) {
    if (c < 0 || r < 0 || c >= this.W || r >= this.H) return { kind: 'box', tall: true };
    return this.solid[r * this.W + c];
  }
  clearTile(c, r) { if (c >= 0 && r >= 0 && c < this.W && r < this.H) this.solid[r * this.W + c] = null; }

  /** cameraOnly: bloquea la cámara pero no a los personajes (p. ej. arcos de portal). */
  addBox(cx, cz, w, d, { tall = true, tag, height = 6, cameraOnly = false } = {}) {
    const b = { type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, tall, enabled: true, tag, height, cameraOnly };
    this.colliders.add(b); return b;
  }
  addCircle(x, z, r, { tall = false, tag, height = 3 } = {}) {
    const c = { type: 'circle', x, z, r, tall, enabled: true, tag, height };
    this.colliders.add(c); return c;
  }
  remove(col) { this.colliders.delete(col); }

  /** Empuja un círculo fuera de los obstáculos. Modifica pos {x,z}. Devuelve true si chocó. */
  resolve(pos, radius, ignore) {
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      const [tc, tr] = this.tileOf(pos.x, pos.z);
      for (let r = tr - 1; r <= tr + 1; r++) {
        for (let c = tc - 1; c <= tc + 1; c++) {
          const s = this.getSolid(c, r);
          if (!s) continue;
          const [cx, cz] = this.tileCenter(c, r);
          if (s.kind === 'circle') {
            if (pushCircle(pos, radius, cx, cz, s.radius)) moved = true;
          } else if (pushBox(pos, radius, cx - TILE / 2, cx + TILE / 2, cz - TILE / 2, cz + TILE / 2)) moved = true;
        }
      }
      for (const col of this.colliders) {
        if (!col.enabled || col === ignore || col.cameraOnly) continue;
        if (col.type === 'box') { if (pushBox(pos, radius, col.minX, col.maxX, col.minZ, col.maxZ)) moved = true; }
        else if (pushCircle(pos, radius, col.x, col.z, col.r)) moved = true;
      }
      if (!moved) break;
      hit = true;
    }
    return hit;
  }

  /** ¿Está el punto dentro de algún obstáculo (con margen)? */
  blocked(x, z, radius = 0) {
    const p = { x, z };
    const before = { x, z };
    this.resolve(p, Math.max(radius, 0.01));
    return Math.hypot(p.x - before.x, p.z - before.z) > 1e-4;
  }

  /** ¿Bloquea la vista (casilla alta / collider alto) el punto? y = altura opcional. */
  blocksView(x, z, y = 0) {
    const [c, r] = this.tileOf(x, z);
    const s = this.getSolid(c, r);
    if (s && s.tall && y < (s.height || 99)) {
      if (s.kind === 'box') return true;
      const [cx, cz] = this.tileCenter(c, r);
      if (Math.hypot(x - cx, z - cz) < s.radius * 0.8) return true;
    }
    for (const col of this.colliders) {
      if (!col.enabled || !col.tall || y > col.height) continue;
      if (col.type === 'box') { if (x > col.minX && x < col.maxX && z > col.minZ && z < col.maxZ) return true; }
      else if (Math.hypot(x - col.x, z - col.z) < col.r) return true;
    }
    return false;
  }

  /** Línea de visión entre dos puntos (muestreo cada 0.5u). */
  lineOfSight(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.blocksView(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
}

function pushCircle(pos, r, cx, cz, cr) {
  const dx = pos.x - cx, dz = pos.z - cz;
  const d = Math.hypot(dx, dz), min = r + cr;
  if (d >= min) return false;
  if (d < 1e-5) { pos.x += min; return true; }
  pos.x = cx + (dx / d) * min; pos.z = cz + (dz / d) * min;
  return true;
}

function pushBox(pos, r, minX, maxX, minZ, maxZ) {
  const nx = Math.max(minX, Math.min(pos.x, maxX));
  const nz = Math.max(minZ, Math.min(pos.z, maxZ));
  const dx = pos.x - nx, dz = pos.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    pos.x = nx + (dx / d) * r; pos.z = nz + (dz / d) * r;
  } else {
    // centro dentro de la caja: salir por el lado más cercano
    const l = pos.x - minX, rr = maxX - pos.x, t = pos.z - minZ, b = maxZ - pos.z;
    const m = Math.min(l, rr, t, b);
    if (m === l) pos.x = minX - r; else if (m === rr) pos.x = maxX + r;
    else if (m === t) pos.z = minZ - r; else pos.z = maxZ + r;
  }
  return true;
}

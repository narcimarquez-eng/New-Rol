// Proyectiles de enemigos (fragmentos de hielo, rocas lanzadas en arco).
// Se bloquean con el escudo, se destruyen con la espada y al chocar con muros.
import * as THREE from 'three';

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.geo = new THREE.OctahedronGeometry(1, 0);
  }

  spawn(o) {
    // las flechas son finas, largas y no brillan; la magia y el hielo sí
    const color = new THREE.Color(o.color).multiplyScalar(o.heavy || o.arrow ? 1 : 2.2);
    const mat = o.arrow ? new THREE.MeshStandardMaterial({ color, roughness: 0.7 }) : new THREE.MeshBasicMaterial({ color, toneMapped: o.heavy });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.scale.set(o.size, o.size * (o.heavy ? 1 : o.arrow ? 9 : 1.8), o.size);
    mesh.castShadow = true;
    mesh.position.set(o.x, o.y, o.z);
    this.game.scene.add(mesh);
    this.list.push({ ...o, mesh, life: 4, px: o.x, pz: o.z });
  }

  /** La espada destruye proyectiles en su arco. */
  slash(test) {
    for (const p of this.list) {
      if (p.dead || !test(p.x, p.z, p.size)) continue;
      p.dead = true;
      this.burst(p);
      this.game.audio.sfx('block');
    }
  }

  burst(p) {
    this.game.particles.burst(p.x, p.y, p.z, { count: p.heavy ? 24 : 12, color: p.color, speed: p.heavy ? 7 : 4, up: 3, life: 0.5, size: p.heavy ? 1.6 : 0.9 });
    if (p.heavy) { this.game.shake(0.3); this.game.audio.sfx('kill'); }
  }

  update(dt) {
    const g = this.game, pl = g.player, zone = g.zone;
    for (const p of this.list) {
      if (p.dead) continue;
      p.life -= dt;
      p.px = p.x; p.pz = p.z;
      p.vy -= (p.gravity || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y += dt * 8;
      p.mesh.lookAt(p.x + p.vx, p.y + p.vy * 0.2, p.z + p.vz);
      p.mesh.rotateX(Math.PI / 2);
      if (!p.arrow && Math.random() < 0.5) g.particles.spawn(p.x, p.y, p.z, { color: p.color, size: 0.4, life: 0.3, gravity: 0 });
      const ground = zone.height(p.x, p.z);
      const hitWall = zone.collision.blocksView(p.x, p.z, p.y - ground);
      // impacto con el jugador
      const dy = p.y - (pl.pos.y + 1);
      if (Math.hypot(pl.x - p.x, pl.z - p.z) < 0.7 + p.size && Math.abs(dy) < 1.4) {
        const r = pl.takeDamage(p.dmg, p.px - p.vx, p.pz - p.vz, p.heavy ? 10 : 5);
        if (r === 'hit' && p.freeze) pl.chill(p.freeze);
        if (r === 'hit' && p.poison) pl.poison(p.poison);
        if (r !== 'ignored') { p.dead = true; this.burst(p); continue; }
      }
      if (p.heavy && p.y <= ground + 0.3) {
        p.dead = true;
        this.burst(p);
        if (Math.hypot(pl.x - p.x, pl.z - p.z) < 2.2) pl.takeDamage(p.dmg, p.x, p.z, 9);
        continue;
      }
      if (hitWall || p.life <= 0 || p.y < ground - 0.5) { p.dead = true; this.burst(p); }
    }
    this.list = this.list.filter((p) => {
      if (p.dead) { g.scene.remove(p.mesh); p.mesh.material.dispose(); return false; }
      return true;
    });
  }

  clear() {
    for (const p of this.list) { this.game.scene.remove(p.mesh); p.mesh.material.dispose(); }
    this.list = [];
  }
}

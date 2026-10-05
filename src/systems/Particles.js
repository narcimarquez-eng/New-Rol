// Sistema de partículas con pool fijo sobre una InstancedMesh (1 draw call).
// Se usa para impactos de espada, magia, recolección, muerte de enemigos, cofres...
import * as THREE from 'three';

const MAX = 900;

export class Particles {
  constructor(scene) {
    const geo = new THREE.OctahedronGeometry(0.12, 0);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = [];
    for (let i = 0; i < MAX; i++) this.p.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, g: 0, color: new THREE.Color(), drag: 0, spin: 0 });
    this.cursor = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this._s = new THREE.Vector3(); this._v = new THREE.Vector3();
  }

  spawn(x, y, z, o = {}) {
    const p = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life || 0.8;
    p.size = o.size || 1;
    p.g = o.gravity ?? 9;
    p.drag = o.drag ?? 1;
    p.spin = Math.random() * 6;
    p.color.set(o.color ?? 0xffffff);
    return p;
  }

  /** Explosión radial. */
  burst(x, y, z, { count = 16, color = 0xffffff, colors, speed = 5, up = 3, life = 0.7, size = 1, gravity = 9, spread = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      const c = colors ? colors[i % colors.length] : color;
      this.spawn(x, y, z, {
        vx: Math.cos(a) * s * spread, vz: Math.sin(a) * s * spread, vy: up * (0.5 + Math.random()),
        life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color: c, gravity,
      });
    }
  }

  /** Chispas de impacto de espada. */
  hit(x, y, z, color = 0xfff2a8) {
    this.burst(x, y, z, { count: 14, color, speed: 7, up: 2.5, life: 0.35, size: 0.8, gravity: 4 });
    this.burst(x, y, z, { count: 6, color: 0xffffff, speed: 3, up: 1, life: 0.2, size: 1.6, gravity: 0 });
  }

  /** Columna mágica ascendente (cofres, objetos). */
  sparkle(x, y, z, { color = 0xfff1a0, count = 30, radius = 0.8, life = 1.4 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.spawn(x + Math.cos(a) * r, y + Math.random() * 0.5, z + Math.sin(a) * r, {
        vx: Math.cos(a) * 0.4, vz: Math.sin(a) * 0.4, vy: 1.5 + Math.random() * 2.5,
        life: life * (0.5 + Math.random() * 0.7), size: 0.5 + Math.random() * 0.8, color, gravity: -0.5, drag: 0.5,
      });
    }
  }

  /** Nube de humo/polvo (muerte de enemigo, voltereta). */
  puff(x, y, z, { color = 0xdddddd, count = 10, size = 2.2, life = 0.6 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, y, z, { vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 0.8 + Math.random(), life, size: size * (0.6 + Math.random() * 0.5), color, gravity: -0.5, drag: 3 });
    }
  }

  update(dt) {
    let n = 0;
    const m = this._m, q = this._q, e = this._e, s = this._s, v = this._v;
    for (const p of this.p) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.spin += dt * 5;
      const k = p.life / p.max;
      const sc = p.size * (k < 0.3 ? k / 0.3 : 1);
      e.set(p.spin, p.spin * 0.7, 0); q.setFromEuler(e);
      s.set(sc, sc, sc); v.set(p.x, p.y, p.z);
      m.compose(v, q, s);
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() { for (const p of this.p) p.alive = false; this.mesh.count = 0; }
}

// Tormentas de arena periódicas (datos de zona: sandstorm { first, every, duration, warn }).
// Durante la tormenta: la niebla se espesa y se vuelve color arena, el sol se apaga,
// el viento arrastra polvo y rayas de arena, suena el viento y:
//  - los enemigos ven la mitad de lejos (y los ballesteros apuntan peor);
//  - caminar contra el viento cuesta más.
import * as THREE from 'three';

const SAND = new THREE.Color(0xc9a46c);

function dustTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sandstorm {
  constructor(game) {
    this.game = game;
    this.level = 0;
    this.cfg = null;
    this.windDir = new THREE.Vector2(1, 0.35).normalize();
    // polvo (puntos grandes y suaves) y rayas de arena alrededor de la cámara
    const N = 1400;
    this.box = new THREE.Vector3(60, 14, 60);
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * this.box.x; pos[i * 3 + 1] = Math.random() * this.box.y; pos[i * 3 + 2] = (Math.random() - 0.5) * this.box.z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ map: dustTexture(), color: 0xd8b483, size: 1.6, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.dust.frustumCulled = false;
    const M = 500;
    const lp = new Float32Array(M * 6);
    this.streakBase = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) { this.streakBase[i * 3] = (Math.random() - 0.5) * 40; this.streakBase[i * 3 + 1] = Math.random() * 6; this.streakBase[i * 3 + 2] = (Math.random() - 0.5) * 40; }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    this.streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xe8cc98, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.streaks.frustumCulled = false;
    // cúpula del color de la tormenta: tapa el cielo físico (que no recibe niebla)
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(260, 24, 12), new THREE.MeshBasicMaterial({ color: SAND, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    this.group = new THREE.Group();
    this.group.add(this.dome, this.dust, this.streaks);
    this.group.visible = false;
    game.scene.add(this.group);
  }

  /** Al cargar una zona: memoriza la niebla y la luz base. */
  reset(zone) {
    this.cfg = zone.data.sandstorm || null;
    this.level = 0;
    this.t = this.cfg ? -(this.cfg.first ?? this.cfg.every) : 0;
    this.warned = false;
    const fog = this.game.scene.fog;
    this.base = {
      density: fog?.density, near: fog?.near, far: fog?.far, color: fog ? fog.color.clone() : new THREE.Color(),
      sun: this.game.sun.intensity, env: this.game.scene.environmentIntensity,
    };
    this.group.visible = false;
    this.game.audio.wind(0);
    this.apply();
  }

  get active() { return this.level > 0.35; }

  /** Fuerza una tormenta ya (para pruebas o eventos). */
  start() { if (this.cfg) { this.t = 0.01; this.warned = true; } }

  update(dt) {
    const c = this.cfg;
    if (!c) return;
    const g = this.game;
    this.t += dt;
    let target = 0;
    if (this.t >= 0) {
      if (this.t < c.duration) target = Math.min(1, this.t / 3) * Math.min(1, (c.duration - this.t) / 4);
      else { this.t = -c.every; this.warned = false; }
    } else if (!this.warned && this.t > -c.warn) {
      this.warned = true;
      g.ui.toast('El viento se levanta... ¡se acerca una tormenta de arena!');
    }
    this.level += (target - this.level) * (1 - Math.exp(-dt * 2));
    if (this.level < 0.003 && target === 0) this.level = 0;
    this.apply();
    g.audio.wind(this.level);
    this.group.visible = this.level > 0.01;
    if (!this.group.visible) return;
    // partículas alrededor de la cámara, arrastradas por el viento
    const cam = g.camera.position;
    const w = this.windDir, sp = 14 + this.level * 10;
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + w.x * sp * dt * (0.7 + (i % 7) * 0.08), y = pos.getY(i) + Math.sin(g.time * 2 + i) * dt * 0.6, z = pos.getZ(i) + w.y * sp * dt;
      const hx = this.box.x / 2, hz = this.box.z / 2;
      if (x > hx) x -= this.box.x; if (x < -hx) x += this.box.x;
      if (z > hz) z -= this.box.z; if (z < -hz) z += this.box.z;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    this.dust.position.set(cam.x, g.zone.height(cam.x, cam.z) - 1, cam.z);
    this.dust.material.opacity = this.level * 0.42;
    const lp = this.streaks.geometry.attributes.position, b = this.streakBase;
    for (let i = 0; i < lp.count / 2; i++) {
      b[i * 3] += w.x * (sp * 2.2) * dt; b[i * 3 + 2] += w.y * (sp * 2.2) * dt;
      if (b[i * 3] > 20) b[i * 3] -= 40; if (b[i * 3] < -20) b[i * 3] += 40;
      if (b[i * 3 + 2] > 20) b[i * 3 + 2] -= 40; if (b[i * 3 + 2] < -20) b[i * 3 + 2] += 40;
      const L = 0.8 + (i % 5) * 0.3;
      lp.setXYZ(i * 2, b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
      lp.setXYZ(i * 2 + 1, b[i * 3] + w.x * L, b[i * 3 + 1], b[i * 3 + 2] + w.y * L);
    }
    lp.needsUpdate = true;
    this.streaks.position.set(cam.x, g.zone.height(cam.x, cam.z), cam.z);
    this.streaks.material.opacity = this.level * 0.5;
    this.dome.position.copy(cam);
    this.dome.material.color.copy(g.scene.fog.color);
    this.dome.material.opacity = Math.min(1, this.level * 1.1);
  }

  /** Niebla, sol y etalonaje según la intensidad actual. */
  apply() {
    const g = this.game, fog = g.scene.fog, L = this.level, b = this.base;
    if (!b || !fog) return;
    if (fog.isFogExp2) fog.density = b.density * (1 + L * 9);
    else { fog.near = THREE.MathUtils.lerp(b.near, 4, L); fog.far = THREE.MathUtils.lerp(b.far, 42, L); }
    fog.color.copy(b.color).lerp(SAND, L * 0.85);
    if (!g.scene.background?.isColor) { /* cielo físico: la niebla lo tapa en lo lejano */ } else g.scene.background.copy(fog.color);
    g.sun.intensity = b.sun * (1 - L * 0.6);
    if (b.env != null) g.scene.environmentIntensity = b.env * (1 - L * 0.3);
  }
}

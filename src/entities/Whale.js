// Perla, la ballena mágica del estanque de la Aldea.
// Adaptación del "Salto de la yubarta": la misma yubarta hecha por código (cuerpo
// torneado con vientre de surcos y manchas, aletas pectorales largas y blancas,
// cola ondulada), a escala del estanque. Salta sola de vez en cuando cuando el
// héroe anda cerca, o al silbarle desde la orilla: emerge girando sobre sí misma,
// cae de espaldas y levanta una lluvia de gotas, bruma con arcoíris y espuma sobre
// el agua. Dos gaviotas planean sobre el estanque.
import * as THREE from 'three';
import { Base } from './Interactables.js';

const WATER_Y = -0.55;
const SCALE = 0.55; // la yubarta original mide 14 m; Perla, unos 7,7
const L = 14, R = L * 0.125;

function rad(s) {
  if (s < 0.28) { const q = 1 - s / 0.28; return R * Math.sqrt(Math.max(0, 1 - q * q)); }
  const t = (s - 0.28) / 0.72;
  return R * (1 - 0.93 * Math.pow(t, 1.45));
}
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const h3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
`;

// ---------------------------------------------------------------- la yubarta

function buildWhale() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // cuerpo torneado, achatado por arriba en la cabeza, con colores por vértice
  const pts = [new THREE.Vector2(0, -L / 2)];
  const NP = 72;
  for (let i = 0; i <= NP; i++) { const s = 1 - i / NP; pts.push(new THREE.Vector2(Math.max(rad(s), 0.0001), L / 2 - s * L)); }
  const g = new THREE.LatheGeometry(pts, 40);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i); const z = p.getZ(i);
    const s = (L / 2 - z) / L;
    if (s < 0.32) {
      const k = 1 - s / 0.32;
      if (y > 0) y *= 1 - 0.3 * k; else y *= 1 + 0.06 * k;
      x *= 1 - 0.16 * k;
    }
    y *= 0.9;
    y -= 0.12 * R * Math.sin(Math.PI * Math.min(s, 1));
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  const cols = new Float32Array(p.count * 3);
  const topA = new THREE.Color(0x335694), topB = new THREE.Color(0x172a55);
  const bellyC = new THREE.Color(0xe9eef6), spotC = new THREE.Color(0xc4d1e6), mouthC = new THREE.Color(0x101a36);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = nrm.getY(i);
    const s = (L / 2 - z) / L;
    const ang = Math.atan2(y, x);
    c.copy(topA).lerp(topB, Math.max(0, ny));
    const edge = -0.25 + (vnoise(s * 18, ang * 2) - 0.5) * 0.35;
    const belly = sstep(edge + 0.12, edge - 0.18, ny) * (1 - sstep(0.75, 0.95, s));
    c.lerp(bellyC, belly);
    if (s < 0.58 && ny < -0.15) {
      const gr = 0.5 + 0.5 * Math.sin(ang * 64);
      c.multiplyScalar(1 - 0.16 * gr * belly * (1 - sstep(0.4, 0.58, s)));
    }
    const hh = h3(Math.floor(x * 5), Math.floor(y * 5), Math.floor(z * 5));
    if (belly < 0.4 && hh > (s < 0.2 ? 0.8 : 0.93)) c.lerp(spotC, 0.75);
    if (s < 0.27 && Math.abs(ny + 0.08 + s * 0.4) < 0.045) c.lerp(mouthC, 0.75);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 });
  const add = (parent, mesh) => { mesh.castShadow = true; parent.add(mesh); return mesh; };
  add(body, new THREE.Mesh(g, skin));

  // aletas pectorales: largas, blancas y de borde ondulado
  const Lf = 4.8, fs = new THREE.Shape();
  fs.moveTo(0, 0.38);
  for (let i = 1; i <= 14; i++) { const x = Lf * i / 14; fs.lineTo(x, 0.46 * (1 - Math.pow(i / 14, 1.6)) + 0.05 + (i % 2 ? 0.06 : 0)); }
  fs.lineTo(Lf + 0.15, 0);
  for (let i = 14; i >= 0; i--) { const x = Lf * i / 14; fs.lineTo(x, -0.27 * (1 - Math.pow(i / 14, 1.2)) - 0.02); }
  const finGeo = new THREE.ExtrudeGeometry(fs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
  finGeo.translate(0, 0, -0.05); finGeo.rotateX(Math.PI / 2);
  const finMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f1, roughness: 0.4, side: THREE.DoubleSide });
  const fins = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * R * 0.72, -R * 0.5, L / 2 - 0.33 * L);
    const inner = new THREE.Group();
    inner.scale.x = side;
    add(inner, new THREE.Mesh(finGeo, finMat));
    pivot.add(inner);
    body.add(pivot);
    fins.push({ pivot, side });
  }

  // cola
  const ts = new THREE.Shape();
  ts.moveTo(0, 0.25);
  ts.quadraticCurveTo(1.5, 0.25, 2.9, -1.0);
  for (let j = 1; j <= 10; j++) { const x = 2.9 * (1 - j / 10); ts.lineTo(x, -1.0 + 0.42 * Math.sin(j / 10 * Math.PI / 2) + (j % 2 ? 0.035 : -0.02)); }
  for (let j = 1; j <= 10; j++) { const x = -2.9 * (j / 10); ts.lineTo(x, -1.0 + 0.42 * Math.sin((1 - j / 10) * Math.PI / 2) + (j % 2 ? 0.035 : -0.02)); }
  ts.quadraticCurveTo(-1.5, 0.25, 0, 0.25);
  const tailGeo = new THREE.ExtrudeGeometry(ts, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
  tailGeo.translate(0, 0, -0.06); tailGeo.rotateX(Math.PI / 2);
  const tail = new THREE.Group();
  tail.position.set(0, -0.05, -L / 2 + 0.25);
  add(tail, new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0x24396a, roughness: 0.35, side: THREE.DoubleSide })));
  body.add(tail);

  // aleta dorsal y ojos
  const dors = add(body, new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x1c2f5e, roughness: 0.35 })));
  dors.scale.z = 2.2; dors.rotation.x = -0.7;
  dors.position.set(0, rad(0.68) * 0.86 - 0.1, L / 2 - 0.68 * L);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x07091a, roughness: 0.1 });
  for (const sx of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), eyeMat);
    eye.position.set(sx * 1.54, -0.42, L / 2 - 0.21 * L);
    body.add(eye);
  }
  root.scale.setScalar(SCALE);
  return { root, body, tail, fins };
}

// ---------------------------------------------------------------- gaviotas

function wingMesh(pts, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
}
function makeGull() {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xf6f3f8, roughness: 0.8 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), bodyM); b.scale.set(1, 0.85, 2.6); g.add(b);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyM); hd.position.set(0, 0.12, 0.85); g.add(hd);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0xf2b84b }));
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.1, 1.15); g.add(beak);
  const wings = [];
  for (const side of [1, -1]) {
    const root = new THREE.Group(); root.scale.x = side; root.position.x = side * 0.22;
    const inner = new THREE.Group(); root.add(inner);
    inner.add(wingMesh([0, 0, 0.4, 2.2, 0, 0.32, 2.2, 0, -0.22, 0, 0, 0.4, 2.2, 0, -0.22, 0, 0, -0.4], 0xe7e4ee));
    const outer = new THREE.Group(); outer.position.x = 2.2; inner.add(outer);
    outer.add(wingMesh([0, 0, 0.32, 2.1, 0, 0.02, 1.9, 0, -0.2, 0, 0, 0.32, 1.9, 0, -0.2, 0, 0, -0.22], 0x2c2e40));
    g.add(root); wings.push({ inner, outer });
  }
  g.scale.setScalar(0.42);
  return { g, wings };
}

// ---------------------------------------------------------------- gotas y bruma

function buildSpray(n) {
  const P = {
    n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3),
    age: new Float32Array(n), life: new Float32Array(n), size0: new Float32Array(n),
    kind: new Uint8Array(n), alive: new Uint8Array(n),
    size: new Float32Array(n), alpha: new Float32Array(n), soft: new Float32Array(n), head: 0, count: 0,
  };
  for (let i = 0; i < n; i++) P.pos[i * 3 + 1] = -500;
  const geo = new THREE.BufferGeometry();
  const attr = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
  P.aPos = attr(P.pos, 3); P.aSize = attr(P.size, 1); P.aAlpha = attr(P.alpha, 1); P.aSoft = attr(P.soft, 1);
  geo.setAttribute('position', P.aPos); geo.setAttribute('aSize', P.aSize);
  geo.setAttribute('aAlpha', P.aAlpha); geo.setAttribute('aSoft', P.aSoft);
  P.uniforms = { uScale: { value: 500 } };
  P.points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: P.uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float aSize; attribute float aAlpha; attribute float aSoft;
      uniform float uScale; varying float vA; varying float vSoft;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 300.);
        vA = aAlpha; vSoft = aSoft;
      }`,
    fragmentShader: `
      varying float vA; varying float vSoft;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA <= 0.001) discard;
        float a = mix(1. - smoothstep(0.22, 0.5, d), pow(1. - d * 2., 1.7), vSoft);
        vec3 col = mix(vec3(1.0, 0.995, 0.99), vec3(0.95, 0.97, 1.0), vSoft);
        gl_FragColor = vec4(col, a * vA);
      }`,
  }));
  P.points.frustumCulled = false;
  P.points.renderOrder = 3;
  return P;
}

function emit(P, kind, x, y, z, vx, vy, vz, size, life) {
  const i = P.head; P.head = (P.head + 1) % P.n;
  if (!P.alive[i]) P.count++;
  P.alive[i] = 1; P.kind[i] = kind; P.age[i] = 0; P.life[i] = life; P.size0[i] = size;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
  P.soft[i] = kind === 1 ? 1 : 0;
}

function updateSpray(P, dt) {
  if (!P.count) return;
  const dragMist = Math.exp(-1.3 * dt);
  for (let i = 0; i < P.n; i++) {
    if (!P.alive[i]) continue;
    const a = (P.age[i] += dt), life = P.life[i], j = i * 3;
    const kill = () => { P.alive[i] = 0; P.alpha[i] = 0; P.pos[j + 1] = -500; P.count--; };
    if (a > life) { kill(); continue; }
    const t = a / life;
    if (P.kind[i] === 0) { // gota: cae y desaparece al tocar el agua
      P.vel[j + 1] -= 9.8 * dt;
      P.vel[j] *= 0.996; P.vel[j + 2] *= 0.996;
      P.pos[j] += P.vel[j] * dt; P.pos[j + 1] += P.vel[j + 1] * dt; P.pos[j + 2] += P.vel[j + 2] * dt;
      if (P.pos[j + 1] < WATER_Y - 0.2 && P.vel[j + 1] < 0) { kill(); continue; }
      P.size[i] = P.size0[i];
      P.alpha[i] = 0.95 * Math.sqrt(1 - t);
    } else { // bruma: sube, se abre y se desvanece
      P.vel[j] = P.vel[j] * dragMist + 0.2 * dt;
      P.vel[j + 1] = P.vel[j + 1] * dragMist + 0.15 * dt;
      P.vel[j + 2] *= dragMist;
      P.pos[j] += P.vel[j] * dt; P.pos[j + 1] += P.vel[j + 1] * dt; P.pos[j + 2] += P.vel[j + 2] * dt;
      P.size[i] = P.size0[i] * (1 + 1.3 * t);
      P.alpha[i] = 0.26 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    }
  }
  P.aPos.needsUpdate = P.aSize.needsUpdate = P.aAlpha.needsUpdate = P.aSoft.needsUpdate = true;
}

/** Mancha de espuma sobre el agua donde cae la ballena (se abre y se deshace). */
function buildFoam() {
  const uniforms = { uTime: { value: 0 }, uFoam: { value: 0 }, uR: { value: 2 } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uTime, uFoam, uR; varying vec2 vP;` + NOISE + `
      void main(){
        float d = length(vP);
        float fn = noise(vP * 1.6 + uTime * 0.15) * 0.6 + noise(vP * 5.3 - uTime * 0.2) * 0.4;
        float foam = uFoam * (1. - smoothstep(uR * 0.35, uR, d)) * smoothstep(0.3, 0.62, fn + 0.12);
        float tint = uFoam * (1. - smoothstep(0., uR * 1.5, d)) * 0.35;
        float a = clamp(foam * 0.92 + tint, 0., 1.);
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(0.55, 0.85, 0.9), vec3(0.97, 0.98, 1.0), clamp(foam * 1.4, 0., 1.)), a);
      }`,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = WATER_Y + 0.04;
  m.renderOrder = 2;
  m.visible = false;
  return { mesh: m, uniforms };
}

/** Arcoíris en la bruma del salto. */
function buildRainbow() {
  const uniforms = { uAmt: { value: 0 } };
  const m = new THREE.Mesh(new THREE.RingGeometry(8, 10, 96, 1, 0, Math.PI), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vR; void main(){ vR = (length(position.xy) - 8.) / 2.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uAmt; varying float vR;
      vec3 hue(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
      void main(){ float r = clamp(vR, 0., 1.); gl_FragColor = vec4(hue(0.78 * (1. - r)), sin(r * 3.14159) * uAmt * 0.22); }`,
  }));
  m.visible = false;
  m.renderOrder = 4;
  return { mesh: m, uniforms };
}

// ---------------------------------------------------------------- entidad

const NS = 20; // puntos a lo largo del cuerpo que levantan agua

export class Whale extends Base {
  /**
   * data: { type: 'whale', tile: centro del estanque, spots: [[col, fila], ...] puntos
   *   de salto (lejos del puente), name }
   */
  constructor(game, data) {
    super(game, data);
    this.root.position.set(0, 0, 0);
    this.name = data.name || 'Perla';
    // estanque: rectángulo de casillas de agua alrededor del centro (para silbar desde la orilla)
    const z = game.zone;
    let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
    for (let r = 0; r < z.H; r++) for (let c = 0; c < z.W; c++) {
      if (!/[~B]/.test(z.charAt(c, r))) continue;
      if (Math.abs(c - data.tile[0]) > 8 || Math.abs(r - data.tile[1]) > 6) continue;
      c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
    const [ax, az] = z.tileToWorld(c0 - 0.5, r0 - 0.5), [bx, bz] = z.tileToWorld(c1 + 0.5, r1 + 0.5);
    this.pond = { x0: ax, z0: az, x1: bx, z1: bz };
    this.cx = (ax + bx) / 2; this.cz = (az + bz) / 2;
    this.spots = (data.spots || [data.tile]).map(([c, r]) => z.tileToWorld(c, r));
    this.radius = 3.6;

    this.W = buildWhale();
    this.W.root.visible = false;
    this.root.add(this.W.root);
    const low = game.gfx?.lowQuality;
    this.P = buildSpray(low ? 900 : 2200);
    this.root.add(this.P.points);
    this.foam = buildFoam();
    this.root.add(this.foam.mesh);
    this.rainbow = buildRainbow();
    this.root.add(this.rainbow.mesh);
    this.gulls = [
      { r: 13, h: 10, sp: 0.16, ph: 0.0, dir: 1 },
      { r: 17, h: 13, sp: 0.12, ph: 2.1, dir: -1 },
    ].map((o) => { const gl = makeGull(); this.root.add(gl.g); return { ...o, ...gl }; });

    this.B = { active: false, tau: 0, prev: [], first: true, spot: 0 };
    for (let i = 0; i < NS; i++) this.B.prev.push(new THREE.Vector3());
    this.next = 4 + Math.random() * 4; // primer salto automático
    this.t = 0;
    this.rainbowAmt = 0;
    this.foamTarget = new THREE.Vector2();
    this._v = new THREE.Vector3();
    this.breaches = 0;
  }

  get prompt() { return this.B.active ? null : `Silbar a ${this.name}`; }

  interact() {
    if (this.B.active) return;
    this.game.audio.sfx('whistle');
    this.whistled = true;
    this.next = this.t + 1.1; // tarda un momento en llegar
  }

  /** Empieza un salto desde uno de los puntos del estanque. */
  breach() {
    const B = this.B;
    B.active = true; B.tau = 0; B.first = true;
    B.spot = (B.spot + 1 + Math.floor(Math.random() * Math.max(1, this.spots.length - 1))) % this.spots.length;
    const [x, z] = this.spots[B.spot];
    const W = this.W;
    W.root.position.set(x, WATER_Y, z);
    // de lado respecto a las orillas largas (norte y sur), así se ve de perfil, algo ladeada
    const sgn = Math.random() < 0.5 ? 1 : -1;
    W.root.rotation.y = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + sgn * (0.15 + Math.random() * 0.25);
    // retrocede para que el salto quede centrado en el punto elegido
    const back = 2.6 * SCALE;
    W.root.position.x -= Math.sin(W.root.rotation.y) * back;
    W.root.position.z -= Math.cos(W.root.rotation.y) * back;
    W.root.visible = true;
    this.foam.uniforms.uR.value = 1.6;
    this.breaches++;
    this.splashed = false;
  }

  /** Pose del salto (tiempos de la animación original). */
  pose(tau, t) {
    const W = this.W;
    const y = 4.6 - 4.1 * (tau - 2) * (tau - 2);
    const pitch = -1.32 - 1.25 * sstep(1.5, 3.4, tau) - 0.3 * sstep(3.4, 5.2, tau);
    const roll = 1.7 * sstep(0.9, 2.8, tau);
    W.body.position.set(0, y, -2 + 1.5 * tau);
    W.body.rotation.set(pitch, 0, roll);
    const swim = 1 - sstep(0.7, 1.3, tau);
    W.tail.rotation.x = Math.sin(t * 6) * 0.45 * swim + 0.18 * sstep(1.3, 2.4, tau) * Math.sin(t * 1.6);
    for (const f of W.fins) {
      const lift = sstep(1.1, 2.2, tau) - 0.6 * sstep(2.6, 3.4, tau);
      f.pivot.rotation.set(0, f.side * (0.62 - 0.25 * lift), f.side * (-0.5 + 0.55 * lift + Math.sin(t * 2) * 0.05));
    }
  }

  update(dt) {
    if (!dt) return;
    const g = this.game, p = g.player;
    this.t += dt;
    const t = this.t;
    // el punto de "silbar" sigue al héroe por la orilla (lo más cercano del estanque)
    const pd = this.pond;
    this.x = Math.min(pd.x1, Math.max(pd.x0, p.x));
    this.z = Math.min(pd.z1, Math.max(pd.z0, p.z));
    const near = Math.hypot(p.x - this.cx, p.z - this.cz) < 60;

    // saltos: al silbar, o solos de vez en cuando si el héroe anda cerca
    if (!this.B.active && t >= this.next && (near || this.whistled)) this.breach();
    if (this.B.active) this.updateBreach(dt, t);

    updateSpray(this.P, dt);
    // tamaño de las gotas en píxeles según la pantalla
    const cam = g.camera, size = g.gfx?.renderer?.getDrawingBufferSize?.(this._size || (this._size = new THREE.Vector2()));
    if (size) this.P.uniforms.uScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));

    const fu = this.foam.uniforms;
    fu.uTime.value = t;
    fu.uFoam.value = Math.max(0, fu.uFoam.value - dt * 0.11);
    if (fu.uFoam.value > 0.03) fu.uR.value = Math.min(9, fu.uR.value + dt * 1.0);
    this.foam.mesh.visible = fu.uFoam.value > 0.005;
    this.rainbowAmt = Math.max(0, this.rainbowAmt - dt * 0.13);
    this.rainbow.uniforms.uAmt.value = this.rainbowAmt;
    this.rainbow.mesh.visible = this.rainbowAmt > 0.01;
    if (this.rainbow.mesh.visible) {
      const fp = this.foam.mesh.position;
      this.rainbow.mesh.position.set(fp.x, WATER_Y - 1.5, fp.z);
      // de cara a la cámara, desplazado hacia el fondo
      const ang = Math.atan2(cam.position.x - fp.x, cam.position.z - fp.z);
      this.rainbow.mesh.position.x -= Math.sin(ang) * 6;
      this.rainbow.mesh.position.z -= Math.cos(ang) * 6;
      this.rainbow.mesh.rotation.set(0, ang, 0);
    }
    this.updateGulls(t);
  }

  updateBreach(dt, t) {
    const B = this.B, W = this.W, P = this.P, v = this._v;
    B.tau += dt;
    this.pose(B.tau, t);
    W.root.updateMatrixWorld(true);
    let budget = P.n > 1000 ? 160 : 70, emitted = 0;
    const k = SCALE;
    for (let i = 0; i < NS; i++) {
      const s = i / (NS - 1);
      const r = rad(Math.min(s, 0.97)) * k;
      v.set(0, 0, L / 2 - s * L).applyMatrix4(W.body.matrixWorld);
      const pv = B.prev[i];
      if (B.first) pv.copy(v);
      const vx = (v.x - pv.x) / dt, vy = (v.y - pv.y) / dt, vz = (v.z - pv.z) / dt;
      const speed = Math.min(Math.hypot(vx, vy, vz), 16);
      const sy = v.y - WATER_Y;
      // donde el cuerpo atraviesa la superficie se levanta agua
      if (Math.abs(sy) < r * 0.95 + 0.2 && speed > 1.2 && budget > 0) {
        let n = speed * dt * 16 * (0.35 + r / (R * k));
        n = Math.min(budget, Math.floor(n + Math.random()));
        budget -= n; emitted += n;
        for (let q = 0; q < n; q++) {
          const ang = Math.random() * Math.PI * 2, rr = r * (0.55 + 0.6 * Math.random());
          const cx = Math.cos(ang), cz = Math.sin(ang);
          const up = Math.min(14, speed * (0.35 + 0.8 * Math.random()) + Math.max(0, vy) * 0.25);
          const out = speed * (0.12 + 0.42 * Math.random()) + 0.5;
          const big = Math.random() < 0.12;
          emit(P, 0, v.x + cx * rr, WATER_Y + 0.1, v.z + cz * rr, cx * out + vx * 0.15, up, cz * out + vz * 0.15,
            big ? 0.3 + Math.random() * 0.2 : 0.07 + Math.random() * 0.14, 2.2 + Math.random());
          if (Math.random() < 0.25) {
            emit(P, 1, v.x + cx * rr, WATER_Y + Math.random() * 1.5, v.z + cz * rr, cx * (0.6 + Math.random() * 1.5), 0.5 + Math.random() * 1.6, cz * (0.6 + Math.random() * 1.5),
              1.8 + Math.random() * 3.5, 3 + Math.random() * 3);
          }
        }
        this.foamTarget.set(v.x, v.z);
      }
      // gotas que chorrean del cuerpo en el aire
      if (sy > 1 && Math.random() < 0.2) {
        const ang = Math.random() * Math.PI * 2;
        emit(P, 0, v.x + Math.cos(ang) * r * 0.8, v.y - r * 0.6, v.z + Math.sin(ang) * r * 0.8,
          vx * 0.7 + (Math.random() - 0.5), vy * 0.6, vz * 0.7 + (Math.random() - 0.5), 0.06 + Math.random() * 0.1, 2);
      }
      pv.copy(v);
    }
    B.first = false;
    if (emitted > 0) {
      const fp = this.foam.mesh.position, fu = this.foam.uniforms;
      if (fu.uFoam.value < 0.05) fp.set(this.foamTarget.x, fp.y, this.foamTarget.y);
      else { fp.x += (this.foamTarget.x - fp.x) * 0.08; fp.z += (this.foamTarget.y - fp.z) * 0.08; }
      fu.uFoam.value = Math.min(1, fu.uFoam.value + emitted * 0.006);
      this.rainbowAmt = Math.min(1, this.rainbowAmt + emitted * 0.004);
    }
    const g = this.game;
    // sonidos: salida del agua y gran chapuzón al caer de espaldas
    if (B.tau > 0.7 && !this.surfaced) { this.surfaced = true; if (this.heard()) g.audio.sfx('splash'); }
    if (B.tau > 3.55 && !this.splashed) {
      this.splashed = true;
      if (this.heard()) { g.audio.sfx('bigsplash'); g.shake?.(0.15); }
      if (!g.progress.flags.has('saw_whale') && Math.hypot(g.player.x - this.cx, g.player.z - this.cz) < 40) {
        g.progress.flags.add('saw_whale');
        g.ui.toast(`¡${this.name}, la ballena mágica del estanque, ha saltado para ti!`);
      }
    }
    if (B.tau > 5.6) {
      B.active = false; W.root.visible = false; this.surfaced = false;
      this.whistled = false;
      this.next = this.t + 9 + Math.random() * 7;
    }
  }

  heard() { return Math.hypot(this.game.player.x - this.cx, this.game.player.z - this.cz) < 45; }

  updateGulls(t) {
    const v = this._v;
    for (const gl of this.gulls) {
      const a = gl.ph + gl.dir * gl.sp * t;
      const pos = (ang) => v.set(this.cx + Math.cos(ang) * gl.r, gl.h + Math.sin(t * 0.6 + gl.ph) * 1.2, this.cz + Math.sin(ang) * gl.r * 0.7);
      gl.g.position.copy(pos(a));
      gl.g.lookAt(pos(a + gl.dir * 0.05));
      gl.g.rotateZ(-gl.dir * 0.32);
      const flap = t * 5.2 + gl.ph * 3;
      const glide = 0.5 + 0.5 * Math.sin(t * 0.5 + gl.ph);
      for (const w of gl.wings) {
        w.inner.rotation.z = Math.sin(flap) * 0.45 * glide + 0.08;
        w.outer.rotation.z = Math.sin(flap - 0.7) * 0.4 * glide - 0.05;
      }
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
  }
}

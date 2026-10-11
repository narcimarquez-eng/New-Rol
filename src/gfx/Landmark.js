// Volcán del horizonte: una montaña lejana que no forma parte del mapa. Es una silueta
// de revolución (base ancha, ladera cóncava y un cráter hundido con lava) con una
// columna de humo que sube y se deshace. Sus materiales ignoran la niebla para que se
// lea como silueta sobre el cielo, y las texturas de humo y halo se crean una sola vez.
import * as THREE from 'three';

let puffTex = null, haloTex = null;

function radialTexture(stops) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [s, a] of stops) grd.addColorStop(s, `rgba(255,255,255,${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/**
 * @param {object} o { x, z (centro de la base), base (radio de la base), height (altura de la cima),
 *   rim (radio del borde del cráter), depth (hondura del cráter), rock, ash, glow, smoke }
 * @returns {{ group: THREE.Group, update: (t: number) => void }}
 */
export function buildVolcano(o = {}) {
  const { x = 0, z = 0, base = 160, height = 85, rim = 24, depth = 16 } = o;
  const rock = new THREE.Color(o.rock ?? 0x4a3f3c), ash = new THREE.Color(o.ash ?? 0x6e625c);
  const glow = o.glow ?? 0xff6a20, smoke = o.smoke ?? 0x5e524e;
  puffTex = puffTex || radialTexture([[0, 0.85], [0.45, 0.4], [1, 0]]);
  haloTex = haloTex || radialTexture([[0, 1], [0.3, 0.6], [1, 0]]);

  const group = new THREE.Group();
  group.name = 'volcano';
  group.position.set(x, -0.6, z);

  // cuerpo: perfil de revolución; la ladera es cóncava (más empinada hacia la cima)
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    prof.push(new THREE.Vector2(rim + (base - rim) * Math.pow(1 - u, 1.8), height * u));
  }
  const bodyGeo = new THREE.LatheGeometry(prof, 48);
  const pos = bodyGeo.attributes.position, col = new Float32Array(pos.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // basalto oscuro abajo y ceniza más clara en la cima
    tmp.copy(rock).lerp(ash, Math.pow(Math.min(1, pos.getY(i) / height), 2.2));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  group.add(new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, fog: false })));

  // cráter: un embudo de lava con un borde incandescente
  const cr = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    cr.push(new THREE.Vector2(Math.max(0.01, rim * (1 - u)), height - depth * Math.sin(u * Math.PI / 2)));
  }
  const lavaMat = new THREE.MeshBasicMaterial({ color: glow, side: THREE.DoubleSide, fog: false });
  group.add(new THREE.Mesh(new THREE.LatheGeometry(cr, 32), lavaMat));
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(rim, 1.6, 6, 40), lavaMat);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = height;
  group.add(rimRing);

  // coladas de lava que bajan por la ladera desde el borde (se ven de lejos)
  const profR = (y) => rim + (base - rim) * Math.pow(1 - y / height, 1.8);
  for (let i = 0; i < 7; i++) {
    const a = (i + 0.5) / 7 * Math.PI * 2 + 0.3;
    const y0 = height - 2, y1 = height * (0.3 + 0.12 * ((i * 3) % 5));
    const p0 = new THREE.Vector3(Math.cos(a) * profR(y0), y0, Math.sin(a) * profR(y0));
    const p1 = new THREE.Vector3(Math.cos(a) * profR(y1), y1, Math.sin(a) * profR(y1));
    const dir = p1.clone().sub(p0);
    const streak = new THREE.Mesh(new THREE.BoxGeometry(1.4, dir.length(), 0.6), lavaMat);
    streak.position.copy(p0).add(p1).multiplyScalar(0.5);
    streak.position.x += Math.cos(a) * 0.5; streak.position.z += Math.sin(a) * 0.5; // apoyada en la ladera
    streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    group.add(streak);
  }

  // resplandor sobre el cráter (discreto: no debe parecer una columna)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  halo.scale.set(rim * 3.2, rim * 3.2, 1);
  halo.position.set(0, height - depth * 0.3, 0);
  group.add(halo);

  // columna de humo: bocanadas que suben, se ensanchan y se desvanecen (ciclo de 16 s)
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: smoke, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    s.userData.k = i / 16;
    group.add(s);
    puffs.push(s);
  }

  const update = (t) => {
    halo.material.opacity = 0.38 + 0.1 * Math.sin(t * 2.3) + 0.04 * Math.sin(t * 7.1);
    for (const s of puffs) {
      const p = (t / 16 + s.userData.k) % 1;
      s.position.set(Math.sin(p * 6.3 + s.userData.k * 40) * (6 + p * 30), height + 2 + p * 40, Math.cos(p * 3 + s.userData.k * 9) * p * 14);
      const sc = 12 + p * 40;
      s.scale.set(sc, sc, 1);
      s.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.22;
    }
  };
  return { group, update };
}

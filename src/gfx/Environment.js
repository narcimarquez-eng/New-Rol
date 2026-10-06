// Atmósfera realista: cielo físico (dispersión de Rayleigh/Mie) con nubes
// procedurales, iluminación ambiental calculada a partir de ese cielo (PMREM),
// niebla de distancia con el color real del horizonte y agua con reflejos
// planos y normales animadas.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { tex } from './Textures.js';

/** Cielo configurado con los datos de la zona. `clampMax` limita el brillo del disco solar. */
function makeSky(atmo, sunDir, { sunDisc = true, clampMax = 6 } = {}) {
  const sky = new Sky();
  sky.scale.setScalar(1000);
  sky.frustumCulled = false;
  // el disco solar del shader original vale miles: sin límite, el bloom lo
  // extiende por toda la pantalla como un velo blanco
  sky.material.fragmentShader = sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    `gl_FragColor = vec4( min( texColor, vec3( ${clampMax.toFixed(1)} ) ), 1.0 );`,
  );
  const u = sky.material.uniforms;
  u.turbidity.value = atmo.turbidity ?? 6;
  u.rayleigh.value = atmo.rayleigh ?? 1.6;
  u.mieCoefficient.value = atmo.mie ?? 0.006;
  u.mieDirectionalG.value = atmo.mieG ?? 0.85;
  u.sunPosition.value.copy(sunDir);
  u.showSunDisc.value = sunDisc ? 1 : 0;
  u.cloudCoverage.value = atmo.clouds ?? 0.32;
  u.cloudDensity.value = atmo.cloudDensity ?? 0.45;
  u.cloudElevation.value = atmo.cloudElevation ?? 0.55;
  u.cloudScale.value = atmo.cloudScale ?? 0.00022;
  return sky;
}

/**
 * Color medio del cielo justo sobre el horizonte (espacio lineal). La niebla
 * usa este color para que el terreno lejano se funda con el cielo sin costura.
 */
function measureHorizon(renderer, scene, sunDir) {
  const size = 32;
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType });
  const cam = new THREE.PerspectiveCamera(90, 1, 0.1, 2000);
  const buf = new Float32Array(size * size * 4);
  const sum = new THREE.Vector3();
  let n = 0;
  const prevTarget = renderer.getRenderTarget();
  try {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      cam.position.set(0, 0, 0);
      // mirando 3° por encima del horizonte
      cam.lookAt(Math.cos(a), Math.tan(THREE.MathUtils.degToRad(3)), Math.sin(a));
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, size / 2, size, 1, buf);
      // las direcciones de espaldas al sol pesan más (es lo que más se ve con niebla)
      const away = 1.2 - 0.4 * Math.max(0, Math.cos(a) * sunDir.x + Math.sin(a) * sunDir.z);
      for (let x = 0; x < size; x++) {
        const r = buf[x * 4], g = buf[x * 4 + 1], b = buf[x * 4 + 2];
        if (!Number.isFinite(r + g + b)) continue;
        sum.x += r * away; sum.y += g * away; sum.z += b * away; n += away;
      }
    }
  } catch (e) {
    console.warn('No se pudo medir el horizonte', e);
    n = 0;
  } finally {
    renderer.setRenderTarget(prevTarget);
    rt.dispose();
  }
  if (!n || sum.lengthSq() === 0) return null;
  sum.divideScalar(n);
  return new THREE.Color(sum.x, sum.y, sum.z);
}

/**
 * @param {object} atmo datos de la zona: { elevation, azimuth, turbidity, rayleigh, mie, clouds, haze, hazeMix, exposure, envIntensity }
 * @returns {{ sky: Sky, sunDir: THREE.Vector3, envMap: THREE.Texture, hazeColor: THREE.Color }}
 */
export function buildAtmosphere(renderer, atmo = {}) {
  const phi = THREE.MathUtils.degToRad(90 - (atmo.elevation ?? 18));
  const theta = THREE.MathUtils.degToRad(atmo.azimuth ?? 200);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  const sky = makeSky(atmo, sunDir);
  sky.name = 'sky';
  sky.userData.update = (t) => { sky.material.uniforms.time.value = t; };

  // iluminación ambiental (reflejos y luz difusa) a partir del mismo cielo, sin
  // disco solar: la luz directa del sol ya la pone la luz direccional
  const envScene = new THREE.Scene();
  const envSky = makeSky(atmo, sunDir, { sunDisc: false, clampMax: 4 });
  envScene.add(envSky);
  const horizon = measureHorizon(renderer, envScene, sunDir);
  // suelo genérico en el entorno para que la luz que rebota desde abajo no sea "cielo"
  const ground = new THREE.Mesh(new THREE.SphereGeometry(500, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: atmo.groundBounce ?? 0x4a5a3a, side: THREE.BackSide }));
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  envSky.geometry.dispose(); envSky.material.dispose(); ground.geometry.dispose(); ground.material.dispose();

  // niebla = horizonte medido, con un toque del color de bruma de la zona
  const haze = new THREE.Color(atmo.haze ?? 0xc9c2b0);
  const hazeColor = horizon ? horizon.clone().lerp(haze, atmo.hazeMix ?? 0.15) : haze;
  return { sky, sunDir, envMap, hazeColor };
}

/** Agua con reflejos planos (refleja la escena) y oleaje a partir de normales. */
export function buildRealWater(width, depth, atmo, sunDir, { level = -0.55, lowQuality = false } = {}) {
  const normals = tex('tex/waternormals.jpg', { srgb: false });
  const water = new Water(new THREE.PlaneGeometry(width, depth), {
    textureWidth: lowQuality ? 256 : 512,
    textureHeight: lowQuality ? 256 : 512,
    waterNormals: normals,
    sunDirection: sunDir.clone().normalize(),
    sunColor: atmo.sunColor ?? 0xfff0d0,
    waterColor: atmo.waterColor ?? 0x1e3a3a,
    distortionScale: 2.2,
    alpha: 0.95,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = level;
  water.material.uniforms.size.value = 3.5;
  water.name = 'water';
  water.userData.update = (t) => { water.material.uniforms.time.value = t * 0.6; };
  return water;
}

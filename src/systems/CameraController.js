// Cámara orbital en tercera persona con seguimiento suave, recolocación
// automática detrás del jugador y colisión (no atraviesa suelo ni muros).
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/utils.js';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;        // cámara situada en (sin(yaw), cos(yaw)) respecto al jugador
    this.pitch = 0.42;
    this.distance = 9;
    this.wantDistance = 9;
    this.curDistance = 9;
    this.target = new THREE.Vector3();
    this.idleLook = 0;
    this.shakeT = 0; this.shakeAmp = 0;
    this.sensitivity = 0.0028;
  }

  snapBehind(player) {
    this.yaw = player.facing + Math.PI;
    this.target.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
    this.curDistance = this.distance;
  }

  shake(amp) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = 0.3; }

  update(dt, input, player, zone, focus) {
    // ---- rotación manual ----
    const dx = input.mouseDX, dy = input.mouseDY;
    if (dx || dy) {
      this.yaw -= dx * this.sensitivity;
      this.pitch = clamp(this.pitch + dy * this.sensitivity, -0.15, 1.2);
      this.idleLook = 0;
    } else this.idleLook += dt;
    if (input.wheel) this.wantDistance = clamp(this.wantDistance + input.wheel * 1.2, 4.5, 15);
    this.distance = damp(this.distance, this.wantDistance, 8, dt);

    // ---- recolocación automática detrás del jugador al moverse ----
    if (focus) {
      // con un objetivo (jefe), encuadra a ambos
      const ang = Math.atan2(player.pos.x - focus.x, player.pos.z - focus.z);
      this.yaw = dampAngle(this.yaw, ang, 2.5, dt);
    } else if (this.idleLook > 1.2 && player.speedNorm > 0.3) {
      this.yaw = dampAngle(this.yaw, player.facing + Math.PI, 1.2, dt);
    }

    // ---- objetivo suavizado ----
    const tx = player.pos.x, ty = player.pos.y + 1.6, tz = player.pos.z;
    this.target.x = damp(this.target.x, tx, 14, dt);
    this.target.y = damp(this.target.y, ty, 10, dt);
    this.target.z = damp(this.target.z, tz, 14, dt);

    // ---- colisión: acortar la distancia si algo bloquea ----
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dirX = Math.sin(this.yaw) * cp, dirY = sp, dirZ = Math.cos(this.yaw) * cp;
    let allowed = this.distance;
    const step = 0.25;
    for (let d = 0.6; d <= this.distance; d += step) {
      const x = this.target.x + dirX * d, y = this.target.y + dirY * d, z = this.target.z + dirZ * d;
      const ground = zone.height(x, z);
      if (y < ground + 0.45 || zone.collision.blocksView(x, z, y - ground)) { allowed = Math.max(0.8, d - 0.45); break; }
    }
    // acercarse rápido, alejarse despacio (evita tirones)
    this.curDistance = allowed < this.curDistance ? damp(this.curDistance, allowed, 25, dt) : damp(this.curDistance, allowed, 4, dt);

    let px = this.target.x + dirX * this.curDistance;
    let py = this.target.y + dirY * this.curDistance;
    let pz = this.target.z + dirZ * this.curDistance;
    // nunca por debajo del suelo
    py = Math.max(py, zone.height(px, pz) + 0.45);

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * (this.shakeT / 0.3);
      px += (Math.random() - 0.5) * a; py += (Math.random() - 0.5) * a; pz += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }

    this.camera.position.set(px, py, pz);
    this.camera.lookAt(this.target.x, this.target.y + 0.2, this.target.z);
  }
}

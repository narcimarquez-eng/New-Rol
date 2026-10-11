// Mando (Gamepad API): palancas, cruceta y botones. Se lee una vez por frame y alimenta
// el mismo Input que el teclado, así que todo lo que funciona con teclado funciona con el
// mando. Usa el mapeo estándar (A, B, X, Y, LB, RB, LT, RT, Back, Start). Los mandos que
// no anuncian ese mapeo (como el de Luna) se leen en esas mismas posiciones.
const DEADZONE = 0.18; // zona muerta de las palancas
const LOOK_PX = 700;   // giro de la cámara con la palanca derecha, en píxeles por segundo
const BUTTONS = [      // [acción, botón estándar]
  ['interact', 0],     // A: hablar, abrir, avanzar diálogos
  ['dodge', 1],        // B: esquivar
  ['attack', 2],       // X: atacar (encadena el combo)
  ['potion', 3],       // Y: beber poción
  ['block', 4],        // LB: bloquear (mantener)
  ['run', 5],          // RB: correr (mantener)
  ['block', 6],        // LT: bloquear (mantener)
  ['attack', 7],       // RT: atacar
  ['menu', 8],         // Back: menú
  ['pause', 9],        // Start: pausa
];
const DPAD = [[12, 0, 1], [13, 0, -1], [14, -1, 0], [15, 1, 0]]; // [botón, x, y] de la cruceta

export class Pad {
  constructor(input, onConnect = () => {}) {
    this.input = input;
    this.held = new Set(); // acciones que el mando tiene pulsadas ahora mismo
    addEventListener('gamepadconnected', () => onConnect());
    addEventListener('gamepaddisconnected', () => this.release());
  }

  /** Suelta lo que el mando tenía pulsado y para el movimiento (al desconectarlo o sin mando). */
  release() {
    for (const a of this.held) this.input.release(a);
    this.held.clear();
    this.input.setPadMove(0, 0);
  }

  /** Lee el primer mando conectado y actualiza el Input. */
  poll(dt) {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const gp = pads.find((p) => p && p.connected);
    if (!gp) { this.release(); return; }
    const down = (i) => !!gp.buttons[i]?.pressed;

    // una acción puede tener dos botones (LB/LT, X/RT): se pulsa al primero y se suelta al último
    const want = new Set();
    for (const [action, i] of BUTTONS) if (down(i)) want.add(action);
    for (const action of new Set(BUTTONS.map(([a]) => a))) {
      const on = want.has(action);
      if (on && !this.held.has(action)) { this.input.press(action); this.held.add(action); }
      else if (!on && this.held.has(action)) { this.input.release(action); this.held.delete(action); }
    }

    // movimiento: palanca izquierda (arriba = adelante) más la cruceta
    const dz = (v) => (Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE));
    let x = dz(gp.axes[0] || 0), y = -dz(gp.axes[1] || 0);
    for (const [i, dx, dy] of DPAD) if (down(i)) { x += dx; y += dy; }
    this.input.setPadMove(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));

    // cámara: la palanca derecha gira igual que el ratón
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx || ry) this.input.addLook(rx * LOOK_PX * dt, ry * LOOK_PX * dt);
  }
}

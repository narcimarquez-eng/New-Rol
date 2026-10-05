// Entrada unificada: teclado, ratón (con pointer lock) y controles táctiles.
// Los sistemas leen estado ("down") o flancos ("pressed") por acción.

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'dodge',
  KeyE: 'interact', Enter: 'interact',
  KeyQ: 'potion',
  ShiftLeft: 'run', ShiftRight: 'run',
  Escape: 'pause', KeyP: 'pause',
  Tab: 'menu', KeyI: 'menu', KeyJ: 'menu',
  KeyF: 'attack', KeyK: 'attack',
  KeyR: 'block', KeyL: 'block',
  KeyM: 'map',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this.locked = false;
    this.touch = { active: false, moveX: 0, moveY: 0 };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(a)) this.pressedSet.add(a);
      this.down.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.down.delete(a);
    });
    addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.wantLock && this.enabled) {
        // el clic que captura el ratón no cuenta como ataque
        try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* sin pointer lock */ }
        if (e.button === 0) return;
      }
      if (e.button === 0) { this.pressedSet.add('attack'); this.down.add('attack'); }
      if (e.button === 2) { this.pressedSet.add('block'); this.down.add('block'); }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.down.delete('attack');
      if (e.button === 2) this.down.delete('block');
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      else if (e.buttons & 4) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    this.wantLock = !this.isTouch;
  }

  /** Se llama desde la capa táctil. */
  setTouchMove(x, y) { this.touch.moveX = x; this.touch.moveY = y; }
  addLook(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }
  press(action) { this.pressedSet.add(action); this.down.add(action); }
  release(action) { this.down.delete(action); }

  isDown(a) { return this.enabled && this.down.has(a); }
  pressed(a) { return this.enabled && this.pressedSet.has(a); }
  /** Consume un flanco para que no lo lea otro sistema. */
  consume(a) { const had = this.pressedSet.has(a); this.pressedSet.delete(a); return this.enabled && had; }

  /** Vector de movimiento (x derecha, y adelante) en [-1,1]. */
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.down.has('left')) x -= 1;
    if (this.down.has('right')) x += 1;
    if (this.down.has('up')) y += 1;
    if (this.down.has('down')) y -= 1;
    x += this.touch.moveX; y += this.touch.moveY;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  /** Fin de frame: limpia flancos y deltas. */
  endFrame() {
    this.pressedSet.clear();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
  }

  /** Libera el ratón. Devuelve true si estaba capturado. */
  releaseLock() {
    if (!this.locked) return false;
    document.exitPointerLock?.();
    return true;
  }
}

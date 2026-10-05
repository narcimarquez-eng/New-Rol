// Controles táctiles: joystick virtual (izquierda), arrastre para la cámara
// (mitad derecha de la pantalla) y botones de acción.
const $ = (id) => document.getElementById(id);

export class Touch {
  constructor(game) {
    this.game = game;
    const input = game.input;
    const joy = $('joy'), knob = $('joy-knob');
    let joyId = null, cx = 0, cy = 0;
    const R = 50;

    joy.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    const moveJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx = dx / l * R; dy = dy / l * R; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        input.setTouchMove(dx / R, -dy / R);
        // empujar a fondo = correr
        if (l > R * 1.1) input.down.add('run'); else input.down.delete('run');
      }
    };
    const endJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null;
        knob.style.transform = '';
        input.setTouchMove(0, 0);
        input.down.delete('run');
      }
    };
    addEventListener('touchmove', moveJoy, { passive: false });
    addEventListener('touchend', endJoy);
    addEventListener('touchcancel', endJoy);

    // cámara: arrastrar sobre el lienzo
    const canvas = game.gfx.renderer.domElement;
    let lookId = null, lx = 0, ly = 0;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        input.addLook((t.clientX - lx) * 1.6, (t.clientY - ly) * 1.6);
        lx = t.clientX; ly = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; });

    const bind = (id, action, hold = false) => {
      const b = $(id);
      b.addEventListener('touchstart', (e) => { input.press(action); e.preventDefault(); }, { passive: false });
      b.addEventListener('touchend', (e) => { if (hold) input.release(action); else input.release(action); e.preventDefault(); }, { passive: false });
      // también con ratón (útil para probar en escritorio)
      b.addEventListener('mousedown', (e) => { input.press(action); e.preventDefault(); });
      b.addEventListener('mouseup', () => input.release(action));
    };
    bind('t-attack', 'attack');
    bind('t-block', 'block', true);
    bind('t-dodge', 'dodge');
    bind('t-interact', 'interact');
    bind('t-potion', 'potion');
  }

  setVisible(on) { $('touch').classList.toggle('hidden', !on); }
}

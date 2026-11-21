/**
 * On-screen controls for phones and tablets (landscape):
 * - Left side: a floating joystick (touch anywhere on the left half and drag). A strong push runs.
 * - Right side: jump button.
 * - Top right: exit button (back to the level list).
 */
const STICK_RADIUS = 60; // pixels
const DEAD_ZONE = 0.15;
const RUN_AT = 0.85; // how far the stick must be pushed to run

function el(tag, id, parent) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  parent.appendChild(e);
  return e;
}

export class TouchControls {
  /**
   * @param input   the Input of the game (its "touch" values are written here)
   * @param onExit  called by the exit button
   */
  constructor(input, onExit) {
    this.input = input;
    const root = el('div', 'touch', document.body);
    this.root = root;

    // Joystick
    const zone = el('div', 'touch-zone', root);
    const base = el('div', 'touch-base', zone);
    const thumb = el('div', 'touch-thumb', base);
    let pointer = null;
    let origin = { x: 0, y: 0 };
    const reset = () => {
      pointer = null;
      base.style.display = 'none';
      input.touch.h = 0;
      input.touch.v = 0;
      input.touch.run = false;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (pointer !== null) return;
      pointer = e.pointerId;
      zone.setPointerCapture(pointer);
      origin = { x: e.clientX, y: e.clientY };
      base.style.display = 'block';
      base.style.left = `${origin.x}px`;
      base.style.top = `${origin.y}px`;
      thumb.style.transform = 'translate(-50%, -50%)';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      let dx = e.clientX - origin.x;
      let dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const mag = Math.min(1, len / STICK_RADIUS);
      if (mag < DEAD_ZONE) {
        input.touch.h = 0;
        input.touch.v = 0;
        input.touch.run = false;
      } else {
        input.touch.h = dx / STICK_RADIUS;
        input.touch.v = -dy / STICK_RADIUS; // up on the screen = forward
        input.touch.run = mag >= RUN_AT;
      }
    });
    zone.addEventListener('pointerup', (e) => { if (e.pointerId === pointer) reset(); });
    zone.addEventListener('pointercancel', (e) => { if (e.pointerId === pointer) reset(); });

    // Buttons
    const jump = el('div', 'touch-jump', root);
    jump.textContent = 'JUMP';
    jump.addEventListener('pointerdown', (e) => { input.pressJump(); jump.classList.add('down'); e.preventDefault(); });
    const release = () => jump.classList.remove('down');
    jump.addEventListener('pointerup', release);
    jump.addEventListener('pointercancel', release);

    const exit = el('div', 'touch-exit', root);
    exit.textContent = 'EXIT';
    exit.addEventListener('pointerdown', (e) => { e.stopPropagation(); onExit(); });
  }
}

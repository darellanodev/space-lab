/** Keyboard input like the Unity "Horizontal", "Vertical", "Jump" and "Fire2" axes. */
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this._jump = false;
    this._recenter = false;
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this._jump = true; e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('mousedown', (e) => { if (e.button === 2) this._recenter = true; });
    target.addEventListener('mouseup', (e) => { if (e.button === 2) this._recenter = false; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _axis(plus, minus) {
    const p = plus.some((k) => this.keys.has(k));
    const m = minus.some((k) => this.keys.has(k));
    return (p ? 1 : 0) - (m ? 1 : 0);
  }

  /** Reads the state for one frame. The jump press is consumed. */
  read() {
    const state = {
      h: this._axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      v: this._axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      jumpPressed: this._jump,
      recenter: this._recenter || this.keys.has('AltLeft'),
    };
    this._jump = false;
    return state;
  }
}

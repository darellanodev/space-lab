/** Keyboard (and touch) input like the Unity "Horizontal", "Vertical", "Jump" and "Fire2" axes. */
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this._jump = false;
    this._recenter = false;
    this.touch = { h: 0, v: 0, run: false, recenter: false }; // set by the on-screen controls (TouchControls)
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

  /** Jump button of the touch controls. */
  pressJump() {
    this._jump = true;
  }

  _axis(plus, minus) {
    const p = plus.some((k) => this.keys.has(k));
    const m = minus.some((k) => this.keys.has(k));
    return (p ? 1 : 0) - (m ? 1 : 0);
  }

  /** Reads the state for one frame. The jump press is consumed. */
  read() {
    const state = {
      h: this._axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) || this.touch.h,
      v: this._axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) || this.touch.v,
      run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touch.run,
      jumpPressed: this._jump,
      recenter: this._recenter || this.keys.has('AltLeft') || this.touch.recenter,
    };
    this._jump = false;
    return state;
  }
}

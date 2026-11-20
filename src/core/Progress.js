/**
 * Counts the files that are being loaded, to show a loading bar.
 * Call expect(n) when you know that n more files will be loaded, and step() each time one finishes.
 * The new files found while loading make the total grow, so the shown value never goes back.
 */
export class Progress {
  constructor(onChange = () => {}) {
    this.total = 0;
    this.loaded = 0;
    this.shown = 0;
    this.onChange = onChange;
  }

  expect(n = 1) {
    this.total += n;
    this._update();
  }

  step() {
    this.loaded += 1;
    this._update();
  }

  /** Counts a promise as one file. Returns the same promise. */
  track(promise) {
    this.expect(1);
    const done = () => this.step();
    promise.then(done, done);
    return promise;
  }

  /** Marks everything as finished (100 %). */
  finish() {
    this.loaded = this.total;
    this._update();
  }

  get fraction() {
    return this.total === 0 ? 0 : Math.min(1, this.loaded / this.total);
  }

  _update() {
    this.shown = Math.max(this.shown, this.fraction);
    this.onChange(this.shown);
  }
}

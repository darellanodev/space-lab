/** Very small sound player for short effects. Files are in public/audio. */
const BASE = import.meta.env.BASE_URL;

export class Sound {
  constructor() {
    this.cache = {};
    this.volume = 1;
  }

  /** Plays a sound file once, for example play('computer.mp3'). */
  play(file) {
    try {
      let audio = this.cache[file];
      if (!audio) audio = this.cache[file] = new Audio(`${BASE}audio/${file}`);
      audio.volume = this.volume;
      audio.currentTime = 0;
      const promise = audio.play();
      if (promise && promise.catch) promise.catch(() => {}); // the browser can block sound before the first key press
    } catch (e) {
      // no sound is not a problem for the game
    }
  }
}

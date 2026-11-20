/** Small sound player: short effects and one looping music. Files are in public/audio. */
const BASE = import.meta.env.BASE_URL;
const MUSIC_VOLUME = 0.5; // the music is quieter than the effects

export class Sound {
  constructor() {
    this.cache = {};
    this.music = null;
    this.musicFile = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('spacelab-muted') === '1';
    } catch (e) {
      // saving is optional
    }
    // Browsers block sound until the player presses a key or clicks. We try again at that moment.
    const unlock = () => {
      if (this.music && this.music.paused && !this.muted) this._playMusic();
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  /** Plays a sound file once, for example play('computer.mp3'). */
  play(file) {
    if (this.muted) return;
    try {
      let audio = this.cache[file];
      if (!audio) audio = this.cache[file] = new Audio(`${BASE}audio/${file}`);
      audio.currentTime = 0;
      const promise = audio.play();
      if (promise && promise.catch) promise.catch(() => {});
    } catch (e) {
      // no sound is not a problem for the game
    }
  }

  /** Starts a looping music. If this file is already playing, nothing changes. */
  playMusic(file) {
    if (this.musicFile === file) return;
    this.stopMusic();
    this.musicFile = file;
    this.music = new Audio(`${BASE}audio/${file}`);
    this.music.loop = true;
    this.music.volume = MUSIC_VOLUME;
    if (!this.muted) this._playMusic();
  }

  _playMusic() {
    const promise = this.music.play();
    if (promise && promise.catch) promise.catch(() => {}); // blocked: the unlock listener will try again
  }

  stopMusic() {
    if (this.music) this.music.pause();
    this.music = null;
    this.musicFile = null;
  }

  /** Sound on / off (key N). Returns true if the sound is now muted. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.music) {
      if (this.muted) this.music.pause();
      else this._playMusic();
    }
    try {
      localStorage.setItem('spacelab-muted', this.muted ? '1' : '0');
    } catch (e) {
      // saving is optional
    }
    return this.muted;
  }
}

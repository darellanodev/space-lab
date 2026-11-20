import { Sound } from '../core/Sound.js';
import { Save, MAX_LEVELS } from '../core/Save.js';
import { Nav } from '../core/Nav.js';

/**
 * Main menu and level selector (HTML over a 16:9 picture, like the Unity "portada" and "niveles" scenes).
 * Positions are in percent of the 1024 x 576 pictures.
 */
const BASE = import.meta.env.BASE_URL;
const tex = (path) => `${BASE}textures/ui/${path}`;

// Level pictures in niveles.png: x, y, width, height (pixels of the 1024 x 576 picture)
const LEVEL_BOXES = [
  [48, 147, 282, 221],
  [371, 147, 282, 221],
  [693, 147, 282, 221],
];

function pct(value, total) {
  return `${(value / total) * 100}%`;
}

function place(el, x, y, w, h) {
  el.style.left = pct(x, 1024);
  el.style.top = pct(y, 576);
  el.style.width = pct(w, 1024);
  if (h) el.style.height = pct(h, 576);
}

function image(src, x, y, w, h) {
  const el = document.createElement('img');
  el.src = src;
  el.draggable = false;
  el.className = 'ui-item';
  place(el, x, y, w, h);
  return el;
}

export class Menu {
  constructor(root, screen) {
    this.root = root;
    this.sound = new Sound();
    root.innerHTML = '';
    root.style.display = 'block';
    const stage = document.createElement('div');
    stage.id = 'stage';
    root.appendChild(stage);
    this.stage = stage;
    if (screen === 'levels') this._levels();
    else this._main();
  }

  _background(file) {
    this.stage.style.backgroundImage = `url(${tex(`portadas/${file}`)})`;
  }

  _button(file, w, h, x, y, onClick) {
    const btn = image(tex(`botones/${file}`), x, y, w, h);
    btn.classList.add('ui-button');
    btn.addEventListener('click', () => {
      this.sound.play('select.mp3');
      onClick();
    });
    this.stage.appendChild(btn);
    return btn;
  }

  _main() {
    this._background('portada.png');
    this.sound.playMusic('music_menu.ogg');
    this._button('btn_start.png', 405, 102, 560, 440, () => Nav.toLevels());
    const hint = document.createElement('div');
    hint.className = 'ui-hint';
    hint.textContent = 'Click or press a key to start the music';
    this.stage.appendChild(hint);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') Nav.toLevels();
    });
  }

  _levels() {
    this._background('niveles.png');
    this.sound.playMusic('music_menu.ogg');
    const progress = Save.get();
    LEVEL_BOXES.forEach(([x, y, w, h], i) => {
      const level = i + 1;
      const unlocked = Save.isUnlocked(level);
      const hit = document.createElement('div');
      hit.className = 'ui-item ui-level' + (unlocked ? ' ui-button' : '');
      place(hit, x, y, w, h);
      this.stage.appendChild(hit);
      if (unlocked) {
        hit.addEventListener('click', () => {
          this.sound.play('select.mp3');
          this._loading(level);
        });
      } else {
        const lock = image(tex('iconos/nivel_candado.png'), x + w / 2 - 43, y + h / 2 - 43, 86, 86);
        this.stage.appendChild(lock);
        hit.style.background = 'rgba(0, 0, 0, 0.55)';
      }
      const medal = progress.medals[i];
      const file = { 1: 'stars_bronze', 2: 'stars_silver', 3: 'stars_gold' }[medal];
      if (file) this.stage.appendChild(image(tex(`iconos/${file}.png`), x + w / 2 - 132, y + h + 14, 265, 57));
    });
    if (progress.lastCompleted >= MAX_LEVELS) {
      this.stage.appendChild(image(tex('iconos/info_gamecompleted.png'), 310, 470, 404, 82));
    }
    this._button('btn_back.png', 354, 86, 24, 470, () => Nav.toMenu());
  }

  /** "LOADING LEVEL n" and then the level starts. */
  _loading(level) {
    this.sound.stopMusic();
    this.stage.innerHTML = '';
    this.stage.style.backgroundImage = 'none';
    const text = document.createElement('div');
    text.className = 'ui-loading';
    text.textContent = `LOADING LEVEL ${level}`;
    this.stage.appendChild(text);
    setTimeout(() => Nav.toLevel(level), 150);
  }
}

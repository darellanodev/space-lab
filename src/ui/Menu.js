import { Sound } from '../core/Sound.js';
import { Save, MAX_LEVELS } from '../core/Save.js';
import { Nav } from '../core/Nav.js';

/**
 * Main menu and level selector (HTML over a 16:9 picture, like the Unity "portada" and "niveles" scenes).
 * Positions are in percent of the 1024 x 576 pictures.
 */
const BASE = import.meta.env.BASE_URL;
const tex = (path) => `${BASE}textures/ui/${path}`;

// Level pictures in niveles.webp: x, y, width, height (pixels of the 1024 x 576 picture)
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
    this.fromStart = false; // the tutorial was opened by the Start button
    this.show(screen);
  }

  /** Shows a screen without reloading the page, so the music keeps playing. */
  show(screen, page = 1) {
    this.stage.innerHTML = '';
    if (screen === 'levels') this._levels();
    else if (screen === 'tutorial') this._tutorial(page);
    else if (screen === 'credits') this._credits();
    else if (screen === 'congratulations') this._congratulations();
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
    this._background('portada.webp');
    this.sound.playMusic('music_menu.ogg');
    const start = () => {
      if (Save.tutorialSeen()) Nav.toLevels();
      else {
        this.fromStart = true;
        this.show('tutorial', 1);
      }
    };
    this._button('btn_start.webp', 405, 102, 560, 365, start);
    this._button('btn_tutorial.webp', 306, 76, 370, 485, () => {
      this.fromStart = false;
      this.show('tutorial', 1);
    });
    this._button('btn_credits.webp', 308, 76, 690, 485, () => this.show('credits'));
    if (!this.keyHandler) {
      this.keyHandler = (e) => {
        if (this.current === 'main' && (e.code === 'Enter' || e.code === 'Space')) start();
      };
      window.addEventListener('keydown', this.keyHandler);
    }
    this.current = 'main';
  }

  /** How to play: 4 pages. The numbers at the top change the page. */
  _tutorial(page) {
    this.current = 'tutorial';
    this.sound.playMusic('music_menu.ogg');
    const mobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this._background(page === 4 ? `tutorial_pag4_${mobile ? 'mobile' : 'pc'}.webp` : `tutorial_pag${page}.webp`);
    if (page >= 2) Save.markTutorialSeen();
    for (let i = 0; i < 4; i++) {
      const zone = document.createElement('div');
      zone.className = 'ui-item ui-button';
      place(zone, 388 + i * 74, 22, 66, 50);
      zone.addEventListener('click', () => this.show('tutorial', i + 1));
      this.stage.appendChild(zone);
    }
    const leave = () => (this.fromStart ? Nav.toLevels() : this.show('main'));
    this._button('btn_back.webp', 354, 86, 24, 478, leave);
    if (page < 4) this._button('btn_next.webp', 306, 75, 690, 478, () => this.show('tutorial', page + 1));
    else {
      this._button('btn_finish.webp', 306, 75, 690, 478, () => {
        Save.markTutorialSeen();
        leave();
      });
    }
  }

  _congratulations() {
    this.current = 'congratulations';
    this.sound.playMusic('music_congratulations.ogg');
    this._background('congratulations.webp');
    this._button('btn_finish.webp', 306, 75, 690, 478, () => Nav.toLevels());
  }

  _credits() {
    this.current = 'credits';
    this.sound.playMusic('music_credits.ogg');
    this._background('creditos.webp');
    this._button('btn_back.webp', 354, 86, 640, 478, () => this.show('main'));
  }

  _levels() {
    this.current = 'levels';
    this._background('niveles.webp');
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
        const lock = image(tex('iconos/nivel_candado.webp'), x + w / 2 - 43, y + h / 2 - 43, 86, 86);
        this.stage.appendChild(lock);
        hit.style.background = 'rgba(0, 0, 0, 0.55)';
      }
      const medal = progress.medals[i];
      const file = { 1: 'stars_bronze', 2: 'stars_silver', 3: 'stars_gold' }[medal];
      if (file) this.stage.appendChild(image(tex(`iconos/${file}.webp`), x + w / 2 - 132, y + h + 14, 265, 57));
    });
    if (progress.lastCompleted >= MAX_LEVELS) {
      this.stage.appendChild(image(tex('iconos/info_gamecompleted.webp'), 310, 470, 404, 82));
    }
    this._button('btn_back.webp', 354, 86, 24, 470, () => Nav.toMenu());
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

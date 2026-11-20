import { Nav } from './core/Nav.js';
import { isTouchDevice, prepareTouchScreen } from './core/Device.js';

async function main() {
  const screen = Nav.current();
  if (isTouchDevice()) prepareTouchScreen();
  if (screen.screen === 'game') {
    document.body.classList.add('playing');
    document.getElementById('loading').textContent = `LOADING LEVEL ${screen.level}`;
    const { Game } = await import('./core/Game.js');
    const game = new Game(document.getElementById('game'));
    game.start();
    await game.loadContent();
    const loading = document.getElementById('loading');
    if (game.loadError) loading.textContent = 'Could not load the level';
    else loading.style.display = 'none';
  } else {
    const { Menu } = await import('./ui/Menu.js');
    new Menu(document.getElementById('menu'), screen.screen);
  }
}

main();

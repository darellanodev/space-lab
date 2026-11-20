import { Nav } from './core/Nav.js';

async function main() {
  const screen = Nav.current();
  if (screen.screen === 'game') {
    document.body.classList.add('playing');
    document.getElementById('loading').textContent = `LOADING LEVEL ${screen.level}`;
    const { Game } = await import('./core/Game.js');
    const game = new Game(document.getElementById('game'), document.getElementById('info'));
    game.start();
    await game.loadContent();
    document.getElementById('loading').style.display = 'none';
  } else {
    const { Menu } = await import('./ui/Menu.js');
    new Menu(document.getElementById('menu'), screen.screen);
  }
}

main();

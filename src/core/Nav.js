/** Moves between the screens of the game. Each screen is a page address. */
export const Nav = {
  /** What to show: { screen: 'menu' | 'levels' | 'game', level } */
  current() {
    const q = new URLSearchParams(location.search);
    if (q.get('level')) return { screen: 'game', level: Number(q.get('level')) || 1 };
    if (q.get('screen') === 'levels') return { screen: 'levels' };
    if (q.get('screen') === 'congratulations') return { screen: 'congratulations' };
    return { screen: 'menu' };
  },

  toMenu() {
    location.href = location.pathname;
  },

  toLevels() {
    location.href = `${location.pathname}?screen=levels`;
  },

  toCongratulations() {
    location.href = `${location.pathname}?screen=congratulations`;
  },

  toLevel(n) {
    location.href = `${location.pathname}?level=${n}`;
  },
};

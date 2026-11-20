/**
 * Progress of the player, saved in the browser (localStorage).
 * Same data as the Unity game: last level finished and medals per level
 * (medal = lives left when the level was finished: 1 bronze, 2 silver, 3 gold).
 */
const KEY = 'spacelab-progress';
export const MAX_LEVELS = 3;

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.medals)) return data;
  } catch (e) {
    // no saved data
  }
  return { lastCompleted: 0, medals: [0, 0, 0] };
}

const TUTORIAL_KEY = 'spacelab-tutorial-seen';

export const Save = {
  /** The tutorial is shown by itself the first time the player presses Start. */
  tutorialSeen() {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === '1';
    } catch (e) {
      return false;
    }
  },

  markTutorialSeen() {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch (e) {
      // saving is optional
    }
  },

  get() {
    return read();
  },

  /** A level is open when the one before it was completed. */
  isUnlocked(level) {
    return read().lastCompleted + 1 >= level;
  },

  /** Saves the result of a level. Medals only get better, never worse. */
  completeLevel(level, livesLeft) {
    const data = read();
    data.lastCompleted = Math.max(data.lastCompleted, level);
    data.medals[level - 1] = Math.max(data.medals[level - 1] || 0, livesLeft);
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      // saving is optional
    }
  },
};

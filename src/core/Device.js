/** True on phones and tablets (the main pointer is a finger). */
export function isTouchDevice() {
  return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches);
}

/**
 * The game is played in landscape. On the first touch we ask for full screen and landscape,
 * if the browser allows it (it is optional: errors are ignored).
 */
export function prepareTouchScreen() {
  const go = () => {
    try {
      const root = document.documentElement;
      const request = root.requestFullscreen ? root.requestFullscreen() : null;
      Promise.resolve(request).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } catch (e) {
      // not supported
    }
  };
  window.addEventListener('pointerdown', go, { once: true });
}

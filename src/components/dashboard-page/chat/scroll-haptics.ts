import { playHaptic } from '@/services/haptics';

// Ticks like a detented wheel while the thread scrolls itself to a target, then lands with a firmer
// tap. Ticks follow distance, so they speed up and slow down with the smooth scroll; the rate is capped
// so the motor keeps each tick distinct.
const TICK_DISTANCE = 64;
const MIN_TICK_INTERVAL = 40;
// Smooth scrolls fire scroll events every frame; this long without one means the scroll has ended.
const SETTLE_DELAY = 140;

export function createScrollHaptics() {
  let lastTop: number | null = null;
  let travelled = 0;
  let moved = false;
  let lastTickAt = 0;
  let settleTimer: number | undefined;

  function stop() {
    window.clearTimeout(settleTimer);
    settleTimer = undefined;
    lastTop = null;
  }

  function settle() {
    const land = moved;
    stop();
    if (land) playHaptic('light');
  }

  function waitForSettle() {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, SETTLE_DELAY);
  }

  return {
    /** Call right before a programmatic scroll, with the pane's current `scrollTop`. */
    start(top: number) {
      lastTop = top;
      travelled = 0;
      moved = false;
      waitForSettle();
    },
    onScroll(top: number) {
      if (lastTop === null) return;
      travelled += Math.abs(top - lastTop);
      moved ||= top !== lastTop;
      lastTop = top;
      const now = Date.now();
      if (travelled >= TICK_DISTANCE && now - lastTickAt >= MIN_TICK_INTERVAL) {
        travelled %= TICK_DISTANCE;
        lastTickAt = now;
        playHaptic('selection');
      }
      waitForSettle();
    },
    /** The user took over the scroll, or the thread is going away: no more ticks and no landing. */
    cancel: stop,
  };
}

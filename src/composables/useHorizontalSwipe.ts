import { useEventListener } from '@vueuse/core';
import type { Ref } from 'vue';

export type SwipeDirection = 'next' | 'previous';

// Drags that start on these keep their own gestures: typing, text selection, and media scrubbing.
const IGNORED_TARGETS = 'input, textarea, video, iframe, [data-no-swipe]';

/** Reports a horizontal drag over `target`: a leftward one is `next`, a rightward one is `previous`. */
export function useHorizontalSwipe(
  target: Ref<HTMLElement | null>,
  options: { onSwipe: (direction: SwipeDirection) => void; disabled?: () => boolean; threshold?: number },
) {
  const threshold = options.threshold ?? 48;
  let start: { id: number; x: number; y: number } | null = null;
  // Pointers down on the target; a second finger turns the gesture into a pinch, which is never a swipe.
  const down = new Set<number>();

  useEventListener(target, 'pointerdown', (event: PointerEvent) => {
    down.add(event.pointerId);
    const ignored = (event.target as Element | null)?.closest(IGNORED_TARGETS);
    start =
      down.size > 1 || options.disabled?.() || ignored
        ? null
        : { id: event.pointerId, x: event.clientX, y: event.clientY };
  });

  // The release is watched on the window: a mouse that leaves the target before release still swiped.
  useEventListener(window, 'pointerup', (event: PointerEvent) => {
    down.delete(event.pointerId);
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (options.disabled?.() || Math.abs(dx) <= threshold || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
    options.onSwipe(dx < 0 ? 'next' : 'previous');
  });

  useEventListener(window, 'pointercancel', (event: PointerEvent) => {
    down.delete(event.pointerId);
    start = null;
  });
}

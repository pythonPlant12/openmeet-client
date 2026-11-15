import { useMediaQuery } from '@vueuse/core';
import { computed, nextTick, ref, type Ref } from 'vue';

import { type Corner, nearestCorner } from '@/lib/meeting-layout';

/** Moving further than this is a drag, not a tap. */
const DRAG_THRESHOLD_PX = 6;
const SNAP_MS = 320;
const SNAP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export interface CornerDragOptions {
  /** The picture that is dragged. Its layout position (left, top) is the caller's; this only adds a transform. */
  element: Ref<HTMLElement | null>;
  /** The area whose corners the picture snaps to. */
  area: Ref<HTMLElement | null>;
  initialCorner?: Corner;
  /** Called when a drag ends on a release, so the click that follows can be ignored. Taps never call it. */
  onDragEnd?: () => void;
}

/**
 * Drags a corner picture (the phone 1:1 self view, the mini call) to any corner of its area. While the finger
 * moves, the picture follows with a transform and no transition, so it never lags. On release the corner
 * changes and the picture is held where it was let go, then only the transform animates into place: the
 * layout position never transitions, so the picture never jumps back to the old corner first.
 */
export function useCornerDrag(options: CornerDragOptions) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const corner = ref<Corner>(options.initialCorner ?? 'bottom-right');
  const offset = ref<{ x: number; y: number } | null>(null);
  const snapping = ref(false);
  let snapTimer: number | undefined;
  let drag: {
    pointerId: number;
    startX: number;
    startY: number;
    /** Centre of the picture at the start, relative to the area. */
    centerX: number;
    centerY: number;
    areaWidth: number;
    areaHeight: number;
  } | null = null;

  const dragging = computed(() => offset.value !== null && !snapping.value);
  const style = computed(() => {
    const current = offset.value;
    if (snapping.value) return { transition: `transform ${SNAP_MS}ms ${SNAP_EASING}` };
    if (current) return { transform: `translate(${current.x}px, ${current.y}px)`, transition: 'none' };
    return {};
  });

  function start(event: PointerEvent) {
    if (event.button !== 0 || !options.area.value || !options.element.value) return;
    // Keeps a held finger from also opening a menu, and the page from scrolling under the drag.
    event.preventDefault();
    const element = options.element.value;
    element.setPointerCapture?.(event.pointerId);
    const area = options.area.value.getBoundingClientRect();
    const view = element.getBoundingClientRect();
    window.clearTimeout(snapTimer);
    snapping.value = false;
    offset.value = null;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: view.left - area.left + view.width / 2,
      centerY: view.top - area.top + view.height / 2,
      areaWidth: area.width,
      areaHeight: area.height,
    };
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const x = event.clientX - drag.startX;
    const y = event.clientY - drag.startY;
    if (offset.value || Math.hypot(x, y) > DRAG_THRESHOLD_PX) offset.value = { x, y };
  }

  async function end(event: PointerEvent) {
    const current = drag;
    if (!current || event.pointerId !== current.pointerId) return;
    drag = null;
    const moved = offset.value;
    const element = options.element.value;
    if (!moved || !element) {
      offset.value = null;
      return;
    }
    if (event.type === 'pointerup') options.onDragEnd?.();

    // FLIP: remember where the picture was let go, move it to its new corner, hold it visually in place, then
    // let the transform animate away.
    const first = element.getBoundingClientRect();
    corner.value = nearestCorner(
      current.centerX + moved.x,
      current.centerY + moved.y,
      current.areaWidth,
      current.areaHeight,
    );
    offset.value = null;
    await nextTick();
    if (drag || reducedMotion.value) return;
    const last = element.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx === 0 && dy === 0) return;
    offset.value = { x: dx, y: dy };
    await nextTick();
    // The held position must be painted before the transition starts, or the browser skips the animation.
    void element.offsetWidth;
    window.requestAnimationFrame(() => {
      if (drag) return;
      snapping.value = true;
      offset.value = null;
      snapTimer = window.setTimeout(() => {
        snapping.value = false;
      }, SNAP_MS);
    });
  }

  return { corner, dragging, style, start, move, end };
}

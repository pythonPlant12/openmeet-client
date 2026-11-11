import { useEventListener } from '@vueuse/core';
import { type Ref, computed, readonly, ref, watch } from 'vue';

import { DOUBLE_TAP_ZOOM, IDENTITY_ZOOM, type Size, type ZoomState, clampPan, zoomAt } from '@/lib/zoom';

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 24;
// A pointer that moves further than this is a drag, not a tap.
const TAP_SLOP = 10;
const WHEEL_SPEED = 0.002;

/**
 * Pinch, wheel, and double-tap zoom for `target`, with one-finger panning while zoomed. The caller applies
 * `zoom` as `translate(x, y) scale(scale)` around the element's center. `media` is the zoomed element, centered
 * in `target`; panning stops at its edges. Without it, the media is taken to fill `target`.
 */
export function usePinchZoom(
  target: Ref<HTMLElement | null>,
  options: { disabled?: () => boolean; media?: () => HTMLElement | null | undefined } = {},
) {
  const zoom = ref<ZoomState>({ ...IDENTITY_ZOOM });
  const isZoomed = computed(() => zoom.value.scale > 1);
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; from: ZoomState } | null = null;
  let tapStart: { x: number; y: number } | null = null;
  let lastTap: { time: number; x: number; y: number } | null = null;

  // The page must not scroll or zoom under the gestures; the viewport already disables page zoom.
  watch(target, (element) => element?.style.setProperty('touch-action', 'none'), { immediate: true });

  // The media's untransformed layout size, then the stage's size.
  function bounds(): [Size, Size] {
    const rect = target.value!.getBoundingClientRect();
    const stage = { width: rect.width, height: rect.height };
    const media = options.media?.();
    return [media?.offsetWidth ? { width: media.offsetWidth, height: media.offsetHeight } : stage, stage];
  }

  function fromCenter(clientX: number, clientY: number) {
    const rect = target.value!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function reset() {
    zoom.value = { ...IDENTITY_ZOOM };
    pointers.clear();
    pinch = null;
    lastTap = null;
  }

  useEventListener(target, 'pointerdown', (event: PointerEvent) => {
    if (options.disabled?.()) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    tapStart = pointers.size === 1 ? { x: event.clientX, y: event.clientY } : null;
    if (pointers.size === 2) pinch = { distance: pinchDistance(), from: zoom.value };
  });

  useEventListener(target, 'pointermove', (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (tapStart && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > TAP_SLOP) tapStart = null;
    if (pinch && pointers.size === 2 && pinch.distance > 0) {
      const [a, b] = [...pointers.values()];
      const center = fromCenter((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      zoom.value = zoomAt(pinch.from, pinch.from.scale * (pinchDistance() / pinch.distance), center, ...bounds());
    } else if (pointers.size === 1 && isZoomed.value) {
      const { x, y } = zoom.value;
      zoom.value = clampPan(
        { ...zoom.value, x: x + event.clientX - previous.x, y: y + event.clientY - previous.y },
        ...bounds(),
      );
    }
  });

  function release(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size < 2) pinch = null;
    if (event.type !== 'pointerup' || !tapStart || pointers.size > 0) return;
    tapStart = null;
    const now = performance.now();
    const isDoubleTap =
      lastTap &&
      now - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < DOUBLE_TAP_DISTANCE;
    if (!isDoubleTap) {
      lastTap = { time: now, x: event.clientX, y: event.clientY };
      return;
    }
    // A third tap starts a new pair instead of toggling again.
    lastTap = null;
    zoom.value = isZoomed.value
      ? { ...IDENTITY_ZOOM }
      : zoomAt(zoom.value, DOUBLE_TAP_ZOOM, fromCenter(event.clientX, event.clientY), ...bounds());
  }

  // A mouse released outside the stage must still end its drag, or the image would pan on plain hover.
  useEventListener(window, 'pointerup', release);
  useEventListener(window, 'pointercancel', release);

  useEventListener(
    target,
    'wheel',
    (event: WheelEvent) => {
      if (options.disabled?.()) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * WHEEL_SPEED);
      zoom.value = zoomAt(zoom.value, zoom.value.scale * factor, fromCenter(event.clientX, event.clientY), ...bounds());
    },
    { passive: false },
  );

  return { zoom: readonly(zoom), isZoomed, reset };
}

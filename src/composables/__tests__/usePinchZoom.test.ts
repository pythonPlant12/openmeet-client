import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { useHorizontalSwipe } from '@/composables/useHorizontalSwipe';
import { usePinchZoom } from '@/composables/usePinchZoom';
import { IDENTITY_ZOOM } from '@/lib/zoom';

async function mountZoom() {
  const onSwipe = vi.fn();
  let api!: ReturnType<typeof usePinchZoom>;
  const wrapper = mount(
    defineComponent(() => {
      const target = ref<HTMLElement | null>(null);
      api = usePinchZoom(target);
      useHorizontalSwipe(target, { onSwipe, disabled: () => api.isZoomed.value });
      return () => h('div', { ref: target });
    }),
    { attachTo: document.body },
  );
  const element = wrapper.element as HTMLElement;
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
    right: 400,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  // `useEventListener` attaches once the template ref is set.
  await nextTick();
  return { element, api, onSwipe };
}

function tap(element: Element, x: number, y: number) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}

describe('usePinchZoom', () => {
  it('zooms in with the mouse wheel around the cursor', async () => {
    const { element, api } = await mountZoom();
    element.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -500, clientX: 200, clientY: 150 }),
    );
    expect(api.zoom.value.scale).toBeGreaterThan(1);
    expect(api.isZoomed.value).toBe(true);
  });

  it('toggles 2.5x and back with a double tap', async () => {
    const { element, api } = await mountZoom();
    tap(element, 200, 150);
    tap(element, 200, 150);
    expect(api.zoom.value.scale).toBe(2.5);
    tap(element, 200, 150);
    tap(element, 200, 150);
    expect(api.zoom.value).toEqual(IDENTITY_ZOOM);
  });

  it('resets to 1x', async () => {
    const { element, api } = await mountZoom();
    element.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -500, clientX: 200, clientY: 150 }),
    );
    api.reset();
    expect(api.zoom.value).toEqual(IDENTITY_ZOOM);
  });

  it('does not report a swipe while zoomed', async () => {
    const { element, onSwipe } = await mountZoom();
    element.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -500, clientX: 200, clientY: 150 }),
    );
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 150, pointerId: 2 }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 150, clientY: 150, pointerId: 2 }));
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('stops panning after a release outside the stage', async () => {
    const { element, api } = await mountZoom();
    element.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -500, clientX: 200, clientY: 150 }),
    );
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 150, pointerId: 3 }));
    document.body.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 200, clientY: 150, pointerId: 3 }),
    );
    const before = { ...api.zoom.value };
    element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 150, pointerId: 3 }));
    expect(api.zoom.value).toEqual(before);
  });
});

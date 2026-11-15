import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { type Corner } from '@/lib/meeting-layout';
import { useCornerDrag } from '@/composables/useCornerDrag';

const AREA = { left: 0, top: 0, width: 390, height: 700 };
// Where the picture sits in each corner, as the layout would place it.
const CORNER_RECTS: Record<Corner, { left: number; top: number }> = {
  'top-left': { left: 12, top: 12 },
  'top-right': { left: 270, top: 12 },
  'bottom-left': { left: 12, top: 550 },
  'bottom-right': { left: 270, top: 550 },
};

function mountDrag(options: { onDragEnd?: () => void } = {}) {
  const wrapper = mount(
    defineComponent(() => {
      const area = ref<HTMLElement | null>(null);
      const picture = ref<HTMLElement | null>(null);
      const drag = useCornerDrag({ element: picture, area, ...options });
      return () =>
        h('div', { ref: area, 'data-testid': 'area' }, [
          h('div', {
            ref: picture,
            'data-testid': 'picture',
            'data-corner': drag.corner.value,
            'data-dragging': String(drag.dragging.value),
            style: drag.style.value,
            onPointerdown: drag.start,
            onPointermove: drag.move,
            onPointerup: drag.end,
            onPointercancel: drag.end,
          }),
        ]);
    }),
    { attachTo: document.body },
  );
  return wrapper;
}

function pointer(type: string, init: PointerEventInit) {
  return new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, ...init });
}

describe('useCornerDrag', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid !== 'picture') {
        return { ...AREA, right: AREA.width, bottom: AREA.height, x: 0, y: 0 } as DOMRect;
      }
      const corner = CORNER_RECTS[(this.dataset.corner as Corner) ?? 'bottom-right'];
      // A picture mid-drag is reported where its transform put it.
      const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(this.style.transform);
      const left = corner.left + (match ? Number(match[1]) : 0);
      const top = corner.top + (match ? Number(match[2]) : 0);
      return { left, top, width: 108, height: 144, right: left + 108, bottom: top + 144, x: left, y: top } as DOMRect;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('follows the pointer with a transform and no transition while dragging', async () => {
    const wrapper = mountDrag();
    const picture = wrapper.get('[data-testid="picture"]');
    expect(picture.attributes('data-corner')).toBe('bottom-right');

    picture.element.dispatchEvent(pointer('pointerdown', { clientX: 320, clientY: 620 }));
    picture.element.dispatchEvent(pointer('pointermove', { clientX: 300, clientY: 580 }));
    await nextTick();

    expect(picture.attributes('data-dragging')).toBe('true');
    expect(picture.attributes('style')).toContain('transform: translate(-20px, -40px)');
    expect(picture.attributes('style')).toContain('transition: none');
    // The corner, and so the layout position, never changes mid-drag.
    expect(picture.attributes('data-corner')).toBe('bottom-right');
  });

  it('settles into the nearest corner by animating only the transform from where it was let go', async () => {
    const onDragEnd = vi.fn();
    const wrapper = mountDrag({ onDragEnd });
    const picture = wrapper.get('[data-testid="picture"]');

    picture.element.dispatchEvent(pointer('pointerdown', { clientX: 320, clientY: 620 }));
    picture.element.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 60 }));
    await nextTick();
    picture.element.dispatchEvent(pointer('pointerup', { clientX: 40, clientY: 60 }));
    await flushPromises();

    // The corner changed; the picture is held where it was let go: (270-280, 550-560) = (-10, -10) against (12, 12).
    expect(picture.attributes('data-corner')).toBe('top-left');
    expect(picture.attributes('style')).toContain('transform: translate(-22px, -22px)');
    expect(picture.attributes('style')).toContain('transition: none');

    // The next frame plays the snap: the transform animates away.
    vi.advanceTimersToNextFrame();
    await nextTick();
    expect(picture.attributes('style')).not.toContain('translate(-22px');
    expect(picture.attributes('style')).toMatch(/transition: transform/);
    expect(picture.attributes('data-dragging')).toBe('false');
    expect(onDragEnd).toHaveBeenCalledTimes(1);

    // Once the snap is over, the picture carries no transition, so the next drag starts clean.
    vi.advanceTimersByTime(400);
    await nextTick();
    expect(picture.attributes('style') ?? '').not.toContain('transition: transform');
  });

  it('treats a short move as a tap: no corner change, no drag end', async () => {
    const onDragEnd = vi.fn();
    const wrapper = mountDrag({ onDragEnd });
    const picture = wrapper.get('[data-testid="picture"]');

    picture.element.dispatchEvent(pointer('pointerdown', { clientX: 320, clientY: 620 }));
    picture.element.dispatchEvent(pointer('pointermove', { clientX: 323, clientY: 622 }));
    picture.element.dispatchEvent(pointer('pointerup', { clientX: 323, clientY: 622 }));
    await flushPromises();

    expect(picture.attributes('data-corner')).toBe('bottom-right');
    expect(picture.attributes('style') ?? '').not.toContain('translate');
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('keeps the corner for later drags', async () => {
    const wrapper = mountDrag();
    const picture = wrapper.get('[data-testid="picture"]');

    picture.element.dispatchEvent(pointer('pointerdown', { clientX: 320, clientY: 620 }));
    picture.element.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 620 }));
    picture.element.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 620 }));
    await flushPromises();
    vi.advanceTimersToNextFrame();
    vi.advanceTimersByTime(400);
    await nextTick();
    expect(picture.attributes('data-corner')).toBe('bottom-left');

    picture.element.dispatchEvent(pointer('pointerdown', { clientX: 60, clientY: 620 }));
    picture.element.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 80 }));
    picture.element.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 80 }));
    await flushPromises();
    expect(picture.attributes('data-corner')).toBe('top-left');
  });
});

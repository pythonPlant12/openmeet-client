import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { useHorizontalSwipe } from '@/composables/useHorizontalSwipe';

async function mountSwipe(options: { disabled?: () => boolean } = {}) {
  const onSwipe = vi.fn();
  const wrapper = mount(
    defineComponent(() => {
      const target = ref<HTMLElement | null>(null);
      useHorizontalSwipe(target, { onSwipe, ...options });
      return () => h('div', { ref: target }, [h('video'), h('span', 'item')]);
    }),
    { attachTo: document.body },
  );
  // `useEventListener` attaches once the template ref is set.
  await nextTick();
  return { wrapper, onSwipe };
}

function drag(element: Element, from: number, to: number, dy = 0) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: from, clientY: 100, pointerId: 1 }));
  element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to, clientY: 100 + dy, pointerId: 1 }));
}

describe('useHorizontalSwipe', () => {
  it('reports a left drag as next and a right drag as previous', async () => {
    const { wrapper, onSwipe } = await mountSwipe();
    drag(wrapper.get('span').element, 200, 100);
    drag(wrapper.get('span').element, 100, 200);
    expect(onSwipe.mock.calls).toEqual([['next'], ['previous']]);
  });

  it('ignores short and mostly vertical drags', async () => {
    const { wrapper, onSwipe } = await mountSwipe();
    drag(wrapper.get('span').element, 200, 170);
    drag(wrapper.get('span').element, 200, 120, 160);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', async () => {
    const { wrapper, onSwipe } = await mountSwipe({ disabled: () => true });
    drag(wrapper.get('span').element, 200, 100);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('ignores pointers that start on interactive media', async () => {
    const { wrapper, onSwipe } = await mountSwipe();
    drag(wrapper.get('video').element, 200, 100);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('reports a swipe that ends outside the target', async () => {
    const { wrapper, onSwipe } = await mountSwipe();
    const span = wrapper.get('span').element;
    span.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 100, pointerId: 1 }));
    document.body.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 20, clientY: 100, pointerId: 1 }),
    );
    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('does not report a two-finger pinch as a swipe', async () => {
    const { wrapper, onSwipe } = await mountSwipe();
    const span = wrapper.get('span').element;
    span.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 150, clientY: 100, pointerId: 1 }));
    span.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 250, clientY: 100, pointerId: 2 }));
    span.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 120, clientY: 100, pointerId: 2 }));
    span.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 100, pointerId: 1 }));
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

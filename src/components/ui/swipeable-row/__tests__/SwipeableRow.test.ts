import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { SwipeableRow } from '@/components/ui/swipeable-row';

// The spring jumps straight to its target so assertions read the settled position.
const animate = vi.hoisted(() =>
  vi.fn((_from: number, to: number, options: { onUpdate: (value: number) => void }) => {
    options.onUpdate(to);
    return { stop: vi.fn() };
  }),
);
vi.mock('motion-v', () => ({ animate }));

const mounted: { unmount: () => void }[] = [];
const onRowClick = vi.fn();
const onAction = vi.fn();

function mountRow(props: Record<string, unknown> = {}) {
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            SwipeableRow,
            { id: 'row-1', leadingWidth: 80, trailingWidth: 80, fullSwipeLeading: true, ...props },
            {
              leading: ({ armed }: { armed: boolean }) =>
                h('button', { 'data-swipe-action': '', 'data-armed': String(armed), onClick: onAction }, 'Read'),
              trailing: () => h('button', { 'data-swipe-action': '' }, 'Delete'),
              default: () => h('button', { 'data-row': '', onClick: onRowClick }, 'Conversation'),
            },
          );
      },
    }),
    { attachTo: document.body },
  );
  mounted.push(wrapper);
  return wrapper;
}

function pointer(type: string, clientX: number, clientY = 0) {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX, clientY, button: 0 });
}

function dispatchSwipe(wrapper: ReturnType<typeof mountRow>, deltaX: number, deltaY = 0) {
  const root = wrapper.get('[data-swipeable-row]').element;
  root.dispatchEvent(pointer('pointerdown', 0, 0));
  root.dispatchEvent(pointer('pointermove', deltaX / 2, deltaY / 2));
  root.dispatchEvent(pointer('pointermove', deltaX, deltaY));
  root.dispatchEvent(pointer('pointerup', deltaX, deltaY));
}

// Waits a macrotask, like a real follow-up tap, so the post-swipe click guard has expired.
async function swipe(wrapper: ReturnType<typeof mountRow>, deltaX: number, deltaY = 0) {
  dispatchSwipe(wrapper, deltaX, deltaY);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
}

function contentOffset(wrapper: ReturnType<typeof mountRow>) {
  return (wrapper.get('[data-swipe-content]').element as HTMLElement).style.transform;
}

afterEach(() => {
  // Open rows keep document listeners, so every row must unmount before the next test.
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  animate.mockClear();
  onRowClick.mockReset();
  onAction.mockReset();
  document.body.innerHTML = '';
});

describe('SwipeableRow', () => {
  it('stops at the maximum distance in both directions', async () => {
    const wrapper = mountRow({ fullSwipeTrailing: true, fullSwipeDistance: 56, maxDistance: 84 });
    const root = wrapper.get('[data-swipeable-row]').element;

    root.dispatchEvent(pointer('pointerdown', 0));
    root.dispatchEvent(pointer('pointermove', 20));
    root.dispatchEvent(pointer('pointermove', 400));
    await wrapper.vm.$nextTick();
    expect(contentOffset(wrapper)).toBe('translate3d(84px, 0, 0)');
    root.dispatchEvent(pointer('pointermove', 80));
    await wrapper.vm.$nextTick();
    // Past the full-swipe distance the row resists: 56 + (80 - 56) * 0.25.
    expect(contentOffset(wrapper)).toBe('translate3d(62px, 0, 0)');
    root.dispatchEvent(pointer('pointermove', -400));
    await wrapper.vm.$nextTick();
    expect(contentOffset(wrapper)).toBe('translate3d(-84px, 0, 0)');
    root.dispatchEvent(pointer('pointerup', -400));
  });

  it('hides closed action panes completely, so no sliver shows at the row edges', () => {
    const wrapper = mountRow();

    expect(wrapper.get('[data-swipe-pane="leading"]').classes()).toContain('invisible');
    expect(wrapper.get('[data-swipe-pane="trailing"]').classes()).toContain('invisible');
  });

  it('reveals leading actions on a short swipe right and keeps them open', async () => {
    const wrapper = mountRow();

    await swipe(wrapper, 60);

    expect(contentOffset(wrapper)).toBe('translate3d(80px, 0, 0)');
    expect(wrapper.get('[data-swipe-pane="leading"]').attributes('aria-hidden')).toBe('false');
    expect(wrapper.emitted('full-swipe-leading')).toBeUndefined();
  });

  it('runs the leading action directly on a strong swipe and closes', async () => {
    const wrapper = mountRow();

    await swipe(wrapper, 400);

    expect(wrapper.findComponent(SwipeableRow).emitted('full-swipe-leading')).toHaveLength(1);
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
  });

  it('settles with a spring that starts from the release velocity', async () => {
    let now = 1_000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => (now += 16));
    const wrapper = mountRow();

    await swipe(wrapper, 400);
    clock.mockRestore();

    const [from, to, options] = animate.mock.calls[animate.mock.calls.length - 1]!;
    expect(from).toBeGreaterThan(80);
    expect(to).toBe(0);
    expect(options).toMatchObject({ type: 'spring', stiffness: 380, damping: 20 });
    expect((options as unknown as { velocity: number }).velocity).toBeGreaterThan(0);
  });

  it('uses the firmer spring for ordinary snaps', async () => {
    const wrapper = mountRow();

    await swipe(wrapper, 60);

    expect(animate.mock.calls[animate.mock.calls.length - 1]![2]).toMatchObject({ stiffness: 520, damping: 32 });
  });

  it('does not reveal the opposite actions while a bounce overshoots', async () => {
    let finish: (() => void) | undefined;
    animate.mockImplementationOnce((_from, _to, options) => {
      const callbacks = options as unknown as { onUpdate: (value: number) => void; onComplete: () => void };
      callbacks.onUpdate(-30);
      finish = () => {
        callbacks.onUpdate(0);
        callbacks.onComplete();
      };
      return { stop: vi.fn() };
    });
    const wrapper = mountRow();

    await swipe(wrapper, 400);

    expect(contentOffset(wrapper)).toBe('translate3d(-30px, 0, 0)');
    expect((wrapper.get('[data-swipe-pane="trailing"]').element as HTMLElement).style.width).toBe('0px');
    finish?.();
    await wrapper.vm.$nextTick();
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
  });

  it('reveals trailing actions on a swipe left without a full-swipe action', async () => {
    const wrapper = mountRow();

    await swipe(wrapper, -400);

    expect(contentOffset(wrapper)).toBe('translate3d(-80px, 0, 0)');
    expect(wrapper.findComponent(SwipeableRow).emitted('full-swipe-leading')).toBeUndefined();
  });

  it('runs a trailing full swipe when enabled', async () => {
    const wrapper = mountRow({ fullSwipeTrailing: true });

    await swipe(wrapper, -400);

    expect(wrapper.findComponent(SwipeableRow).emitted('full-swipe-trailing')).toHaveLength(1);
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
  });

  it('never rests open in momentary mode and honours a custom trigger distance', async () => {
    const wrapper = mountRow({ momentary: true, fullSwipeDistance: 50, fullSwipeTrailing: true });

    await swipe(wrapper, 40);
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
    expect(wrapper.findComponent(SwipeableRow).emitted('full-swipe-leading')).toBeUndefined();

    await swipe(wrapper, 60);
    expect(wrapper.findComponent(SwipeableRow).emitted('full-swipe-leading')).toHaveLength(1);

    await swipe(wrapper, -60);
    expect(wrapper.findComponent(SwipeableRow).emitted('full-swipe-trailing')).toHaveLength(1);
  });

  it('clips both axes by default and only sideways when asked', () => {
    expect(mountRow().get('[data-swipeable-row]').classes()).toContain('overflow-hidden');
    const sideways = mountRow({ id: 'row-2', clipHorizontally: true }).get('[data-swipeable-row]');
    expect(sideways.classes()).toContain('harbor-clip-x');
    expect(sideways.classes()).not.toContain('overflow-hidden');
  });

  it('leaves vertical gestures to native scrolling', async () => {
    const wrapper = mountRow();

    await swipe(wrapper, 10, 120);

    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
  });

  it('does not activate the row after a swipe, and a tap on an open row closes it', async () => {
    const wrapper = mountRow();
    await swipe(wrapper, 60);

    await wrapper.get('[data-row]').trigger('click');

    expect(onRowClick).not.toHaveBeenCalled();
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');

    await wrapper.get('[data-row]').trigger('click');
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('ignores the click generated by the swipe gesture itself', async () => {
    const wrapper = mountRow();

    dispatchSwipe(wrapper, 400);
    await wrapper.get('[data-row]').trigger('click');

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('keeps a half-swiped row open when the release produces a click', async () => {
    const wrapper = mountRow();

    dispatchSwipe(wrapper, 60);
    await wrapper.get('[data-row]').trigger('click');

    expect(onRowClick).not.toHaveBeenCalled();
    expect(contentOffset(wrapper)).toBe('translate3d(80px, 0, 0)');
  });

  it('keeps a partly swiped row open on either side until the next interaction', async () => {
    const wrapper = mountRow();

    dispatchSwipe(wrapper, -60);
    await wrapper.get('[data-row]').trigger('click');
    expect(contentOffset(wrapper)).toBe('translate3d(-80px, 0, 0)');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.get('[data-row]').trigger('click');
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
  });

  it('cancels native drags so row content moves with the swipe', () => {
    const wrapper = mountRow();
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });

    wrapper.get('[data-row]').element.dispatchEvent(dragStart);

    expect(dragStart.defaultPrevented).toBe(true);
  });

  it('lets revealed action buttons be clicked', async () => {
    const wrapper = mountRow();
    await swipe(wrapper, 60);

    await wrapper.get('[data-swipe-pane="leading"] button').trigger('click');

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('swipes with trackpad horizontal scrolling', async () => {
    vi.useFakeTimers();
    const wrapper = mountRow();
    const root = wrapper.get('[data-swipeable-row]').element;

    root.dispatchEvent(new WheelEvent('wheel', { deltaX: -30, deltaY: 0, bubbles: true, cancelable: true }));
    root.dispatchEvent(new WheelEvent('wheel', { deltaX: -30, deltaY: 0, bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(200);

    expect(contentOffset(wrapper)).toBe('translate3d(80px, 0, 0)');
    vi.useRealTimers();
  });

  it('ignores vertical trackpad scrolling that drifts slightly sideways', async () => {
    vi.useFakeTimers();
    const wrapper = mountRow();
    const root = wrapper.get('[data-swipeable-row]').element;
    const wheel = (deltaX: number, deltaY: number) =>
      new WheelEvent('wheel', { deltaX, deltaY, bubbles: true, cancelable: true });

    const scroll = wheel(-6, 40);
    root.dispatchEvent(scroll);
    root.dispatchEvent(wheel(-8, 10));
    await vi.advanceTimersByTimeAsync(200);

    expect(scroll.defaultPrevented).toBe(false);
    expect(contentOffset(wrapper)).toBe('translate3d(0px, 0, 0)');
    vi.useRealTimers();
  });

  it('closes when another row opens', async () => {
    const first = mountRow();
    const second = mountRow({ id: 'row-2' });
    await swipe(first, 60);

    await swipe(second, 60);

    expect(contentOffset(first)).toBe('translate3d(0px, 0, 0)');
    expect(contentOffset(second)).toBe('translate3d(80px, 0, 0)');
  });
});

import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LiquidTabBar from '@/components/layout/LiquidTabBar.vue';

const items = [
  { key: 'chats', label: 'Chats' },
  { key: 'calls', label: 'Calls' },
];

function pointer(type: string, pointerType = 'touch') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LiquidTabBar long-press', () => {
  it('reports a held touch on a long-press item instead of selecting it', async () => {
    const wrapper = mount(LiquidTabBar, {
      props: { items, activeKey: 'chats', label: 'Workspace', longPressKeys: ['calls'] },
    });
    const calls = wrapper.get('[data-tab="calls"]').element;
    calls.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(600);
    calls.dispatchEvent(pointer('pointerup'));
    calls.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(wrapper.emitted('longPress')).toEqual([['calls']]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('keeps a short tap a normal selection, and ignores holds on other items or with a mouse', async () => {
    const wrapper = mount(LiquidTabBar, {
      props: { items, activeKey: 'chats', label: 'Workspace', longPressKeys: ['calls'] },
    });
    const calls = wrapper.get('[data-tab="calls"]');
    calls.element.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(200);
    calls.element.dispatchEvent(pointer('pointerup'));
    await calls.trigger('click');
    calls.element.dispatchEvent(pointer('pointerdown', 'mouse'));
    vi.advanceTimersByTime(600);
    wrapper.get('[data-tab="chats"]').element.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(600);

    expect(wrapper.emitted('select')).toEqual([['calls']]);
    expect(wrapper.emitted('longPress')).toBeUndefined();
  });
});

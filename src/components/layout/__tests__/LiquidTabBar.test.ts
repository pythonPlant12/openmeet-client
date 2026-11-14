import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

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

describe('LiquidTabBar links', () => {
  // Records the `animate` prop the bar gives the icon.
  const Icon = defineComponent({
    props: ['animate'],
    setup: (props) => () => h('svg', { 'data-animate': String(props.animate) }),
  });
  const linkItems = [
    { key: 'chats', label: 'Chats', icon: Icon, to: '/chats' },
    { key: 'calls', label: 'Calls', icon: Icon, to: '/calls', holdsPressedIcon: true },
  ];

  async function mountWithRouter(activeKey: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/chats', component: { template: '<div />' } },
        { path: '/calls', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    const wrapper = mount(LiquidTabBar, {
      props: { items: linkItems, activeKey, label: 'Workspace', longPressKeys: ['calls'] },
      global: { plugins: [router] },
    });
    return { wrapper, router };
  }

  it('renders a long-press item as a button that navigates on tap, so a phone shows no link menu', async () => {
    const { wrapper, router } = await mountWithRouter('chats');
    expect(wrapper.get('[data-tab="chats"]').element.tagName).toBe('A');
    const calls = wrapper.get('[data-tab="calls"]');
    expect(calls.element.tagName).toBe('BUTTON');

    await calls.trigger('click');
    await vi.runAllTimersAsync();
    expect(router.currentRoute.value.path).toBe('/calls');
  });

  it('keeps the pressed icon pose while a holding item is the current tab', async () => {
    const { wrapper } = await mountWithRouter('calls');
    expect(wrapper.get('[data-tab="calls"] svg').attributes('data-animate')).toBe('true');
    expect(wrapper.get('[data-tab="chats"] svg').attributes('data-animate')).toBe('false');

    await wrapper.setProps({ activeKey: 'chats' });
    expect(wrapper.get('[data-tab="calls"] svg').attributes('data-animate')).toBe('false');
  });
});

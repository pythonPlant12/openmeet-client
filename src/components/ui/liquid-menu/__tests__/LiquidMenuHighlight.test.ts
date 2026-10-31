import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import LiquidMenuHighlight from '@/components/ui/liquid-menu/LiquidMenuHighlight.vue';

// A menu-shaped host: the bubble watches its parent, the element with role="menu".
const Menu = defineComponent({
  setup() {
    return () =>
      h('div', { role: 'menu' }, [
        h(LiquidMenuHighlight),
        h('div', { role: 'menuitem', 'data-item': 'open' }, 'Open'),
        h('div', { role: 'menuitem', 'data-item': 'delete', class: 'harbor-context-menu-danger' }, 'Delete'),
      ]);
  },
});

describe('LiquidMenuHighlight', () => {
  it('follows the highlighted item and warms up on destructive ones', async () => {
    const wrapper = mount(Menu, { attachTo: document.body });
    const bubble = () => wrapper.get('.liquid-menu-bubble');
    expect(bubble().attributes('data-visible')).toBeUndefined();

    wrapper.get('[data-item="open"]').element.setAttribute('data-highlighted', '');
    await flushPromises();
    expect(bubble().attributes('data-visible')).toBe('true');
    expect(bubble().attributes('data-tone')).toBe('default');

    wrapper.get('[data-item="open"]').element.removeAttribute('data-highlighted');
    wrapper.get('[data-item="delete"]').element.setAttribute('data-highlighted', '');
    await flushPromises();
    expect(bubble().attributes('data-tone')).toBe('danger');

    // Nothing highlighted for a moment, as when crossing between submenu triggers: the bubble keeps its place
    // and stays visible, then fades only if nothing new is highlighted.
    vi.useFakeTimers();
    const placed = bubble().attributes('style');
    wrapper.get('[data-item="delete"]').element.removeAttribute('data-highlighted');
    await flushPromises();
    expect(bubble().attributes('data-visible')).toBe('true');
    expect(bubble().attributes('style')).toBe(placed);
    await vi.advanceTimersByTimeAsync(200);
    expect(bubble().attributes('data-visible')).toBeUndefined();
    expect(bubble().attributes('style')).toBe(placed);
    vi.useRealTimers();
    wrapper.unmount();
  });
});

import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import LiquidGlassSurface from '@/components/layout/LiquidGlassSurface.vue';

function mountSurface(targetKey: string | null) {
  return mount(LiquidGlassSurface, {
    props: { targetKey, followHover: true },
    slots: {
      default: ({ targetKey: current }: { targetKey: string | null }) =>
        ['chat', 'share'].map((key) =>
          h('button', { 'data-liquid-key': key, 'data-current': String(current === key) }, key),
        ),
    },
  });
}

beforeEach(() => {
  // jsdom has no WebGL, so the surface takes its CSS drop fallback.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => vi.restoreAllMocks());

describe('LiquidGlassSurface', () => {
  it('rests the drop on its target and hides it without one', async () => {
    const wrapper = mountSurface('chat');
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('data-idle')).toBeUndefined();
    expect(wrapper.get('[data-liquid-key="chat"]').attributes('data-current')).toBe('true');

    await wrapper.setProps({ targetKey: null });
    expect(wrapper.attributes('data-idle')).toBe('true');
  });

  it('follows the hovered item with a mouse and returns when the pointer leaves', async () => {
    const wrapper = mountSurface('chat');
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-liquid-key="share"]').trigger('pointermove', { pointerType: 'mouse' });
    expect(wrapper.get('[data-liquid-key="share"]').attributes('data-current')).toBe('true');

    await wrapper.trigger('pointerleave');
    expect(wrapper.get('[data-liquid-key="chat"]').attributes('data-current')).toBe('true');
  });
});

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SplitText from '@/components/marketing/SplitText.vue';

vi.mock('motion-v', async () => {
  const { defineComponent, h } = await import('vue');

  return {
    motion: {
      span: defineComponent({
        inheritAttrs: false,
        props: ['animate', 'initial', 'transition'],
        setup(props, { attrs, slots }) {
          return () =>
            h(
              'span',
              {
                ...attrs,
                'data-opacity': props.animate?.opacity,
                'data-transition-type': props.transition?.type,
              },
              slots.default?.(),
            );
        },
      }),
    },
  };
});

const intersectionCallbacks = new Map<Element, IntersectionObserverCallback>();

enableAutoUnmount(afterEach);

function stubMotionPreference(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

beforeEach(() => {
  intersectionCallbacks.clear();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal('IntersectionObserver', function (callback: IntersectionObserverCallback) {
    return {
      disconnect: vi.fn(),
      observe: (element: Element) => intersectionCallbacks.set(element, callback),
    };
  });
  stubMotionPreference(false);
});

describe('SplitText', () => {
  it('renders words inside the requested semantic element', () => {
    const wrapper = mount(SplitText, { props: { as: 'h2', text: 'Meet without limits' } });

    expect(wrapper.element.tagName).toBe('H2');
    expect(wrapper.attributes('aria-label')).toBe('Meet without limits');
    expect(wrapper.findAll('[aria-hidden="true"]')).toHaveLength(3);
    expect(wrapper.text()).toBe('Meet without limits');
  });

  it('reveals words after entering the viewport', async () => {
    const wrapper = mount(SplitText, { props: { text: 'Visible on arrival' } });
    await flushPromises();

    expect(intersectionCallbacks.has(wrapper.element)).toBe(true);
    intersectionCallbacks.get(wrapper.element)?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('[data-opacity="1"]')).toHaveLength(3);
    expect(wrapper.find('[data-transition-type="spring"]').exists()).toBe(true);
  });

  it('shows text immediately when reduced motion is enabled', async () => {
    stubMotionPreference(true);
    const wrapper = mount(SplitText, { props: { text: 'No motion' } });
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('[data-opacity="1"]')).toHaveLength(2);
    expect(intersectionCallbacks.has(wrapper.element)).toBe(false);
  });
});

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import { useFullscreenLock } from '@/composables/useFullscreenLock';

const FullscreenLockHarness = defineComponent({
  setup() {
    useFullscreenLock();
    return () => null;
  },
});

const originalBodyStyles = document.body.style.cssText;
const originalHtmlStyles = document.documentElement.style.cssText;

afterEach(() => {
  document.body.style.cssText = originalBodyStyles;
  document.documentElement.style.cssText = originalHtmlStyles;
});

describe('useFullscreenLock', () => {
  it('restores pre-existing viewport overflow after unmounting', () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'scroll';

    const wrapper = mount(FullscreenLockHarness);

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    wrapper.unmount();

    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('scroll');
  });
});

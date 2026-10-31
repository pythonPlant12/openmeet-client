import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import IncomingCallBar from '@/components/layout/IncomingCallBar.vue';

function mountBar(props: Partial<{ name: string; more: number; isAnswering: boolean }> = {}) {
  return mount(IncomingCallBar, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })],
    },
    props: { name: 'OpenMeet testers', more: 0, isAnswering: false, ...props },
  });
}

describe('IncomingCallBar', () => {
  it('names the caller and answers or declines', async () => {
    const wrapper = mountBar({ more: 1 });
    expect(wrapper.get('[data-incoming-caller]').text()).toBe('OpenMeet testers');
    expect(wrapper.get('[data-incoming-call]').text()).toContain('1 more');

    await wrapper.get('[data-incoming-accept]').trigger('click');
    await wrapper.get('[data-incoming-decline]').trigger('click');
    expect(wrapper.emitted('accept')).toHaveLength(1);
    expect(wrapper.emitted('decline')).toHaveLength(1);
  });

  it('hides the answer buttons while a response is in flight', () => {
    const wrapper = mountBar({ isAnswering: true });
    expect(wrapper.find('[data-incoming-accept]').exists()).toBe(false);
    expect(wrapper.find('[data-incoming-decline]').exists()).toBe(false);
  });
});

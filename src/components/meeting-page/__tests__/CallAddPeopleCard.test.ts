import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import CallAddPeopleCard from '@/components/meeting-page/CallAddPeopleCard.vue';
import en from '@/locales/en.json';

function mountCard(alone: boolean) {
  return mount(CallAddPeopleCard, {
    props: { alone },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

describe('CallAddPeopleCard', () => {
  it('asks to add people while you are alone, and opens the invite', async () => {
    const card = mountCard(true);
    expect(card.text()).toContain('Add people');
    await card.get('button').trigger('click');
    expect(card.emitted('invite')).toHaveLength(1);
  });

  it('disappears once someone else is in the call', () => {
    expect(mountCard(false).find('button').exists()).toBe(false);
  });
});

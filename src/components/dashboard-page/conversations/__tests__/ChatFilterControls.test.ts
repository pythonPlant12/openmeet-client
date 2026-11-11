import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ChatFilterControls from '@/components/dashboard-page/conversations/ChatFilterControls.vue';

describe('ChatFilterControls', () => {
  it('is one switch labelled with the next view', () => {
    const wrapper = mount(ChatFilterControls, { props: { filter: 'groups' } });
    const labels = wrapper.findAll('button').map((button) => button.attributes('aria-label'));
    expect(labels).toEqual(['Show friends chats']);
  });

  it('emits the next view', async () => {
    const wrapper = mount(ChatFilterControls, { props: { filter: 'groups' } });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('switch')).toEqual([['direct']]);
  });
});

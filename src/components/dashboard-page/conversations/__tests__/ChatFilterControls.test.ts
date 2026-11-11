import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ChatFilterControls from '@/components/dashboard-page/conversations/ChatFilterControls.vue';

describe('ChatFilterControls', () => {
  it('labels the buttons for the current view', () => {
    const wrapper = mount(ChatFilterControls, { props: { filter: 'groups' } });
    const labels = wrapper.findAll('button').map((button) => button.attributes('aria-label'));
    expect(labels).toEqual(['Create group', 'Show friends chats']);
  });

  it('emits the action and the next view', async () => {
    const wrapper = mount(ChatFilterControls, { props: { filter: 'groups' } });
    const [action, toggle] = wrapper.findAll('button');
    await action!.trigger('click');
    await toggle!.trigger('click');
    expect(wrapper.emitted('action')).toEqual([['create-group']]);
    expect(wrapper.emitted('switch')).toEqual([['direct']]);
  });
});

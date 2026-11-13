import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import CallPhoneTopBar from '@/components/meeting-page/CallPhoneTopBar.vue';
import en from '@/locales/en.json';

enableAutoUnmount(afterEach);

function mountBar(props: Partial<InstanceType<typeof CallPhoneTopBar>['$props']> = {}) {
  return mount(CallPhoneTopBar, {
    props: {
      roomName: 'team-sync',
      participantCount: 3,
      meetingId: 'team-sync',
      inviteMode: 'enabled',
      isChatOpen: false,
      unreadCount: 0,
      ...props,
    },
    slots: { 'audio-output': '<button data-stub-audio-output />' },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

describe('CallPhoneTopBar', () => {
  it('shows the room name, the number of people, audio output, invite, and chat', () => {
    const wrapper = mountBar();

    expect(wrapper.text()).toContain('team-sync');
    expect(wrapper.text()).toContain('3');
    expect(wrapper.find('[data-stub-audio-output]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Open sharing options"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Open chat"]').exists()).toBe(true);
  });

  it('toggles the chat and counts unread messages on its button', async () => {
    const wrapper = mountBar({ unreadCount: 12 });
    const chat = wrapper.get('[data-chat-trigger]');

    expect(chat.attributes('aria-label')).toBe('Open chat, 12 unread messages');
    expect(chat.text()).toContain('9+');
    await chat.trigger('click');
    expect(wrapper.emitted('toggle-chat')).toHaveLength(1);

    await wrapper.setProps({ isChatOpen: true });
    expect(wrapper.get('[data-chat-trigger]').attributes('aria-label')).toBe('Close chat');
    expect(wrapper.get('[data-chat-trigger]').text()).not.toContain('9+');
  });
});

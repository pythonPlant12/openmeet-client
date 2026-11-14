import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import CallDesktopTopBar from '@/components/meeting-page/CallDesktopTopBar.vue';
import en from '@/locales/en.json';

function mountBar(props: Partial<InstanceType<typeof CallDesktopTopBar>['$props']> = {}) {
  return mount(CallDesktopTopBar, {
    props: { roomName: 'team-sync', isChatOpen: false, unreadCount: 0, ...props },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

describe('CallDesktopTopBar', () => {
  it('shows the room name on the left and toggles the chat on the right', async () => {
    const wrapper = mountBar({ unreadCount: 3 });
    expect(wrapper.get('[data-room-name]').text()).toBe('team-sync');

    const chat = wrapper.get('[data-chat-trigger]');
    expect(chat.attributes('aria-label')).toBe('Open chat, 3 unread messages');
    await chat.trigger('click');
    expect(wrapper.emitted('toggle-chat')).toHaveLength(1);
  });
});

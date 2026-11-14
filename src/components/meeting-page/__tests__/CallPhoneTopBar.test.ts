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
  it('shows the room name, audio output, invite, and chat, with no collapse button', () => {
    const wrapper = mountBar();

    expect(wrapper.get('[data-room-name]').text()).toContain('team-sync');
    expect(wrapper.find('[data-stub-audio-output]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Invite people"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Open chat"]').exists()).toBe(true);
    expect(wrapper.find('[data-collapse-call]').exists()).toBe(false);
  });

  it('opens the invite from its button', async () => {
    const wrapper = mountBar();
    await wrapper.get('button[aria-label="Invite people"]').trigger('click');
    expect(wrapper.emitted('invite')).toHaveLength(1);
  });

  it('opens the invite for guests too, and keeps the sharing menu for conversation calls', () => {
    expect(mountBar({ inviteMode: 'signedOut' }).find('button[aria-label="Invite people"]').exists()).toBe(true);
    expect(mountBar({ inviteMode: 'hidden' }).find('button[aria-label="Open sharing options"]').exists()).toBe(true);
  });

  it('opens the controls panel from the room name', async () => {
    const wrapper = mountBar();
    await wrapper.get('[data-room-name]').trigger('click');
    expect(wrapper.emitted('open-panel')).toHaveLength(1);
  });

  it('offers the camera flip only while the camera is on', async () => {
    expect(mountBar({ cameraOn: false }).find('[data-flip-camera]').exists()).toBe(false);

    const wrapper = mountBar({ cameraOn: true });
    await wrapper.get('[data-flip-camera]').trigger('click');
    expect(wrapper.emitted('flip-camera')).toHaveLength(1);
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

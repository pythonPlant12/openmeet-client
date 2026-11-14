import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

const haptics = vi.hoisted(() => ({ playHaptic: vi.fn() }));
vi.mock('@/services/haptics', () => haptics);

const { default: MeetingControls } = await import('@/components/meeting-page/MeetingControls.vue');

enableAutoUnmount(afterEach);

const stub = (marker: string) => ({ inheritAttrs: false, template: `<i data-bar-item="${marker}" />` });

function mountControls(props: Partial<InstanceType<typeof MeetingControls>['$props']> = {}) {
  return mount(MeetingControls, {
    props: {
      audioAvailable: true,
      videoAvailable: true,
      showConnectionStatus: false,
      isMuted: false,
      isVideoOff: true,
      meetingId: 'team-sync',
      inviteMode: 'enabled',
      participants: [],
      pinnedParticipantId: null,
      viewMode: 'grid',
      canPresent: true,
      ...props,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        MeetingMediaControl: { props: ['kind'], template: '<i :data-bar-item="kind" />' },
        MeetingScreenShareControl: stub('share'),
        MeetingActionMenu: stub('more'),
      },
    },
  });
}

describe('MeetingControls', () => {
  afterEach(() => haptics.playHaptic.mockReset());

  it('groups mic and camera, then share and more, then leave, with invite on the left and full screen on the right', () => {
    const wrapper = mountControls();
    const itemsIn = (selector: string) =>
      wrapper
        .get(selector)
        .findAll('[data-bar-item], [data-chat-trigger]')
        .map((item) => item.attributes('data-bar-item') ?? item.attributes('aria-label'));

    expect(itemsIn('[data-controls-group="media"]')).toEqual(['audio', 'video']);
    expect(itemsIn('[data-controls-group="actions"]')).toEqual(['share', 'more']);
    expect(wrapper.find('[data-chat-trigger]').exists()).toBe(false);
    expect(wrapper.find('[data-controls-group] button[aria-label="End call"]').exists()).toBe(false);
    expect(wrapper.get('button[aria-label="End call"]').classes()).toContain('call-button-leave');
    expect(wrapper.get('[data-fullscreen-toggle]').attributes('aria-label')).toBe('Full screen');
  });

  it('opens the invite from the button on the left, where inviting is possible', async () => {
    const wrapper = mountControls();
    await wrapper.get('[data-invite-trigger]').trigger('click');
    expect(wrapper.emitted('invite')).toHaveLength(1);

    expect(mountControls({ inviteMode: 'hidden' }).find('[data-invite-trigger]').exists()).toBe(false);
  });

  it('toggles full screen', async () => {
    const wrapper = mountControls();
    await wrapper.get('[data-fullscreen-toggle]').trigger('click');
    expect(wrapper.emitted('toggle-fullscreen')).toHaveLength(1);

    await wrapper.setProps({ fullscreen: true });
    expect(wrapper.get('[data-fullscreen-toggle]').attributes('aria-label')).toBe('Exit full screen');
  });

  it('leaves with a medium haptic', async () => {
    const wrapper = mountControls();
    await wrapper.get('button[aria-label="End call"]').trigger('click');

    expect(wrapper.emitted('end-call')).toHaveLength(1);
    expect(haptics.playHaptic).toHaveBeenCalledWith('medium');
  });
});

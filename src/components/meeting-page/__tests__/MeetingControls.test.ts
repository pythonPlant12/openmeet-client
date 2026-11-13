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
      isChatOpen: false,
      participants: [],
      pinnedParticipantId: null,
      viewMode: 'grid',
      canPresent: true,
      ...props,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        LiquidGlassSurface: { template: '<div><slot /></div>' },
        MeetingMediaControl: { props: ['kind'], template: '<i :data-bar-item="kind" />' },
        MeetingScreenShareControl: stub('share'),
        MeetingActionMenu: stub('more'),
      },
    },
  });
}

describe('MeetingControls', () => {
  afterEach(() => haptics.playHaptic.mockReset());

  it('reads mic, camera · share, chat, more · leave, with full screen apart on the right', () => {
    const wrapper = mountControls();
    const order = wrapper
      .findAll('[data-bar-item], [data-controls-separator], [data-chat-trigger], button[aria-label="End call"]')
      .map(
        (item) =>
          item.attributes('data-bar-item') ??
          (item.attributes('data-controls-separator') !== undefined ? '·' : item.attributes('aria-label')),
      );

    expect(order).toEqual(['audio', 'video', '·', 'share', 'Open chat', 'more', '·', 'End call']);
    expect(wrapper.get('[data-fullscreen-toggle]').attributes('aria-label')).toBe('Full screen');
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

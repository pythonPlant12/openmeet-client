import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';
import type { Participant } from '@/xstate/machines/webrtc/types';

const haptics = vi.hoisted(() => ({ playHaptic: vi.fn() }));
vi.mock('@/services/haptics', () => haptics);

const { default: CallPhoneControls } = await import('@/components/meeting-page/CallPhoneControls.vue');

enableAutoUnmount(afterEach);

const participants: Participant[] = [
  { id: 'local', name: 'Local Person', isLocal: true, stream: null, audioEnabled: true, videoEnabled: true },
  { id: 'remote', name: 'Remote Person', isLocal: false, stream: null, audioEnabled: false, videoEnabled: true },
];

// The split buttons and the share control have their own tests; here they only need to be found.
const MediaControl = {
  props: ['kind', 'off', 'available', 'warning'],
  emits: ['toggle', 'request-access'],
  template: '<button :data-stub-media="kind" @click="$emit(warning ? \'request-access\' : \'toggle\')" />',
};
const ShareControl = { template: '<button data-stub-share />' };

function mountControls(props: Partial<InstanceType<typeof CallPhoneControls>['$props']> = {}) {
  return mount(CallPhoneControls, {
    attachTo: document.body,
    props: {
      audioAvailable: true,
      videoAvailable: true,
      isMuted: false,
      isVideoOff: true,
      canPresent: false,
      participants,
      pinnedParticipantId: null,
      viewMode: 'grid',
      showConnectionStatus: false,
      ...props,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: { MeetingMediaControl: MediaControl, MeetingScreenShareControl: ShareControl },
    },
  });
}

const handle = (wrapper: ReturnType<typeof mountControls>) => wrapper.get('[data-controls-handle]');

describe('CallPhoneControls', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    haptics.playHaptic.mockReset();
  });

  it('shows mic, camera, and leave in the bar, and share only where the screen can be shared', async () => {
    const wrapper = mountControls();

    expect(wrapper.find('[data-stub-media="audio"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub-media="video"]').exists()).toBe(true);
    expect(wrapper.find('[data-stub-share]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="End call"]').exists()).toBe(true);

    await wrapper.setProps({ canPresent: true });
    expect(wrapper.find('[data-stub-share]').exists()).toBe(true);
  });

  it('forwards the mic and camera toggles', async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-stub-media="audio"]').trigger('click');
    await wrapper.get('[data-stub-media="video"]').trigger('click');

    expect(wrapper.emitted('toggle-mute')).toHaveLength(1);
    expect(wrapper.emitted('toggle-video')).toHaveLength(1);
  });

  it('passes the mic and camera warnings through and asks for access again', async () => {
    const wrapper = mountControls({ audioWarning: true, videoWarning: true });

    await wrapper.get('[data-stub-media="audio"]').trigger('click');
    await wrapper.get('[data-stub-media="video"]').trigger('click');

    expect(wrapper.emitted('request-access')).toEqual([['audio'], ['video']]);
  });

  it('leaves with a medium haptic', async () => {
    const wrapper = mountControls();

    await wrapper.get('button[aria-label="End call"]').trigger('click');

    expect(wrapper.emitted('end-call')).toHaveLength(1);
    expect(haptics.playHaptic).toHaveBeenCalledWith('medium');
  });

  it('opens and closes the controls panel from its handle with a selection haptic', async () => {
    const wrapper = mountControls();
    expect(handle(wrapper).attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('[data-controls-panel]').attributes('inert')).toBeDefined();

    await handle(wrapper).trigger('click');
    expect(handle(wrapper).attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[data-controls-panel]').attributes('inert')).toBeUndefined();
    expect(haptics.playHaptic).toHaveBeenLastCalledWith('selection');

    await handle(wrapper).trigger('click');
    expect(handle(wrapper).attributes('aria-expanded')).toBe('false');
    expect(haptics.playHaptic).toHaveBeenCalledTimes(2);
  });

  it('holds the layout, pins, participants, dev tools, and the bug report in the panel', async () => {
    const wrapper = mountControls({ pinnedParticipantId: 'remote' });
    await handle(wrapper).trigger('click');
    const panel = wrapper.get('[data-controls-panel]');

    expect(panel.get('[role="radio"][aria-checked="true"]').text()).toContain('Grid view');
    await panel
      .findAll('[role="radio"]')
      .find((radio) => radio.text().includes('Speaker view'))!
      .trigger('click');
    expect(wrapper.emitted('set-view-mode')).toEqual([['speaker']]);

    expect(panel.text()).toContain('Local Person');
    expect(panel.text()).toContain('Remote Person');
    await panel.get('button[aria-label="Unpin Remote Person"]').trigger('click');
    await panel.get('button[aria-label="Pin Local Person"]').trigger('click');
    expect(wrapper.emitted('toggle-pin')).toEqual([['remote'], ['local']]);

    const devTools = panel.get('[data-dev-tools]');
    expect(devTools.attributes('aria-checked')).toBe('false');
    await devTools.trigger('click');
    expect(wrapper.emitted('toggle-stats')).toHaveLength(1);

    const report = panel.get<HTMLAnchorElement>('a[target="_blank"]');
    expect(report.text()).toContain('Report a bug');
    expect(report.element.href).toContain('Area%3A+meeting');
  });
});

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

const haptics = vi.hoisted(() => ({ playHaptic: vi.fn() }));
vi.mock('@/services/haptics', () => haptics);

const { default: CallPhoneControls } = await import('@/components/meeting-page/CallPhoneControls.vue');

enableAutoUnmount(afterEach);

// The split buttons and the share control have their own tests; here they only need to be found.
const MediaControl = {
  props: ['kind', 'off', 'available', 'warning', 'variant'],
  emits: ['toggle', 'request-access', 'preview-camera'],
  template:
    '<button :data-stub-media="kind" :data-variant="variant" @click="$emit(warning ? \'request-access\' : \'toggle\')" />',
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
      viewMode: 'grid',
      canInvite: true,
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
const bar = (wrapper: ReturnType<typeof mountControls>) => wrapper.get('[data-controls-bar]');

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

  it('reads camera, mic, share, leave in the bar, without chevrons', async () => {
    const wrapper = mountControls({ canPresent: true });
    const controls = bar(wrapper)
      .findAll('button')
      .map(
        (button) =>
          button.attributes('data-stub-media') ??
          (button.attributes('data-stub-share') !== undefined ? 'share' : button.attributes('aria-label')),
      );
    expect(controls).toEqual(['video', 'audio', 'share', 'End call']);
    expect(
      bar(wrapper)
        .findAll('[data-stub-media]')
        .map((media) => media.attributes('data-variant')),
    ).toEqual(['toggle', 'toggle']);
  });

  it('shows share only where the screen can be shared', () => {
    expect(mountControls().find('[data-stub-share]').exists()).toBe(false);
  });

  it('forwards the mic and camera toggles', async () => {
    const wrapper = mountControls();

    await bar(wrapper).get('[data-stub-media="audio"]').trigger('click');
    await bar(wrapper).get('[data-stub-media="video"]').trigger('click');

    expect(wrapper.emitted('toggle-mute')).toHaveLength(1);
    expect(wrapper.emitted('toggle-video')).toHaveLength(1);
  });

  it('passes the mic and camera warnings through and asks for access again', async () => {
    const wrapper = mountControls({ audioWarning: true, videoWarning: true });

    await bar(wrapper).get('[data-stub-media="audio"]').trigger('click');
    await bar(wrapper).get('[data-stub-media="video"]').trigger('click');

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

  it('moves the controls row to the top of the card while the panel is open', async () => {
    const wrapper = mountControls();
    expect(bar(wrapper).attributes('data-position')).toBe('bottom');
    await handle(wrapper).trigger('click');
    expect(bar(wrapper).attributes('data-position')).toBe('top');
  });

  it('holds chat, devices, layout, invite, dev tools, and the bug report in the panel, but no participants', async () => {
    const wrapper = mountControls();
    await handle(wrapper).trigger('click');
    const panel = wrapper.get('[data-controls-panel]');

    await panel.get('[data-panel-row="chat"]').trigger('click');
    expect(wrapper.emitted('toggle-chat')).toHaveLength(1);

    expect(
      panel
        .findAll('[data-stub-media]')
        .map((row) => [row.attributes('data-stub-media'), row.attributes('data-variant')]),
    ).toEqual([
      ['audio', 'row'],
      ['video', 'row'],
    ]);
    await panel.get('[data-panel-row="preview-camera"]').trigger('click');
    expect(wrapper.emitted('preview-camera')).toHaveLength(1);

    expect(panel.get('[role="radio"][aria-checked="true"]').text()).toContain('Grid view');
    await panel
      .findAll('[role="radio"]')
      .find((radio) => radio.text().includes('Speaker view'))!
      .trigger('click');
    expect(wrapper.emitted('set-view-mode')).toEqual([['speaker']]);

    await panel.get('[data-panel-row="invite"]').trigger('click');
    expect(wrapper.emitted('invite')).toHaveLength(1);

    expect(panel.find('[data-panel-participants]').exists()).toBe(false);

    const devTools = panel.get('[data-dev-tools]');
    expect(devTools.attributes('aria-checked')).toBe('false');
    await devTools.trigger('click');
    expect(wrapper.emitted('toggle-stats')).toHaveLength(1);

    const report = panel.get<HTMLAnchorElement>('a[target="_blank"]');
    expect(report.text()).toContain('Report a bug');
    expect(report.element.href).toContain('Area%3A+meeting');
  });

  it('leaves out the invite row where inviting is not possible', async () => {
    const wrapper = mountControls({ canInvite: false });
    expect(wrapper.find('[data-panel-row="invite"]').exists()).toBe(false);
  });
});

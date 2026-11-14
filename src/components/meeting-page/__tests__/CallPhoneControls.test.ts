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
    '<div><button :data-stub-media="kind" :data-variant="variant" @click="$emit(warning ? \'request-access\' : \'toggle\')" /><button v-if="variant === \'row\'" :data-stub-preview="kind" @click="$emit(\'preview-camera\')" /><slot name="extra" /></div>',
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

  it('keeps the controls row above the panel, so it rides up as the panel opens', async () => {
    const wrapper = mountControls();
    const order = () =>
      Array.from(wrapper.get('[data-call-phone-controls]').element.children).map((child) =>
        child.hasAttribute('data-controls-bar') ? 'bar' : child.hasAttribute('data-controls-panel') ? 'panel' : '',
      );
    expect(bar(wrapper).classes()).toContain('order-2');
    expect(wrapper.get('[data-controls-panel]').classes()).toContain('order-3');
    await handle(wrapper).trigger('click');
    expect(bar(wrapper).classes()).toContain('order-2');
    expect(order().filter(Boolean)).toEqual(['bar', 'panel']);
  });

  it('closes the open panel on a tap outside it, which presses nothing underneath', async () => {
    const wrapper = mountControls();
    expect(wrapper.find('[data-controls-backdrop]').exists()).toBe(false);
    await handle(wrapper).trigger('click');

    const backdrop = wrapper.get('[data-controls-backdrop]');
    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    backdrop.element.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    await backdrop.trigger('click');

    expect(handle(wrapper).attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('[data-controls-backdrop]').exists()).toBe(false);
  });

  it('holds only the microphone and camera settings in the panel', async () => {
    const wrapper = mountControls();
    await handle(wrapper).trigger('click');
    const panel = wrapper.get('[data-controls-panel]');

    expect(
      panel
        .findAll('[data-stub-media]')
        .map((row) => [row.attributes('data-stub-media'), row.attributes('data-variant')]),
    ).toEqual([
      ['audio', 'row'],
      ['video', 'row'],
    ]);
    await panel.get('[data-stub-preview="video"]').trigger('click');
    expect(wrapper.emitted('preview-camera')).toHaveLength(1);

    for (const gone of ['chat', 'invite']) expect(panel.find(`[data-panel-row="${gone}"]`).exists()).toBe(false);
    expect(panel.find('[role="radiogroup"]').exists()).toBe(false);
    expect(panel.find('[data-dev-tools]').exists()).toBe(false);
    expect(panel.text()).not.toContain('Report a bug');
  });

  it('toggles showing your own camera from the panel', async () => {
    const wrapper = mountControls({ showOwnCamera: true });
    const toggle = wrapper.get('[data-panel-row="own-camera"]');
    expect(toggle.attributes('role')).toBe('switch');
    expect(toggle.attributes('aria-checked')).toBe('true');
    await toggle.trigger('click');
    expect(wrapper.emitted('toggle-own-camera')).toHaveLength(1);
  });
});

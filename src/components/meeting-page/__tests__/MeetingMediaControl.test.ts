import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, inject, provide, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

const settings = vi.hoisted(() => ({
  changeDevice: vi.fn(),
  changeQuality: vi.fn(),
  changeSpeaker: vi.fn(),
  changeInputVolume: vi.fn(),
  refresh: vi.fn(),
  startLevelMeter: vi.fn(),
  stopLevelMeter: vi.fn(),
  canChooseSpeaker: true,
}));
const haptics = vi.hoisted(() => ({ playHaptic: vi.fn() }));

vi.mock('@/services/haptics', () => haptics);
vi.mock('@/composables/useMeetingMediaSettings', () => ({
  useMeetingMediaSettings: (kind: 'audio' | 'video') => ({
    devices: ref(
      kind === 'audio'
        ? [
            { deviceId: 'mic-1', label: 'Built-in microphone' },
            { deviceId: 'mic-2', label: 'Headset microphone' },
          ]
        : [
            { deviceId: 'cam-1', label: 'Front camera' },
            { deviceId: 'cam-2', label: 'USB camera' },
          ],
    ),
    activeId: ref(kind === 'audio' ? 'mic-1' : 'cam-1'),
    quality: ref('auto'),
    sentHeight: ref(720),
    busy: ref(false),
    speakers: ref([
      { deviceId: 'default', label: 'System default' },
      { deviceId: 'speaker-2', label: 'Headphones' },
    ]),
    speakerId: ref('default'),
    inputVolume: ref(0.8),
    inputLevel: ref(0.5),
    ...settings,
  }),
}));

const { default: MeetingMediaControl } = await import('@/components/meeting-page/MeetingMediaControl.vue');

enableAutoUnmount(afterEach);

const passthrough = { template: '<div><slot /></div>' };
// The menu opens from its trigger the way the real menu reports it, through update:open.
const Menu = defineComponent({
  emits: ['update:open'],
  setup(_, { slots, emit }) {
    provide('openMenu', () => emit('update:open', true));
    return () => h('div', slots.default?.());
  },
});
const Trigger = defineComponent({
  setup(_, { slots }) {
    const open = inject<() => void>('openMenu');
    return () => h('div', { onClick: open }, slots.default?.());
  },
});
// Radio items forward the chosen value to their group the way the real menu does.
const RadioItem = defineComponent({
  props: { value: String },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          onClick: (event: Event) =>
            (event.currentTarget as HTMLElement).parentElement!.dispatchEvent(
              Object.assign(new Event('pick'), { value: props.value }),
            ),
        },
        slots.default?.(),
      );
  },
});

function mountControl(kind: 'audio' | 'video', off = false, warning = false, variant?: 'split' | 'toggle' | 'row') {
  return mount(MeetingMediaControl, {
    props: { kind, off, available: !warning, warning, variant },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        DropdownMenu: Menu,
        DropdownMenuTrigger: Trigger,
        DropdownMenuContent: passthrough,
        DropdownMenuLabel: passthrough,
        DropdownMenuSeparator: passthrough,
        DropdownMenuSub: passthrough,
        DropdownMenuSubTrigger: { template: '<div v-bind="$attrs"><slot /></div>' },
        DropdownMenuSubContent: passthrough,
        DropdownMenuItem: { template: '<button v-bind="$attrs" @click="$emit(\'select\')"><slot /></button>' },
        DropdownMenuRadioGroup: {
          emits: ['update:modelValue'],
          template: '<div @pick="(event) => $emit(\'update:modelValue\', event.value)"><slot /></div>',
        },
        DropdownMenuRadioItem: RadioItem,
      },
    },
  });
}

describe('MeetingMediaControl', () => {
  beforeEach(() => {
    // Animated menu icons watch the viewport, which jsdom has no observer for.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    for (const value of Object.values(settings)) if (typeof value === 'function') value.mockReset();
    settings.canChooseSpeaker = true;
    settings.changeDevice.mockResolvedValue(true);
    haptics.playHaptic.mockReset();
  });

  it('toggles the medium from the main part with a light haptic, without opening the menu', async () => {
    const wrapper = mountControl('audio');

    await wrapper.get('[data-media-toggle]').trigger('click');

    expect(wrapper.emitted('toggle')).toHaveLength(1);
    expect(wrapper.emitted('open-change')).toBeUndefined();
    expect(haptics.playHaptic).toHaveBeenCalledWith('light');
    expect(wrapper.get('[data-media-toggle]').attributes('aria-label')).toBe('Mute microphone');
  });

  it('shows only the toggle in the phone bar, with no chevron', () => {
    const control = mountControl('audio', false, false, 'toggle');
    expect(control.find('[data-media-toggle]').exists()).toBe(true);
    expect(control.find('[data-media-menu-trigger]').exists()).toBe(false);
  });

  it('shows only the device menu as a labelled row in the phone controls panel', () => {
    const control = mountControl('video', false, false, 'row');
    expect(control.find('[data-media-toggle]').exists()).toBe(false);
    expect(control.get('[data-media-menu-trigger]').text()).toContain('Camera');
  });

  it('shows a muted microphone or a camera that is off in red', () => {
    const muted = mountControl('audio', true).get('[data-media-toggle]');
    expect(muted.attributes('data-media-off')).toBe('true');
    expect(muted.attributes('data-off')).toBe('true');
    expect(muted.attributes('aria-label')).toBe('Unmute microphone');

    const cameraOn = mountControl('video').get('[data-media-toggle]');
    expect(cameraOn.attributes('data-off')).toBe('false');
    expect(cameraOn.attributes('data-active')).toBe('true');
    expect(cameraOn.attributes('aria-label')).toBe('Turn camera off');
  });

  it('opens the device menu from the chevron with a medium haptic', async () => {
    const wrapper = mountControl('audio');

    await wrapper.get('[data-media-menu-trigger]').trigger('click');

    expect(wrapper.emitted('toggle')).toBeUndefined();
    expect(wrapper.emitted('open-change')).toEqual([[true]]);
    expect(haptics.playHaptic).toHaveBeenCalledWith('medium');
    expect(settings.refresh).toHaveBeenCalled();
    expect(settings.startLevelMeter).toHaveBeenCalled();
    expect(wrapper.get('[data-media-menu-trigger]').attributes('aria-label')).toBe('Microphone options');
  });

  it('lists microphones, speakers and the input volume with its level in the microphone menu', async () => {
    const wrapper = mountControl('audio');
    expect(wrapper.findAll('[data-device-option]').map((option) => option.text())).toEqual([
      'Built-in microphone',
      'Headset microphone',
    ]);
    expect(wrapper.findAll('[data-speaker-option]').map((option) => option.text())).toEqual([
      'System default',
      'Headphones',
    ]);
    expect(wrapper.find('[data-preview-camera]').exists()).toBe(false);
    expect(wrapper.find('[data-quality-option]').exists()).toBe(false);

    const slider = wrapper.get<HTMLInputElement>('[data-input-volume]');
    expect(slider.element.value).toBe('80');
    await slider.setValue('50');
    expect(settings.changeInputVolume).toHaveBeenCalledWith(0.5);
    expect(wrapper.get('[data-input-level]').attributes('aria-valuenow')).toBe('50');

    await wrapper.get('[data-speaker-option="speaker-2"]').trigger('click');
    expect(settings.changeSpeaker).toHaveBeenCalledWith('speaker-2');
  });

  it('leaves out the speaker list where the browser cannot switch outputs', () => {
    settings.canChooseSpeaker = false;

    expect(mountControl('audio').find('[data-speaker-option]').exists()).toBe(false);
  });

  it('lists cameras, Preview camera and quality in the camera menu', async () => {
    const wrapper = mountControl('video');
    expect(wrapper.findAll('[data-device-option]').map((option) => option.text())).toEqual([
      'Front camera',
      'USB camera',
    ]);
    expect(wrapper.find('[data-speaker-option]').exists()).toBe(false);
    expect(wrapper.find('[data-input-volume]').exists()).toBe(false);
    expect(wrapper.get('[data-media-quality-menu]').text()).toContain('Auto · 720p');

    await wrapper.get('[data-preview-camera]').trigger('click');
    expect(wrapper.emitted('preview-camera')).toHaveLength(1);

    await wrapper.get('[data-quality-option="1080p"]').trigger('click');
    expect(settings.changeQuality).toHaveBeenCalledWith('1080p');
  });

  it('switches the device and reports the media change', async () => {
    const wrapper = mountControl('video');
    await wrapper.get('[data-device-option="cam-2"]').trigger('click');
    await flushPromises();

    expect(settings.changeDevice).toHaveBeenCalledWith('cam-2');
    expect(wrapper.emitted('media-changed')).toHaveLength(1);
  });

  it('shows a warning on a medium the call could not get, and tapping it asks again', async () => {
    const wrapper = mountControl('audio', true, true);
    const toggle = wrapper.get('[data-media-toggle]');

    expect(wrapper.find('[data-media-warning]').exists()).toBe(true);
    expect(toggle.attributes('disabled')).toBeUndefined();
    expect(toggle.attributes('aria-label')).toBe('Allow the microphone');

    await toggle.trigger('click');

    expect(wrapper.emitted('request-access')).toHaveLength(1);
    expect(wrapper.emitted('toggle')).toBeUndefined();
    expect(mountControl('video', true, true).get('[data-media-toggle]').attributes('aria-label')).toBe(
      'Allow the camera',
    );
    expect(mountControl('audio').find('[data-media-warning]').exists()).toBe(false);
  });
});

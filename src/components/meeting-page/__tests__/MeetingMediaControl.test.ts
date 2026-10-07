import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createI18n } from 'vue-i18n';

const settings = vi.hoisted(() => ({ changeDevice: vi.fn(), changeQuality: vi.fn(), refresh: vi.fn() }));
vi.mock('@/composables/useMeetingMediaSettings', () => ({
  useMeetingMediaSettings: () => ({
    devices: ref([
      { deviceId: 'cam-1', label: 'Front camera' },
      { deviceId: 'cam-2', label: 'USB camera' },
    ]),
    activeId: ref('cam-1'),
    quality: ref('auto'),
    sentHeight: ref(720),
    busy: ref(false),
    ...settings,
  }),
}));

const { default: MeetingMediaControl } = await import('@/components/meeting-page/MeetingMediaControl.vue');

enableAutoUnmount(afterEach);

const passthrough = { template: '<div><slot /></div>' };
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

function mountControl(kind: 'audio' | 'video', off = false) {
  return mount(MeetingMediaControl, {
    props: { kind, off, available: true },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })],
      stubs: {
        DropdownMenu: passthrough,
        DropdownMenuTrigger: passthrough,
        DropdownMenuContent: passthrough,
        DropdownMenuLabel: passthrough,
        DropdownMenuSeparator: passthrough,
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
    Object.values(settings).forEach((mock) => mock.mockReset());
    settings.changeDevice.mockResolvedValue(true);
  });

  it('opens one menu from the button that turns the medium on and off', async () => {
    const wrapper = mountControl('audio', true);
    expect(wrapper.get('[data-media-button]').attributes('data-media-off')).toBe('true');
    expect(wrapper.find('[data-media-options]').exists()).toBe(false);

    await wrapper.get('[data-media-toggle-item]').trigger('click');

    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('switches the source and reports the media change', async () => {
    const wrapper = mountControl('video');
    await wrapper.get('[data-device-option="cam-2"]').trigger('click');
    await flushPromises();

    expect(settings.changeDevice).toHaveBeenCalledWith('cam-2');
    expect(wrapper.emitted('media-changed')).toHaveLength(1);
  });

  it('offers video quality on the camera only', async () => {
    const camera = mountControl('video');
    expect(camera.get('[data-quality-option="auto"]').text()).toContain('now 720p');
    expect(camera.findAll('[data-quality-option]').map((option) => option.attributes('data-quality-option'))).toEqual([
      'auto',
      '360p',
      '720p',
      '1080p',
    ]);
    await camera.get('[data-quality-option="1080p"]').trigger('click');
    expect(settings.changeQuality).toHaveBeenCalledWith('1080p');

    expect(mountControl('audio').find('[data-quality-option]').exists()).toBe(false);
  });
});

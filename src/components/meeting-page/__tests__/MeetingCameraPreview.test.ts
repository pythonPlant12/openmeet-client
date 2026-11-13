import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

const calls = vi.hoisted(() => ({
  saveCallSettings: vi.fn(),
  changeDevice: vi.fn(),
  refresh: vi.fn(),
  liveCamera: null as unknown,
}));

vi.mock('@/lib/call-settings', () => ({ saveCallSettings: calls.saveCallSettings }));
vi.mock('@/xstate/machines/webrtc/actors', () => ({
  getServices: () => ({
    webrtcService: { getLocalStream: () => ({ getVideoTracks: () => (calls.liveCamera ? [calls.liveCamera] : []) }) },
  }),
}));
vi.mock('@/composables/useMeetingMediaSettings', () => ({
  useMeetingMediaSettings: (kind: 'audio' | 'video') => {
    const activeId = ref(kind === 'audio' ? 'mic-1' : 'cam-1');
    return {
      devices: ref(
        kind === 'audio'
          ? [{ deviceId: 'mic-1', label: 'Built-in microphone' }]
          : [
              { deviceId: 'cam-1', label: 'Front camera' },
              { deviceId: 'cam-2', label: 'USB camera' },
            ],
      ),
      activeId,
      quality: ref('auto'),
      busy: ref(false),
      refresh: calls.refresh,
      // Like the real settings, a chosen device becomes the active one.
      changeDevice: (deviceId: string) => {
        activeId.value = deviceId;
        return calls.changeDevice(kind, deviceId);
      },
    };
  },
}));

const { default: MeetingCameraPreview } = await import('@/components/meeting-page/MeetingCameraPreview.vue');

enableAutoUnmount(afterEach);

function track(deviceId: string) {
  return { kind: 'video', deviceId, stop: vi.fn(), getSettings: () => ({ deviceId }) };
}

// The dialog reports a tap outside the way the real one does, through update:open.
const DialogStub = defineComponent({
  name: 'DialogStub',
  props: { open: Boolean },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () => (props.open ? h('div', slots.default?.()) : null);
  },
});
const passthrough = { template: '<div><slot /></div>' };

function mountPreview(cameraOn = false) {
  return mount(MeetingCameraPreview, {
    props: { open: true, cameraOn, 'onUpdate:open': () => {} },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: { Dialog: DialogStub, DialogContent: passthrough, DialogTitle: passthrough, DialogDescription: passthrough },
    },
  });
}

describe('MeetingCameraPreview', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let captured: ReturnType<typeof track>[];

  beforeEach(() => {
    calls.saveCallSettings.mockReset();
    calls.changeDevice.mockReset().mockResolvedValue(true);
    calls.refresh.mockReset();
    calls.liveCamera = null;
    captured = [];
    getUserMedia = vi.fn(async (constraints: { video: { deviceId?: { ideal: string } } }) => {
      const camera = track(constraints.video.deviceId?.ideal ?? 'default');
      captured.push(camera);
      return { getVideoTracks: () => [camera], getTracks: () => [camera] };
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('MediaStream', vi.fn(function MediaStream(tracks: unknown[]) {
      return { tracks, getTracks: () => tracks };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('previews the chosen camera with microphone and camera selects', async () => {
    const wrapper = mountPreview();
    await flushPromises();

    expect(getUserMedia).toHaveBeenCalledWith({ video: expect.objectContaining({ deviceId: { ideal: 'cam-1' } }) });
    expect(wrapper.get('[data-preview-microphone]').text()).toContain('Built-in microphone');
    expect(wrapper.get('[data-preview-camera-select]').text()).toContain('Front camera');
  });

  it('turns the camera on with the previewed track and remembers the preview was seen', async () => {
    const wrapper = mountPreview();
    await flushPromises();

    await wrapper.get('[data-camera-preview-confirm]').trigger('click');

    const [[sent]] = wrapper.emitted('confirm') as [[ReturnType<typeof track>]];
    expect(sent.deviceId).toBe('cam-1');
    expect(sent.stop).not.toHaveBeenCalled();
    expect(calls.saveCallSettings).toHaveBeenCalledWith({ cameraPreviewSeen: true });
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('closes on a tap outside and leaves the camera off', async () => {
    const wrapper = mountPreview();
    await flushPromises();
    wrapper.findComponent(DialogStub).vm.$emit('update:open', false);
    await flushPromises();

    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(calls.saveCallSettings).not.toHaveBeenCalled();
    expect(captured[0]!.stop).toHaveBeenCalled();
  });

  it('switches and saves the camera from its select and previews it live', async () => {
    const wrapper = mountPreview();
    await flushPromises();

    await wrapper.get('[data-preview-camera-select] select').setValue('cam-2');
    await flushPromises();

    expect(calls.changeDevice).toHaveBeenCalledWith('video', 'cam-2');
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: expect.objectContaining({ deviceId: { ideal: 'cam-2' } }) });
    expect(captured[0]!.stop).toHaveBeenCalled();
  });

  it('shows the live camera without opening it again when the camera is already on', async () => {
    calls.liveCamera = track('cam-1');
    const wrapper = mountPreview(true);
    await flushPromises();

    expect(getUserMedia).not.toHaveBeenCalled();
    await wrapper.get('[data-camera-preview-confirm]').trigger('click');
    expect(wrapper.emitted('confirm')).toEqual([[null]]);
  });
});

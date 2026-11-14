<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import { useMeetingMediaSettings } from '@/composables/useMeetingMediaSettings';
import { saveCallSettings } from '@/lib/call-settings';
import { CAMERA_LEVELS, captureConstraints } from '@/services/video-quality';
import { getServices } from '@/xstate/machines/webrtc/actors';

import MeetingSelect from './MeetingSelect.vue';

// The camera preview: shows the camera before others see it, with the microphone and camera to choose over its
// bottom edge. Turning the camera on hands the previewed track to the call; a tap outside closes it and leaves
// the camera off. With the camera already on, it shows the live camera instead of opening it again.
const props = defineProps<{ cameraOn: boolean }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  /** The track to send, or null when the camera was already on. */
  (event: 'confirm', track: MediaStreamTrack | null): void;
}>();
const { t } = useI18n();
const microphone = useMeetingMediaSettings('audio');
const camera = useMeetingMediaSettings('video');

const videoRef = ref<HTMLVideoElement | null>(null);
const previewStream = shallowRef<MediaStream | null>(null);
const isLoading = ref(false);
let ownedTrack: MediaStreamTrack | null = null;
let request = 0;
// The camera the preview is still opening, so a quick confirm waits for it instead of sending nothing.
let loading: Promise<void> = Promise.resolve();
let confirming = false;

const deviceOptions = (devices: MediaDeviceInfo[], fallback: string) =>
  devices.map((device, index) => ({ value: device.deviceId, label: device.label || `${fallback} ${index + 1}` }));
const microphoneOptions = computed(() => deviceOptions(microphone.devices.value, t('meeting.controls.microphone')));
const cameraOptions = computed(() => deviceOptions(camera.devices.value, t('meeting.controls.camera')));
const microphoneId = computed({
  get: () => microphone.activeId.value,
  set: (deviceId: string) => void microphone.changeDevice(deviceId),
});
const cameraId = computed({
  get: () => camera.activeId.value,
  set: (deviceId: string) => void selectCamera(deviceId),
});

function stopOwnedTrack() {
  ownedTrack?.stop();
  ownedTrack = null;
  previewStream.value = null;
}

async function showPreview() {
  const id = ++request;
  stopOwnedTrack();
  if (props.cameraOn) {
    const live = getServices().webrtcService?.getLocalStream()?.getVideoTracks()[0];
    previewStream.value = live ? new MediaStream([live]) : null;
    return;
  }

  isLoading.value = true;
  try {
    const deviceId = camera.activeId.value;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...captureConstraints(CAMERA_LEVELS, camera.quality.value),
        ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
      },
    });
    const track = stream.getVideoTracks()[0] ?? null;
    if (id !== request || !open.value) {
      track?.stop();
      return;
    }
    ownedTrack = track;
    previewStream.value = track ? new MediaStream([track]) : null;
  } catch (error) {
    console.error('[MeetingCameraPreview] Failed to open the camera:', error);
  } finally {
    if (id === request) isLoading.value = false;
  }
}

function load(task: () => Promise<void>) {
  loading = task();
  return loading;
}

async function selectCamera(deviceId: string) {
  await load(async () => {
    if (await camera.changeDevice(deviceId)) await showPreview();
  });
}

function close() {
  request += 1;
  stopOwnedTrack();
  open.value = false;
}

function onOpenChange(isOpen: boolean) {
  if (!isOpen) close();
}

async function confirm() {
  if (confirming) return;
  confirming = true;
  saveCallSettings({ cameraPreviewSeen: true });
  if (!props.cameraOn && !ownedTrack) await loading;
  const track = props.cameraOn ? null : ownedTrack;
  // The call owns the previewed track from here on.
  ownedTrack = null;
  emit('confirm', track);
  close();
}

watch(
  previewStream,
  (stream) => {
    const video = videoRef.value;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play?.()?.catch(() => undefined);
  },
  { flush: 'post' },
);

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return;
    await load(async () => {
      await Promise.all([microphone.refresh(), camera.refresh()]);
      if (open.value) await showPreview();
    });
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  request += 1;
  stopOwnedTrack();
});
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      hide-close
      overlay-class="bg-harbor-ink/30 backdrop-blur-md"
      class="w-[calc(100%-2rem)] max-w-xl gap-4 border-0 bg-transparent p-0 shadow-none"
      data-camera-preview
    >
      <DialogTitle class="sr-only">{{ t('meeting.preview.title') }}</DialogTitle>
      <DialogDescription class="sr-only">{{ t('meeting.preview.description') }}</DialogDescription>
      <div class="relative aspect-video overflow-hidden rounded-3xl bg-harbor-ink shadow-harbor-float">
        <video ref="videoRef" autoplay playsinline muted class="size-full -scale-x-100 object-cover" />
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
          <LoadingRipple class="size-8 text-harbor-accent" />
        </div>
        <div class="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2">
          <div data-preview-microphone>
            <MeetingSelect
              v-model="microphoneId"
              :options="microphoneOptions"
              :disabled="microphone.busy.value"
              :placeholder="t('meeting.controls.noMicrophones')"
              :aria-label="t('meeting.controls.microphone')"
            />
          </div>
          <div data-preview-camera-select>
            <MeetingSelect
              v-model="cameraId"
              :options="cameraOptions"
              :disabled="camera.busy.value"
              :placeholder="t('meeting.controls.noCameras')"
              :aria-label="t('meeting.controls.camera')"
            />
          </div>
        </div>
      </div>
      <div class="flex justify-center">
        <button
          type="button"
          class="call-button call-chip h-12 w-auto px-6 text-sm font-semibold"
          data-camera-preview-confirm
          @click="confirm"
        >
          {{ t(cameraOn ? 'meeting.preview.done' : 'meeting.preview.turnOn') }}
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>

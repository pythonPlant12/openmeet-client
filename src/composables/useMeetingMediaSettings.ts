import { ref } from 'vue';

import { toast } from '@/components/ui/toast';
import { useMediaDevices } from '@/composables/useMediaDevices';
import { useWebrtc } from '@/composables/useWebrtc';
import { loadVideoQuality, saveVideoQuality } from '@/lib/video-quality';
import type { VideoQuality } from '@/services/video-quality';
import { getServices } from '@/xstate/machines/webrtc/actors';

export type MediaKind = 'audio' | 'video';

/** Source and quality choices for the local microphone or camera during a call. */
export function useMeetingMediaSettings(kind: MediaKind) {
  const { audioDevices, videoDevices, enumerateDevices } = useMediaDevices();
  const { switchDevice, setVideoQuality, activeDeviceId } = useWebrtc();
  const devices = kind === 'audio' ? audioDevices : videoDevices;
  const activeId = ref('');
  const quality = ref<VideoQuality>(loadVideoQuality());
  const busy = ref(false);
  /** Height the camera sends right now, which auto quality changes. */
  const sentHeight = ref<number | null>(null);

  // Devices can be plugged in during a call, so the list is read again whenever the menu opens.
  async function refresh() {
    if (kind === 'video') sentHeight.value = getServices().webrtcService?.getCameraHeight() ?? null;
    try {
      await enumerateDevices();
    } catch (error) {
      console.error('[useMeetingMediaSettings] Failed to list devices:', error);
    }
    activeId.value = activeDeviceId(kind) ?? '';
    if (kind === 'video') sentHeight.value = getServices().webrtcService?.getCameraHeight() ?? null;
  }

  /** Returns whether the device changed. */
  async function changeDevice(deviceId: string) {
    const previous = activeDeviceId(kind) ?? '';
    if (!deviceId || deviceId === previous || busy.value) return false;
    activeId.value = deviceId;
    busy.value = true;
    try {
      await switchDevice(kind, deviceId);
      return true;
    } catch (error) {
      console.error('[useMeetingMediaSettings] Failed to switch device:', error);
      activeId.value = previous;
      toast({
        title: kind === 'audio' ? 'Could not switch the microphone' : 'Could not switch the camera',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function changeQuality(value: VideoQuality) {
    if (value === quality.value || busy.value) return;
    quality.value = value;
    saveVideoQuality(value);
    busy.value = true;
    try {
      await setVideoQuality(value);
      sentHeight.value = getServices().webrtcService?.getCameraHeight() ?? null;
    } finally {
      busy.value = false;
    }
  }

  return { devices, activeId, quality, sentHeight, busy, refresh, changeDevice, changeQuality };
}

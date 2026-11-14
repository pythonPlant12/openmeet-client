import { ref } from 'vue';

import { toast } from '@/components/ui/toast';
import { useMediaDevices } from '@/composables/useMediaDevices';
import { useWebrtc } from '@/composables/useWebrtc';
import { saveCallSettings } from '@/lib/call-settings';
import { loadVideoQuality, saveVideoQuality } from '@/lib/video-quality';
import { canChooseAudioOutput, getAudioOutput, setAudioOutput } from '@/services/audio-output';
import type { VideoQuality } from '@/services/video-quality';
import { getServices } from '@/xstate/machines/webrtc/actors';

export type MediaKind = 'audio' | 'video';

/** Speech rarely passes a quarter of full scale, so the meter fills at that level. */
const FULL_METER_LEVEL = 0.25;

/** Source and quality choices for the local microphone or camera during a call. */
export function useMeetingMediaSettings(kind: MediaKind) {
  const { audioDevices, videoDevices, audioOutputDevices, enumerateDevices } = useMediaDevices();
  const { switchDevice, setVideoQuality, activeDeviceId } = useWebrtc();
  const devices = kind === 'audio' ? audioDevices : videoDevices;
  const activeId = ref('');
  const quality = ref<VideoQuality>(loadVideoQuality());
  const busy = ref(false);
  /** Height the camera sends right now, which auto quality changes. */
  const sentHeight = ref<number | null>(null);
  /** The speaker list shows only where the browser can switch outputs. */
  const canChooseSpeaker = canChooseAudioOutput();
  const speakers = audioOutputDevices;
  // Browsers that list outputs name the system default 'default'.
  const speakerId = ref(getAudioOutput() ?? 'default');
  const inputVolume = ref(1);
  /** Outgoing microphone level from 0 to 1, updated while the meter runs. */
  const inputLevel = ref(0);
  let meterFrame: number | null = null;

  // Devices can be plugged in during a call, so the list is read again whenever the menu opens.
  async function refresh() {
    if (kind === 'video') sentHeight.value = getServices().webrtcService?.getCameraHeight() ?? null;
    if (kind === 'audio') inputVolume.value = getServices().webrtcService?.getInputVolume() ?? 1;
    try {
      await enumerateDevices();
    } catch (error) {
      console.error('[useMeetingMediaSettings] Failed to list devices:', error);
    }
    activeId.value = activeDeviceId(kind) ?? '';
    speakerId.value = getAudioOutput() ?? 'default';
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
      saveCallSettings(kind === 'audio' ? { microphoneId: deviceId } : { cameraId: deviceId });
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

  async function changeSpeaker(deviceId: string) {
    if (!deviceId || deviceId === speakerId.value) return;
    speakerId.value = deviceId;
    await setAudioOutput(deviceId === 'default' ? null : deviceId);
  }

  async function changeInputVolume(volume: number) {
    inputVolume.value = volume;
    try {
      await getServices().webrtcService?.setInputVolume(volume);
    } catch (error) {
      console.error('[useMeetingMediaSettings] Failed to set the input volume:', error);
    }
  }

  /** Runs the level meter; start it from the gesture that opens the menu. */
  async function startLevelMeter() {
    stopLevelMeter();
    const service = getServices().webrtcService;
    if (!service) return;
    try {
      await service.startInputMeter();
    } catch (error) {
      console.error('[useMeetingMediaSettings] Failed to start the level meter:', error);
      return;
    }
    const tick = () => {
      inputLevel.value = Math.min(1, service.getInputLevel() / FULL_METER_LEVEL);
      meterFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopLevelMeter() {
    if (meterFrame !== null) cancelAnimationFrame(meterFrame);
    meterFrame = null;
    inputLevel.value = 0;
  }

  return {
    devices,
    activeId,
    quality,
    sentHeight,
    busy,
    canChooseSpeaker,
    speakers,
    speakerId,
    inputVolume,
    inputLevel,
    refresh,
    changeDevice,
    changeQuality,
    changeSpeaker,
    changeInputVolume,
    startLevelMeter,
    stopLevelMeter,
  };
}

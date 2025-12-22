import { computed, ref, shallowRef } from 'vue';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

// Singleton state
const audioPermission = ref<PermissionState>('unknown');
const videoPermission = ref<PermissionState>('unknown');
const audioDevices = shallowRef<MediaDeviceInfo[]>([]);
const videoDevices = shallowRef<MediaDeviceInfo[]>([]);

export function useMediaDevices() {
  const isAudioDenied = computed(() => audioPermission.value === 'denied');
  const isVideoDenied = computed(() => videoPermission.value === 'denied');
  const hasAllPermissions = computed(() => audioPermission.value === 'granted' && videoPermission.value === 'granted');

  const enumerateDevices = async () => {
    console.log('enumerateDevices()');
    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log('Devices: ', devices);
    audioDevices.value = devices.filter((d) => d.kind === 'audioinput');
    videoDevices.value = devices.filter((d) => d.kind === 'videoinput');
  };

  // Check current permission states and track changes
  const checkPermissions = async () => {
    try {
      const [mic, cam] = await Promise.all([
        navigator.permissions.query({ name: 'microphone' as PermissionName }),
        navigator.permissions.query({ name: 'camera' as PermissionName }),
      ]);

      audioPermission.value = mic.state as PermissionState;
      videoPermission.value = cam.state as PermissionState;

      mic.onchange = () => (audioPermission.value = mic.state as PermissionState);
      cam.onchange = () => (videoPermission.value = cam.state as PermissionState);
    } catch {
      // Permissions API not supported
    }
  };

  // Request permissions via getUserMedia
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      audioPermission.value = 'granted';
      videoPermission.value = 'granted';
      await enumerateDevices(); // Must be before stopping tracks (Firefox requirement)
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        audioPermission.value = 'denied';
        videoPermission.value = 'denied';
      }
      return false;
    }
  };

  return {
    audioPermission,
    videoPermission,
    audioDevices,
    videoDevices,
    isAudioDenied,
    isVideoDenied,
    hasAllPermissions,
    checkPermissions,
    requestPermissions,
    enumerateDevices,
  };
}

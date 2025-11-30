import { onUnmounted, readonly, ref } from 'vue';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export function useMediaPermissions() {
  const audioPermission = ref<PermissionState>('unknown');
  const videoPermission = ref<PermissionState>('unknown');
  const isWatching = ref(false);

  let audioPermissionStatus: PermissionStatus | null = null;
  let videoPermissionStatus: PermissionStatus | null = null;

  const updateAudioState = (state: PermissionState) => {
    audioPermission.value = state;
  };

  const updateVideoState = (state: PermissionState) => {
    videoPermission.value = state;
  };

  /**
   * Start watching for permission changes using the Permissions API
   */
  const startWatching = async () => {
    if (isWatching.value) return;
    isWatching.value = true;

    // Watch microphone permission
    try {
      audioPermissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      updateAudioState(audioPermissionStatus.state as PermissionState);

      audioPermissionStatus.onchange = () => {
        if (audioPermissionStatus) {
          updateAudioState(audioPermissionStatus.state as PermissionState);
        }
      };
    } catch {
      // Permissions API not supported for microphone
      audioPermission.value = 'unknown';
    }

    // Watch camera permission
    try {
      videoPermissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      updateVideoState(videoPermissionStatus.state as PermissionState);

      videoPermissionStatus.onchange = () => {
        if (videoPermissionStatus) {
          updateVideoState(videoPermissionStatus.state as PermissionState);
        }
      };
    } catch {
      // Permissions API not supported for camera
      videoPermission.value = 'unknown';
    }
  };

  /**
   * Stop watching for permission changes
   */
  const stopWatching = () => {
    if (audioPermissionStatus) {
      audioPermissionStatus.onchange = null;
      audioPermissionStatus = null;
    }
    if (videoPermissionStatus) {
      videoPermissionStatus.onchange = null;
      videoPermissionStatus = null;
    }
    isWatching.value = false;
  };

  /**
   * Request microphone permission
   * @returns true if permission was granted
   */
  const requestAudioPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());
      audioPermission.value = 'granted';
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        audioPermission.value = 'denied';
      }
      return false;
    }
  };

  /**
   * Request camera permission
   * @returns true if permission was granted
   */
  const requestVideoPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      stream.getTracks().forEach((track) => track.stop());
      videoPermission.value = 'granted';
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        videoPermission.value = 'denied';
      }
      return false;
    }
  };

  /**
   * Request both audio and video permissions
   * @returns object with audio and video permission results
   */
  const requestAllPermissions = async (): Promise<{ audio: boolean; video: boolean }> => {
    try {
      // Try to get both at once
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      audioPermission.value = 'granted';
      videoPermission.value = 'granted';
      return { audio: true, video: true };
    } catch {
      // If both fail, try each separately
      const audio = await requestAudioPermission();
      const video = await requestVideoPermission();
      return { audio, video };
    }
  };

  /**
   * Check if audio permission is denied
   */
  const isAudioDenied = () => audioPermission.value === 'denied';

  /**
   * Check if video permission is denied
   */
  const isVideoDenied = () => videoPermission.value === 'denied';

  // Cleanup on unmount
  onUnmounted(() => {
    stopWatching();
  });

  return {
    // State (readonly to prevent external mutation)
    audioPermission: readonly(audioPermission),
    videoPermission: readonly(videoPermission),
    isWatching: readonly(isWatching),

    // Methods
    startWatching,
    stopWatching,
    requestAudioPermission,
    requestVideoPermission,
    requestAllPermissions,
    isAudioDenied,
    isVideoDenied,
  };
}

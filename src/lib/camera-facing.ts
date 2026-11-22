import { computed, readonly, ref } from 'vue';

/** Which side of the device a camera looks out of: 'user' is the selfie camera, 'environment' the back camera. */
export type CameraFacing = 'user' | 'environment';

// Browsers that report no facing still name the side in the camera's label, such as "camera2 0, facing back" on
// Android or "Back Camera" on iOS.
const BACK_LABEL = /\b(back|rear|environment|world)\b/i;
const FRONT_LABEL = /\b(front|user|selfie|facetime)\b/i;

function facingOfLabel(label: string): CameraFacing | null {
  if (BACK_LABEL.test(label)) return 'environment';
  if (FRONT_LABEL.test(label)) return 'user';
  return null;
}

/** The side a live camera track looks out of, or null when the browser does not tell (most desktop webcams). */
export function cameraFacingOf(track: MediaStreamTrack | null | undefined): CameraFacing | null {
  if (!track) return null;
  const facing = track.getSettings().facingMode;
  if (facing === 'user' || facing === 'environment') return facing;
  return facingOfLabel(track.label ?? '');
}

/**
 * Whether one of the listed cameras is a back camera. Where the browser reports what each camera can do, that
 * decides; otherwise the label does. With no camera saying which side it is on, two or more cameras are taken to
 * be a front and a back one.
 */
export function hasBackCamera(cameras: MediaDeviceInfo[]): boolean {
  let known = false;
  for (const camera of cameras) {
    const capabilities = (camera as InputDeviceInfo).getCapabilities?.();
    const facingModes = capabilities?.facingMode;
    if (facingModes?.includes('environment')) return true;
    const byLabel = facingOfLabel(camera.label);
    if (byLabel === 'environment') return true;
    if (facingModes || byLabel) known = true;
  }
  return !known && cameras.length > 1;
}

// The side the camera you send looks out of. Like other video calls, only your own preview of the selfie camera is
// mirrored, so it moves like a mirror; the back camera shows the scene the right way round. Others always see the
// camera as it is, never mirrored.
const localFacing = ref<CameraFacing | null>(null);
export const localCameraFacing = readonly(localFacing);
/** Whether your own preview of your camera is mirrored. */
export const localCameraMirrored = computed(() => localFacing.value !== 'environment');

export function setLocalCameraFacing(facing: CameraFacing | null) {
  localFacing.value = facing;
}

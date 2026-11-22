import { describe, expect, it } from 'vitest';

import { cameraFacingOf, hasBackCamera } from '../camera-facing';

function camera(label: string, facingMode?: string[]): MediaDeviceInfo {
  return {
    kind: 'videoinput',
    deviceId: label,
    groupId: '',
    label,
    ...(facingMode ? { getCapabilities: () => ({ facingMode }) } : {}),
  } as unknown as MediaDeviceInfo;
}

function track(settings: MediaTrackSettings, label = ''): MediaStreamTrack {
  return { label, getSettings: () => settings } as unknown as MediaStreamTrack;
}

describe('hasBackCamera', () => {
  it('trusts the facing a camera reports', () => {
    expect(hasBackCamera([camera('Camera 0', ['user']), camera('Camera 1', ['environment'])])).toBe(true);
    expect(hasBackCamera([camera('Camera 0', ['user'])])).toBe(false);
  });

  it('finds a back camera by its label', () => {
    expect(hasBackCamera([camera('Front Camera'), camera('Back Camera')])).toBe(true);
    expect(hasBackCamera([camera('camera2 0, facing back', [])])).toBe(true);
  });

  it('finds none among desktop webcams that report no facing', () => {
    expect(hasBackCamera([camera('FaceTime HD Camera', []), camera('USB Webcam', [])])).toBe(false);
    expect(hasBackCamera([camera('Front Camera'), camera('Integrated Webcam')])).toBe(false);
  });

  it('takes two cameras that say nothing about their side to be a front and a back one', () => {
    expect(hasBackCamera([camera('Cámara frontal'), camera('Cámara trasera')])).toBe(true);
    expect(hasBackCamera([camera('Cámara frontal')])).toBe(false);
    expect(hasBackCamera([])).toBe(false);
  });
});

describe('cameraFacingOf', () => {
  it('reads the facing from the track settings, then from its label', () => {
    expect(cameraFacingOf(track({ facingMode: 'environment' }))).toBe('environment');
    expect(cameraFacingOf(track({ facingMode: 'user' }, 'Back Camera'))).toBe('user');
    expect(cameraFacingOf(track({}, 'Back Camera'))).toBe('environment');
    expect(cameraFacingOf(track({}, 'FaceTime HD Camera'))).toBe('user');
    expect(cameraFacingOf(track({}, 'USB Webcam'))).toBeNull();
    expect(cameraFacingOf(null)).toBeNull();
  });
});

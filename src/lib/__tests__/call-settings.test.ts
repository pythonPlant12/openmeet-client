import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCallSettings, resolveCallDevices, saveCallSettings } from '../call-settings';

function device(kind: MediaDeviceKind, deviceId: string) {
  return { kind, deviceId, label: deviceId, groupId: '' } as MediaDeviceInfo;
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
  };
}

describe('call settings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a first call on this device with no saved devices, the mic off and the preview not yet seen', () => {
    expect(loadCallSettings()).toEqual({
      microphoneId: null,
      cameraId: null,
      speakerId: null,
      cameraPreviewSeen: false,
      micOn: false,
    });
  });

  it('restores the saved devices, the preview-seen flag and the mic state', () => {
    saveCallSettings({ microphoneId: 'mic-2', cameraId: 'cam-2' });
    saveCallSettings({ speakerId: 'speaker-2', cameraPreviewSeen: true, micOn: true });

    expect(loadCallSettings()).toEqual({
      microphoneId: 'mic-2',
      cameraId: 'cam-2',
      speakerId: 'speaker-2',
      cameraPreviewSeen: true,
      micOn: true,
    });
  });

  it('never restores the camera turned on', () => {
    localStorage.setItem('openmeet:call-settings', JSON.stringify({ cameraOn: true, videoEnabled: true }));
    saveCallSettings({ cameraOn: true } as never);

    const settings = loadCallSettings();
    expect(settings).not.toHaveProperty('cameraOn');
    expect(settings).not.toHaveProperty('videoEnabled');
    expect(localStorage.getItem('openmeet:call-settings')).not.toContain('cameraOn');
  });

  it('falls back to the system default for a saved device that is no longer there', () => {
    saveCallSettings({ microphoneId: 'unplugged-mic', cameraId: 'cam-2', speakerId: 'unplugged-speaker' });
    const devices = [device('audioinput', 'mic-1'), device('videoinput', 'cam-1'), device('videoinput', 'cam-2')];

    expect(resolveCallDevices(loadCallSettings(), devices)).toEqual({
      microphoneId: null,
      cameraId: 'cam-2',
      speakerId: null,
    });
  });

  it('does not match a device of another kind with the same ID', () => {
    saveCallSettings({ microphoneId: 'shared-id' });

    expect(resolveCallDevices(loadCallSettings(), [device('audiooutput', 'shared-id')]).microphoneId).toBeNull();
  });

  it('ignores stored values of the wrong shape', () => {
    localStorage.setItem(
      'openmeet:call-settings',
      JSON.stringify({ microphoneId: 4, cameraId: '', cameraPreviewSeen: 'yes', micOn: 'true' }),
    );

    expect(loadCallSettings()).toEqual({
      microphoneId: null,
      cameraId: null,
      speakerId: null,
      cameraPreviewSeen: false,
      micOn: false,
    });
  });

  it('keeps the call working when storage is unreadable or blocked', () => {
    localStorage.setItem('openmeet:call-settings', '{not json');
    expect(loadCallSettings().micOn).toBe(false);

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });

    expect(() => saveCallSettings({ micOn: true })).not.toThrow();
    expect(loadCallSettings()).toEqual({
      microphoneId: null,
      cameraId: null,
      speakerId: null,
      cameraPreviewSeen: false,
      micOn: false,
    });
  });
});

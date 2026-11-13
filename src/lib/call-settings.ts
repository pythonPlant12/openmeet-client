// Call settings belong to this device only, so they live in local storage and are never synced to the account.
// The camera's on state is deliberately absent: a call always starts with the camera off.

const STORAGE_KEY = 'openmeet:call-settings';

export interface CallSettings {
  microphoneId: string | null;
  cameraId: string | null;
  speakerId: string | null;
  /** The camera preview opened once on this device, so later camera turn-ons skip it. */
  cameraPreviewSeen: boolean;
  micOn: boolean;
}

export type CallDevices = Pick<CallSettings, 'microphoneId' | 'cameraId' | 'speakerId'>;

const DEFAULTS: CallSettings = {
  microphoneId: null,
  cameraId: null,
  speakerId: null,
  cameraPreviewSeen: false,
  micOn: false,
};

const DEVICE_KINDS: Record<keyof CallDevices, MediaDeviceKind> = {
  microphoneId: 'audioinput',
  cameraId: 'videoinput',
  speakerId: 'audiooutput',
};

const deviceId = (value: unknown) => (typeof value === 'string' && value ? value : null);
const flag = (value: unknown) => value === true;

function readStored(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Unknown, malformed or unreadable values fall back to a first call on this device. */
export function loadCallSettings(): CallSettings {
  const stored = readStored();
  return {
    microphoneId: deviceId(stored.microphoneId),
    cameraId: deviceId(stored.cameraId),
    speakerId: deviceId(stored.speakerId),
    cameraPreviewSeen: flag(stored.cameraPreviewSeen),
    micOn: flag(stored.micOn),
  };
}

export function saveCallSettings(changes: Partial<CallSettings>) {
  const next = { ...loadCallSettings() };
  for (const key of Object.keys(DEFAULTS) as (keyof CallSettings)[]) {
    if (key in changes) Object.assign(next, { [key]: changes[key] });
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A private window may block storage; the choice still applies to this call.
  }
}

/** The first camera turn-on on a device opens the camera preview; later ones turn the camera on directly. */
export function needsCameraPreview(): boolean {
  return !loadCallSettings().cameraPreviewSeen;
}

/** A saved device that is no longer connected becomes null, which means the system default. */
export function resolveCallDevices(settings: CallSettings, devices: MediaDeviceInfo[]): CallDevices {
  const present = (key: keyof CallDevices) => {
    const id = settings[key];
    return id && devices.some((device) => device.kind === DEVICE_KINDS[key] && device.deviceId === id) ? id : null;
  };
  return { microphoneId: present('microphoneId'), cameraId: present('cameraId'), speakerId: present('speakerId') };
}

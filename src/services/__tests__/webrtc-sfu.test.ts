import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SignalingService } from '../signaling';
import { WebRTCServiceSFU } from '../webrtc-sfu';

class FakeTrack extends EventTarget {
  enabled = true;
  readyState: MediaStreamTrackState = 'live';
  constructor(
    readonly kind: 'audio' | 'video',
    private deviceId: string,
  ) {
    super();
  }
  stop = vi.fn(() => {
    this.readyState = 'ended';
  });
  getSettings() {
    return { deviceId: this.deviceId, height: 720 };
  }
  applyConstraints = vi.fn(async () => {});
}

class FakeStream {
  id = 'local-stream';
  private tracks: FakeTrack[];
  constructor(tracks: FakeTrack[] = []) {
    this.tracks = [...tracks];
  }
  getTracks = () => [...this.tracks];
  getAudioTracks = () => this.tracks.filter((track) => track.kind === 'audio');
  getVideoTracks = () => this.tracks.filter((track) => track.kind === 'video');
  addTrack = (track: FakeTrack) => this.tracks.push(track);
  removeTrack = (track: FakeTrack) => {
    this.tracks = this.tracks.filter((candidate) => candidate !== track);
  };
}

class FakeSender {
  constructor(public track: FakeTrack | null) {}
  replaceTrack = vi.fn(async (track: FakeTrack | null) => {
    this.track = track;
  });
  getParameters = () => ({ encodings: [{}] });
  setParameters = vi.fn(async () => {});
}

class FakePeerConnection {
  senders: FakeSender[] = [];
  transceiverKinds: string[] = [];
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0' }));
  setLocalDescription = vi.fn(async () => {});
  close = vi.fn();
  addTrack(track: FakeTrack) {
    const sender = new FakeSender(track);
    this.senders.push(sender);
    return sender;
  }
  addTransceiver(kind: string) {
    const sender = new FakeSender(null);
    this.senders.push(sender);
    this.transceiverKinds.push(kind);
    return { sender };
  }
  getSenders = () => this.senders;
  getTransceivers = () => [];
}

function signaling() {
  return { on: vi.fn(), sendOffer: vi.fn(), sendIceCandidate: vi.fn() } as unknown as SignalingService;
}

describe('WebRTCServiceSFU camera', () => {
  let peerConnection: FakePeerConnection;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let microphone: FakeTrack;
  let camera: FakeTrack;

  beforeEach(() => {
    microphone = new FakeTrack('audio', 'mic-1');
    camera = new FakeTrack('video', 'cam-1');
    getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) =>
      constraints.audio
        ? new FakeStream([microphone, camera])
        : new FakeStream([
            new FakeTrack('video', (constraints.video as { deviceId?: { ideal: string } }).deviceId?.ideal ?? 'cam-1'),
          ]),
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal(
      'RTCPeerConnection',
      vi.fn(function RTCPeerConnection() {
        peerConnection = new FakePeerConnection();
        return peerConnection;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startCall() {
    const service = new WebRTCServiceSFU(signaling(), []);
    await service.initializeMedia();
    service.createPeerConnection();
    return service;
  }

  function videoSender() {
    return peerConnection.senders[1]!;
  }

  it('stops the camera and sends nothing on its sender when the camera turns off', async () => {
    const service = await startCall();

    await service.setCameraEnabled(false);

    expect(camera.stop).toHaveBeenCalled();
    expect(videoSender().replaceTrack).toHaveBeenCalledWith(null);
    expect(service.getLocalStream()!.getVideoTracks()).toHaveLength(0);
    expect(service.isCameraOn()).toBe(false);
  });

  it('captures the same camera again on the same sender without a new offer', async () => {
    const service = await startCall();
    await service.setCameraEnabled(false);

    await service.setCameraEnabled(true);

    const restarted = service.getLocalStream()!.getVideoTracks()[0] as unknown as FakeTrack;
    expect(restarted.readyState).toBe('live');
    expect(restarted).not.toBe(camera);
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: expect.objectContaining({ deviceId: { ideal: 'cam-1' } }),
    });
    expect(videoSender().track).toBe(restarted);
    expect(peerConnection.senders).toHaveLength(2);
    expect(peerConnection.createOffer).not.toHaveBeenCalled();
    expect(service.isCameraOn()).toBe(true);
  });

  it('leaves the microphone running while the camera is off', async () => {
    const service = await startCall();

    await service.setCameraEnabled(false);

    expect(microphone.stop).not.toHaveBeenCalled();
    expect(microphone.enabled).toBe(true);
  });

  it('keeps a video sender for a camera that is off before the call connects', async () => {
    const service = new WebRTCServiceSFU(signaling(), []);
    await service.initializeMedia();
    await service.setCameraEnabled(false);

    service.createPeerConnection();
    await service.setCameraEnabled(true);

    expect(peerConnection.transceiverKinds).toEqual(['video']);
    expect(videoSender().track).toBe(service.getLocalStream()!.getVideoTracks()[0]);
  });

  it('remembers a camera chosen while off and opens it on the next turn-on', async () => {
    const service = await startCall();
    await service.setCameraEnabled(false);

    await service.switchDevice('video', 'cam-2');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(service.getActiveDeviceId('video')).toBe('cam-2');

    await service.setCameraEnabled(true);
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: expect.objectContaining({ deviceId: { ideal: 'cam-2' } }),
    });
  });

  function stubCameraPermission(state: PermissionState) {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      permissions: { query: vi.fn(async () => ({ state })) },
    });
  }

  it('enters with one capture of both devices and the camera already off', async () => {
    stubCameraPermission('prompt');
    const service = new WebRTCServiceSFU(signaling(), []);

    await service.initializeMedia({ cameraOff: true });
    service.createPeerConnection();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: expect.anything(), video: expect.anything() }));
    expect(camera.stop).toHaveBeenCalled();
    expect(service.isCameraOn()).toBe(false);
    expect(service.hasCamera()).toBe(true);
    expect(peerConnection.transceiverKinds).toEqual(['video']);
  });

  it('does not open the camera at entry once the camera is allowed', async () => {
    stubCameraPermission('granted');
    getUserMedia.mockImplementation(async (constraints: MediaStreamConstraints) =>
      constraints.video
        ? new FakeStream([new FakeTrack('video', (constraints.video as { deviceId: { ideal: string } }).deviceId.ideal)])
        : new FakeStream([microphone]),
    );
    const service = new WebRTCServiceSFU(signaling(), []);

    await service.initializeMedia({ cameraOff: true, videoDeviceId: 'cam-2' });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
    expect(service.hasCamera()).toBe(true);

    service.createPeerConnection();
    await service.setCameraEnabled(true);
    expect(service.getActiveDeviceId('video')).toBe('cam-2');
  });

  it('prefers the saved devices without requiring them', async () => {
    const service = new WebRTCServiceSFU(signaling(), []);

    await service.initializeMedia({ audioDeviceId: 'mic-9', videoDeviceId: 'cam-9' });

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { ideal: 'mic-9' } }),
      video: expect.objectContaining({ deviceId: { ideal: 'cam-9' } }),
    });
  });

  it('turns the camera on with the track the camera preview already captured', async () => {
    const service = await startCall();
    await service.setCameraEnabled(false);
    getUserMedia.mockClear();
    const previewTrack = new FakeTrack('video', 'cam-2');

    await service.setCameraEnabled(true, previewTrack as unknown as MediaStreamTrack);

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(videoSender().track).toBe(previewTrack);
    expect(service.getLocalStream()!.getVideoTracks()).toEqual([previewTrack]);
  });

  it('still counts a camera that is off as available', async () => {
    const service = await startCall();
    await service.setCameraEnabled(false);

    expect(service.hasCamera()).toBe(true);
  });
});

class FakeAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'running';
  processed = new FakeTrack('audio', 'processed');
  sources: FakeStream[] = [];
  gain = Object.assign(new FakeAudioNode(), { gain: { value: 1 } });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource = (stream: FakeStream) => {
    this.sources.push(stream);
    return new FakeAudioNode();
  };
  createGain = () => this.gain;
  createAnalyser = () =>
    Object.assign(new FakeAudioNode(), {
      fftSize: 0,
      frequencyBinCount: 4,
      getByteTimeDomainData: (samples: Uint8Array) => samples.fill(192),
    });
  createMediaStreamDestination = () => ({ stream: new FakeStream([this.processed]) });
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}

describe('WebRTCServiceSFU input volume', () => {
  let peerConnection: FakePeerConnection;
  let microphone: FakeTrack;

  beforeEach(() => {
    FakeAudioContext.instances = [];
    microphone = new FakeTrack('audio', 'mic-1');
    const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) =>
      constraints.video
        ? new FakeStream([microphone, new FakeTrack('video', 'cam-1')])
        : new FakeStream([new FakeTrack('audio', 'mic-2')]),
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal(
      'RTCPeerConnection',
      vi.fn(function RTCPeerConnection() {
        peerConnection = new FakePeerConnection();
        return peerConnection;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startCall() {
    const service = new WebRTCServiceSFU(signaling(), []);
    await service.initializeMedia();
    service.createPeerConnection();
    return service;
  }

  const audioSender = () => peerConnection.senders[0]!;

  it('sends the microphone at the chosen volume, and the microphone itself at full volume', async () => {
    const service = await startCall();

    await service.setInputVolume(0.4);
    const context = FakeAudioContext.instances[0]!;
    expect(context.gain.gain.value).toBe(0.4);
    expect(audioSender().track).toBe(context.processed);

    await service.setInputVolume(1);
    expect(audioSender().track).toBe(microphone);
    expect(peerConnection.createOffer).not.toHaveBeenCalled();
  });

  it('keeps the input volume when the microphone changes', async () => {
    const service = await startCall();
    await service.setInputVolume(0.5);

    await service.switchDevice('audio', 'mic-2');

    const context = FakeAudioContext.instances[0]!;
    expect(audioSender().track).toBe(context.processed);
    expect(context.sources[context.sources.length - 1]!.getAudioTracks()[0]!.getSettings().deviceId).toBe('mic-2');
  });

  it('measures the outgoing microphone level', async () => {
    const service = await startCall();

    await service.startInputMeter();

    expect(service.getInputLevel()).toBeGreaterThan(0);
    expect(audioSender().track).toBe(microphone);
  });
});

describe('WebRTCServiceSFU listen-only and lost media', () => {
  let peerConnection: FakePeerConnection;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let permissionState: PermissionState;

  const denied = () => new DOMException('denied', 'NotAllowedError');
  const missing = () => new DOMException('none', 'NotFoundError');

  beforeEach(() => {
    permissionState = 'prompt';
    getUserMedia = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      permissions: { query: vi.fn(async () => ({ state: permissionState })) },
    });
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal(
      'RTCPeerConnection',
      vi.fn(function RTCPeerConnection() {
        peerConnection = new FakePeerConnection();
        return peerConnection;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startCall() {
    const service = new WebRTCServiceSFU(signaling(), []);
    await service.initializeMedia({ cameraOff: true });
    service.createPeerConnection();
    return service;
  }

  it('enters listen-only when permission is denied, still ready to send both later', async () => {
    getUserMedia.mockRejectedValue(denied());

    const service = await startCall();

    expect(service.getLocalStream()!.getTracks()).toHaveLength(0);
    expect(service.getMediaIssue('audio')).toBe('denied');
    expect(service.getMediaIssue('video')).toBe('denied');
    expect(service.hasCamera()).toBe(false);
    expect(peerConnection.transceiverKinds).toEqual(['audio', 'video']);
  });

  it('keeps the microphone when there is no camera', async () => {
    const microphone = new FakeTrack('audio', 'mic-1');
    getUserMedia.mockImplementation(async (constraints: MediaStreamConstraints) => {
      if (constraints.video) throw missing();
      return new FakeStream([microphone]);
    });

    const service = await startCall();

    expect(service.getLocalStream()!.getAudioTracks()).toEqual([microphone]);
    expect(service.getMediaIssue('audio')).toBeNull();
    expect(service.getMediaIssue('video')).toBe('unavailable');
  });

  it('asks again and sends the new microphone on the existing sender', async () => {
    getUserMedia.mockRejectedValueOnce(denied());
    const service = await startCall();
    const microphone = new FakeTrack('audio', 'mic-1');
    getUserMedia.mockResolvedValueOnce(new FakeStream([microphone]));

    expect(await service.requestMedia('audio')).toBeNull();

    expect(peerConnection.senders[0]!.track).toBe(microphone);
    expect(service.getLocalStream()!.getAudioTracks()).toEqual([microphone]);
    expect(service.getMediaIssue('audio')).toBeNull();
    expect(peerConnection.createOffer).not.toHaveBeenCalled();
  });

  it('does not ask again once the permission is permanently denied', async () => {
    getUserMedia.mockRejectedValue(denied());
    const service = await startCall();
    getUserMedia.mockClear();
    permissionState = 'denied';

    expect(await service.requestMedia('video')).toBe('denied');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('stops sending and reports a track that drops during the call', async () => {
    const microphone = new FakeTrack('audio', 'mic-1');
    getUserMedia.mockResolvedValue(new FakeStream([microphone, new FakeTrack('video', 'cam-1')]));
    const service = await startCall();
    const lost = vi.fn();
    service.onLocalTrackLost = lost;

    microphone.readyState = 'ended';
    microphone.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(lost).toHaveBeenCalledWith('audio');
    expect(service.getLocalStream()!.getAudioTracks()).toHaveLength(0);
    expect(peerConnection.senders[0]!.replaceTrack).toHaveBeenCalledWith(null);
    expect(service.getMediaIssue('audio')).toBe('unavailable');
  });
});

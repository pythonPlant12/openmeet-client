import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScreenShareSession } from '../screen-share';

const webrtc = vi.hoisted(() => ({ useLocalStream: vi.fn(), createPeerConnection: vi.fn(), sendOffer: vi.fn() }));

vi.mock('../signaling', () => ({
  SignalingService: vi.fn(function SignalingService() {
    return { connect: vi.fn(), onConnectionChange: vi.fn(), on: vi.fn(), joinRoom: vi.fn(), disconnect: vi.fn() };
  }),
}));
vi.mock('../webrtc-sfu', () => ({
  WebRTCServiceSFU: vi.fn(function WebRTCServiceSFU() {
    return { ...webrtc, cleanup: vi.fn() };
  }),
}));

const options = {
  serverUrl: 'ws://localhost',
  roomId: 'room-1',
  presenterId: 'presenter-1',
  presenterName: 'Ada',
  password: null,
  quality: 'auto' as const,
};

function capturedStream() {
  const video = { contentHint: '', kind: 'video', stop: vi.fn(), addEventListener: vi.fn() };
  const audio = { kind: 'audio', stop: vi.fn() };
  return {
    video,
    audio,
    stream: {
      getVideoTracks: () => [video],
      getAudioTracks: () => [audio],
      getTracks: () => [video, audio],
    } as unknown as MediaStream,
  };
}

describe('ScreenShareSession', () => {
  beforeEach(() => {
    webrtc.createPeerConnection.mockReturnValue({});
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function stubCapture(stream: MediaStream) {
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(stream) } });
  }

  it('sends the captured screen with its sound, sharp for text', async () => {
    const { stream, video } = capturedStream();
    stubCapture(stream);

    const sent = await new ScreenShareSession().start(options);

    expect(sent).toBe(stream);
    expect(video.contentHint).toBe('detail');
    expect(webrtc.useLocalStream).toHaveBeenCalledWith(stream, 'auto');
    expect(webrtc.sendOffer).toHaveBeenCalled();
  });

  it('stops the capture once when the share ends', async () => {
    const { stream, video, audio } = capturedStream();
    stubCapture(stream);
    const session = new ScreenShareSession();
    const ended = vi.fn();
    session.onEnded = ended;
    await session.start(options);

    session.stop();
    session.stop();

    expect(video.stop).toHaveBeenCalledTimes(1);
    expect(audio.stop).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith('stopped');
  });

  it('ends with an error and stops the capture when joining fails', async () => {
    const { stream, video } = capturedStream();
    stubCapture(stream);
    webrtc.sendOffer.mockRejectedValueOnce(new Error('offer failed'));
    const session = new ScreenShareSession();
    const ended = vi.fn();
    session.onEnded = ended;

    await expect(session.start(options)).rejects.toThrow('offer failed');
    expect(video.stop).toHaveBeenCalled();
    expect(ended).toHaveBeenCalledWith('error');
  });
});

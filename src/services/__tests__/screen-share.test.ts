import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cropVideoTrack } from '../screen-crop';
import { ScreenShareSession } from '../screen-share';

const webrtc = vi.hoisted(() => ({ useLocalStream: vi.fn(), createPeerConnection: vi.fn(), sendOffer: vi.fn() }));
const crop = vi.hoisted(() => ({ stop: vi.fn(), track: { contentHint: '', kind: 'video' } }));

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
vi.mock('../screen-crop', () => ({ cropVideoTrack: vi.fn(() => crop) }));

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
    vi.stubGlobal(
      'MediaStream',
      vi.fn(function MediaStream(tracks: unknown[]) {
        return { tracks };
      }),
    );
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function stubCapture(stream: MediaStream) {
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(stream) } });
  }

  it('sends only the selected area with the captured sound', async () => {
    const { stream, video, audio } = capturedStream();
    stubCapture(stream);
    const area = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };

    const sent = await new ScreenShareSession().start({ ...options, chooseArea: async () => area });

    expect(cropVideoTrack).toHaveBeenCalledWith(video, area);
    expect(sent).toEqual({ tracks: [crop.track, audio] });
    expect(webrtc.useLocalStream).toHaveBeenCalledWith(sent, 'auto');
  });

  it('sends the whole capture when everything is chosen', async () => {
    const { stream } = capturedStream();
    stubCapture(stream);

    const sent = await new ScreenShareSession().start({ ...options, chooseArea: async () => 'whole' });

    expect(cropVideoTrack).not.toHaveBeenCalled();
    expect(sent).toBe(stream);
  });

  it('stops the capture without joining when the area picker is closed', async () => {
    const { stream, video, audio } = capturedStream();
    stubCapture(stream);
    const session = new ScreenShareSession();
    const ended = vi.fn();
    session.onEnded = ended;

    await expect(session.start({ ...options, chooseArea: async () => null })).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(webrtc.useLocalStream).not.toHaveBeenCalled();
    expect(ended).toHaveBeenCalledWith('stopped');
  });

  it('stops the crop and the capture when the share ends', async () => {
    const { stream, video } = capturedStream();
    stubCapture(stream);
    const session = new ScreenShareSession();
    await session.start({ ...options, chooseArea: async () => ({ x: 0, y: 0, width: 0.5, height: 0.5 }) });

    session.stop();

    expect(crop.stop).toHaveBeenCalled();
    expect(video.stop).toHaveBeenCalled();
  });
});

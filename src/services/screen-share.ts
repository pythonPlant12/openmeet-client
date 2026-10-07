import { SignalingService } from './signaling';
import { SCREEN_LEVELS, type VideoQuality, captureConstraints } from './video-quality';
import { WebRTCServiceSFU } from './webrtc-sfu';

export type ScreenShareEndReason = 'stopped' | 'lost' | 'error';

export interface ScreenShareOptions {
  serverUrl: string;
  roomId: string;
  /** The presenter's participant ID in the room; the server ties the share to it. */
  presenterId: string;
  presenterName: string;
  password: string | null;
  quality: VideoQuality;
}

/**
 * A presenter's screen share. It joins the room as its own send-only connection marked as the presenter's
 * screen, so the SFU forwards it like a camera, never sends media back to it, and drops it with the presenter.
 */
export class ScreenShareSession {
  private signaling: SignalingService | null = null;
  private webrtc: WebRTCServiceSFU | null = null;
  private ended = false;
  stream: MediaStream | null = null;
  onEnded: ((reason: ScreenShareEndReason) => void) | null = null;
  onLevelChange: ((height: number) => void) | null = null;

  static isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  }

  /** Asks the browser which screen, window, or tab to share, then starts sending it. */
  async start(options: ScreenShareOptions): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: captureConstraints(SCREEN_LEVELS, options.quality),
      // Tabs can share their sound; the presenter's microphone already carries their voice.
      audio: true,
      // The meeting tab itself would show an endless mirror of the call.
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
    } as DisplayMediaStreamOptions);
    this.stream = stream;
    const video = stream.getVideoTracks()[0];
    if (video) {
      // Text and slides stay sharp; the encoder lowers frame rate before resolution.
      video.contentHint = 'detail';
      // The browser's own "Stop sharing" button ends the track.
      video.addEventListener('ended', () => this.stop('stopped'));
    }

    try {
      const signaling = new SignalingService(options.serverUrl);
      this.signaling = signaling;
      await signaling.connect();
      // The share does not rejoin on its own: a new connection would need the presenter's new ID.
      signaling.onConnectionChange((change) => {
        if (change === 'lost' || change === 'abandoned') this.stop('lost');
      });
      signaling.on('error', (message) => {
        if (message.type === 'error') {
          console.error('[ScreenShareSession] Meeting server refused the screen share:', message.message);
          this.stop('error');
        }
      });

      const webrtc = new WebRTCServiceSFU(signaling, undefined, 'screen');
      this.webrtc = webrtc;
      webrtc.onVideoLevelChange = (height) => this.onLevelChange?.(height);
      webrtc.useLocalStream(stream, options.quality);
      signaling.joinRoom(options.roomId, options.presenterName, options.password, options.presenterId);
      const connection = webrtc.createPeerConnection();
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'failed') this.stop('lost');
      };
      await webrtc.sendOffer();
    } catch (error) {
      this.stop('error');
      throw error;
    }
    return stream;
  }

  async setQuality(quality: VideoQuality) {
    await this.webrtc?.setVideoQuality(quality);
  }

  setAudienceSize(otherPeople: number) {
    this.webrtc?.setAudienceSize(otherPeople);
  }

  stop(reason: ScreenShareEndReason = 'stopped') {
    if (this.ended) return;
    this.ended = true;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.webrtc?.cleanup();
    this.signaling?.disconnect();
    this.webrtc = null;
    this.signaling = null;
    this.onEnded?.(reason);
  }
}

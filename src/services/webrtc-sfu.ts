import { i18n } from '@/i18n';

import { resolveReachableTurnUrl } from './dev-networking';
import { MicInput } from './mic-input';
import { SignalingService } from './signaling';
import {
  CAMERA_LEVELS,
  SCREEN_LEVELS,
  SenderQualityController,
  type VideoQuality,
  captureConstraints,
  maxLevelForAudience,
} from './video-quality';

export interface DeviceConstraints {
  audioDeviceId?: string | null;
  videoDeviceId?: string | null;
  videoQuality?: VideoQuality;
}

export type { VideoQuality };

export interface ConnectionQualityStats {
  quality: 'good' | 'poor';
  packetLossRatio: number;
  roundTripTime: number | null;
  jitter: number | null;
  reason: string | null;
  hasRecentMediaActivity: boolean;
  remoteVideoFrozen: boolean;
}

interface InboundPacketSnapshot {
  packetsReceived: number;
  packetsLost: number;
  bytesReceived: number;
  framesDecoded: number;
}

interface MediaStatsSummary {
  inbound: Array<{
    id: string;
    kind: string;
    mid?: string;
    ssrc?: number;
    trackIdentifier?: string;
    packetsReceived: number;
    packetsLost: number;
    bytesReceived: number;
    framesDecoded?: number;
    audioLevel?: number;
    jitter?: number;
  }>;
  outbound: Array<{
    kind: string;
    packetsSent: number;
    bytesSent: number;
    framesEncoded?: number;
  }>;
  selectedCandidatePair: {
    currentRoundTripTime?: number;
    availableOutgoingBitrate?: number;
    localCandidateType?: string;
    localProtocol?: string;
    remoteCandidateType?: string;
    remoteProtocol?: string;
  } | null;
}

function createDefaultIceServers(): RTCIceServer[] {
  const turnUrl = resolveReachableTurnUrl(import.meta.env.VITE_TURN_URL || 'turn:turn.openmeets.eu:3478');

  return [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
    {
      urls: turnUrlsWithTcpFallback(turnUrl),
      username: import.meta.env.VITE_TURN_USER || 'openmeet',
      credential: import.meta.env.VITE_TURN_PASSWORD || 'openmeet123',
    },
  ];
}

function turnUrlsWithTcpFallback(turnUrl: string): string[] {
  if (!turnUrl.startsWith('turn:') || turnUrl.includes('?')) {
    return [turnUrl];
  }

  return [turnUrl, `${turnUrl}?transport=tcp`];
}

function mediaErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) return i18n.global.t('errors.mediaUnavailable');

  const errorKeys: Record<string, string> = {
    NotAllowedError: 'errors.mediaPermissionDenied',
    NotFoundError: 'errors.mediaDevicesMissing',
    NotReadableError: 'errors.mediaDevicesBusy',
    OverconstrainedError: 'errors.mediaConstraints',
    SecurityError: 'errors.mediaUnavailable',
  };

  return i18n.global.t(errorKeys[error.name] ?? 'errors.mediaUnavailable');
}

function configuredIceTransportPolicy(): RTCIceTransportPolicy {
  const policy = import.meta.env.VITE_ICE_TRANSPORT_POLICY;

  if (policy === 'relay') {
    return 'relay';
  }

  return 'all';
}

export class WebRTCServiceSFU {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onRemoteTrackCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private previousInboundPackets = new Map<string, InboundPacketSnapshot>();
  private pendingRemoteIceCandidates: RTCIceCandidateInit[] = [];
  private videoQuality: VideoQuality = 'auto';
  /** This participant's own senders, kept so a camera that is off can come back on the same sender. */
  private localSenders: Partial<Record<'audio' | 'video', RTCRtpSender>> = {};
  /** Camera to open on the next turn-on; set while the camera is off, so its light is off too. */
  private releasedCameraId: string | null | undefined;
  /** Volume and level stage on the microphone, built the first time either is used. */
  private micInput: MicInput | null = null;
  private inputVolume = 1;
  private readonly videoQualityController: SenderQualityController;
  /** Called with the height the video currently sends, which auto quality changes over time. */
  onVideoLevelChange: ((height: number) => void) | null = null;

  constructor(
    private signalingService: SignalingService,
    private iceServers: RTCIceServer[] = createDefaultIceServers(),
    /** A screen share sends a captured screen with its own quality levels instead of the camera. */
    private videoSource: 'camera' | 'screen' = 'camera',
  ) {
    this.videoQualityController = new SenderQualityController(
      videoSource === 'screen' ? SCREEN_LEVELS : CAMERA_LEVELS,
      () => this.localSender('video', this.localStream?.getVideoTracks()[0]),
      () => this.localStream?.getVideoTracks()[0],
      (height) => this.onVideoLevelChange?.(height),
    );
    this.setupSignalingHandlers();
  }

  /** Sends media captured elsewhere, such as a screen, instead of opening the camera and microphone. */
  useLocalStream(stream: MediaStream, quality: VideoQuality): void {
    this.localStream = stream;
    this.videoQuality = quality;
  }

  private setupSignalingHandlers(): void {
    // Handle answer from server (initial negotiation)
    this.signalingService.on('answer', (message) => {
      if (message.type === 'answer') {
        this.handleAnswer(message.sdp).catch((error) => {
          console.error('[WebRTCServiceSFU] Failed to handle answer:', error);
        });
      }
    });

    // Handle offer from server (for renegotiation when new tracks added)
    this.signalingService.on('offer', (message) => {
      if (message.type === 'offer') {
        console.log('[WebRTCServiceSFU] Received renegotiation offer from server');
        this.handleServerOffer(message.sdp).catch((error) => {
          console.error('[WebRTCServiceSFU] Failed to handle server offer:', error);
        });
      }
    });

    // Handle ICE candidate from server
    this.signalingService.on('iceCandidate', (message) => {
      if (message.type === 'iceCandidate') {
        this.handleIceCandidate({
          candidate: message.candidate,
          sdpMid: message.sdpMid,
          sdpMLineIndex: message.sdpMLineIndex,
        }).catch((error) => {
          console.error('[WebRTCServiceSFU] Failed to handle ICE candidate:', error);
        });
      }
    });
  }

  async initializeMedia(deviceConstraints?: DeviceConstraints): Promise<MediaStream> {
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      this.videoQuality = deviceConstraints?.videoQuality ?? 'auto';
      const videoConstraints = captureConstraints(CAMERA_LEVELS, this.videoQuality);

      // Apply device ID constraints if provided
      if (deviceConstraints?.audioDeviceId) {
        audioConstraints.deviceId = { exact: deviceConstraints.audioDeviceId };
      }
      if (deviceConstraints?.videoDeviceId) {
        videoConstraints.deviceId = { exact: deviceConstraints.videoDeviceId };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

      console.log('[WebRTCServiceSFU] Media initialized:', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
        audioDevice: deviceConstraints?.audioDeviceId || 'default',
        videoDevice: deviceConstraints?.videoDeviceId || 'default',
      });

      return this.localStream;
    } catch (error) {
      console.error('[WebRTCServiceSFU] Failed to initialize media:', error);
      throw new Error(i18n.global.t('errors.mediaAccess', { message: mediaErrorMessage(error) }));
    }
  }

  createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      console.log('[WebRTCServiceSFU] Closing existing peer connection');
      this.peerConnection.close();
    }
    this.pendingRemoteIceCandidates = [];

    console.log('[WebRTCServiceSFU] Creating new peer connection');
    const iceTransportPolicy = configuredIceTransportPolicy();
    console.log('[WebRTCServiceSFU] ICE transport policy:', iceTransportPolicy);

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy,
    });

    // Add local tracks to peer connection. A camera that is off still gets its sender, so turning it on
    // later only replaces the track and never renegotiates.
    this.localSenders = {};
    const stream = this.localStream;
    if (stream) {
      for (const track of stream.getTracks()) {
        const sender = this.peerConnection.addTrack(track, stream);
        const kind = track.kind as 'audio' | 'video';
        this.localSenders[kind] ??= sender;
      }
      if (this.localSenders.audio && this.micInput && this.inputVolume !== 1) {
        void this.localSenders.audio.replaceTrack(this.micInput.outputTrack);
      }
      if (!this.localSenders.video && this.releasedCameraId !== undefined) {
        this.localSenders.video = this.peerConnection.addTransceiver('video', {
          direction: 'sendrecv',
          streams: [stream],
        }).sender;
      }
      console.log('[WebRTCServiceSFU] ✓ Local media added to peer connection');
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTCServiceSFU] Local ICE candidate:', this.describeCandidate(event.candidate.candidate));
        this.signalingService.sendIceCandidate('server', event.candidate.toJSON());
      } else {
        console.log('[WebRTCServiceSFU] Local ICE gathering complete');
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTCServiceSFU] Peer connection state CHANGED TO:', this.peerConnection?.connectionState);
    };

    // Handle remote tracks (from SFU forwarding other participants' media)
    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      const track = event.track;
      const transceiver = this.peerConnection
        ?.getTransceivers()
        .find((candidate) => candidate.receiver.track === track);

      console.log('[WebRTCServiceSFU] Remote track event:', {
        kind: track.kind,
        trackId: track.id,
        streamId: stream.id,
        mid: transceiver?.mid ?? null,
        muted: track.muted,
        readyState: track.readyState,
        streams: event.streams.map((eventStream) => eventStream.id),
      });

      track.onmute = () => {
        console.log('[WebRTCServiceSFU] Remote track muted:', {
          kind: track.kind,
          trackId: track.id,
          streamId: stream.id,
        });
      };
      track.onunmute = () => {
        console.log('[WebRTCServiceSFU] Remote track unmuted:', {
          kind: track.kind,
          trackId: track.id,
          streamId: stream.id,
        });
      };
      track.onended = () => {
        console.log('[WebRTCServiceSFU] Remote track ended:', {
          kind: track.kind,
          trackId: track.id,
          streamId: stream.id,
        });
      };

      // Ignore local stream (Sometimes Chrome sends its own localstream)
      if (this.localStream && stream.id === this.localStream.id) {
        console.log('[WebRTCServiceSFU] Ignoring own stream reflected from SFU');
        return;
      }

      // Notify callback directly with the original stream
      if (stream && this.onRemoteTrackCallback) {
        console.log(
          `[WebRTCServiceSFU] ✓ Notifying callback for stream ${stream.id} (${stream.getTracks().length} tracks)`,
        );
        this.onRemoteTrackCallback(stream.id, stream);
      }
    };

    return this.peerConnection;
  }

  setOnRemoteTrack(callback: (participantId: string, stream: MediaStream) => void): void {
    this.onRemoteTrackCallback = callback;
  }

  async sendOffer(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error(i18n.global.t('errors.peerFailed'));
    }

    console.log('[WebRTCServiceSFU] Creating offer');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    console.log('[WebRTCServiceSFU] Sending offer to server');
    this.signalingService.sendOffer('server', offer.sdp!);
  }

  private async handleAnswer(sdp: string): Promise<void> {
    if (!this.peerConnection) {
      console.error('[WebRTCServiceSFU] Cannot handle answer: peer connection not initialized');
      return;
    }

    console.log('[WebRTCServiceSFU] Received answer from server');
    const answerDescription = new RTCSessionDescription({
      type: 'answer',
      sdp,
    });

    await this.peerConnection.setRemoteDescription(answerDescription);
    console.log('[WebRTCServiceSFU] Remote description set');
    // Encodings exist once the offer is answered, so the chosen quality starts now.
    void this.videoQualityController.setQuality(this.videoQuality);
    await this.flushPendingRemoteIceCandidates();
  }

  private async handleServerOffer(sdp: string): Promise<void> {
    if (!this.peerConnection) {
      console.error('[WebRTCServiceSFU] Cannot handle server offer: peer connection not initialized');
      return;
    }

    console.log('[WebRTCServiceSFU] Handling renegotiation offer from server (Perfect Negotiation)');

    // Set remote description (server's offer)
    const offerDescription = new RTCSessionDescription({
      type: 'offer',
      sdp,
    });
    await this.peerConnection.setRemoteDescription(offerDescription);
    console.log('[WebRTCServiceSFU] Set remote description from server offer');
    await this.flushPendingRemoteIceCandidates();

    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    console.log('[WebRTCServiceSFU] Created answer for renegotiation');

    // Send answer back to server
    this.signalingService.sendAnswer('server', answer.sdp!);
    console.log('[WebRTCServiceSFU] Sent answer to server');
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      console.error('[WebRTCServiceSFU] Cannot add ICE candidate: peer connection not initialized');
      return;
    }

    if (!this.peerConnection.remoteDescription) {
      console.log(
        '[WebRTCServiceSFU] Queueing remote ICE candidate until remote description is set:',
        this.describeCandidate(candidate.candidate || ''),
      );
      this.pendingRemoteIceCandidates.push(candidate);
      return;
    }

    console.log(
      '[WebRTCServiceSFU] Adding ICE candidate from server:',
      this.describeCandidate(candidate.candidate || ''),
    );
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushPendingRemoteIceCandidates(): Promise<void> {
    if (!this.peerConnection || this.pendingRemoteIceCandidates.length === 0) {
      return;
    }

    const candidates = this.pendingRemoteIceCandidates.splice(0);
    console.log(`[WebRTCServiceSFU] Flushing ${candidates.length} queued remote ICE candidates`);

    for (const candidate of candidates) {
      console.log(
        '[WebRTCServiceSFU] Adding queued ICE candidate from server:',
        this.describeCandidate(candidate.candidate || ''),
      );
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getVideoQuality(): VideoQuality {
    return this.videoQuality;
  }

  /** Device currently feeding the local track of this kind; for a camera that is off, the one it reopens. */
  getActiveDeviceId(kind: 'audio' | 'video'): string | null {
    if (kind === 'video' && this.releasedCameraId !== undefined) return this.releasedCameraId;
    const track = kind === 'audio' ? this.localStream?.getAudioTracks()[0] : this.localStream?.getVideoTracks()[0];
    return track?.getSettings().deviceId ?? null;
  }

  isCameraOn(): boolean {
    return this.localStream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
  }

  /** The call has a camera, live or turned off by this participant. */
  hasCamera(): boolean {
    return this.isCameraOn() || this.releasedCameraId !== undefined;
  }

  /**
   * Turning the camera off stops it, so the device's camera light goes off, and its sender sends nothing.
   * Turning it on captures the camera again and puts the track on the same sender, so the call does not
   * renegotiate. The microphone is muted by disabling its track instead.
   */
  async setCameraEnabled(enabled: boolean): Promise<void> {
    const stream = this.localStream;
    if (!stream) throw new Error(i18n.global.t('errors.mediaUnavailable'));
    const current = stream.getVideoTracks()[0];

    if (!enabled) {
      if (!current) return;
      this.releasedCameraId = current.getSettings().deviceId ?? null;
      // The track leaves the stream before any await, so a peer connection created meanwhile keeps a sender
      // without it.
      stream.removeTrack(current);
      current.stop();
      await this.localSender('video', current)?.replaceTrack(null);
      console.log('[WebRTCServiceSFU] Camera off');
      return;
    }

    if (current?.readyState === 'live') return;
    const replacement = await this.captureCamera(this.releasedCameraId ?? null);
    this.releasedCameraId = undefined;
    await this.localSender('video', undefined)?.replaceTrack(replacement);
    stream.addTrack(replacement);
    await this.videoQualityController.apply();
    console.log('[WebRTCServiceSFU] Camera on');
  }

  private async captureCamera(deviceId: string | null): Promise<MediaStreamTrack> {
    const constraints = captureConstraints(CAMERA_LEVELS, this.videoQuality);
    try {
      const video = deviceId ? { ...constraints, deviceId: { exact: deviceId } } : constraints;
      return (await navigator.mediaDevices.getUserMedia({ video })).getVideoTracks()[0]!;
    } catch (error) {
      console.error('[WebRTCServiceSFU] Failed to open the camera:', error);
      throw new Error(i18n.global.t('errors.mediaAccess', { message: mediaErrorMessage(error) }));
    }
  }

  /**
   * Swaps the camera or microphone during a call. The outgoing RTP sender keeps its transceiver, so no
   * renegotiation is needed and the other participants keep receiving on the same stream.
   */
  async switchDevice(kind: 'audio' | 'video', deviceId: string): Promise<void> {
    const stream = this.localStream;
    if (!stream) throw new Error(i18n.global.t('errors.mediaUnavailable'));
    // A camera that is off stays off; the chosen camera opens on the next turn-on.
    if (kind === 'video' && this.releasedCameraId !== undefined) {
      this.releasedCameraId = deviceId;
      return;
    }
    const previous = kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
    if (previous?.getSettings().deviceId === deviceId) return;

    let replacement: MediaStreamTrack;
    try {
      const constraints =
        kind === 'audio'
          ? {
              audio: {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            }
          : { video: { ...captureConstraints(CAMERA_LEVELS, this.videoQuality), deviceId: { exact: deviceId } } };
      replacement = (await navigator.mediaDevices.getUserMedia(constraints)).getTracks()[0]!;
    } catch (error) {
      console.error('[WebRTCServiceSFU] Failed to open device:', error);
      throw new Error(i18n.global.t('errors.mediaAccess', { message: mediaErrorMessage(error) }));
    }

    // A muted microphone or a camera turned off stays that way on the new device.
    replacement.enabled = previous?.enabled ?? true;
    const sender = this.localSender(kind, previous);
    const sendsInputVolume = kind === 'audio' && !!this.micInput && sender?.track === this.micInput.outputTrack;
    if (kind === 'audio') this.micInput?.setSource(replacement);
    // A microphone sent at a chosen volume keeps its processed track; only the stage's source changes.
    if (!sendsInputVolume) await sender?.replaceTrack(replacement);
    if (previous) {
      stream.removeTrack(previous);
      previous.stop();
    }
    stream.addTrack(replacement);
    if (kind === 'video') await this.videoQualityController.apply();
    console.log('[WebRTCServiceSFU] Switched device:', { kind, deviceId });
  }

  getInputVolume(): number {
    return this.inputVolume;
  }

  /**
   * Sets the outgoing microphone volume from 0 to 1. Full volume sends the microphone track itself, so the call
   * relies on Web Audio only while the volume is lowered.
   */
  async setInputVolume(volume: number): Promise<void> {
    this.inputVolume = Math.min(1, Math.max(0, volume));
    const mic = this.ensureMicInput();
    if (!mic) return;
    mic.setVolume(this.inputVolume);
    await mic.resume();
    const microphone = this.localStream?.getAudioTracks()[0];
    // A suspended audio graph sends silence, so the microphone itself stays on the sender until it runs.
    const outgoing = this.inputVolume === 1 || !mic.isRunning ? microphone : mic.outputTrack;
    const sender = this.localSenders.audio;
    if (outgoing && sender && sender.track !== outgoing) await sender.replaceTrack(outgoing);
  }

  /** Starts measuring the microphone; call from a gesture so the audio graph may run. */
  async startInputMeter(): Promise<void> {
    await this.ensureMicInput()?.resume();
  }

  /** Outgoing microphone level from 0 to 1, after the input volume. */
  getInputLevel(): number {
    return this.micInput?.isRunning ? this.micInput.level() : 0;
  }

  private ensureMicInput(): MicInput | null {
    const microphone = this.localStream?.getAudioTracks()[0];
    if (this.micInput || !microphone || typeof AudioContext === 'undefined') return this.micInput;
    try {
      this.micInput = new MicInput(microphone);
      this.micInput.setVolume(this.inputVolume);
    } catch (error) {
      console.error('[WebRTCServiceSFU] Failed to start the microphone volume stage:', error);
    }
    return this.micInput;
  }

  /** Changes the outgoing camera quality; auto keeps adjusting it to the network. */
  async setVideoQuality(quality: VideoQuality): Promise<void> {
    this.videoQuality = quality;
    await this.videoQualityController.setQuality(quality);
    console.log('[WebRTCServiceSFU] Video quality set:', quality, `${this.videoQualityController.currentHeight()}p`);
  }

  /** Height the camera currently sends. */
  getCameraHeight(): number {
    return this.videoQualityController.currentHeight();
  }

  /** Each other person receives a copy through the SFU, so auto quality has a lower ceiling in bigger calls. */
  setAudienceSize(otherPeople: number): void {
    void this.videoQualityController.setMaxIndex(maxLevelForAudience(otherPeople, this.videoSource));
  }

  private localSender(kind: 'audio' | 'video', track: MediaStreamTrack | undefined) {
    // Forwarded media arrives on receive-only transceivers, so only this participant's senders carry a track.
    const own = this.localSenders[kind];
    if (own) return own;
    const senders = this.peerConnection?.getSenders() ?? [];
    return (
      senders.find((sender) => track && sender.track === track) ?? senders.find((sender) => sender.track?.kind === kind)
    );
  }

  async getInboundAudioLevels(): Promise<Map<string, number>> {
    const levels = new Map<string, number>();
    if (!this.peerConnection) return levels;

    const stats = await this.peerConnection.getStats();
    stats.forEach((report) => {
      if (
        report.type === 'inbound-rtp' &&
        !report.isRemote &&
        (report.kind || report.mediaType) === 'audio' &&
        typeof report.trackIdentifier === 'string' &&
        typeof report.audioLevel === 'number'
      ) {
        levels.set(report.trackIdentifier, report.audioLevel);
      }
    });
    return levels;
  }

  async getConnectionQualityStats(): Promise<ConnectionQualityStats> {
    if (!this.peerConnection) {
      return {
        quality: 'good',
        packetLossRatio: 0,
        roundTripTime: null,
        jitter: null,
        reason: null,
        hasRecentMediaActivity: false,
        remoteVideoFrozen: false,
      };
    }

    const stats = await this.peerConnection.getStats();
    let maxPacketLossRatio = 0;
    let maxJitter: number | null = null;
    let maxRoundTripTime: number | null = null;
    let hasRecentMediaActivity = false;
    let remoteVideoFrozen = false;
    const diagnostics = this.summarizeMediaStats(stats);

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && !report.isRemote) {
        const packetsReceived = report.packetsReceived ?? 0;
        const packetsLost = Math.max(report.packetsLost ?? 0, 0);
        const bytesReceived = report.bytesReceived ?? 0;
        const framesDecoded = report.framesDecoded ?? 0;
        const previous = this.previousInboundPackets.get(report.id);

        if (previous) {
          const receivedDelta = Math.max(packetsReceived - previous.packetsReceived, 0);
          const lostDelta = Math.max(packetsLost - previous.packetsLost, 0);
          const totalDelta = receivedDelta + lostDelta;
          const bytesDelta = Math.max(bytesReceived - previous.bytesReceived, 0);
          const framesDelta = Math.max(framesDecoded - previous.framesDecoded, 0);

          if (receivedDelta > 0 || bytesDelta > 0 || framesDelta > 0) {
            hasRecentMediaActivity = true;
          }

          if ((report.kind || report.mediaType) === 'video' && bytesDelta > 0 && framesDelta === 0) {
            remoteVideoFrozen = true;
          }

          if (totalDelta > 0) {
            maxPacketLossRatio = Math.max(maxPacketLossRatio, lostDelta / totalDelta);
          }
        }

        this.previousInboundPackets.set(report.id, { packetsReceived, packetsLost, bytesReceived, framesDecoded });

        if (typeof report.jitter === 'number') {
          maxJitter = Math.max(maxJitter ?? 0, report.jitter);
        }
      }

      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated === true) {
        if (typeof report.currentRoundTripTime === 'number') {
          maxRoundTripTime = Math.max(maxRoundTripTime ?? 0, report.currentRoundTripTime);
        }
      }

      if (report.type === 'remote-inbound-rtp' && typeof report.roundTripTime === 'number') {
        maxRoundTripTime = Math.max(maxRoundTripTime ?? 0, report.roundTripTime);
      }
    });

    console.log('[WebRTCServiceSFU] Connection diagnostics:', diagnostics);

    let reason: string | null = null;

    if (maxPacketLossRatio >= 0.05) {
      reason = i18n.global.t('errors.packetLoss', { percent: Math.round(maxPacketLossRatio * 100) });
    } else if (maxRoundTripTime !== null && maxRoundTripTime >= 0.8) {
      reason = i18n.global.t('errors.latency', { milliseconds: Math.round(maxRoundTripTime * 1000) });
    } else if (maxJitter !== null && maxJitter >= 0.15) {
      reason = i18n.global.t('errors.jitter', { milliseconds: Math.round(maxJitter * 1000) });
    } else if (remoteVideoFrozen) {
      reason = i18n.global.t('errors.videoRecovering');
    }

    return {
      quality: reason ? 'poor' : 'good',
      packetLossRatio: maxPacketLossRatio,
      roundTripTime: maxRoundTripTime,
      jitter: maxJitter,
      reason,
      hasRecentMediaActivity,
      remoteVideoFrozen,
    };
  }

  cleanup(): void {
    console.log('[WebRTCServiceSFU] Cleaning up resources');
    this.videoQualityController.stop();

    // Stop all local tracks
    this.localStream?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    this.peerConnection?.close();

    // Clear references
    this.localStream = null;
    this.peerConnection = null;
    this.localSenders = {};
    this.releasedCameraId = undefined;
    this.micInput?.close();
    this.micInput = null;
    this.inputVolume = 1;
    this.previousInboundPackets.clear();
    this.pendingRemoteIceCandidates = [];
  }

  private describeCandidate(candidate: string): Record<string, string | null> {
    const parts = candidate.split(' ');
    const typIndex = parts.indexOf('typ');

    return {
      protocol: parts[2]?.toLowerCase() || null,
      port: parts[5] || null,
      type: typIndex >= 0 ? parts[typIndex + 1] || null : null,
      transport: candidate.includes('relay') ? 'relay' : candidate.includes('srflx') ? 'srflx' : 'direct',
    };
  }

  private summarizeMediaStats(stats: RTCStatsReport): MediaStatsSummary {
    const summary: MediaStatsSummary = {
      inbound: [],
      outbound: [],
      selectedCandidatePair: null,
    };

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && !report.isRemote) {
        summary.inbound.push({
          id: report.id,
          kind: report.kind || report.mediaType || 'unknown',
          mid: report.mid,
          ssrc: report.ssrc,
          trackIdentifier: report.trackIdentifier,
          packetsReceived: report.packetsReceived ?? 0,
          packetsLost: report.packetsLost ?? 0,
          bytesReceived: report.bytesReceived ?? 0,
          framesDecoded: report.framesDecoded,
          audioLevel: report.audioLevel,
          jitter: report.jitter,
        });
      }

      if (report.type === 'outbound-rtp' && !report.isRemote) {
        summary.outbound.push({
          kind: report.kind || report.mediaType || 'unknown',
          packetsSent: report.packetsSent ?? 0,
          bytesSent: report.bytesSent ?? 0,
          framesEncoded: report.framesEncoded,
        });
      }

      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated === true) {
        const localCandidate = stats.get(report.localCandidateId);
        const remoteCandidate = stats.get(report.remoteCandidateId);

        summary.selectedCandidatePair = {
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate,
          localCandidateType: localCandidate?.candidateType,
          localProtocol: localCandidate?.protocol,
          remoteCandidateType: remoteCandidate?.candidateType,
          remoteProtocol: remoteCandidate?.protocol,
        };
      }
    });

    return summary;
  }
}

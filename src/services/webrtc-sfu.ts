import { resolveReachableTurnUrl } from './dev-networking';
import { SignalingService } from './signaling';

export interface DeviceConstraints {
  audioDeviceId?: string | null;
  videoDeviceId?: string | null;
}

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
    kind: string;
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

  constructor(
    private signalingService: SignalingService,
    private iceServers: RTCIceServer[] = createDefaultIceServers(),
  ) {
    this.setupSignalingHandlers();
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

      // Optimized for multi-party: 640x360 @ 15fps (~300-500 Kbps per stream)
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 640, max: 640 },
        height: { ideal: 360, max: 360 },
        frameRate: { ideal: 15, max: 15 },
      };

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
      throw new Error(`Failed to access media devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
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

      console.log('[WebRTCServiceSFU] Remote track event:', {
        kind: track.kind,
        trackId: track.id,
        streamId: stream.id,
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
      throw new Error('Peer connection not initialized');
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
      reason = `Packet loss is ${Math.round(maxPacketLossRatio * 100)}%`;
    } else if (maxRoundTripTime !== null && maxRoundTripTime >= 0.8) {
      reason = `High latency: ${Math.round(maxRoundTripTime * 1000)}ms`;
    } else if (maxJitter !== null && maxJitter >= 0.15) {
      reason = `Unstable media timing: ${Math.round(maxJitter * 1000)}ms jitter`;
    } else if (remoteVideoFrozen) {
      reason = 'Remote video is recovering';
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

    // Stop all local tracks
    this.localStream?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    this.peerConnection?.close();

    // Clear references
    this.localStream = null;
    this.peerConnection = null;
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
          kind: report.kind || report.mediaType || 'unknown',
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

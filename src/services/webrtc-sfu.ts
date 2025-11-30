import { SignalingService } from './signaling';

export interface DeviceConstraints {
  audioDeviceId?: string | null;
  videoDeviceId?: string | null;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
  },
  {
    urls: [import.meta.env.VITE_TURN_URL || 'turn:turn.openmeets.eu:3478'],
    username: import.meta.env.VITE_TURN_USER || 'openmeet',
    credential: import.meta.env.VITE_TURN_PASSWORD || 'openmeet123',
  },
];

export class WebRTCServiceSFU {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onRemoteTrackCallback: ((participantId: string, stream: MediaStream) => void) | null = null;

  constructor(
    private signalingService: SignalingService,
    private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS,
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
    // Pre-allocated transceivers make this faster and more reliable
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

    console.log('[WebRTCServiceSFU] Creating new peer connection');
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
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
        this.signalingService.sendIceCandidate('server', event.candidate.toJSON());
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTCServiceSFU] Peer connection state CHANGED TO:', this.peerConnection?.connectionState);
    };

    // Handle remote tracks (from SFU forwarding other participants' media)
    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      const track = event.track;

      console.log(`[WebRTCServiceSFU] ✓ Received ${track.kind} track from stream ${stream.id} (muted: ${track.muted})`);

      // Ignore our own stream (Chrome bug workaround)
      if (this.localStream && stream.id === this.localStream.id) {
        console.log(`[WebRTCServiceSFU] ❌ Ignoring own stream reflected from SFU`);
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

    console.log('[WebRTCServiceSFU] Adding ICE candidate from server');
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
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
  }
}

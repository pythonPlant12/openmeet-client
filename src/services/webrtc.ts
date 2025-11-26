import { firebaseService } from './firebase';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
  },
];

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private unsubscribers: (() => void)[] = [];
  private onRemoteTrackCallback: ((stream: MediaStream) => void) | null = null;
  private processedStreamIds: Set<string> = new Set(); // Track processed streams to avoid duplicates

  constructor(private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS) {}

  async initializeMedia(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      this.remoteStream = new MediaStream();
      return this.localStream;
    } catch (error) {
      throw new Error(`Failed to access media devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      console.log('[WebRTCService] Closing existing peer connection');
      this.peerConnection.close();
    }

    console.log('[WebRTCService] Creating new peer connection');
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Add local tracks to peer connection
    if (this.localStream) {
      console.log('[WebRTCService] Adding local tracks to peer connection:', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
      });
      this.localStream.getTracks().forEach((track) => {
        console.log('[WebRTCService] Adding track:', track.kind, track.id);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks - ontrack fires once per track (audio and video separately)
    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      console.log('[WebRTCService] Remote track received:', {
        kind: event.track.kind,
        trackId: event.track.id,
        streamId: stream?.id,
        audioTracks: stream?.getAudioTracks().length,
        videoTracks: stream?.getVideoTracks().length,
      });

      // Add track to our remote stream
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });

      // Deduplicate: Only notify XState once per stream ID (not per track)
      // ontrack fires twice (audio + video), but we only want one participant
      if (!this.onRemoteTrackCallback) {
        console.warn('[WebRTCService] Remote track callback not set yet! Track will be lost:', event.track.kind);
        return;
      }

      if (stream && !this.processedStreamIds.has(stream.id)) {
        console.log('[WebRTCService] New stream detected, notifying XState:', stream.id);
        this.processedStreamIds.add(stream.id);
        this.onRemoteTrackCallback(stream);
      } else if (stream) {
        console.log('[WebRTCService] Stream already processed (deduplicated):', stream.id);
      }
    };

    return this.peerConnection;
  }

  setOnRemoteTrack(callback: (stream: MediaStream) => void): void {
    this.onRemoteTrackCallback = callback;
  }

  async createOffer(callId: string, participantName?: string): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Set up ICE candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        firebaseService.addICECandidate(callId, 'offer', event.candidate.toJSON()).catch((error) => {
          console.error('Failed to save ICE candidate:', error);
        });
      }
    };

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Save offer to Firestore with participant name
    await firebaseService.createCallDocument(callId, offer, participantName);

    // Listen for answer
    const unsubscribe = firebaseService.subscribeToCall(callId, async (data) => {
      if (data?.answer && !this.peerConnection?.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(data.answer);
        await this.peerConnection?.setRemoteDescription(answerDescription);
      }
    });
    this.unsubscribers.push(unsubscribe);

    // Listen for answer ICE candidates
    const candidateUnsubscribe = firebaseService.subscribeToICECandidates(callId, 'answer', async (candidate) => {
      await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
    });
    this.unsubscribers.push(candidateUnsubscribe);

    return offer;
  }

  async createAnswer(callId: string, participantName?: string): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Set up ICE candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        firebaseService.addICECandidate(callId, 'answer', event.candidate.toJSON()).catch((error) => {
          console.error('Failed to save ICE candidate:', error);
        });
      }
    };

    // Get the offer from Firestore
    const callData = await firebaseService.getCallDocument(callId);
    if (!callData?.offer) {
      throw new Error('Call not found or offer not available');
    }

    const offerDescription = new RTCSessionDescription(callData.offer);
    await this.peerConnection.setRemoteDescription(offerDescription);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Save answer to Firestore with participant name
    await firebaseService.updateCallDocument(callId, answer, participantName);

    // Listen for offer ICE candidates
    const candidateUnsubscribe = firebaseService.subscribeToICECandidates(callId, 'offer', async (candidate) => {
      await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
    });
    this.unsubscribers.push(candidateUnsubscribe);

    return answer;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  closePeerConnection(): void {
    console.log('[WebRTCService] Closing peer connection due to disconnect');
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    // Clear remote stream
    this.remoteStream = null;
    // Clear processed stream IDs so rejoining participants can be added again
    this.processedStreamIds.clear();
  }

  cleanup(): void {
    console.log('[WebRTCService] Cleaning up resources');

    // Unsubscribe from all Firestore listeners
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];

    // Stop all local tracks
    this.localStream?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    this.peerConnection?.close();

    // Clear references
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.processedStreamIds.clear(); // Reset stream tracking for fresh connections
  }
}

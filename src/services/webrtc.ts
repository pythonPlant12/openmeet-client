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
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
    };

    return this.peerConnection;
  }

  async createOffer(callId: string): Promise<RTCSessionDescriptionInit> {
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

    // Save offer to Firestore
    await firebaseService.createCallDocument(callId, offer);

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

  async createAnswer(callId: string): Promise<RTCSessionDescriptionInit> {
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

    // Save answer to Firestore
    await firebaseService.updateCallDocument(callId, answer);

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

  cleanup(): void {
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
  }
}

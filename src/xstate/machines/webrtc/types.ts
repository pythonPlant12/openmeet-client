import type { DeviceConstraints } from '@/services/webrtc-sfu';

export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface SFUContext {
  // Media
  localStream: MediaStream | null;

  // Participants
  participants: Map<string, Participant>;
  localParticipantId: string | null;
  localParticipantName: string;

  // Room
  roomId: string | null;

  // Connection state
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;

  // Internal tracking
  streamOwnerMap: Map<string, string>;
  knownRemoteParticipants: Set<string>;

  // Error
  error: string | null;
}

// User-initiated events
export type SFUUserEvents =
  | { type: 'INIT_MEDIA'; participantName?: string; deviceConstraints?: DeviceConstraints }
  | { type: 'JOIN_ROOM'; roomId: string; participantName?: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'TOGGLE_AUDIO'; participantId: string; enabled: boolean }
  | { type: 'TOGGLE_VIDEO'; participantId: string; enabled: boolean }
  | { type: 'RETRY' };

// Signaling events (from server via WebSocket)
export type SFUSignalingEvents =
  | { type: 'JOINED'; participantId: string; participantName: string }
  | { type: 'PARTICIPANT_JOINED'; participantId: string; participantName: string }
  | { type: 'PARTICIPANT_LEFT'; participantId: string }
  | { type: 'STREAM_OWNER'; streamId: string; participantId: string; participantName: string }
  | { type: 'MEDIA_STATE_CHANGED'; participantId: string; audioEnabled: boolean; videoEnabled: boolean }
  | { type: 'SERVER_ERROR'; message: string };

// WebRTC events (from RTCPeerConnection)
export type SFUWebRTCEvents =
  | { type: 'REMOTE_TRACK_RECEIVED'; streamId: string; stream: MediaStream }
  | { type: 'CONNECTION_STATE_CHANGED'; state: RTCPeerConnectionState }
  | { type: 'ICE_CONNECTION_STATE_CHANGED'; state: RTCIceConnectionState };

// Internal machine events
export type SFUInternalEvents =
  | { type: 'MEDIA_INITIALIZED'; localStream: MediaStream }
  | { type: 'MEDIA_INIT_FAILED'; error: string }
  | { type: 'OFFER_SENT' }
  | { type: 'JOIN_FAILED'; error: string };

// All events
export type SFUEvents = SFUUserEvents | SFUSignalingEvents | SFUWebRTCEvents | SFUInternalEvents;

// Actor input types
export interface InitMediaInput {
  participantName?: string;
  deviceConstraints?: DeviceConstraints;
}

export interface JoinRoomInput {
  roomId: string;
  participantName: string;
  localStream: MediaStream;
}

export interface SessionDescription {
  type: RTCSdpType;
  sdp: string;
}

export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface WebRTCContext {
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null; // Keep for backward compatibility, will be deprecated
  participants: Map<string, Participant>;
  localParticipantId: string | null;
  localParticipantName: string;
  callId: string | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  error: string | null;
  isInitiator: boolean;
}

export type WebRTCEvents =
  | { type: 'INIT_MEDIA'; participantName?: string }
  | { type: 'CREATE_CALL'; callId: string; participantName?: string }
  | { type: 'JOIN_CALL'; callId: string; participantName?: string }
  | { type: 'PARTICIPANT_JOINED'; participantId: string; participantName: string }
  | { type: 'PARTICIPANT_LEFT'; participantId: string }
  | { type: 'PARTICIPANT_AUDIO_TOGGLED'; participantId: string; enabled: boolean }
  | { type: 'PARTICIPANT_VIDEO_TOGGLED'; participantId: string; enabled: boolean }
  | { type: 'STREAM_RECEIVED'; participantId: string; stream: MediaStream }
  | { type: 'END_CALL' }
  | { type: 'RETRY' }
  | { type: 'CONNECTION_STATE_CHANGED'; state: RTCPeerConnectionState }
  | { type: 'ICE_CONNECTION_STATE_CHANGED'; state: RTCIceConnectionState };

export interface WebRTCInput {
  iceServers?: RTCIceServer[];
}

export interface InitMediaOutput {
  localStream: MediaStream;
}

export interface CreateCallOutput {
  callId: string;
  offer: SessionDescription;
}

export interface JoinCallOutput {
  answer: SessionDescription;
}

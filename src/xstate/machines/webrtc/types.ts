export interface User {
  id: string;
  name?: string;
}

export interface MediaStreamState {
  local: MediaStream | null;
  remote: MediaStream | null;
}

export interface CallDetails {
  callId: string;
  createdAt: Date;
  participants: string[];
}

export interface ICECandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

export interface SessionDescription {
  type: RTCSdpType;
  sdp: string;
}

export interface WebRTCContext {
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callId: string | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  error: string | null;
  isInitiator: boolean;
}

export type WebRTCEvents =
  | { type: 'INIT_MEDIA' }
  | { type: 'CREATE_CALL' }
  | { type: 'JOIN_CALL'; callId: string }
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

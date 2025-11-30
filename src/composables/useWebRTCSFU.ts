import { computed, ref, shallowRef } from 'vue';

import { SignalingService } from '@/services/signaling';
import type { DeviceConstraints } from '@/services/webrtc-sfu';
import { WebRTCServiceSFU } from '@/services/webrtc-sfu';
import type { Participant } from '@/xstate/machines/webrtc/types';

// SFU server URL - change this to your server's address
// Use wss:// for secure WebSocket connection
const SFU_SERVER_URL = 'wss://192.168.31.43:8081/ws';

export function useWebRTCSFU() {
  // State
  const state = ref<'idle' | 'initializingMedia' | 'mediaReady' | 'joiningRoom' | 'inCall' | 'error'>('idle');
  const localStream = shallowRef<MediaStream | null>(null);
  const participants = ref<Map<string, Participant>>(new Map());
  const localParticipantId = ref<string | null>(null);
  const localParticipantName = ref<string>('');
  const roomId = ref<string | null>(null);
  const error = ref<Error | null>(null);
  const connectionState = ref<RTCPeerConnectionState | null>(null);
  const iceConnectionState = ref<RTCIceConnectionState | null>(null);

  // Services
  let signalingService: SignalingService | null = null;
  let webrtcService: WebRTCServiceSFU | null = null;

  // Computed
  const isIdle = computed(() => state.value === 'idle');
  const isInitializingMedia = computed(() => state.value === 'initializingMedia');
  const isMediaReady = computed(() => state.value === 'mediaReady');
  const isInCall = computed(() => state.value === 'inCall');
  const isError = computed(() => state.value === 'error');

  const participantsArray = computed(() => Array.from(participants.value.values()) as Participant[]);
  const localParticipant = computed(() =>
    localParticipantId.value ? participants.value.get(localParticipantId.value) : null,
  );
  const remoteParticipants = computed(() => participantsArray.value.filter((p) => !p.isLocal));

  /**
   * Initialize media (camera/microphone)
   */
  const initMedia = async (participantName?: string, deviceConstraints?: DeviceConstraints) => {
    try {
      state.value = 'initializingMedia';

      if (participantName) {
        localParticipantName.value = participantName;
      }

      // Initialize WebRTC service
      if (!signalingService) {
        signalingService = new SignalingService(SFU_SERVER_URL);
        await signalingService.connect();

        webrtcService = new WebRTCServiceSFU(signalingService);
      }

      // Get local media with device constraints
      if (webrtcService) {
        const stream = await webrtcService.initializeMedia(deviceConstraints);
        localStream.value = stream;
      }

      state.value = 'mediaReady';
    } catch (err) {
      state.value = 'error';
      error.value = err instanceof Error ? err : new Error('Failed to initialize media');
      console.error('[useWebRTCSFU] Failed to initialize media:', err);
    }
  };

  /**
   * Join a room (replaces createCall/joinCall)
   */
  const joinRoom = async (id: string, participantName?: string) => {
    try {
      if (participantName) {
        localParticipantName.value = participantName;
      }

      if (!webrtcService || !signalingService) {
        throw new Error('Services not initialized. Call initMedia first');
      }

      state.value = 'joiningRoom';
      roomId.value = id;

      // Setup signaling event handlers
      signalingService.on('joined', (message) => {
        if (message.type === 'joined') {
          localParticipantId.value = message.participantId;

          // Add local participant
          participants.value.set(message.participantId, {
            id: message.participantId,
            name: localParticipantName.value,
            stream: localStream.value,
            isLocal: true,
            audioEnabled: true,
            videoEnabled: true,
          });

          console.log('[useWebRTCSFU] Joined room:', id, 'Participant ID:', message.participantId);
        }
      });

      const knownRemoteParticipants = new Set<string>();
      // Maps stream IDs to their owner participant IDs (received from server)
      const streamOwnerMap = new Map<string, string>();

      signalingService.on('streamOwner', (message) => {
        if (message.type === 'streamOwner') {
          console.log('[useWebRTCSFU] Stream owner mapping:', message.streamId, '→', message.participantName);
          streamOwnerMap.set(message.streamId, message.participantId);
        }
      });

      signalingService.on('participantJoined', (message) => {
        if (message.type === 'participantJoined') {
          console.log('[useWebRTCSFU] Participant joined:', message.participantName, message.participantId);

          // Track this as a known remote participant
          knownRemoteParticipants.add(message.participantId);

          // Add remote participant (without stream initially)
          participants.value.set(message.participantId, {
            id: message.participantId,
            name: message.participantName,
            stream: null,
            isLocal: false,
            audioEnabled: true,
            videoEnabled: true,
          });
        }
      });

      signalingService.on('participantLeft', (message) => {
        if (message.type === 'participantLeft') {
          console.log('[useWebRTCSFU] Participant left:', message.participantId);
          knownRemoteParticipants.delete(message.participantId);
          participants.value.delete(message.participantId);
        }
      });

      signalingService.on('error', (message) => {
        if (message.type === 'error') {
          console.error('[useWebRTCSFU] Server error:', message.message);
          error.value = new Error(message.message);
        }
      });

      signalingService.on('mediaStateChanged', (message) => {
        if (message.type === 'mediaStateChanged') {
          console.log('[useWebRTCSFU] Media state changed for:', message.participantId, message);
          const participant = participants.value.get(message.participantId);
          if (participant && !participant.isLocal) {
            participants.value.set(message.participantId, {
              ...participant,
              audioEnabled: message.audioEnabled,
              videoEnabled: message.videoEnabled,
            });
          }
        }
      });

      // Setup remote track handler
      webrtcService.setOnRemoteTrack((participantStreamId, stream) => {
        console.log(
          '[useWebRTCSFU] Received remote stream:',
          participantStreamId,
          'Tracks:',
          stream.getTracks().length,
        );

        // Additional check: compare track IDs to ensure it's not our own stream
        if (localStream.value) {
          const localTrackIds = localStream.value.getTracks().map((t) => t.id);
          const remoteTrackIds = stream.getTracks().map((t) => t.id);
          //? Remove if beta OK
          const hasMatchingTrack = localTrackIds.some((id) => remoteTrackIds.includes(id));

          if (hasMatchingTrack) {
            console.log('[useWebRTCSFU] ❌ Ignoring own stream reflected from SFU (track ID match)');
            console.log('  Local track IDs:', localTrackIds);
            console.log('  Remote track IDs:', remoteTrackIds);
            return;
          }
        }

        //? Remove if beta OK
        // CRITICAL FIX: Only accept remote streams if we have received a participantJoined message
        // This prevents showing "ghost" participants when alone in the room
        // if (knownRemoteParticipants.size === 0) {
        //   console.log('[useWebRTCSFU] Ignoring remote stream - no other participants in room');
        //   return;
        // }

        console.log('[useWebRTCSFU] Known remote participants:', Array.from(knownRemoteParticipants));
        console.log('[useWebRTCSFU] Stream owner map:', Array.from(streamOwnerMap.entries()));

        // Use server-provided stream-to-participant mapping
        const ownerParticipantId = streamOwnerMap.get(participantStreamId);

        if (ownerParticipantId) {
          // We know who owns this stream, assign directly
          const ownerParticipant = participants.value.get(ownerParticipantId);
          if (ownerParticipant) {
            console.log('[useWebRTCSFU] ✓ Assigning stream to correct owner:', ownerParticipant.name);
            participants.value.set(ownerParticipantId, {
              ...ownerParticipant,
              stream,
            });
          } else {
            console.warn('[useWebRTCSFU] Owner participant not found:', ownerParticipantId);
          }
        } else {
          // Fallback: No mapping available, try to find a participant without stream
          console.warn('[useWebRTCSFU] No stream owner mapping for:', participantStreamId);
          const existingParticipantWithoutStream = Array.from(participants.value.values()).find(
            (p) => !p.isLocal && !p.stream,
          );

          if (existingParticipantWithoutStream) {
            console.log('[useWebRTCSFU]️ Fallback: Assigning to:', existingParticipantWithoutStream.name);
            participants.value.set(existingParticipantWithoutStream.id, {
              ...existingParticipantWithoutStream,
              stream,
            });
          }
        }
      });

      // Join room via signaling
      signalingService.joinRoom(id, localParticipantName.value);

      // Create peer connection and send offer
      const pc = webrtcService.createPeerConnection();

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        connectionState.value = pc.connectionState;
        console.log('[useWebRTCSFU] Connection state:', pc.connectionState);

        if (pc.connectionState === 'connected') {
          state.value = 'inCall';
        } else if (pc.connectionState === 'failed') {
          state.value = 'error';
          error.value = new Error('Peer connection failed');
        }
      };

      pc.oniceconnectionstatechange = () => {
        iceConnectionState.value = pc.iceConnectionState;
        console.log('[useWebRTCSFU] ICE connection state:', pc.iceConnectionState);
      };

      await webrtcService.sendOffer();

      console.log('[useWebRTCSFU] Offer sent, waiting for answer...');
    } catch (err) {
      state.value = 'error';
      error.value = err instanceof Error ? err : new Error('Failed to join room');
      console.error('[useWebRTCSFU] Failed to join room:', err);
    }
  };

  /**
   * Leave the room
   */
  const leaveRoom = () => {
    console.log('[useWebRTCSFU] Leaving room...');

    if (webrtcService) {
      webrtcService.cleanup();
    }

    if (signalingService) {
      signalingService.disconnect();
    }

    // Stop local stream
    localStream.value?.getTracks().forEach((track) => track.stop());

    state.value = 'idle';
    localStream.value = null;
    participants.value.clear();
    localParticipantId.value = null;
    roomId.value = null;
    connectionState.value = null;
    iceConnectionState.value = null;
    error.value = null;

    signalingService = null;
    webrtcService = null;
  };

  /**
   * Toggle local audio and notify other participants
   */
  const toggleParticipantAudio = (participantId: string, enabled: boolean) => {
    const participant = participants.value.get(participantId);
    if (participant && participant.isLocal && localStream.value) {
      localStream.value.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });

      const newAudioEnabled = enabled;
      const currentVideoEnabled = participant.videoEnabled;

      participants.value.set(participantId, {
        ...participant,
        audioEnabled: newAudioEnabled,
      });

      // Notify server to broadcast to other participants
      signalingService?.sendMediaStateChanged(newAudioEnabled, currentVideoEnabled);
    }
  };

  /**
   * Toggle local video and notify other participants
   */
  const toggleParticipantVideo = (participantId: string, enabled: boolean) => {
    const participant = participants.value.get(participantId);
    if (participant && participant.isLocal && localStream.value) {
      localStream.value.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });

      const currentAudioEnabled = participant.audioEnabled;
      const newVideoEnabled = enabled;

      participants.value.set(participantId, {
        ...participant,
        videoEnabled: newVideoEnabled,
      });

      // Notify server to broadcast to other participants
      signalingService?.sendMediaStateChanged(currentAudioEnabled, newVideoEnabled);
    }
  };

  return {
    // State
    state,
    isIdle,
    isInitializingMedia,
    isMediaReady,
    isInCall,
    isError,

    localStream,
    participants,
    participantsArray,
    localParticipant,
    remoteParticipants,
    localParticipantId,
    localParticipantName,
    roomId,
    error,
    connectionState,
    iceConnectionState,

    // Actions
    initMedia,
    joinRoom,
    leaveRoom,
    toggleParticipantAudio,
    toggleParticipantVideo,

    // Legacy aliases for compatibility
    createCall: joinRoom,
    joinCall: joinRoom,
    endCall: leaveRoom,
  };
}

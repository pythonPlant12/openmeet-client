import { computed, inject } from 'vue';

import type { DeviceConstraints } from '@/services/webrtc-sfu';
import type { Participant } from '@/xstate/machines/webrtc/types';

// Type for the full useMachine return object
type WebrtcActor = {
  snapshot: { value: any };
  send: (event: any) => void;
  actorRef: any;
};

export function useWebrtc() {
  const webrtcActor = inject<WebrtcActor>('webrtcActor');

  if (!webrtcActor) {
    throw new Error('webrtcActor not provided. Make sure to provide it in App.vue');
  }

  // State computed properties
  const state = computed(() => {
    const value = webrtcActor.snapshot.value.value;
    // Handle nested states - return the deepest state name for compatibility
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      // For nested states like { connected: 'joiningRoom' }, return 'joiningRoom'
      if ('connected' in value) {
        return value.connected as string;
      }
    }
    return 'idle';
  });

  const isIdle = computed(() => webrtcActor.snapshot.value.matches('idle'));
  const isInitializingMedia = computed(() => webrtcActor.snapshot.value.matches('initializingMedia'));
  const isMediaReady = computed(() => webrtcActor.snapshot.value.matches('mediaReady'));
  // Nested states under 'connected' parent
  const isJoiningRoom = computed(() => webrtcActor.snapshot.value.matches({ connected: 'joiningRoom' }));
  const isInCall = computed(() => webrtcActor.snapshot.value.matches({ connected: 'inCall' }));
  const isConnected = computed(() => webrtcActor.snapshot.value.matches('connected'));
  const isEndingCall = computed(() => webrtcActor.snapshot.value.matches('endingCall'));
  const isError = computed(() => webrtcActor.snapshot.value.matches('error'));

  // Context computed properties
  const localStream = computed(() => webrtcActor.snapshot.value.context.localStream);
  const participants = computed(() => webrtcActor.snapshot.value.context.participants);
  const participantsArray = computed(
    () => Array.from(webrtcActor.snapshot.value.context.participants.values()) as Participant[],
  );
  const localParticipantId = computed(() => webrtcActor.snapshot.value.context.localParticipantId);
  const localParticipantName = computed(() => webrtcActor.snapshot.value.context.localParticipantName);
  const roomId = computed(() => webrtcActor.snapshot.value.context.roomId);
  const connectionState = computed(() => webrtcActor.snapshot.value.context.connectionState);
  const iceConnectionState = computed(() => webrtcActor.snapshot.value.context.iceConnectionState);
  const error = computed(() =>
    webrtcActor.snapshot.value.context.error ? new Error(webrtcActor.snapshot.value.context.error) : null,
  );

  const localParticipant = computed(() =>
    localParticipantId.value ? participants.value.get(localParticipantId.value) : null,
  );
  const remoteParticipants = computed(() => participantsArray.value.filter((p) => !p.isLocal));

  // Actions - wrap send() calls
  const initMedia = (participantName?: string, deviceConstraints?: DeviceConstraints) => {
    webrtcActor.send({ type: 'INIT_MEDIA', participantName, deviceConstraints });
  };

  const joinRoom = (roomIdToJoin: string, participantName?: string) => {
    webrtcActor.send({ type: 'JOIN_ROOM', roomId: roomIdToJoin, participantName });
  };

  const leaveRoom = () => {
    webrtcActor.send({ type: 'LEAVE_ROOM' });
  };

  const toggleParticipantAudio = (participantId: string, enabled: boolean) => {
    webrtcActor.send({ type: 'TOGGLE_AUDIO', participantId, enabled });
  };

  const toggleParticipantVideo = (participantId: string, enabled: boolean) => {
    webrtcActor.send({ type: 'TOGGLE_VIDEO', participantId, enabled });
  };

  const retry = () => {
    webrtcActor.send({ type: 'RETRY' });
  };

  return {
    // State
    state,
    isIdle,
    isInitializingMedia,
    isMediaReady,
    isJoiningRoom,
    isInCall,
    isConnected,
    isEndingCall,
    isError,

    // Context
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
    retry,

    // Raw access (like useAuth exposes)
    send: webrtcActor.send,
    actorRef: webrtcActor.actorRef,

    // Legacy aliases for compatibility
    createCall: joinRoom,
    joinCall: joinRoom,
    endCall: leaveRoom,
  };
}

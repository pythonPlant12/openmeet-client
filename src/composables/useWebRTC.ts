import { computed, inject } from 'vue';

import type { Participant } from '@/xstate/machines/webrtc/types';

export function useWebRTC() {
  const webrtcActor = inject<any>('webrtcActor');

  if (!webrtcActor) {
    throw new Error('WebRTC actor not provided! Make sure webrtcActor is provided in App.vue');
  }

  const snapshot = webrtcActor.snapshot;
  const send = webrtcActor.send;
  const actorRef = webrtcActor.actorRef;

  // Computed properties for easy access to state
  const state = computed(() => snapshot.value.value);
  const context = computed(() => snapshot.value.context);

  const isIdle = computed(() => state.value === 'idle');
  const isInitializingMedia = computed(() => state.value === 'initializingMedia');
  const isMediaReady = computed(() => state.value === 'mediaReady');
  const isCreatingCall = computed(() => state.value === 'creatingCall');
  const isJoiningCall = computed(() => state.value === 'joiningCall');
  const isInCall = computed(() => state.value === 'inCall');
  const isError = computed(() => state.value === 'error');

  const localStream = computed(() => context.value.localStream);
  const remoteStream = computed(() => context.value.remoteStream);
  const participants = computed(() => context.value.participants);
  const localParticipantId = computed(() => context.value.localParticipantId);
  const localParticipantName = computed(() => context.value.localParticipantName);
  const callId = computed(() => context.value.callId);
  const error = computed(() => context.value.error);
  const connectionState = computed(() => context.value.connectionState);
  const iceConnectionState = computed(() => context.value.iceConnectionState);
  const isInitiator = computed(() => context.value.isInitiator);

  // Convert participants Map to Array for easier iteration in components
  const participantsArray = computed(() => Array.from(participants.value.values()) as Participant[]);
  const localParticipant = computed(() =>
    localParticipantId.value ? participants.value.get(localParticipantId.value) : null,
  );
  const remoteParticipants = computed(() => participantsArray.value.filter((p) => !p.isLocal));

  // Actions
  const initMedia = (participantName?: string) => send({ type: 'INIT_MEDIA', participantName });
  const createCall = (callId: string, participantName?: string) =>
    send({ type: 'CREATE_CALL', callId, participantName });
  const joinCall = (callId: string, participantName?: string) => send({ type: 'JOIN_CALL', callId, participantName });
  const endCall = () => send({ type: 'END_CALL' });
  const retry = () => send({ type: 'RETRY' });

  // Participant management actions
  const addParticipant = (participantId: string, participantName: string) =>
    send({ type: 'PARTICIPANT_JOINED', participantId, participantName });
  const removeParticipant = (participantId: string) => send({ type: 'PARTICIPANT_LEFT', participantId });
  const updateParticipantStream = (participantId: string, stream: MediaStream) =>
    send({ type: 'STREAM_RECEIVED', participantId, stream });
  const toggleParticipantAudio = (participantId: string, enabled: boolean) =>
    send({ type: 'PARTICIPANT_AUDIO_TOGGLED', participantId, enabled });
  const toggleParticipantVideo = (participantId: string, enabled: boolean) =>
    send({ type: 'PARTICIPANT_VIDEO_TOGGLED', participantId, enabled });

  return {
    // State
    state,
    context,
    isIdle,
    isInitializingMedia,
    isMediaReady,
    isCreatingCall,
    isJoiningCall,
    isInCall,
    isError,

    // Context values
    localStream,
    remoteStream,
    participants,
    participantsArray,
    localParticipant,
    remoteParticipants,
    localParticipantId,
    localParticipantName,
    callId,
    error,
    connectionState,
    iceConnectionState,
    isInitiator,

    // Actions
    initMedia,
    createCall,
    joinCall,
    endCall,
    retry,

    // Participant management actions
    addParticipant,
    removeParticipant,
    updateParticipantStream,
    toggleParticipantAudio,
    toggleParticipantVideo,

    // Actor ref for advanced use
    actorRef,
  };
}

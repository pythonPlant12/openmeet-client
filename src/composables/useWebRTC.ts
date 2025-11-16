import { useActor } from '@xstate/vue';
import { computed } from 'vue';

import { webrtcMachine } from '@/xstate/machines/webrtc';

export function useWebRTC() {
  const { snapshot, send, actorRef } = useActor(webrtcMachine);

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
  const callId = computed(() => context.value.callId);
  const error = computed(() => context.value.error);
  const connectionState = computed(() => context.value.connectionState);
  const iceConnectionState = computed(() => context.value.iceConnectionState);
  const isInitiator = computed(() => context.value.isInitiator);

  // Actions
  const initMedia = () => send({ type: 'INIT_MEDIA' });
  const createCall = () => send({ type: 'CREATE_CALL' });
  const joinCall = (callId: string) => send({ type: 'JOIN_CALL', callId });
  const endCall = () => send({ type: 'END_CALL' });
  const retry = () => send({ type: 'RETRY' });

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

    // Actor ref for advanced use
    actorRef,
  };
}

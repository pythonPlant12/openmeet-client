import { assign, fromPromise, setup } from 'xstate';

import { WebRTCService } from '@/services/webrtc';

import type {
  CreateCallOutput,
  InitMediaOutput,
  JoinCallOutput,
  WebRTCContext,
  WebRTCEvents,
  WebRTCInput,
} from './types';

const webrtcService = new WebRTCService();

// Actors (async operations)
const initMediaActor = fromPromise<InitMediaOutput, void>(async () => {
  const localStream = await webrtcService.initializeMedia();
  return { localStream };
});

const createCallActor = fromPromise<CreateCallOutput, void>(async () => {
  // Generate a unique call ID
  const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create peer connection and offer
  webrtcService.createPeerConnection();
  const offer = await webrtcService.createOffer(callId);

  return {
    callId,
    offer: {
      type: offer.type!,
      sdp: offer.sdp!,
    },
  };
});

const joinCallActor = fromPromise<JoinCallOutput, { callId: string }>(async ({ input }) => {
  // Create peer connection and answer
  webrtcService.createPeerConnection();
  const answer = await webrtcService.createAnswer(input.callId);

  return {
    answer: {
      type: answer.type!,
      sdp: answer.sdp!,
    },
  };
});

export const webrtcMachine = setup({
  types: {
    context: {} as WebRTCContext,
    events: {} as WebRTCEvents,
    input: {} as WebRTCInput,
  },

  actors: {
    initMediaActor,
    createCallActor,
    joinCallActor,
  },

  actions: {
    setLocalStream: assign({
      localStream: ({ event }) => {
        const output = (event as any).output as InitMediaOutput;
        return output.localStream;
      },
      error: null,
    }),

    setCallCreated: assign({
      callId: ({ event }) => {
        const output = (event as any).output as CreateCallOutput;
        return output.callId;
      },
      isInitiator: true,
      error: null,
    }),

    setCallJoined: assign({
      isInitiator: false,
      error: null,
    }),

    setCallId: assign({
      callId: ({ event }) => {
        const joinEvent = event as Extract<WebRTCEvents, { type: 'JOIN_CALL' }>;
        return joinEvent.callId;
      },
    }),

    setPeerConnection: assign({
      peerConnection: () => webrtcService.getPeerConnection(),
    }),

    setRemoteStream: assign({
      remoteStream: () => webrtcService.getRemoteStream(),
    }),

    setConnectionState: assign({
      connectionState: ({ event }) => {
        const stateEvent = event as Extract<WebRTCEvents, { type: 'CONNECTION_STATE_CHANGED' }>;
        return stateEvent.state;
      },
    }),

    setIceConnectionState: assign({
      iceConnectionState: ({ event }) => {
        const stateEvent = event as Extract<WebRTCEvents, { type: 'ICE_CONNECTION_STATE_CHANGED' }>;
        return stateEvent.state;
      },
    }),

    setError: assign({
      error: ({ event }) => {
        const error = (event as any).error;
        return error?.message || 'An error occurred';
      },
    }),

    clearContext: assign({
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      callId: null,
      connectionState: null,
      iceConnectionState: null,
      error: null,
      isInitiator: false,
    }),

    cleanupResources: () => {
      webrtcService.cleanup();
    },

    monitorPeerConnection: ({ context, self }) => {
      const pc = context.peerConnection;
      if (!pc) return;

      pc.onconnectionstatechange = () => {
        self.send({
          type: 'CONNECTION_STATE_CHANGED',
          state: pc.connectionState,
        });

        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.error('WebRTC connection failed or disconnected:', pc.connectionState);
        }
      };

      pc.oniceconnectionstatechange = () => {
        self.send({
          type: 'ICE_CONNECTION_STATE_CHANGED',
          state: pc.iceConnectionState,
        });

        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          console.error('ICE connection failed or disconnected:', pc.iceConnectionState);
        }
      };
    },

    updateRemoteStream: assign({
      remoteStream: () => webrtcService.getRemoteStream(),
    }),
  },

  guards: {
    hasError: ({ context }) => context.error !== null,
    isConnected: ({ context }) => context.connectionState === 'connected',
  },
}).createMachine({
  id: 'webrtc',

  context: {
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    callId: null,
    connectionState: null,
    iceConnectionState: null,
    error: null,
    isInitiator: false,
  },

  initial: 'idle',

  states: {
    idle: {
      description: 'Initial state - no media or connection',
      on: {
        INIT_MEDIA: {
          target: 'initializingMedia',
        },
      },
    },

    initializingMedia: {
      description: 'Requesting access to camera and microphone',
      invoke: {
        src: 'initMediaActor',
        onDone: {
          target: 'mediaReady',
          actions: 'setLocalStream',
        },
        onError: {
          target: 'error',
          actions: 'setError',
        },
      },
    },

    mediaReady: {
      description: 'Media devices initialized, ready to create or join call',
      on: {
        CREATE_CALL: {
          target: 'creatingCall',
        },
        JOIN_CALL: {
          target: 'joiningCall',
          actions: 'setCallId',
        },
      },
    },

    creatingCall: {
      description: 'Creating a new call (generating offer)',
      invoke: {
        src: 'createCallActor',
        onDone: {
          target: 'inCall',
          actions: ['setCallCreated', 'setPeerConnection', 'monitorPeerConnection'],
        },
        onError: {
          target: 'error',
          actions: 'setError',
        },
      },
    },

    joiningCall: {
      description: 'Joining an existing call (generating answer)',
      invoke: {
        src: 'joinCallActor',
        input: ({ context }) => ({ callId: context.callId! }),
        onDone: {
          target: 'inCall',
          actions: ['setCallJoined', 'setPeerConnection', 'monitorPeerConnection'],
        },
        onError: {
          target: 'error',
          actions: 'setError',
        },
      },
    },

    inCall: {
      description: 'Active call in progress',
      entry: 'updateRemoteStream',
      on: {
        CONNECTION_STATE_CHANGED: {
          actions: 'setConnectionState',
        },
        ICE_CONNECTION_STATE_CHANGED: {
          actions: 'setIceConnectionState',
        },
        END_CALL: {
          target: 'endingCall',
        },
      },
    },

    endingCall: {
      description: 'Ending the call and cleaning up resources',
      entry: ['cleanupResources', 'clearContext'],
      always: {
        target: 'idle',
      },
    },

    error: {
      description: 'An error occurred during WebRTC operations',
      on: {
        RETRY: {
          target: 'idle',
          actions: ['cleanupResources', 'clearContext'],
        },
        END_CALL: {
          target: 'endingCall',
        },
      },
    },
  },
});

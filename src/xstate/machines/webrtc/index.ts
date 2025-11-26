import { assign, fromPromise, setup } from 'xstate';

import { firebaseService } from '@/services/firebase';
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

const createCallActor = fromPromise<CreateCallOutput, { callId: string; participantName?: string }>(
  async ({ input }) => {
    // Use the provided callId from the meeting room URL
    const { callId, participantName } = input;

    // Create peer connection and offer
    webrtcService.createPeerConnection();
    const offer = await webrtcService.createOffer(callId, participantName);

    return {
      callId,
      offer: {
        type: offer.type!,
        sdp: offer.sdp!,
      },
    };
  },
);

const joinCallActor = fromPromise<JoinCallOutput, { callId: string; participantName?: string }>(async ({ input }) => {
  const { callId, participantName } = input;

  // Create peer connection and answer
  webrtcService.createPeerConnection();
  const answer = await webrtcService.createAnswer(callId, participantName);

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
        const callEvent = event as Extract<WebRTCEvents, { type: 'CREATE_CALL' | 'JOIN_CALL' }>;
        return callEvent.callId;
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
      participants: () => new Map(),
      localParticipantId: null,
      localParticipantName: 'User',
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
        console.log('[XState] Connection state changed:', pc.connectionState);

        // Only send events if actor is still active
        try {
          self.send({
            type: 'CONNECTION_STATE_CHANGED',
            state: pc.connectionState,
          });
        } catch (error) {
          console.warn('[XState] Failed to send CONNECTION_STATE_CHANGED (actor may be stopped)');
        }

        if (pc.connectionState === 'failed') {
          console.error('[WebRTC] Connection failed - may need TURN server for NAT traversal');
        } else if (pc.connectionState === 'disconnected') {
          console.warn('[WebRTC] Connection disconnected');
        } else if (pc.connectionState === 'connected') {
          console.log('[WebRTC] Connection established successfully!');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[XState] ICE connection state changed:', pc.iceConnectionState);

        // Only send events if actor is still active
        try {
          self.send({
            type: 'ICE_CONNECTION_STATE_CHANGED',
            state: pc.iceConnectionState,
          });
        } catch (error) {
          console.warn('[XState] Failed to send ICE_CONNECTION_STATE_CHANGED (actor may be stopped)');
        }

        if (pc.iceConnectionState === 'failed') {
          console.error('[WebRTC] ICE failed - using STUN only, may need TURN server');
        } else if (pc.iceConnectionState === 'disconnected') {
          console.warn('[WebRTC] ICE disconnected');
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('[WebRTC] ICE connection established!');
        }
      };
    },

    setupRemoteTrackListener: ({ self, context }) => {
      console.log('[XState] Setting up remote track listener');

      webrtcService.setOnRemoteTrack(async (stream: MediaStream) => {
        console.log('[XState] Remote track callback triggered:', {
          streamId: stream.id,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });

        // Fetch remote participant name from Firestore
        let remoteParticipantName = 'Remote Participant';
        if (context.callId) {
          try {
            const callData = await firebaseService.getCallDocument(context.callId);
            // If we're the initiator (created the call), the remote participant is the joiner
            // If we're not the initiator (joined the call), the remote participant is the creator
            if (context.isInitiator) {
              remoteParticipantName = callData?.joinerName || 'Remote Participant';
            } else {
              remoteParticipantName = callData?.creatorName || 'Remote Participant';
            }
            console.log('[XState] Fetched remote participant name:', remoteParticipantName);
          } catch (error) {
            console.warn('[XState] Failed to fetch remote participant name:', error);
          }
        }

        const remoteParticipantId = crypto.randomUUID();
        console.log('[XState] Creating remote participant with ID:', remoteParticipantId);

        self.send({
          type: 'PARTICIPANT_JOINED',
          participantId: remoteParticipantId,
          participantName: remoteParticipantName,
        });

        self.send({
          type: 'STREAM_RECEIVED',
          participantId: remoteParticipantId,
          stream,
        });
      });
    },

    updateRemoteStream: assign({
      remoteStream: () => webrtcService.getRemoteStream(),
    }),

    setParticipantName: assign({
      localParticipantName: ({ event }) => {
        const initEvent = event as Extract<WebRTCEvents, { type: 'INIT_MEDIA' | 'CREATE_CALL' | 'JOIN_CALL' }>;
        return initEvent.participantName || 'User';
      },
    }),

    setLocalParticipantId: assign({
      localParticipantId: () => crypto.randomUUID(),
    }),

    addLocalParticipant: assign({
      participants: ({ context }) => {
        console.log('[XState] Adding local participant:', {
          id: context.localParticipantId,
          name: context.localParticipantName,
          hasStream: !!context.localStream,
        });
        const newParticipants = new Map(context.participants);
        if (context.localParticipantId && context.localStream) {
          newParticipants.set(context.localParticipantId, {
            id: context.localParticipantId,
            name: context.localParticipantName,
            isLocal: true,
            stream: context.localStream,
            audioEnabled: true,
            videoEnabled: true,
          });
        }
        console.log('[XState] Total participants after adding local:', newParticipants.size);
        return newParticipants;
      },
    }),

    addParticipant: assign({
      participants: ({ context, event }) => {
        const joinEvent = event as Extract<WebRTCEvents, { type: 'PARTICIPANT_JOINED' }>;
        console.log('[XState] Adding remote participant:', {
          id: joinEvent.participantId,
          name: joinEvent.participantName,
          currentParticipants: context.participants.size,
        });
        const newParticipants = new Map(context.participants);
        newParticipants.set(joinEvent.participantId, {
          id: joinEvent.participantId,
          name: joinEvent.participantName,
          isLocal: false,
          stream: null,
          audioEnabled: true,
          videoEnabled: true,
        });
        console.log('[XState] Total participants after adding remote:', newParticipants.size);
        return newParticipants;
      },
    }),

    removeParticipant: assign({
      participants: ({ context, event }) => {
        const leftEvent = event as Extract<WebRTCEvents, { type: 'PARTICIPANT_LEFT' }>;
        const newParticipants = new Map(context.participants);
        newParticipants.delete(leftEvent.participantId);
        return newParticipants;
      },
    }),

    updateParticipantStream: assign({
      participants: ({ context, event }) => {
        const streamEvent = event as Extract<WebRTCEvents, { type: 'STREAM_RECEIVED' }>;
        console.log('[XState] Updating participant stream:', {
          participantId: streamEvent.participantId,
          streamId: streamEvent.stream.id,
          audioTracks: streamEvent.stream.getAudioTracks().length,
          videoTracks: streamEvent.stream.getVideoTracks().length,
        });
        const newParticipants = new Map(context.participants);
        const participant = newParticipants.get(streamEvent.participantId);
        if (participant) {
          console.log('[XState] Found participant, attaching stream');
          newParticipants.set(streamEvent.participantId, {
            ...participant,
            stream: streamEvent.stream,
          });
        } else {
          console.warn('[XState] Participant not found for stream update:', streamEvent.participantId);
        }
        return newParticipants;
      },
    }),

    updateParticipantAudio: assign({
      participants: ({ context, event }) => {
        const audioEvent = event as Extract<WebRTCEvents, { type: 'PARTICIPANT_AUDIO_TOGGLED' }>;
        const newParticipants = new Map(context.participants);
        const participant = newParticipants.get(audioEvent.participantId);
        if (participant) {
          newParticipants.set(audioEvent.participantId, {
            ...participant,
            audioEnabled: audioEvent.enabled,
          });
        }
        return newParticipants;
      },
    }),

    updateParticipantVideo: assign({
      participants: ({ context, event }) => {
        const videoEvent = event as Extract<WebRTCEvents, { type: 'PARTICIPANT_VIDEO_TOGGLED' }>;
        const newParticipants = new Map(context.participants);
        const participant = newParticipants.get(videoEvent.participantId);
        if (participant) {
          newParticipants.set(videoEvent.participantId, {
            ...participant,
            videoEnabled: videoEvent.enabled,
          });
        }
        return newParticipants;
      },
    }),

    clearParticipants: assign({
      participants: () => new Map(),
      localParticipantId: null,
    }),

    handlePeerDisconnection: ({ context }) => {
      console.log('[XState] Peer connection disconnected, cleaning up');
      // Close the peer connection
      webrtcService.closePeerConnection();
    },

    removeDisconnectedParticipants: assign({
      participants: ({ context }) => {
        console.log('[XState] Removing remote participants due to disconnection');
        const newParticipants = new Map(context.participants);
        // Remove all remote participants (for 1-to-1, there's only one)
        // When SFU is implemented, we'll track per-connection participant IDs
        for (const [id, participant] of newParticipants.entries()) {
          if (!participant.isLocal) {
            console.log('[XState] Removing disconnected participant:', id, participant.name);
            newParticipants.delete(id);
          }
        }
        console.log('[XState] Remaining participants after disconnect:', newParticipants.size);
        return newParticipants;
      },
      peerConnection: null, // Clear the failed peer connection
      remoteStream: null, // Clear the remote stream
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
    participants: new Map(),
    localParticipantId: null,
    localParticipantName: 'User',
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
      entry: ['setParticipantName', 'setLocalParticipantId'],
      invoke: {
        src: 'initMediaActor',
        onDone: {
          target: 'mediaReady',
          actions: ['setLocalStream', 'addLocalParticipant'],
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
          actions: 'setCallId',
        },
        JOIN_CALL: {
          target: 'joiningCall',
          actions: 'setCallId',
        },
      },
    },

    creatingCall: {
      description: 'Creating a new call (generating offer)',
      entry: 'setupRemoteTrackListener', // Set up callback BEFORE creating peer connection
      invoke: {
        src: 'createCallActor',
        input: ({ context }) => ({ callId: context.callId!, participantName: context.localParticipantName }),
        onDone: {
          target: 'inCall',
          actions: ['setCallCreated', 'setPeerConnection', 'monitorPeerConnection'],
        },
        onError: {
          target: 'error',
          actions: 'setError',
        },
      },
      on: {
        // Handle remote participants joining while creating call
        PARTICIPANT_JOINED: {
          actions: 'addParticipant',
        },
        STREAM_RECEIVED: {
          actions: 'updateParticipantStream',
        },
      },
    },

    joiningCall: {
      description: 'Joining an existing call (generating answer)',
      entry: 'setupRemoteTrackListener', // Set up callback BEFORE creating peer connection
      invoke: {
        src: 'joinCallActor',
        input: ({ context }) => ({ callId: context.callId!, participantName: context.localParticipantName }),
        onDone: {
          target: 'inCall',
          actions: ['setCallJoined', 'setPeerConnection', 'monitorPeerConnection'],
        },
        onError: {
          target: 'error',
          actions: 'setError',
        },
      },
      on: {
        // Handle remote participants joining while joining call
        PARTICIPANT_JOINED: {
          actions: 'addParticipant',
        },
        STREAM_RECEIVED: {
          actions: 'updateParticipantStream',
        },
      },
    },

    inCall: {
      description: 'Active call in progress',
      entry: 'updateRemoteStream',
      on: {
        CONNECTION_STATE_CHANGED: [
          {
            guard: ({ event }) => {
              const stateEvent = event as Extract<WebRTCEvents, { type: 'CONNECTION_STATE_CHANGED' }>;
              return stateEvent.state === 'failed' || stateEvent.state === 'disconnected';
            },
            actions: ['setConnectionState', 'handlePeerDisconnection', 'removeDisconnectedParticipants'],
          },
          {
            actions: 'setConnectionState',
          },
        ],
        ICE_CONNECTION_STATE_CHANGED: [
          {
            guard: ({ event }) => {
              const stateEvent = event as Extract<WebRTCEvents, { type: 'ICE_CONNECTION_STATE_CHANGED' }>;
              return stateEvent.state === 'failed' || stateEvent.state === 'disconnected';
            },
            actions: ['setIceConnectionState', 'handlePeerDisconnection', 'removeDisconnectedParticipants'],
          },
          {
            actions: 'setIceConnectionState',
          },
        ],
        PARTICIPANT_JOINED: {
          actions: 'addParticipant',
        },
        PARTICIPANT_LEFT: {
          actions: 'removeParticipant',
        },
        STREAM_RECEIVED: {
          actions: 'updateParticipantStream',
        },
        PARTICIPANT_AUDIO_TOGGLED: {
          actions: 'updateParticipantAudio',
        },
        PARTICIPANT_VIDEO_TOGGLED: {
          actions: 'updateParticipantVideo',
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

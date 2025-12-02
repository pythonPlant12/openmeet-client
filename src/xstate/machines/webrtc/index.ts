import { assign, setup } from 'xstate';

import type { DeviceConstraints } from '@/services/webrtc-sfu';

import { clearServices, getServices, getSignalingService, initMediaActor, joinRoomActor } from './actors';
import type { Participant, SFUContext, SFUEvents } from './types';

// Re-export for convenience
export { getServices } from './actors';

// Initial context
const initialContext: SFUContext = {
  localStream: null,
  participants: new Map(),
  localParticipantId: null,
  localParticipantName: '',
  roomId: null,
  connectionState: null,
  iceConnectionState: null,
  streamOwnerMap: new Map(),
  knownRemoteParticipants: new Set(),
  error: null,
};

// The SFU XState machine
export const webrtcMachine = setup({
  types: {
    context: {} as SFUContext,
    events: {} as SFUEvents,
    input: {} as { participantName?: string; deviceConstraints?: DeviceConstraints },
  },
  actors: {
    initMedia: initMediaActor,
    joinRoom: joinRoomActor,
  },
  actions: {
    setLocalStream: assign({
      localStream: (_, params: { stream: MediaStream }) => params.stream,
    }),

    setParticipantName: assign({
      localParticipantName: ({ context }, params: { name?: string }) => params.name || context.localParticipantName,
    }),

    setRoomId: assign({
      roomId: (_, params: { roomId: string }) => params.roomId,
    }),

    setLocalParticipant: assign({
      localParticipantId: (_, params: { participantId: string }) => params.participantId,
      participants: ({ context }, params: { participantId: string }) => {
        const newParticipants = new Map(context.participants);
        newParticipants.set(params.participantId, {
          id: params.participantId,
          name: context.localParticipantName,
          stream: context.localStream,
          isLocal: true,
          audioEnabled: true,
          videoEnabled: true,
        });
        return newParticipants;
      },
    }),

    addRemoteParticipant: assign({
      participants: ({ context }, params: { participantId: string; participantName: string }) => {
        const newParticipants = new Map(context.participants);
        newParticipants.set(params.participantId, {
          id: params.participantId,
          name: params.participantName,
          stream: null,
          isLocal: false,
          audioEnabled: true,
          videoEnabled: true,
        });
        return newParticipants;
      },
      knownRemoteParticipants: ({ context }, params: { participantId: string }) => {
        const newSet = new Set(context.knownRemoteParticipants);
        newSet.add(params.participantId);
        return newSet;
      },
    }),

    removeParticipant: assign({
      participants: ({ context }, params: { participantId: string }) => {
        const newParticipants = new Map(context.participants);
        newParticipants.delete(params.participantId);
        return newParticipants;
      },
      knownRemoteParticipants: ({ context }, params: { participantId: string }) => {
        const newSet = new Set(context.knownRemoteParticipants);
        newSet.delete(params.participantId);
        return newSet;
      },
    }),

    setStreamOwner: assign({
      streamOwnerMap: ({ context }, params: { streamId: string; participantId: string }) => {
        const newMap = new Map(context.streamOwnerMap);
        newMap.set(params.streamId, params.participantId);
        return newMap;
      },
    }),

    assignStreamToParticipant: assign({
      participants: ({ context }, params: { streamId: string; stream: MediaStream }) => {
        const newParticipants = new Map(context.participants);
        const ownerParticipantId = context.streamOwnerMap.get(params.streamId);

        if (ownerParticipantId) {
          const participant = newParticipants.get(ownerParticipantId);
          if (participant) {
            console.log('[webrtcMachine] Assigning stream to:', participant.name);
            newParticipants.set(ownerParticipantId, {
              ...participant,
              stream: params.stream,
            });
          }
        } else {
          // Fallback: find participant without stream
          const participantWithoutStream = Array.from(newParticipants.values()).find((p) => !p.isLocal && !p.stream);
          if (participantWithoutStream) {
            console.log('[webrtcMachine] Fallback: Assigning stream to:', participantWithoutStream.name);
            newParticipants.set(participantWithoutStream.id, {
              ...participantWithoutStream,
              stream: params.stream,
            });
          }
        }

        return newParticipants;
      },
    }),

    updateMediaState: assign({
      participants: ({ context }, params: { participantId: string; audioEnabled: boolean; videoEnabled: boolean }) => {
        const participant = context.participants.get(params.participantId);
        if (!participant || participant.isLocal) return context.participants;

        const newParticipants = new Map(context.participants);
        newParticipants.set(params.participantId, {
          ...participant,
          audioEnabled: params.audioEnabled,
          videoEnabled: params.videoEnabled,
        });
        return newParticipants;
      },
    }),

    setConnectionState: assign({
      connectionState: (_, params: { state: RTCPeerConnectionState }) => params.state,
    }),

    setIceConnectionState: assign({
      iceConnectionState: (_, params: { state: RTCIceConnectionState }) => params.state,
    }),

    setError: assign({
      error: (_, params: { error: string }) => params.error,
    }),

    toggleLocalAudio: assign({
      participants: ({ context }, params: { participantId: string; enabled: boolean }) => {
        const participant = context.participants.get(params.participantId);
        if (!participant?.isLocal || !context.localStream) return context.participants;

        context.localStream.getAudioTracks().forEach((track) => {
          track.enabled = params.enabled;
        });

        const newParticipants = new Map(context.participants);
        newParticipants.set(params.participantId, {
          ...participant,
          audioEnabled: params.enabled,
        });

        // Notify server
        getSignalingService()?.sendMediaStateChanged(params.enabled, participant.videoEnabled);

        return newParticipants;
      },
    }),

    toggleLocalVideo: assign({
      participants: ({ context }, params: { participantId: string; enabled: boolean }) => {
        const participant = context.participants.get(params.participantId);
        if (!participant?.isLocal || !context.localStream) return context.participants;

        context.localStream.getVideoTracks().forEach((track) => {
          track.enabled = params.enabled;
        });

        const newParticipants = new Map(context.participants);
        newParticipants.set(params.participantId, {
          ...participant,
          videoEnabled: params.enabled,
        });

        // Notify server
        getSignalingService()?.sendMediaStateChanged(participant.audioEnabled, params.enabled);

        return newParticipants;
      },
    }),

    cleanup: ({ context }) => {
      console.log('[webrtcMachine] Cleaning up...');

      // Stop local stream tracks
      context.localStream?.getTracks().forEach((track) => track.stop());

      // Cleanup services
      const { webrtcService, signalingService } = getServices();
      webrtcService?.cleanup();
      signalingService?.disconnect();

      // Clear module-level services
      clearServices();
    },

    resetContext: assign({
      localStream: null,
      participants: () => new Map<string, Participant>(),
      localParticipantId: null,
      roomId: null,
      connectionState: null,
      iceConnectionState: null,
      streamOwnerMap: () => new Map<string, string>(),
      knownRemoteParticipants: () => new Set<string>(),
      error: null,
    }),
  },
  guards: {
    isConnectionConnected: ({ context }) => context.connectionState === 'connected',
    isConnectionFailed: ({ context }) =>
      context.connectionState === 'failed' || context.connectionState === 'disconnected',
  },
}).createMachine({
  id: 'webrtcMachine',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        INIT_MEDIA: {
          target: 'initializingMedia',
          actions: [{ type: 'setParticipantName', params: ({ event }) => ({ name: event.participantName }) }],
        },
      },
    },

    initializingMedia: {
      invoke: {
        id: 'initMedia',
        src: 'initMedia',
        input: ({ event }) => {
          if (event.type === 'INIT_MEDIA') {
            return {
              participantName: event.participantName,
              deviceConstraints: event.deviceConstraints,
            };
          }
          return {};
        },
        onDone: {
          target: 'mediaReady',
          actions: [{ type: 'setLocalStream', params: ({ event }) => ({ stream: event.output }) }],
        },
        onError: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({
                error: event.error instanceof Error ? event.error.message : 'Failed to initialize media',
              }),
            },
          ],
        },
      },
    },

    mediaReady: {
      on: {
        JOIN_ROOM: {
          target: 'connected',
          actions: [
            { type: 'setRoomId', params: ({ event }) => ({ roomId: event.roomId }) },
            { type: 'setParticipantName', params: ({ event }) => ({ name: event.participantName }) },
          ],
        },
        LEAVE_ROOM: {
          target: 'idle',
          actions: ['cleanup', 'resetContext'],
        },
      },
    },

    // Parent state that keeps the joinRoom actor alive across joiningRoom and inCall
    connected: {
      initial: 'joiningRoom',
      invoke: {
        id: 'joinRoom',
        src: 'joinRoom',
        input: ({ context }) => ({
          roomId: context.roomId!,
          participantName: context.localParticipantName,
          localStream: context.localStream!,
        }),
      },
      // Events handled at parent level (available in both child states)
      on: {
        JOINED: {
          actions: [{ type: 'setLocalParticipant', params: ({ event }) => ({ participantId: event.participantId }) }],
        },
        STREAM_OWNER: {
          actions: [
            {
              type: 'setStreamOwner',
              params: ({ event }) => ({ streamId: event.streamId, participantId: event.participantId }),
            },
          ],
        },
        PARTICIPANT_JOINED: {
          actions: [
            {
              type: 'addRemoteParticipant',
              params: ({ event }) => ({ participantId: event.participantId, participantName: event.participantName }),
            },
          ],
        },
        PARTICIPANT_LEFT: {
          actions: [{ type: 'removeParticipant', params: ({ event }) => ({ participantId: event.participantId }) }],
        },
        REMOTE_TRACK_RECEIVED: {
          actions: [
            {
              type: 'assignStreamToParticipant',
              params: ({ event }) => ({ streamId: event.streamId, stream: event.stream }),
            },
          ],
        },
        MEDIA_STATE_CHANGED: {
          actions: [
            {
              type: 'updateMediaState',
              params: ({ event }) => ({
                participantId: event.participantId,
                audioEnabled: event.audioEnabled,
                videoEnabled: event.videoEnabled,
              }),
            },
          ],
        },
        ICE_CONNECTION_STATE_CHANGED: {
          actions: [{ type: 'setIceConnectionState', params: ({ event }) => ({ state: event.state }) }],
        },
        SERVER_ERROR: {
          target: 'error',
          actions: [{ type: 'setError', params: ({ event }) => ({ error: event.message }) }],
        },
        LEAVE_ROOM: {
          target: 'endingCall',
        },
      },
      states: {
        joiningRoom: {
          on: {
            CONNECTION_STATE_CHANGED: [
              {
                guard: ({ event }) => event.state === 'connected',
                target: 'inCall',
                actions: [{ type: 'setConnectionState', params: ({ event }) => ({ state: event.state }) }],
              },
              {
                guard: ({ event }) => event.state === 'failed',
                target: '#webrtcMachine.error',
                actions: [
                  { type: 'setConnectionState', params: ({ event }) => ({ state: event.state }) },
                  { type: 'setError', params: () => ({ error: 'Peer connection failed' }) },
                ],
              },
              {
                actions: [{ type: 'setConnectionState', params: ({ event }) => ({ state: event.state }) }],
              },
            ],
          },
        },
        inCall: {
          on: {
            CONNECTION_STATE_CHANGED: [
              {
                guard: ({ event }) => event.state === 'failed' || event.state === 'disconnected',
                target: '#webrtcMachine.error',
                actions: [
                  { type: 'setConnectionState', params: ({ event }) => ({ state: event.state }) },
                  { type: 'setError', params: ({ event }) => ({ error: `Connection ${event.state}` }) },
                ],
              },
              {
                actions: [{ type: 'setConnectionState', params: ({ event }) => ({ state: event.state }) }],
              },
            ],
            TOGGLE_AUDIO: {
              actions: [
                {
                  type: 'toggleLocalAudio',
                  params: ({ event }) => ({ participantId: event.participantId, enabled: event.enabled }),
                },
              ],
            },
            TOGGLE_VIDEO: {
              actions: [
                {
                  type: 'toggleLocalVideo',
                  params: ({ event }) => ({ participantId: event.participantId, enabled: event.enabled }),
                },
              ],
            },
          },
        },
      },
    },

    endingCall: {
      entry: ['cleanup', 'resetContext'],
      always: {
        target: 'idle',
      },
    },

    error: {
      on: {
        RETRY: {
          target: 'idle',
          actions: ['cleanup', 'resetContext'],
        },
        LEAVE_ROOM: {
          target: 'idle',
          actions: ['cleanup', 'resetContext'],
        },
      },
    },
  },
});

export type webrtcMachine = typeof webrtcMachine;

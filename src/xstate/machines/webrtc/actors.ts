import { fromCallback, fromPromise } from 'xstate';

import { MEETING_ACCESS_ERRORS } from '@/config/meeting-access.config';
import { i18n } from '@/i18n';
import { resolveReachableWebSocketUrl } from '@/services/dev-networking';
import { SignalingService } from '@/services/signaling';
import { WebRTCServiceSFU } from '@/services/webrtc-sfu';

import type { InitMediaInput, JoinRoomInput, SFUEvents } from './types';

// SFU server URL
export const SFU_SERVER_URL = resolveReachableWebSocketUrl(
  import.meta.env.VITE_SFU_WSS_URL || 'wss://sfu.openmeets.eu/ws',
);
const DISCONNECT_GRACE_MS = 15000;
const MAX_DISCONNECT_GRACE_MS = 45000;

// Module-level service instances (not in XState context because they're not serializable)
let signalingService: SignalingService | null = null;
let webrtcService: WebRTCServiceSFU | null = null;

// Helper to get services
export function getServices() {
  return { signalingService, webrtcService };
}

// Helper to clear services (used by cleanup action)
export function clearServices() {
  webrtcService = null;
  signalingService = null;
}

// Helper to get signaling service (used by toggle actions)
export function getSignalingService() {
  return signalingService;
}

/**
 * Actor: Initialize media and services
 * Creates signaling connection and initializes local media stream
 */
export const initMediaActor = fromPromise<MediaStream, InitMediaInput>(async ({ input }) => {
  // Create signaling service if not exists
  if (!signalingService) {
    signalingService = new SignalingService(SFU_SERVER_URL);
    await signalingService.connect();
  }

  // Create WebRTC service if not exists
  if (!webrtcService) {
    webrtcService = new WebRTCServiceSFU(signalingService);
  }

  // Initialize media
  const stream = await webrtcService.initializeMedia(input.deviceConstraints);
  return stream;
});

/**
 * Actor: Join room and setup peer connection
 * Uses fromCallback because it needs to continuously send events to parent
 * after the initial setup (signaling messages, connection state changes, etc.)
 */
export const joinRoomActor = fromCallback<SFUEvents, JoinRoomInput>(({ sendBack, input }) => {
  if (!signalingService || !webrtcService) {
    sendBack({ type: 'SERVER_ERROR', message: i18n.global.t('errors.servicesNotInitialized') });
    return;
  }

  // Setup signaling event handlers that send events back to the parent machine
  signalingService.on('joined', (message) => {
    if (message.type === 'joined') {
      sendBack({ type: 'JOINED', participantId: message.participantId, participantName: message.participantName });
    }
  });

  signalingService.on('streamOwner', (message) => {
    if (message.type === 'streamOwner') {
      sendBack({
        type: 'STREAM_OWNER',
        streamId: message.streamId,
        participantId: message.participantId,
        participantName: message.participantName,
      });
    }
  });

  signalingService.on('participantJoined', (message) => {
    if (message.type === 'participantJoined') {
      sendBack({
        type: 'PARTICIPANT_JOINED',
        participantId: message.participantId,
        participantName: message.participantName,
        screenShareOf: message.screenShareOf ?? null,
      });
    }
  });

  signalingService.on('participantLeft', (message) => {
    if (message.type === 'participantLeft') {
      sendBack({ type: 'PARTICIPANT_LEFT', participantId: message.participantId });
    }
  });

  signalingService.on('error', (message) => {
    if (message.type === 'error') {
      console.error('[webrtcMachine] Meeting server error:', message.message);
      // Access refusals are shown as they are, so the page can ask for a password again.
      const isAccessError = MEETING_ACCESS_ERRORS.includes(message.message);
      sendBack({
        type: 'SERVER_ERROR',
        message: isAccessError ? message.message : i18n.global.t('errors.meetingServer'),
      });
    }
  });

  signalingService.on('mediaStateChanged', (message) => {
    if (message.type === 'mediaStateChanged') {
      sendBack({
        type: 'MEDIA_STATE_CHANGED',
        participantId: message.participantId,
        audioEnabled: message.audioEnabled,
        videoEnabled: message.videoEnabled,
      });
    }
  });

  signalingService.on('chatMessage', (message) => {
    if (message.type === 'chatMessage') {
      sendBack({
        type: 'CHAT_MESSAGE_RECEIVED',
        id: message.id,
        participantId: message.participantId,
        participantName: message.participantName,
        message: message.message,
        timestamp: message.timestamp,
        replyTo: message.replyTo ?? null,
        reactions: message.reactions ?? [],
      });
    }
  });

  signalingService.on('chatHistory', (message) => {
    if (message.type === 'chatHistory') {
      sendBack({ type: 'CHAT_HISTORY_RECEIVED', messages: message.messages });
    }
  });

  signalingService.on('chatReactionsChanged', (message) => {
    if (message.type === 'chatReactionsChanged') {
      sendBack({ type: 'CHAT_REACTIONS_CHANGED', messageId: message.messageId, reactions: message.reactions });
    }
  });

  // Setup remote track handler
  webrtcService.setOnRemoteTrack((streamId, stream) => {
    console.log('[webrtcMachine] Remote track received:', streamId);

    // Check if it's our own stream (Chrome bug workaround)
    if (input.localStream) {
      const localTrackIds = input.localStream.getTracks().map((t) => t.id);
      const remoteTrackIds = stream.getTracks().map((t) => t.id);
      const hasMatchingTrack = localTrackIds.some((id) => remoteTrackIds.includes(id));

      if (hasMatchingTrack) {
        console.log('[webrtcMachine] Ignoring own stream reflected from SFU');
        return;
      }
    }

    sendBack({ type: 'REMOTE_TRACK_RECEIVED', streamId, stream });
  });

  const signaling = signalingService;
  const webrtc = webrtcService;
  let pc: RTCPeerConnection;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let hasRecentMediaActivity = false;
  let remoteVideoFrozen = false;
  let disconnectedSince: number | null = null;

  const clearDisconnectTimer = () => {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
  };

  const scheduleDisconnectTimeout = () => {
    clearDisconnectTimer();
    disconnectTimer = setTimeout(() => {
      if (pc.connectionState === 'disconnected' || pc.iceConnectionState === 'disconnected') {
        const disconnectedFor = disconnectedSince ? Date.now() - disconnectedSince : DISCONNECT_GRACE_MS;

        if (hasRecentMediaActivity && !remoteVideoFrozen && disconnectedFor < MAX_DISCONNECT_GRACE_MS) {
          console.log(
            '[webrtcMachine] Connection still disconnected, but media stats are progressing; keeping call alive',
          );
          scheduleDisconnectTimeout();
          return;
        }

        sendBack({ type: 'CONNECTION_TIMEOUT' });
      }
    }, DISCONNECT_GRACE_MS);
  };

  const watchPeerConnection = (connection: RTCPeerConnection) => {
    connection.onconnectionstatechange = () => {
      console.log('[webrtcMachine] Peer connection state:', connection.connectionState);
      sendBack({ type: 'CONNECTION_STATE_CHANGED', state: connection.connectionState });

      if (connection.connectionState === 'disconnected') {
        disconnectedSince ??= Date.now();
        scheduleDisconnectTimeout();
      }

      if (
        connection.connectionState === 'connected' ||
        connection.connectionState === 'failed' ||
        connection.connectionState === 'closed'
      ) {
        disconnectedSince = null;
        clearDisconnectTimer();
      }
    };

    connection.oniceconnectionstatechange = () => {
      console.log('[webrtcMachine] ICE connection state:', connection.iceConnectionState);
      sendBack({ type: 'ICE_CONNECTION_STATE_CHANGED', state: connection.iceConnectionState });

      if (connection.iceConnectionState === 'disconnected') {
        disconnectedSince ??= Date.now();
        scheduleDisconnectTimeout();
      }

      if (
        connection.iceConnectionState === 'connected' ||
        connection.iceConnectionState === 'completed' ||
        connection.iceConnectionState === 'failed' ||
        connection.iceConnectionState === 'closed'
      ) {
        disconnectedSince = null;
        clearDisconnectTimer();
      }
    };

    connection.onicegatheringstatechange = () => {
      console.log('[webrtcMachine] ICE gathering state:', connection.iceGatheringState);
    };

    connection.onsignalingstatechange = () => {
      console.log('[webrtcMachine] Signaling state:', connection.signalingState);
    };
  };

  // The server owns one peer connection per signaling session, so every (re)join negotiates a fresh one.
  const joinWithNewPeerConnection = () => {
    signaling.joinRoom(input.roomId, input.participantName, input.password);
    pc = webrtc.createPeerConnection();
    watchPeerConnection(pc);

    webrtc
      .sendOffer()
      .then(() => {
        console.log('[webrtcMachine] Offer sent, waiting for answer...');
      })
      .catch((error) => {
        sendBack({
          type: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : i18n.global.t('errors.offerFailed'),
        });
      });
  };

  // A dropped socket means the server already removed this participant and closed its peer connection.
  // The old connection is muted so its teardown does not end the call, then the room is rejoined once
  // signaling is back.
  const stopWatchingConnectionChanges = signaling.onConnectionChange((change) => {
    if (change === 'lost') {
      console.log('[webrtcMachine] Signaling lost; waiting to rejoin');
      clearDisconnectTimer();
      disconnectedSince = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      sendBack({ type: 'SIGNALING_LOST' });
      return;
    }

    if (change === 'restored') {
      console.log('[webrtcMachine] Signaling restored; rejoining room');
      sendBack({ type: 'SIGNALING_RESTORED' });
      joinWithNewPeerConnection();
      return;
    }

    sendBack({ type: 'CONNECTION_TIMEOUT' });
  });

  joinWithNewPeerConnection();

  const qualityInterval = setInterval(() => {
    if (pc.connectionState === 'closed') return;

    webrtc
      .getConnectionQualityStats()
      .then((stats) => {
        hasRecentMediaActivity = stats.hasRecentMediaActivity;
        remoteVideoFrozen = stats.remoteVideoFrozen;
        sendBack({ type: 'CONNECTION_QUALITY_CHANGED', stats });
      })
      .catch((error) => {
        console.error('[webrtcMachine] Failed to collect connection quality stats:', error);
      });
  }, 3000);

  // Return cleanup function (optional)
  return () => {
    // Cleanup is handled by the machine's cleanup action
    clearDisconnectTimer();
    clearInterval(qualityInterval);
    stopWatchingConnectionChanges();
    console.log('[webrtcMachine] joinRoomActor cleanup');
  };
});

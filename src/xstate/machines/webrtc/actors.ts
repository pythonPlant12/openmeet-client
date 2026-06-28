import { fromCallback, fromPromise } from 'xstate';

import { resolveReachableWebSocketUrl } from '@/services/dev-networking';
import { SignalingService } from '@/services/signaling';
import { WebRTCServiceSFU } from '@/services/webrtc-sfu';

import type { InitMediaInput, JoinRoomInput, SFUEvents } from './types';

// SFU server URL
const SFU_SERVER_URL = resolveReachableWebSocketUrl(import.meta.env.VITE_SFU_WSS_URL || 'wss://sfu.openmeets.eu/ws');
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
    sendBack({ type: 'SERVER_ERROR', message: 'Services not initialized. Call initMedia first' });
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
      sendBack({ type: 'SERVER_ERROR', message: message.message });
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
        participantId: message.participantId,
        participantName: message.participantName,
        message: message.message,
        timestamp: message.timestamp,
      });
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

  // Join room via signaling
  signalingService.joinRoom(input.roomId, input.participantName);

  // Create peer connection and setup connection state monitoring
  const pc = webrtcService.createPeerConnection();
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
          console.log('[webrtcMachine] Connection still disconnected, but media stats are progressing; keeping call alive');
          scheduleDisconnectTimeout();
          return;
        }

        sendBack({ type: 'CONNECTION_TIMEOUT' });
      }
    }, DISCONNECT_GRACE_MS);
  };

  pc.onconnectionstatechange = () => {
    console.log('[webrtcMachine] Peer connection state:', pc.connectionState);
    sendBack({ type: 'CONNECTION_STATE_CHANGED', state: pc.connectionState });

    if (pc.connectionState === 'disconnected') {
      disconnectedSince ??= Date.now();
      scheduleDisconnectTimeout();
    }

    if (pc.connectionState === 'connected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      disconnectedSince = null;
      clearDisconnectTimer();
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('[webrtcMachine] ICE connection state:', pc.iceConnectionState);
    sendBack({ type: 'ICE_CONNECTION_STATE_CHANGED', state: pc.iceConnectionState });

    if (pc.iceConnectionState === 'disconnected') {
      disconnectedSince ??= Date.now();
      scheduleDisconnectTimeout();
    }

    if (
      pc.iceConnectionState === 'connected' ||
      pc.iceConnectionState === 'completed' ||
      pc.iceConnectionState === 'failed' ||
      pc.iceConnectionState === 'closed'
    ) {
      disconnectedSince = null;
      clearDisconnectTimer();
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log('[webrtcMachine] ICE gathering state:', pc.iceGatheringState);
  };

  pc.onsignalingstatechange = () => {
    console.log('[webrtcMachine] Signaling state:', pc.signalingState);
  };

  const qualityInterval = setInterval(() => {
    if (pc.connectionState === 'closed') return;

    webrtcService
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

  // Send offer to SFU
  webrtcService
    .sendOffer()
    .then(() => {
      console.log('[webrtcMachine] Offer sent, waiting for answer...');
    })
    .catch((error) => {
      sendBack({ type: 'SERVER_ERROR', message: error instanceof Error ? error.message : 'Failed to send offer' });
    });

  // Return cleanup function (optional)
  return () => {
    // Cleanup is handled by the machine's cleanup action
    clearDisconnectTimer();
    clearInterval(qualityInterval);
    console.log('[webrtcMachine] joinRoomActor cleanup');
  };
});

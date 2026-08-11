// WebSocket signaling service for connecting to Rust SFU backend
import { i18n } from '@/i18n';
import { cookieUtils } from '@/utils';

const SIGNALING_PROTOCOL_VERSION = 2;
const AUTHENTICATION_TIMEOUT_MS = 5_000;

export interface SignalingChatMessage {
  participantId: string;
  participantName: string;
  message: string;
  timestamp: number;
}

export type SignalingMessage =
  | { type: 'authenticate'; protocolVersion: number; accessToken: string | null }
  | { type: 'authenticated'; protocolVersion: number; authenticated: boolean }
  | { type: 'join'; roomId: string; participantName: string }
  | { type: 'joined'; participantId: string; participantName: string }
  | { type: 'offer'; targetId: string; sdp: string }
  | { type: 'answer'; targetId: string; sdp: string }
  | {
      type: 'iceCandidate';
      targetId: string;
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    }
  | { type: 'participantJoined'; participantId: string; participantName: string }
  | { type: 'participantLeft'; participantId: string }
  | { type: 'streamOwner'; streamId: string; participantId: string; participantName: string }
  | { type: 'mediaStateChanged'; participantId: string; audioEnabled: boolean; videoEnabled: boolean }
  | ({ type: 'chatMessage' } & SignalingChatMessage)
  | { type: 'chatHistory'; messages: SignalingChatMessage[] }
  | { type: 'error'; message: string };

type MessageHandler = (message: SignalingMessage) => void;

export class SignalingService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private intentionalDisconnect = false;

  constructor(private serverUrl: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let identityDecided = false;
      const authenticationTimer = window.setTimeout(() => {
        if (identityDecided) return;
        this.intentionalDisconnect = true;
        this.ws?.close();
        reject(new Error(i18n.global.t('errors.websocketFailed')));
      }, AUTHENTICATION_TIMEOUT_MS);
      console.log('[SignalingService] Connecting to:', this.serverUrl);

      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[SignalingService] WebSocket connected');
        this.reconnectAttempts = 0;
        this.intentionalDisconnect = false;
        this.send({
          type: 'authenticate',
          protocolVersion: SIGNALING_PROTOCOL_VERSION,
          accessToken: cookieUtils.get('accessToken'),
        });
      };

      this.ws.onerror = (error) => {
        console.error('[SignalingService] WebSocket error:', error);
        reject(new Error(i18n.global.t('errors.websocketFailed')));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SignalingMessage;
          console.log('[SignalingService] Received message:', message.type);
          if (message.type === 'authenticated') {
            if (message.protocolVersion !== SIGNALING_PROTOCOL_VERSION) {
              throw new Error('Unsupported signaling protocol');
            }
            identityDecided = true;
            window.clearTimeout(authenticationTimer);
            resolve();
          } else if (!identityDecided && message.type === 'error') {
            this.intentionalDisconnect = true;
            window.clearTimeout(authenticationTimer);
            this.ws?.close();
            reject(new Error(i18n.global.t('errors.websocketFailed')));
            return;
          }
          this.handleMessage(message);
        } catch (error) {
          console.error('[SignalingService] Failed to parse message:', error);
          if (!identityDecided) {
            this.intentionalDisconnect = true;
            window.clearTimeout(authenticationTimer);
            this.ws?.close();
            reject(new Error(i18n.global.t('errors.websocketFailed')));
          }
        }
      };

      this.ws.onclose = (event) => {
        window.clearTimeout(authenticationTimer);
        if (!identityDecided) reject(new Error(i18n.global.t('errors.websocketFailed')));
        console.log('[SignalingService] WebSocket closed:', {
          code: event.code,
          reason: event.reason || null,
          wasClean: event.wasClean,
          intentionalDisconnect: this.intentionalDisconnect,
          reconnectAttempts: this.reconnectAttempts,
        });
        this.handleDisconnect();
      };
    });
  }

  disconnect(): void {
    console.log('[SignalingService] Disconnecting');
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
  }

  send(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[SignalingService] WebSocket not connected');
      throw new Error(i18n.global.t('errors.websocketDisconnected'));
    }

    console.log('[SignalingService] Sending message');
    this.ws.send(JSON.stringify(message));
  }

  // Room management
  joinRoom(roomId: string, participantName: string): void {
    this.send({
      type: 'join',
      roomId,
      participantName,
    });
  }

  // WebRTC signaling
  sendOffer(targetId: string, sdp: string): void {
    this.send({
      type: 'offer',
      targetId,
      sdp,
    });
  }

  sendAnswer(targetId: string, sdp: string): void {
    this.send({
      type: 'answer',
      targetId,
      sdp,
    });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidateInit): void {
    this.send({
      type: 'iceCandidate',
      targetId,
      candidate: candidate.candidate || '',
      sdpMid: candidate.sdpMid || null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
    });
  }

  sendMediaStateChanged(audioEnabled: boolean, videoEnabled: boolean): void {
    this.send({
      type: 'mediaStateChanged',
      participantId: '', // Server will fill this in
      audioEnabled,
      videoEnabled,
    });
  }

  sendChatMessage(message: string): void {
    this.send({
      type: 'chatMessage',
      participantId: '', // Server will fill this in
      participantName: '', // Server will fill this in
      message,
      timestamp: Date.now(),
    });
  }

  // Event handlers
  on(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  off(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: SignalingMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Also trigger wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  private handleDisconnect(): void {
    // Don't reconnect if we intentionally disconnected
    if (this.intentionalDisconnect) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[SignalingService] Reconnecting (attempt ${this.reconnectAttempts})...`);

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('[SignalingService] Reconnect failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[SignalingService] Max reconnect attempts reached');
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

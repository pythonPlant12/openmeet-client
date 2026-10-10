import { cookieUtils } from '@/utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const SOCIAL_EVENTS_URL =
  import.meta.env.VITE_SOCIAL_EVENTS_WS_URL || `${API_BASE_URL.replace(/^http/, 'ws')}/social/events`;

export type SocialEventResource = 'calls' | 'conversations' | 'friends' | 'notifications';

/** Which endpoint answers the call: a direct call invitation or a conversation call session. */
export type AlertCallKind = 'invitation' | 'session';

/** Something to show as an OS notification. The server sends alerts only while the user's status is Online. */
export type SocialAlert =
  | {
      kind: 'message';
      conversationId: string;
      sequence: number;
      senderId: string;
      senderName: string;
      /** Group title; null for direct conversations. */
      conversationTitle: string | null;
      preview: string;
      hasAttachments: boolean;
    }
  | {
      kind: 'incomingCall';
      callId: string;
      callKind: AlertCallKind;
      callerName: string;
      conversationId: string | null;
      conversationTitle: string | null;
      expiresAt: string;
    };

type ServerMessage =
  | { type: 'authenticated' }
  | { type: 'error'; message: string }
  | { type: 'refresh'; resource: SocialEventResource }
  | { type: 'alert'; alert: SocialAlert };

interface SocialEventHandlers {
  onResource: (resource: SocialEventResource) => void;
  onConnected: () => void;
  onAlert?: (alert: SocialAlert) => void;
}

export class SocialEventsService {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | undefined;
  private reconnectAttempts = 0;
  private generation = 0;

  connect(
    onResource: SocialEventHandlers['onResource'],
    onConnected: SocialEventHandlers['onConnected'],
    onAlert?: SocialEventHandlers['onAlert'],
  ) {
    this.disconnect();
    const generation = this.generation;
    this.open({ onResource, onConnected, onAlert }, generation);
  }

  disconnect() {
    this.generation += 1;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.reconnectAttempts = 0;
    this.socket?.close();
    this.socket = null;
  }

  private open(handlers: SocialEventHandlers, generation: number) {
    const socket = new WebSocket(SOCIAL_EVENTS_URL);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (generation !== this.generation) return;
      const accessToken = cookieUtils.get('accessToken');
      if (!accessToken) {
        reconnect = false;
        socket.close();
        return;
      }
      socket.send(JSON.stringify({ type: 'authenticate', accessToken }));
    });
    let reconnect = true;
    socket.addEventListener('message', (event) => {
      if (generation !== this.generation) return;
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === 'authenticated') {
          this.reconnectAttempts = 0;
          handlers.onConnected();
        } else if (message.type === 'refresh') {
          handlers.onResource(message.resource);
        } else if (message.type === 'alert') {
          handlers.onAlert?.(message.alert);
        } else if (message.type === 'error') {
          console.error('[SocialEvents] Authentication failed:', message.message);
          reconnect = false;
          window.dispatchEvent(new Event('openmeet:access-token-expired'));
          this.disconnect();
        }
      } catch (error) {
        console.error('[SocialEvents] Invalid server message:', error);
      }
    });
    socket.addEventListener('close', () => {
      if (generation !== this.generation || !reconnect) return;
      this.socket = null;
      const maximumDelay = Math.min(1_000 * 2 ** this.reconnectAttempts, 15_000);
      const delay = maximumDelay / 2 + Math.random() * (maximumDelay / 2);
      this.reconnectAttempts += 1;
      this.reconnectTimer = window.setTimeout(() => this.open(handlers, generation), delay);
    });
    socket.addEventListener('error', () => socket.close());
  }
}

export const socialEventsService = new SocialEventsService();

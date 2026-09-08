import { cookieUtils } from '@/utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const SOCIAL_EVENTS_URL =
  import.meta.env.VITE_SOCIAL_EVENTS_WS_URL || `${API_BASE_URL.replace(/^http/, 'ws')}/social/events`;

export type SocialEventResource = 'calls' | 'conversations' | 'friends' | 'notifications';

type ServerMessage =
  | { type: 'authenticated' }
  | { type: 'error'; message: string }
  | { type: 'refresh'; resource: SocialEventResource };

export class SocialEventsService {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | undefined;
  private reconnectAttempts = 0;
  private generation = 0;

  connect(accessToken: string, onResource: (resource: SocialEventResource) => void, onConnected: () => void) {
    this.disconnect();
    const generation = this.generation;
    this.open(accessToken, onResource, onConnected, generation);
  }

  disconnect() {
    this.generation += 1;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.reconnectAttempts = 0;
    this.socket?.close();
    this.socket = null;
  }

  private open(
    accessToken: string,
    onResource: (resource: SocialEventResource) => void,
    onConnected: () => void,
    generation: number,
  ) {
    const socket = new WebSocket(SOCIAL_EVENTS_URL);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (generation !== this.generation) return;
      socket.send(JSON.stringify({ type: 'authenticate', accessToken: cookieUtils.get('accessToken') || accessToken }));
    });
    let reconnect = true;
    socket.addEventListener('message', (event) => {
      if (generation !== this.generation) return;
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === 'authenticated') {
          this.reconnectAttempts = 0;
          onConnected();
        } else if (message.type === 'refresh') {
          onResource(message.resource);
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
      this.reconnectTimer = window.setTimeout(() => this.open(accessToken, onResource, onConnected, generation), delay);
    });
    socket.addEventListener('error', () => socket.close());
  }
}

export const socialEventsService = new SocialEventsService();

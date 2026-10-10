import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SocialEventsService } from '@/services/social-events';
import { cookieUtils } from '@/utils';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];

  sent: string[] = [];

  constructor(public url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.dispatchEvent(new Event('close'));
  }

  open() {
    this.dispatchEvent(new Event('open'));
  }

  receive(message: object) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  cookieUtils.remove('accessToken');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SocialEventsService', () => {
  it('authenticates then forwards resource refreshes', () => {
    const service = new SocialEventsService();
    const onResource = vi.fn();
    const onConnected = vi.fn();
    cookieUtils.set('accessToken', 'signed-token', 1);

    service.connect(onResource, onConnected);
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.receive({ type: 'authenticated' });
    socket.receive({ type: 'refresh', resource: 'conversations' });

    expect(socket.url).toBe('ws://localhost:8081/social/events');
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: 'authenticate', accessToken: 'signed-token' });
    expect(onConnected).toHaveBeenCalledOnce();
    expect(onResource).toHaveBeenCalledWith('conversations');

    service.disconnect();
  });

  it('forwards alerts for OS notifications', () => {
    const service = new SocialEventsService();
    const onAlert = vi.fn();
    cookieUtils.set('accessToken', 'signed-token', 1);
    const alert = {
      kind: 'incomingCall',
      callId: 'call-1',
      callKind: 'session',
      callerName: 'Maya',
      conversationId: 'conversation-1',
      conversationTitle: null,
      expiresAt: '2026-10-10T12:00:00Z',
    };

    service.connect(vi.fn(), vi.fn(), onAlert);
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.receive({ type: 'authenticated' });
    socket.receive({ type: 'alert', alert });

    expect(onAlert).toHaveBeenCalledWith(alert);

    service.disconnect();
  });

  it('reconnects after an unexpected close', async () => {
    vi.useFakeTimers();
    const service = new SocialEventsService();
    cookieUtils.set('accessToken', 'signed-token', 1);
    service.connect(vi.fn(), vi.fn());

    FakeWebSocket.instances[0]!.close();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(FakeWebSocket.instances).toHaveLength(2);
    service.disconnect();
  });

  it('uses the latest stored token when reconnecting', async () => {
    vi.useFakeTimers();
    const service = new SocialEventsService();
    cookieUtils.set('accessToken', 'old-token', 1);
    service.connect(vi.fn(), vi.fn());
    FakeWebSocket.instances[0]!.close();
    cookieUtils.set('accessToken', 'fresh-token', 1);

    await vi.advanceTimersByTimeAsync(1_000);
    const socket = FakeWebSocket.instances[1]!;
    socket.open();

    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: 'authenticate', accessToken: 'fresh-token' });
    service.disconnect();
  });

  it('requests token refresh after authentication fails', () => {
    const service = new SocialEventsService();
    const listener = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('openmeet:access-token-expired', listener);
    cookieUtils.set('accessToken', 'expired-token', 1);
    service.connect(vi.fn(), vi.fn());

    FakeWebSocket.instances[0]!.receive({ type: 'error', message: 'Invalid access token' });

    expect(listener).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith('[SocialEvents] Authentication failed:', 'Invalid access token');
    window.removeEventListener('openmeet:access-token-expired', listener);
  });

  it('does not authenticate or reconnect with a stale caller token after access cookie deletion', async () => {
    vi.useFakeTimers();
    const service = new SocialEventsService();

    service.connect(vi.fn(), vi.fn());
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.close();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(socket.sent).toEqual([]);
    expect(FakeWebSocket.instances).toHaveLength(1);
    service.disconnect();
  });
});

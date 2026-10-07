import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConnectionChange, SignalingService } from '../signaling';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  sent: unknown[] = [];

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: '', wasClean: true });
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  authenticate() {
    this.onmessage?.({ data: JSON.stringify({ type: 'authenticated', protocolVersion: 2 }) });
  }

  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006, reason: '', wasClean: false });
  }
}

const latestSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;

async function connectedService() {
  const service = new SignalingService('ws://sfu.test/ws');
  const changes: ConnectionChange[] = [];
  service.onConnectionChange((change) => changes.push(change));
  const connected = service.connect();
  latestSocket().open();
  latestSocket().authenticate();
  await connected;
  return { service, changes };
}

describe('SignalingService reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports a lost session and its restoration once the new socket re-authenticates', async () => {
    const { changes } = await connectedService();

    latestSocket().drop();
    expect(changes).toEqual(['lost']);

    await vi.advanceTimersByTimeAsync(1_000);
    latestSocket().open();
    expect(changes).toEqual(['lost']);
    latestSocket().authenticate();
    await vi.advanceTimersByTimeAsync(0);

    expect(changes).toEqual(['lost', 'restored']);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('gives up after every reconnect attempt fails', async () => {
    const { changes } = await connectedService();

    latestSocket().drop();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await vi.advanceTimersByTimeAsync(1_000 * attempt);
      latestSocket().drop();
    }

    expect(changes).toEqual(['lost', 'abandoned']);
  });

  it('stays silent when the session is closed on purpose', async () => {
    const { service, changes } = await connectedService();

    service.disconnect();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(changes).toEqual([]);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

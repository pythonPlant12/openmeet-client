import { describe, expect, it, vi } from 'vitest';

import { resolveReachableTurnUrl, resolveReachableWebSocketUrl } from '../dev-networking';

describe('dev networking URL resolution', () => {
  function withBrowserHost(hostname: string, test: () => void) {
    vi.stubGlobal('window', { location: { hostname } });

    try {
      test();
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it('replaces loopback WebSocket hosts when the app is opened from a LAN host', () => {
    withBrowserHost('192.168.1.50', () => {
      expect(resolveReachableWebSocketUrl('ws://localhost:8081/ws')).toBe('ws://192.168.1.50:8081/ws');
    });
  });

  it('replaces loopback TURN hosts when the app is opened from a LAN host', () => {
    withBrowserHost('192.168.1.50', () => {
      expect(resolveReachableTurnUrl('turn:localhost:3478?transport=udp')).toBe('turn:192.168.1.50:3478?transport=udp');
    });
  });

  it('keeps production hosts unchanged', () => {
    withBrowserHost('192.168.1.50', () => {
      expect(resolveReachableWebSocketUrl('wss://sfu.openmeets.eu/ws')).toBe('wss://sfu.openmeets.eu/ws');
      expect(resolveReachableTurnUrl('turn:turn.openmeets.eu:3478')).toBe('turn:turn.openmeets.eu:3478');
    });
  });

  it('keeps localhost URLs unchanged for local browser sessions', () => {
    withBrowserHost('localhost', () => {
      expect(resolveReachableWebSocketUrl('ws://localhost:8081/ws')).toBe('ws://localhost:8081/ws');
      expect(resolveReachableTurnUrl('turn:localhost:3478')).toBe('turn:localhost:3478');
    });
  });
});

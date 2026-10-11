import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startNativeNotifications } from '@/services/native-notifications';

vi.mock('@tauri-apps/api/core', () => ({
  addPluginListener: vi.fn(),
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }));

const labels = {
  reply: 'Reply',
  replyPlaceholder: 'Message',
  send: 'Send',
  answer: 'Answer',
  decline: 'Decline',
};

describe('startNativeNotifications', () => {
  const unlistenActions = vi.fn();
  const unlistenFallback = vi.fn();

  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue({ ringsNatively: true });
    vi.mocked(listen).mockResolvedValueOnce(unlistenActions).mockResolvedValueOnce(unlistenFallback);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards iOS call fallbacks and removes both listeners on stop', async () => {
    const onCallFallback = vi.fn();
    const session = await startNativeNotifications(labels, vi.fn(), onCallFallback);

    expect(listen).toHaveBeenNthCalledWith(1, 'notification-action', expect.any(Function));
    expect(listen).toHaveBeenNthCalledWith(2, 'call-notification-fallback', expect.any(Function));
    const fallbackListener = vi.mocked(listen).mock.calls[1]![1]!;
    fallbackListener({ payload: { callId: 'call-1' } } as never);
    expect(onCallFallback).toHaveBeenCalledWith('call-1');

    session.stop();
    expect(unlistenActions).toHaveBeenCalledOnce();
    expect(unlistenFallback).toHaveBeenCalledOnce();
  });

  it('does not listen for call fallbacks when calls do not ring natively', async () => {
    vi.mocked(invoke).mockResolvedValue({ ringsNatively: false });
    const session = await startNativeNotifications(labels, vi.fn(), vi.fn());

    expect(listen).toHaveBeenCalledTimes(1);
    session.stop();
    expect(unlistenActions).toHaveBeenCalledOnce();
    expect(unlistenFallback).not.toHaveBeenCalled();
  });
});

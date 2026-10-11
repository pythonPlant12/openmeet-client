import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createScrollHaptics } from '@/components/dashboard-page/chat/scroll-haptics';
import { playHaptic } from '@/services/haptics';

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

describe('scroll haptics', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function scrollThrough(haptics: ReturnType<typeof createScrollHaptics>, tops: number[]) {
    for (const top of tops) {
      vi.advanceTimersByTime(16);
      haptics.onScroll(top);
    }
  }

  it('ticks by distance while scrolling, then lands once', () => {
    const haptics = createScrollHaptics();
    haptics.start(0);

    // 16 frames of 20px: 320px, five ticks of 64px, at most one per 40ms.
    scrollThrough(
      haptics,
      Array.from({ length: 16 }, (_, frame) => (frame + 1) * 20),
    );
    const ticks = vi.mocked(playHaptic).mock.calls.filter(([kind]) => kind === 'selection').length;
    expect(ticks).toBeGreaterThanOrEqual(4);
    expect(ticks).toBeLessThanOrEqual(5);
    expect(playHaptic).not.toHaveBeenCalledWith('light');

    vi.advanceTimersByTime(200);
    expect(playHaptic).toHaveBeenLastCalledWith('light');
    expect(vi.mocked(playHaptic).mock.calls.filter(([kind]) => kind === 'light')).toHaveLength(1);
  });

  it('ticks faster when the scroll moves faster', () => {
    const slow = createScrollHaptics();
    slow.start(0);
    scrollThrough(slow, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const slowTicks = vi.mocked(playHaptic).mock.calls.length;
    vi.clearAllMocks();
    vi.advanceTimersByTime(200);
    vi.clearAllMocks();

    const fast = createScrollHaptics();
    fast.start(0);
    scrollThrough(fast, [80, 160, 240, 320, 400, 480, 560, 640, 720, 800]);
    expect(vi.mocked(playHaptic).mock.calls.length).toBeGreaterThan(slowTicks);
  });

  it('stays silent when nothing moves or the user takes over', () => {
    const idle = createScrollHaptics();
    idle.start(500);
    vi.advanceTimersByTime(200);
    expect(playHaptic).not.toHaveBeenCalled();

    const taken = createScrollHaptics();
    taken.start(0);
    scrollThrough(taken, [30]);
    taken.cancel();
    scrollThrough(taken, [300, 600]);
    vi.advanceTimersByTime(200);
    expect(playHaptic).not.toHaveBeenCalled();
  });
});

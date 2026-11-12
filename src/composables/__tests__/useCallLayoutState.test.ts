import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCallLayoutState } from '@/composables/useCallLayoutState';
import { playHaptic } from '@/services/haptics';

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe('useCallLayoutState', () => {
  it('pins on a tile tap and unpins back to the previous layout, with a selection haptic each time', () => {
    const layout = useCallLayoutState();
    layout.setViewMode('grid');
    vi.clearAllMocks();

    layout.togglePin('ada');
    expect(layout.viewMode.value).toBe('speaker');
    expect(layout.pinnedParticipantId.value).toBe('ada');
    expect(playHaptic).toHaveBeenLastCalledWith('selection');

    layout.togglePin('ada');
    expect(layout.viewMode.value).toBe('grid');
    expect(layout.pinnedParticipantId.value).toBeNull();
    expect(playHaptic).toHaveBeenCalledTimes(2);
  });

  it('plays a selection haptic for a layout change, and none when the choice is unchanged', () => {
    const layout = useCallLayoutState();
    layout.setViewMode('speaker');
    expect(playHaptic).toHaveBeenCalledWith('selection');
    layout.setViewMode('speaker');
    expect(playHaptic).toHaveBeenCalledTimes(1);
  });

  it('follows a new screen share without a haptic, unless the person pinned someone', () => {
    const layout = useCallLayoutState();
    layout.setViewMode('grid');
    vi.clearAllMocks();

    layout.followScreenShare();
    expect(layout.viewMode.value).toBeNull();

    layout.togglePin('ada');
    vi.clearAllMocks();
    layout.followScreenShare();
    expect(layout.pinnedParticipantId.value).toBe('ada');
    expect(playHaptic).not.toHaveBeenCalled();
  });

  it('drops the pin of someone who left without a haptic', () => {
    const layout = useCallLayoutState();
    layout.togglePin('ada');
    vi.clearAllMocks();

    layout.keepPinAmong(['me', 'bob']);
    expect(layout.pinnedParticipantId.value).toBeNull();
    expect(layout.viewMode.value).toBeNull();
    expect(playHaptic).not.toHaveBeenCalled();
  });
});

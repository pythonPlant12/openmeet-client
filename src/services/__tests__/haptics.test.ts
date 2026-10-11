import { afterEach, describe, expect, it, vi } from 'vitest';

import { playHaptic } from '@/services/haptics';

const tauri = vi.hoisted(() => ({ isTauri: vi.fn(() => false), invoke: vi.fn(() => Promise.resolve()) }));
vi.mock('@tauri-apps/api/core', () => tauri);

describe('haptics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    tauri.isTauri.mockReturnValue(false);
  });

  it('asks the native app to play feedback', () => {
    tauri.isTauri.mockReturnValue(true);
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    playHaptic('medium');

    expect(tauri.invoke).toHaveBeenCalledWith('trigger_haptic', { feedback: 'medium' });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('falls back to the Vibration API in browsers', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    playHaptic('success');

    expect(tauri.invoke).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledWith([10, 60, 10]);
  });

  it('does nothing in browsers without vibration', () => {
    vi.stubGlobal('navigator', {});

    expect(() => playHaptic('selection')).not.toThrow();
  });
});

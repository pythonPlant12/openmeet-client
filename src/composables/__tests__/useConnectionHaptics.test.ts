import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EffectScope, effectScope, nextTick, ref } from 'vue';

const haptics = vi.hoisted(() => ({ playHaptic: vi.fn() }));
vi.mock('@/services/haptics', () => haptics);

const { useConnectionHaptics } = await import('@/composables/useConnectionHaptics');

describe('useConnectionHaptics', () => {
  let scope: EffectScope;

  afterEach(() => {
    scope.stop();
    haptics.playHaptic.mockReset();
  });

  function setUp() {
    scope = effectScope();
    const isReconnecting = ref(false);
    const connectionState = ref<RTCPeerConnectionState | null>('connected');
    scope.run(() => useConnectionHaptics(isReconnecting, connectionState));
    return { isReconnecting, connectionState };
  }

  it('plays an error haptic when the connection is lost', async () => {
    const { isReconnecting } = setUp();
    isReconnecting.value = true;
    await nextTick();
    expect(haptics.playHaptic).toHaveBeenCalledExactlyOnceWith('error');

    isReconnecting.value = false;
    await nextTick();
    expect(haptics.playHaptic).toHaveBeenCalledTimes(1);
  });

  it('plays an error haptic when reconnecting fails', async () => {
    const { connectionState } = setUp();
    connectionState.value = 'failed';
    await nextTick();
    expect(haptics.playHaptic).toHaveBeenCalledExactlyOnceWith('error');
  });

  it('stays quiet while the connection is set up', async () => {
    const { connectionState } = setUp();
    connectionState.value = 'connecting';
    await nextTick();
    connectionState.value = 'connected';
    await nextTick();
    expect(haptics.playHaptic).not.toHaveBeenCalled();
  });
});

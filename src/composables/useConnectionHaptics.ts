import { type Ref, watch } from 'vue';

import { playHaptic } from '@/services/haptics';

/** An `error` haptic when the call's connection is lost, and again when reconnecting fails. */
export function useConnectionHaptics(
  isReconnecting: Ref<boolean>,
  connectionState: Ref<RTCPeerConnectionState | null | undefined>,
) {
  watch(isReconnecting, (reconnecting) => {
    if (reconnecting) playHaptic('error');
  });
  watch(connectionState, (state) => {
    if (state === 'failed') playHaptic('error');
  });
}

import { useWindowSize } from '@vueuse/core';
import { computed } from 'vue';

import { callFormFactor } from '@/lib/meeting-layout';

/** The call screen's form factor (phone portrait, phone landscape, desktop), following the window's size. */
export function useCallFormFactor() {
  const { width, height } = useWindowSize();
  return computed(() => callFormFactor(width.value, height.value));
}

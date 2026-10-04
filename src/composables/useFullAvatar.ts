import { onBeforeUnmount, ref, watch } from 'vue';

import { socialApi } from '@/services/social-api';

// Loads the full-size avatar only while a preview is open; callers show the thumbnail until it arrives.
export function useFullAvatar(source: () => string | null | undefined, active: () => boolean) {
  const url = ref<string | null>(null);
  let loadedSource: string | null = null;
  let request = 0;

  function release() {
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = null;
    loadedSource = null;
  }

  watch(
    [source, active],
    async ([path, isActive]) => {
      if (!path || path !== loadedSource) {
        request += 1;
        release();
      }
      if (!path || !isActive || loadedSource === path) return;

      const currentRequest = ++request;
      try {
        const avatar = await socialApi.loadAvatar('', path, 'full');
        if (currentRequest !== request) return;
        url.value = URL.createObjectURL(avatar);
        loadedSource = path;
      } catch (error) {
        console.error('[useFullAvatar] Failed to load full avatar:', error);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    request += 1;
    release();
  });

  return url;
}

import { useEventListener } from '@vueuse/core';
import { type Ref, computed, onScopeDispose, ref, watch } from 'vue';

/** In full screen the controls hide after this long without mouse movement. */
export const AUTO_HIDE_MS = 3000;

/**
 * Full screen controls: shown on entering full screen and on any mouse movement, hidden after `AUTO_HIDE_MS`
 * without one. An open menu keeps them, since menus open from the controls. Outside full screen they always show.
 * Menus open in portals outside the page, so the document is watched rather than the page.
 */
export function useAutoHideControls(enabled: Ref<boolean>) {
  const isRevealed = ref(false);
  let timer: number | undefined;

  function scheduleHide() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (document.querySelector('[role="menu"]')) scheduleHide();
      else isRevealed.value = false;
    }, AUTO_HIDE_MS);
  }

  /** `autoHide` false keeps them until `hide`, for a touch swipe that has no mouse movement to bring them back. */
  function show(autoHide = true) {
    if (!enabled.value) return;
    isRevealed.value = true;
    window.clearTimeout(timer);
    if (autoHide) scheduleHide();
  }

  function hide() {
    window.clearTimeout(timer);
    isRevealed.value = false;
  }

  watch(
    enabled,
    (active) => {
      if (active) show();
      else hide();
    },
    { immediate: true },
  );

  useEventListener(
    document,
    'pointermove',
    (event: PointerEvent) => {
      if (event.pointerType === 'mouse') show();
    },
    { passive: true },
  );

  onScopeDispose(() => window.clearTimeout(timer));

  return { shown: computed(() => !enabled.value || isRevealed.value), show, hide };
}

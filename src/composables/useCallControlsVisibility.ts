import { useEventListener } from '@vueuse/core';
import { type Ref, computed, onScopeDispose, ref, watch } from 'vue';

/** On desktop the call controls hide after this long without mouse movement. */
export const AUTO_HIDE_MS = 3000;

/** While any of these is open the controls stay, since menus, sheets, the chat, and the panel open from them. */
const HOLD_SELECTOR =
  '[role="menu"], [role="dialog"], .harbor-chat-panel[data-state="open"], [data-call-phone-controls][data-state="open"]';
const isHeld = () => !!document.querySelector(HOLD_SELECTOR);

/**
 * Whether the call controls (top bar, controls bar, "Add people" card, and full name tags) are shown.
 * With `autoHide` (desktop) they show on any mouse movement and hide after `AUTO_HIDE_MS` without one. Without it
 * (phones) they stay until a long-press toggles them. Menus open in portals outside the page, so the document is
 * watched rather than the page.
 */
export function useCallControlsVisibility(autoHide: Ref<boolean>) {
  const isShown = ref(true);
  let timer: number | undefined;

  function scheduleHide() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (isHeld()) scheduleHide();
      else isShown.value = false;
    }, AUTO_HIDE_MS);
  }

  function show() {
    isShown.value = true;
    if (autoHide.value) scheduleHide();
    else window.clearTimeout(timer);
  }

  function hide() {
    window.clearTimeout(timer);
    isShown.value = false;
  }

  /** A long-press on the video area. */
  function toggle() {
    if (isShown.value) {
      if (!isHeld()) hide();
    } else show();
  }

  watch(autoHide, () => show(), { immediate: true });

  useEventListener(
    document,
    'pointermove',
    (event: PointerEvent) => {
      if (autoHide.value && event.pointerType === 'mouse') show();
    },
    { passive: true },
  );

  onScopeDispose(() => window.clearTimeout(timer));

  return { shown: computed(() => isShown.value), show, hide, toggle };
}

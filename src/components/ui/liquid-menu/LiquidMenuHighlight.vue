<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * One liquid bubble per menu that glides to the highlighted item (pointer or keyboard), or to the trigger of an
 * open submenu, and presses in while an item is held. Place it as the first child of a positioned menu content;
 * it watches its parent, so menu items need no changes.
 */
const bubbleRef = ref<HTMLElement | null>(null);
// The last box stays while nothing is highlighted (for example while the pointer crosses from one submenu
// trigger to the next), so the bubble fades in place and then glides on instead of jumping from the corner.
const box = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const isVisible = ref(false);
const tone = ref<'default' | 'danger'>('default');
const isPressed = ref(false);
// The first placement jumps into place; later ones glide from the previous item.
const hasPlaced = ref(false);
// Crossing between items leaves a brief moment with nothing highlighted; waiting this long before fading
// lets the bubble glide straight on.
const HIDE_DELAY_MS = 120;
let hideTimer: number | undefined;
let observer: MutationObserver | undefined;
let container: HTMLElement | null = null;

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

function targetItem() {
  if (!container) return null;
  const items = [...container.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].filter(
    // Submenus open in their own portals, but nested menus inside this content belong to someone else.
    (item) => item.closest('[role="menu"]') === container,
  );
  return (
    items.find((item) => item.hasAttribute('data-highlighted')) ??
    items.find((item) => item.getAttribute('aria-haspopup') === 'menu' && item.dataset.state === 'open') ??
    null
  );
}

function place() {
  const item = targetItem();
  if (!item) {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => (isVisible.value = false), HIDE_DELAY_MS);
    return;
  }
  window.clearTimeout(hideTimer);
  // Items may sit inside wrappers, so their box is measured against the menu, including its scroll. The menu
  // may still be zooming in, so screen distances are scaled back to its own size.
  const menu = container!;
  const menuRect = menu.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const scale = menu.offsetWidth ? menuRect.width / menu.offsetWidth || 1 : 1;
  box.value = {
    top: (itemRect.top - menuRect.top) / scale - menu.clientTop + menu.scrollTop,
    left: (itemRect.left - menuRect.left) / scale - menu.clientLeft + menu.scrollLeft,
    width: item.offsetWidth,
    height: item.offsetHeight,
  };
  tone.value = item.matches('.harbor-context-menu-danger, [data-menu-tone="danger"]') ? 'danger' : 'default';
  isVisible.value = true;
  if (!hasPlaced.value) requestAnimationFrame(() => (hasPlaced.value = true));
}

function handlePointerDown(event: PointerEvent) {
  if ((event.target as Element | null)?.closest(ITEM_SELECTOR)) isPressed.value = true;
}

function handlePointerUp() {
  isPressed.value = false;
}

onMounted(() => {
  container = bubbleRef.value?.parentElement ?? null;
  if (!container) return;
  observer = new MutationObserver(place);
  observer.observe(container, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-highlighted', 'data-state'],
  });
  container.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointerup', handlePointerUp);
  place();
});

onUnmounted(() => {
  window.clearTimeout(hideTimer);
  observer?.disconnect();
  container?.removeEventListener('pointerdown', handlePointerDown);
  window.removeEventListener('pointerup', handlePointerUp);
});
</script>

<template>
  <span
    ref="bubbleRef"
    class="liquid-menu-bubble"
    :data-visible="isVisible ? 'true' : undefined"
    :data-tone="tone"
    :data-pressed="isPressed ? 'true' : undefined"
    :data-gliding="hasPlaced ? 'true' : undefined"
    :style="
      box
        ? {
            width: `${box.width}px`,
            height: `${box.height}px`,
            transform: `translate(${box.left}px, ${box.top}px)`,
          }
        : undefined
    "
    aria-hidden="true"
  />
</template>

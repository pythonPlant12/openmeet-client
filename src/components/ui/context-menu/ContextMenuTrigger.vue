<script setup lang="ts">
import type { ContextMenuTriggerProps } from 'reka-ui';
import { ContextMenuTrigger, useForwardProps } from 'reka-ui';

const props = defineProps<ContextMenuTriggerProps>();
const forwarded = useForwardProps(props);

function handleContextKey(event: KeyboardEvent) {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  event.preventDefault();
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const bounds = target.getBoundingClientRect();
  target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }),
  );
}
</script>

<template>
  <ContextMenuTrigger v-bind="forwarded" @keydown="handleContextKey">
    <slot />
  </ContextMenuTrigger>
</template>

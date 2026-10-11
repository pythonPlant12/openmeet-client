<script setup lang="ts">
import type { ContextMenuRootEmits, ContextMenuRootProps } from 'reka-ui';
import { ContextMenuRoot, useForwardPropsEmits } from 'reka-ui';

import { playHaptic } from '@/services/haptics';

const props = defineProps<ContextMenuRootProps>();
const emits = defineEmits<ContextMenuRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);

function handleOpenChange(open: boolean) {
  if (open) playHaptic('medium');
}
</script>

<template>
  <ContextMenuRoot v-bind="forwarded" @update:open="handleOpenChange">
    <slot />
  </ContextMenuRoot>
</template>

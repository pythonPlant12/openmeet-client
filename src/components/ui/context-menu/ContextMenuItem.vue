<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { ContextMenuItemProps } from 'reka-ui';
import { ContextMenuItem, useForwardProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuItemProps & { class?: HTMLAttributes['class']; inset?: boolean }>();
const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ContextMenuItem
    v-bind="forwarded"
    :class="
      cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
        inset && 'pl-8',
        props.class,
      )
    "
  >
    <slot />
  </ContextMenuItem>
</template>

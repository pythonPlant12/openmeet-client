<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { ContextMenuItemProps } from 'reka-ui';
import { ContextMenuItem, useForwardProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<
  ContextMenuItemProps & {
    class?: HTMLAttributes['class'];
    inset?: boolean;
    /** `danger` paints a destructive action red. */
    variant?: 'default' | 'danger';
  }
>();
const delegatedProps = reactiveOmit(props, 'class', 'variant');
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ContextMenuItem
    v-bind="forwarded"
    :class="
      cn(
        'harbor-menu-item relative flex select-none items-center outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        variant === 'danger' && 'harbor-context-menu-danger',
        inset && 'pl-8',
        props.class,
      )
    "
  >
    <slot />
  </ContextMenuItem>
</template>

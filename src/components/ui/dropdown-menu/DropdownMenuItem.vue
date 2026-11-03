<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { DropdownMenuItemProps } from 'reka-ui';
import { DropdownMenuItem, useForwardProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<
  DropdownMenuItemProps & {
    class?: HTMLAttributes['class'];
    inset?: boolean;
    /** `danger` paints a destructive action red. */
    variant?: 'default' | 'danger';
  }
>();

const delegatedProps = reactiveOmit(props, 'class', 'variant');

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <DropdownMenuItem
    v-bind="forwardedProps"
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
  </DropdownMenuItem>
</template>

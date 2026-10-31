<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from 'reka-ui';
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import LiquidMenuHighlight from '@/components/ui/liquid-menu/LiquidMenuHighlight.vue';
import { cn } from '@/lib/utils';

// The portal is the root, so attributes such as data-* go onto the content element itself.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DropdownMenuContentProps & { class?: HTMLAttributes['class'] }>(), {
  sideOffset: 4,
  // Every menu flips or shifts to stay this far inside the viewport, and scrolls when taller than it.
  collisionPadding: 12,
  // Shifting keeps the whole menu on screen, even when its trigger sits at an edge.
  sticky: 'always',
});
const emits = defineEmits<DropdownMenuContentEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'liquid-menu relative z-[2000] max-h-[var(--reka-dropdown-menu-content-available-height)] max-w-[var(--reka-dropdown-menu-content-available-width)] min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=bottom]:slide-out-to-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in data-[state=open]:fill-mode-both data-[state=closed]:fill-mode-both motion-reduce:animate-none',
          props.class,
        )
      "
    >
      <LiquidMenuHighlight />
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

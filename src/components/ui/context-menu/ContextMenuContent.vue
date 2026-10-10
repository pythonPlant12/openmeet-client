<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { ContextMenuContentEmits, ContextMenuContentProps } from 'reka-ui';
import { ContextMenuContent, ContextMenuPortal, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

// The portal is the root, so attributes such as data-* go onto the menu element itself.
defineOptions({ inheritAttrs: false });

// Like DropdownMenuContent: stay inside the viewport and scroll when taller than it.
const props = withDefaults(defineProps<ContextMenuContentProps & { class?: HTMLAttributes['class'] }>(), {
  collisionPadding: 12,
});
const emits = defineEmits<ContextMenuContentEmits>();
const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'z-[2000] max-h-[var(--reka-context-menu-content-available-height)] max-w-[var(--reka-context-menu-content-available-width)] min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in data-[state=open]:fill-mode-both data-[state=closed]:fill-mode-both motion-reduce:animate-none',
          props.class,
        )
      "
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>

<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { DropdownMenuSubContentEmits, DropdownMenuSubContentProps } from 'reka-ui';
import { DropdownMenuPortal, DropdownMenuSubContent, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

// The portal is the root, so attributes such as data-* go onto the content element itself.
defineOptions({ inheritAttrs: false });

// Like DropdownMenuContent: stay inside the viewport and scroll when taller than it.
const props = withDefaults(defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes['class'] }>(), {
  collisionPadding: 12,
});
const emits = defineEmits<DropdownMenuSubContentEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <!-- Portalled like DropdownMenuContent: inside the parent menu it would be clipped by its overflow and transform. -->
  <DropdownMenuPortal>
    <DropdownMenuSubContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'z-[2000] max-h-[var(--reka-dropdown-menu-content-available-height)] max-w-[var(--reka-dropdown-menu-content-available-width)] min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          props.class,
        )
      "
    >
      <slot />
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>

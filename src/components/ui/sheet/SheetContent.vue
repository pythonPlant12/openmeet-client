<script setup lang="ts">
import type { SheetVariants } from '.';
import { sheetVariants } from '.';
import { reactiveOmit } from '@vueuse/core';
import { X } from 'lucide-vue-next';
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '@/lib/utils';

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes['class'];
  showOverlay?: boolean;
  side?: SheetVariants['side'];
}

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<SheetContentProps>(), { showOverlay: true });

const emits = defineEmits<DialogContentEmits>();
const { t } = useI18n();

const delegatedProps = reactiveOmit(props, 'class', 'showOverlay', 'side');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      v-if="showOverlay"
      class="fixed inset-0 z-50 bg-black/80 sm:bg-transparent data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent :class="cn(sheetVariants({ side }), props.class)" v-bind="{ ...forwarded, ...$attrs }">
      <slot />

      <DialogClose
        class="harbor-round-button absolute right-3 top-3 size-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle disabled:pointer-events-none [&_svg]:size-[1.125rem]"
      >
        <X class="w-4 h-4" />
        <span class="sr-only">{{ t('common.close') }}</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>

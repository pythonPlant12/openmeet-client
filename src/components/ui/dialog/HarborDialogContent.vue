<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

import DialogContent from './DialogContent.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  class?: HTMLAttributes['class'];
  overlayClass?: HTMLAttributes['class'];
  hideClose?: boolean;
}>();
</script>

<template>
  <DialogContent
    v-bind="$attrs"
    :class="cn('harbor-dialog-content', props.class)"
    :overlay-class="cn('harbor-dialog-overlay', props.overlayClass)"
    :hide-close="props.hideClose"
  >
    <slot />
  </DialogContent>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
  <!-- Harbor dialog footer: 24px below the content (with the content's 16px gap), the primary action on top on
       phones and on the right on wider screens. -->
  <div :class="cn('flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end', props.class)">
    <slot />
  </div>
</template>

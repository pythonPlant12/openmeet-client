<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = withDefaults(defineProps<{ as?: string; class?: HTMLAttributes['class'] }>(), { as: 'h3' });
</script>

<template>
  <!-- A bold section title over a list, such as "Recent" or "Requests", with an optional action on the right. -->
  <div :class="cn('flex items-center justify-between gap-3 px-3 pb-1 pt-4', props.class)">
    <component :is="as" class="text-lg font-bold text-harbor-ink"><slot /></component>
    <slot name="action" />
  </div>
</template>

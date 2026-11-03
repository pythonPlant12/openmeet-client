<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
  <!-- A white pill of round actions; its buttons get the gray hover from `harbor-round-group`. -->
  <div role="group" :class="cn('harbor-round-group', props.class)">
    <slot />
  </div>
</template>

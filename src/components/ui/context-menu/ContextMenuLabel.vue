<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core';
import type { ContextMenuLabelProps } from 'reka-ui';
import { ContextMenuLabel, useForwardProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<ContextMenuLabelProps & { class?: HTMLAttributes['class']; inset?: boolean }>();
const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ContextMenuLabel v-bind="forwarded" :class="cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', props.class)">
    <slot />
  </ContextMenuLabel>
</template>

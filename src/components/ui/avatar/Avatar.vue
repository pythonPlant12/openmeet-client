<script setup lang="ts">
import type { AvatarSize } from '.';
import type { HTMLAttributes } from 'vue';

import { LoadingRipple } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<{
    src?: string | null;
    /** Shown when there is no picture and no fallback slot. */
    initials?: string;
    loading?: boolean;
    size?: AvatarSize;
    class?: HTMLAttributes['class'];
  }>(),
  { size: 'lg' },
);

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-7 text-[10px] [&_svg]:size-3.5',
  sm: 'size-8 text-xs [&_svg]:size-4',
  md: 'size-10 text-sm [&_svg]:size-5',
  lg: 'size-12 text-sm [&_svg]:size-6',
};
</script>

<template>
  <!-- A round picture with a gray disc behind it: a loading ripple, then the fallback icon or initials. -->
  <span
    :class="
      cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-harbor-avatar font-semibold text-harbor-icon',
        SIZES[size],
        props.class,
      )
    "
    ><img v-if="src" :src="src" alt="" class="size-full object-cover" /><LoadingRipple
      v-else-if="loading"
      class="!size-4"
    /><slot v-else>{{ initials }}</slot></span
  >
</template>

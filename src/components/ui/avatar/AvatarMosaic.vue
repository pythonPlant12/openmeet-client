<script setup lang="ts">
import type { AvatarSize } from '.';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';

import { cn } from '@/lib/utils';

export interface MosaicFace {
  src?: string | null;
  initials: string;
}

const props = withDefaults(defineProps<{ faces: MosaicFace[]; size?: AvatarSize; class?: HTMLAttributes['class'] }>(), {
  size: 'lg',
});

// Matches `Avatar`, so a mosaic lines up with single avatars in the same list.
const SIZES: Record<AvatarSize, string> = {
  xs: 'size-7 text-[8px]',
  sm: 'size-8 text-[9px]',
  md: 'size-10 text-[10px]',
  lg: 'size-12 text-[11px]',
};

const tiles = computed(() => props.faces.slice(0, 4));
</script>

<template>
  <!-- Up to four faces in one circle: halves for two, a half and two quarters for three, quarters for four. -->
  <span
    :class="
      cn(
        'grid shrink-0 gap-px overflow-hidden rounded-full bg-harbor-surface font-semibold text-harbor-icon',
        tiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
        tiles.length > 2 ? 'grid-rows-2' : 'grid-rows-1',
        SIZES[size],
        props.class,
      )
    "
  >
    <span
      v-for="(face, index) in tiles"
      :key="index"
      data-mosaic-tile
      class="flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-harbor-avatar"
      :class="{ 'row-span-2': tiles.length === 3 && index === 0 }"
      ><img v-if="face.src" :src="face.src" alt="" class="size-full object-cover" /><template v-else>{{
        face.initials
      }}</template></span
    >
  </span>
</template>

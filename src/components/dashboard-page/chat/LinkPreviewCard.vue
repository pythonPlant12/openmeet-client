<script setup lang="ts">
import { computed } from 'vue';

import { useLinkPreview } from '@/composables/useLinkPreview';

const props = defineProps<{ url: string; local: boolean }>();

const { preview, imageUrl } = useLinkPreview(computed(() => props.url));
</script>

<template>
  <a
    v-if="preview"
    data-link-preview
    :href="url"
    target="_blank"
    rel="noopener noreferrer nofollow"
    class="mt-1.5 block overflow-hidden rounded-xl transition-colors"
    :class="
      local
        ? 'bg-white/[0.14] text-white [@media(hover:hover)]:hover:bg-white/20'
        : 'bg-[#F1F4F3] text-[#102F35] [@media(hover:hover)]:hover:bg-[#EAEFED]'
    "
  >
    <img v-if="imageUrl" :src="imageUrl" alt="" class="aspect-[1.91/1] max-h-44 w-full object-cover" />
    <span class="block border-l-[3px] px-2.5 py-2" :class="local ? 'border-white/60' : 'border-[#0B7A75]'">
      <span
        v-if="preview.siteName"
        class="block truncate text-[0.6875rem] font-semibold"
        :class="local ? 'text-white/80' : 'text-[#0B7A75]'"
        >{{ preview.siteName }}</span
      >
      <span v-if="preview.title" class="line-clamp-2 block text-sm font-semibold leading-snug">{{
        preview.title
      }}</span>
      <span
        v-if="preview.description"
        class="mt-0.5 line-clamp-2 block text-xs leading-snug"
        :class="local ? 'text-white/80' : 'text-[#4E6B70]'"
        >{{ preview.description }}</span
      >
    </span>
  </a>
</template>

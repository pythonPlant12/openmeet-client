<script setup lang="ts">
import { computed } from 'vue';

import { useLinkPreview } from '@/composables/useLinkPreview';

const props = defineProps<{ url: string }>();

const { preview, imageUrl } = useLinkPreview(computed(() => props.url));
</script>

<template>
  <a
    v-if="preview"
    data-link-preview
    :href="url"
    target="_blank"
    rel="noopener noreferrer nofollow"
    class="mt-1.5 block overflow-hidden rounded-xl bg-harbor-ink/[0.05] text-harbor-ink transition-colors [@media(hover:hover)]:hover:bg-harbor-ink/[0.08]"
  >
    <img v-if="imageUrl" :src="imageUrl" alt="" class="aspect-[1.91/1] max-h-44 w-full object-cover" />
    <span class="block border-l-[3px] border-harbor-accent px-2.5 py-2">
      <span v-if="preview.siteName" class="block truncate text-[0.6875rem] font-semibold text-harbor-accent">{{
        preview.siteName
      }}</span>
      <span v-if="preview.title" class="line-clamp-2 block text-sm font-semibold leading-snug">{{
        preview.title
      }}</span>
      <span v-if="preview.description" class="mt-0.5 line-clamp-2 block text-xs leading-snug text-harbor-icon">{{
        preview.description
      }}</span>
    </span>
  </a>
</template>

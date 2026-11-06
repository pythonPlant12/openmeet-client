<script setup lang="ts">
import { Link2 } from 'lucide-vue-next';
import { computed } from 'vue';

import { useLinkPreview } from '@/composables/useLinkPreview';

// One shared link: its page title and picture when the preview loads, else the address alone.
const props = defineProps<{ href: string; text: string; meta: string }>();

const { preview, imageUrl } = useLinkPreview(computed(() => props.href));
const host = computed(() => {
  try {
    return new URL(props.href).hostname.replace(/^www\./, '');
  } catch {
    return props.text;
  }
});
</script>

<template>
  <a
    data-shared-link
    :href="href"
    target="_blank"
    rel="noopener noreferrer nofollow"
    class="flex min-w-0 items-center gap-3 rounded-xl p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle [@media(hover:hover)]:hover:bg-harbor-hover"
  >
    <span
      class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-harbor-hover text-harbor-accent"
    >
      <img v-if="imageUrl" :src="imageUrl" alt="" class="size-full object-cover" />
      <Link2 v-else class="size-5" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold text-harbor-ink">{{ preview?.title || host }}</span>
      <span class="block truncate text-xs text-harbor-accent">{{ text }}</span>
      <span class="block truncate text-xs text-harbor-muted">{{ meta }}</span>
    </span>
  </a>
</template>

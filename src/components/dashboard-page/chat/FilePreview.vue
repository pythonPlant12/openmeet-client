<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-vue-next';
import { computed } from 'vue';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ConversationMessageAttachment } from '@/services/social-api';

const props = defineProps<{
  attachments: ConversationMessageAttachment[];
  activeIndex: number;
  attachmentUrls: Record<string, string>;
}>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'update:activeIndex', index: number): void;
}>();

const activeAttachment = computed(() => props.attachments[props.activeIndex]);
const activeUrl = computed(() =>
  activeAttachment.value ? props.attachmentUrls[activeAttachment.value.url] : undefined,
);
const isImage = computed(() => activeAttachment.value?.contentType.startsWith('image/'));
const isVideo = computed(() => activeAttachment.value?.contentType.startsWith('video/'));
const isPdf = computed(() => activeAttachment.value?.contentType === 'application/pdf');
const hasPrevious = computed(() => props.activeIndex > 0);
const hasNext = computed(() => props.activeIndex < props.attachments.length - 1);
let touchStartX: number | null = null;

function move(offset: number) {
  const index = props.activeIndex + offset;
  if (index >= 0 && index < props.attachments.length) emit('update:activeIndex', index);
}

function handlePointerDown(event: PointerEvent) {
  touchStartX = event.clientX;
}

function handlePointerUp(event: PointerEvent) {
  if (touchStartX === null) return;
  const distance = event.clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(distance) < 48) return;
  move(distance < 0 ? 1 : -1);
}
</script>

<template>
  <Dialog :open="attachments.length > 0" @update:open="(open) => !open && emit('close')">
    <DialogContent
      hide-close
      class="flex h-[min(80dvh,48rem)] max-w-5xl flex-col overflow-hidden border-[#D8E7E3] bg-white p-0 text-[#102F35]"
    >
      <header class="flex min-h-14 items-center gap-3 border-b border-[#E5EFEC] px-5">
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ activeAttachment?.fileName }}</span>
        <a
          v-if="activeUrl && activeAttachment"
          :href="activeUrl"
          :download="activeAttachment.fileName"
          class="harbor-ghost-action flex size-9 items-center justify-center rounded-full text-[#0B7A75]"
          aria-label="Download attachment"
          title="Download"
          ><Download class="size-4"
        /></a>
        <button
          type="button"
          class="harbor-ghost-action flex size-9 items-center justify-center rounded-full text-[#27595D]"
          aria-label="Close preview"
          title="Close"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
      </header>
      <div
        class="relative flex min-h-0 flex-1 items-center justify-center bg-[#102F35] p-4"
        @pointerdown="handlePointerDown"
        @pointerup="handlePointerUp"
      >
        <img
          v-if="isImage && activeUrl"
          :src="activeUrl"
          :alt="activeAttachment?.fileName"
          class="max-h-full max-w-full object-contain"
        />
        <video v-else-if="isVideo && activeUrl" :src="activeUrl" controls playsinline class="max-h-full max-w-full" />
        <iframe
          v-else-if="isPdf && activeUrl"
          :src="activeUrl"
          :title="activeAttachment?.fileName"
          class="size-full rounded-lg bg-white"
        />
        <div v-else class="flex flex-col items-center gap-3 text-center text-white/75">
          <FileText class="size-10" /><span>Preview unavailable</span>
        </div>
        <button
          v-if="hasPrevious"
          type="button"
          class="absolute left-3 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#0B7A75] shadow-sm"
          aria-label="Previous attachment"
          @click="move(-1)"
        >
          <ChevronLeft />
        </button>
        <button
          v-if="hasNext"
          type="button"
          class="absolute right-3 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#0B7A75] shadow-sm"
          aria-label="Next attachment"
          @click="move(1)"
        >
          <ChevronRight />
        </button>
      </div>
      <footer class="flex min-h-14 items-center gap-3 border-t border-[#E5EFEC] px-5 text-sm">
        <span class="flex-1 text-[#61777B]">{{ activeIndex + 1 }} of {{ attachments.length }}</span>
      </footer>
    </DialogContent>
  </Dialog>
</template>

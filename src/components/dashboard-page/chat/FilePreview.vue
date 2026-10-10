<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-vue-next';
import { computed } from 'vue';

import { Dialog, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
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
    <HarborDialogContent
      hide-close
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font flex h-[min(82dvh,48rem)] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-0 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)]"
    >
      <DialogTitle class="sr-only">Media preview</DialogTitle>
      <header class="flex min-h-14 items-center gap-3 border-b border-[#E5EFEC] px-4 sm:px-5">
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
        class="relative flex min-h-0 flex-1 items-center justify-center bg-white p-3 sm:p-4"
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
        <div v-else class="flex flex-col items-center gap-3 text-center text-[#61777B]">
          <FileText class="size-10" /><span>Preview unavailable</span>
        </div>
        <button
          v-if="hasPrevious"
          type="button"
          class="harbor-ghost-action absolute left-3 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#0B7A75] shadow-sm"
          aria-label="Previous attachment"
          @click="move(-1)"
        >
          <ChevronLeft />
        </button>
        <button
          v-if="hasNext"
          type="button"
          class="harbor-ghost-action absolute right-3 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#0B7A75] shadow-sm"
          aria-label="Next attachment"
          @click="move(1)"
        >
          <ChevronRight />
        </button>
      </div>
      <footer class="border-t border-[#E5EFEC] bg-[#FBFCF8] px-4 py-3 sm:px-5">
        <div class="mb-2 flex items-center gap-3 text-sm">
          <span class="flex-1 text-[#61777B]">{{ activeIndex + 1 }} of {{ attachments.length }}</span>
        </div>
        <div v-if="attachments.length > 1" class="flex gap-2 overflow-x-auto pb-1" aria-label="Media list" role="list">
          <div v-for="(attachment, index) in attachments" :key="attachment.id" role="listitem">
            <button
              type="button"
              class="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-[#0B7A75] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              :class="
                index === activeIndex
                  ? 'border-[#0B7A75] bg-[#E6F4F1] ring-2 ring-[#0B7A75]/20'
                  : 'border-[#D8E7E3] bg-white'
              "
              :aria-label="`Show ${attachment.fileName}`"
              :aria-current="index === activeIndex ? 'true' : undefined"
              @click="emit('update:activeIndex', index)"
            >
              <img
                v-if="attachment.contentType.startsWith('image/') && attachmentUrls[attachment.url]"
                :src="attachmentUrls[attachment.url]"
                :alt="attachment.fileName"
                class="size-full object-cover"
              />
              <FileText v-else class="size-5" />
            </button>
          </div>
        </div>
      </footer>
    </HarborDialogContent>
  </Dialog>
</template>

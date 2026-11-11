<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core';
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref, watch } from 'vue';

import { Dialog, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import { RoundButton } from '@/components/ui/round-button';
import { useHorizontalSwipe } from '@/composables/useHorizontalSwipe';
import { usePinchZoom } from '@/composables/usePinchZoom';
import type { ConversationMessageAttachment } from '@/services/social-api';

const props = defineProps<{
  attachments: ConversationMessageAttachment[];
  activeIndex: number;
  attachmentUrls: Record<string, string>;
  /** Kept for callers; the viewer always opens above raised dialogs and the navigation bars. */
  elevated?: boolean;
}>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'update:activeIndex', index: number): void;
}>();

const stageRef = ref<HTMLElement | null>(null);
const mediaRef = ref<HTMLImageElement | null>(null);
// Where the last press on the stage started; a drag that ends there is not a backdrop click.
let pressStart: { x: number; y: number } | null = null;
const CLICK_SLOP = 10;
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
// The direction of the last move, so the next item slides in from the side the user swiped toward.
const direction = ref<1 | -1>(1);

const activeAttachment = computed(() => props.attachments[props.activeIndex]);
const activeUrl = computed(() =>
  activeAttachment.value ? props.attachmentUrls[activeAttachment.value.url] : undefined,
);
const isImage = computed(() => activeAttachment.value?.contentType.startsWith('image/') ?? false);
const isVideo = computed(() => activeAttachment.value?.contentType.startsWith('video/'));
const isPdf = computed(() => activeAttachment.value?.contentType === 'application/pdf');
const hasPrevious = computed(() => props.activeIndex > 0);
const hasNext = computed(() => props.activeIndex < props.attachments.length - 1);

const { zoom, isZoomed, reset } = usePinchZoom(stageRef, {
  disabled: () => !isImage.value,
  media: () => mediaRef.value,
});
const imageTransform = computed(() => `translate(${zoom.value.x}px, ${zoom.value.y}px) scale(${zoom.value.scale})`);

function move(offset: 1 | -1) {
  const index = props.activeIndex + offset;
  if (index < 0 || index >= props.attachments.length) return;
  direction.value = offset;
  emit('update:activeIndex', index);
}

useHorizontalSwipe(stageRef, {
  onSwipe: (swipe) => move(swipe === 'next' ? 1 : -1),
  disabled: () => isZoomed.value || props.attachments.length < 2,
});

watch(() => props.activeIndex, reset);

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'ArrowRight') move(1);
  else if (event.key === 'ArrowLeft') move(-1);
});

function handleStagePointerDown(event: PointerEvent) {
  pressStart = { x: event.clientX, y: event.clientY };
}

// Only a press and release in place on the empty backdrop closes; presses on the media zoom, pan, or swipe,
// and a mouse drag that ends on the backdrop still fires a click.
function handleStageClick(event: MouseEvent) {
  const moved = pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > CLICK_SLOP;
  pressStart = null;
  if (event.target === event.currentTarget && !moved) emit('close');
}

// Each item slides in from the side it was swiped toward and pops up slightly, like the avatar preview.
const slideOffset = (side: 1 | -1) => (prefersReducedMotion.value ? 0 : `${side * 24}%`);
const slideIn = computed(() => ({
  opacity: 0,
  x: slideOffset(direction.value),
  scale: prefersReducedMotion.value ? 1 : 0.96,
}));
const slideOut = computed(() => ({
  opacity: 0,
  x: slideOffset(-direction.value as 1 | -1),
  transition: { duration: prefersReducedMotion.value ? 0 : 0.18 },
}));
const slideTransition = computed(() => ({
  duration: prefersReducedMotion.value ? 0 : 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
}));
</script>

<template>
  <Dialog :open="attachments.length > 0" @update:open="(open) => !open && emit('close')">
    <HarborDialogContent
      hide-close
      overlay-class="!z-[1060] bg-harbor-ink/70 backdrop-blur-lg"
      class="harbor-media-viewer marketing-font !z-[1060] left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-transparent p-0 text-white shadow-none sm:rounded-none"
    >
      <DialogTitle class="sr-only">Media preview</DialogTitle>
      <header
        class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] [text-shadow:0_1px_3px_rgb(17_27_33/0.5)] sm:px-6"
      >
        <div class="pointer-events-auto flex min-w-0 items-center gap-1">
          <div class="min-w-0" data-media-name>
            <p class="truncate text-sm font-semibold">{{ activeAttachment?.fileName }}</p>
            <p v-if="attachments.length > 1" class="text-xs text-white/75">
              {{ activeIndex + 1 }} of {{ attachments.length }}
            </p>
          </div>
          <a
            v-if="activeUrl && activeAttachment"
            :href="activeUrl"
            :download="activeAttachment.fileName"
            class="flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors [@media(hover:hover)]:hover:bg-white/15"
            aria-label="Download attachment"
            title="Download"
            ><Download class="size-[1.125rem]"
          /></a>
        </div>
        <button
          type="button"
          class="pointer-events-auto ml-auto flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors [@media(hover:hover)]:hover:bg-white/15"
          aria-label="Close preview"
          title="Close"
          @click="emit('close')"
        >
          <X class="size-5" />
        </button>
      </header>
      <div
        ref="stageRef"
        data-media-stage
        class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        @pointerdown="handleStagePointerDown"
        @click="handleStageClick"
      >
        <AnimatePresence mode="popLayout" :initial="false">
          <motion.div
            :key="activeAttachment?.id"
            :initial="slideIn"
            :animate="{ opacity: 1, x: 0, scale: 1 }"
            :exit="slideOut"
            :transition="slideTransition"
            class="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <img
              v-if="isImage && activeUrl"
              ref="mediaRef"
              :src="activeUrl"
              :alt="activeAttachment?.fileName"
              draggable="false"
              class="pointer-events-auto max-h-full max-w-full select-none object-contain"
              :style="{ transform: imageTransform }"
            />
            <video
              v-else-if="isVideo && activeUrl"
              :src="activeUrl"
              controls
              playsinline
              class="pointer-events-auto max-h-full max-w-full"
            />
            <iframe
              v-else-if="isPdf && activeUrl"
              :src="activeUrl"
              :title="activeAttachment?.fileName"
              class="pointer-events-auto mt-16 h-[calc(100%-4rem)] w-full max-w-4xl bg-white"
            />
            <LoadingRipple v-else-if="!activeUrl" data-media-loading class="size-8 text-white" />
            <div v-else class="flex flex-col items-center gap-3 text-center text-white/80">
              <FileText class="size-10" /><span>Preview unavailable</span>
            </div>
          </motion.div>
        </AnimatePresence>
        <RoundButton
          v-if="hasPrevious"
          tone="soft"
          class="harbor-media-viewer-arrow absolute left-4"
          aria-label="Previous attachment"
          @click="move(-1)"
        >
          <ChevronLeft />
        </RoundButton>
        <RoundButton
          v-if="hasNext"
          tone="soft"
          class="harbor-media-viewer-arrow absolute right-4"
          aria-label="Next attachment"
          @click="move(1)"
        >
          <ChevronRight />
        </RoundButton>
      </div>
    </HarborDialogContent>
  </Dialog>
</template>

<style>
/* Arrows are for a mouse; touch screens swipe. */
@media not ((hover: hover) and (pointer: fine)) {
  .harbor-media-viewer-arrow {
    display: none;
  }
}
</style>

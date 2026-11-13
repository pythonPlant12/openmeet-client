<script setup lang="ts">
import { Crop, Monitor } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HarborDialogContent,
} from '@/components/ui/dialog';
import { useScreenShare } from '@/composables/useScreenShare';
import { MIN_AREA_FRACTION, type ScreenArea, normalizeArea } from '@/services/screen-crop';

// After the browser's picker, the presenter drags over a live preview to choose what others see.
const { t } = useI18n();
const { areaRequest } = useScreenShare();

type Handle = 'nw' | 'ne' | 'sw' | 'se';
type Drag =
  | { kind: 'draw'; startX: number; startY: number }
  | { kind: 'move'; offsetX: number; offsetY: number }
  | { kind: 'resize'; handle: Handle; anchorX: number; anchorY: number };

const HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se'];
const KEY_STEP = 0.01;
const DEFAULT_AREA: ScreenArea = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };

const surface = ref<HTMLElement | null>(null);
const area = ref<ScreenArea>({ ...DEFAULT_AREA });
const videoSize = ref({ width: 16, height: 9 });
let drag: Drag | null = null;

const open = computed(() => areaRequest.value !== null);
const pixelSize = computed(
  () =>
    `${Math.round(area.value.width * videoSize.value.width)} × ${Math.round(area.value.height * videoSize.value.height)}`,
);

watch(open, (isOpen) => {
  if (isOpen) area.value = { ...DEFAULT_AREA };
});

function bindStream(element: unknown) {
  const video = element as HTMLVideoElement | null;
  if (video && areaRequest.value && video.srcObject !== areaRequest.value.stream) {
    video.srcObject = areaRequest.value.stream;
  }
}

function onMetadata(event: Event) {
  const video = event.target as HTMLVideoElement;
  if (video.videoWidth && video.videoHeight) videoSize.value = { width: video.videoWidth, height: video.videoHeight };
}

/** Pointer position as fractions of the preview, kept inside it. */
function pointerPoint(event: PointerEvent) {
  const rect = surface.value!.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

function fromCorners(ax: number, ay: number, bx: number, by: number): ScreenArea {
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
}

function startDrag(event: PointerEvent, next: (point: { x: number; y: number }) => Drag) {
  if (event.button !== 0) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = next(pointerPoint(event));
}

function onSurfaceDown(event: PointerEvent) {
  startDrag(event, (point) => ({ kind: 'draw', startX: point.x, startY: point.y }));
}

function onSelectionDown(event: PointerEvent) {
  event.stopPropagation();
  startDrag(event, (point) => ({ kind: 'move', offsetX: point.x - area.value.x, offsetY: point.y - area.value.y }));
}

function onHandleDown(event: PointerEvent, handle: Handle) {
  event.stopPropagation();
  const { x, y, width, height } = area.value;
  // The corner opposite the handle stays where it is.
  startDrag(event, () => ({
    kind: 'resize',
    handle,
    anchorX: handle.endsWith('w') ? x + width : x,
    anchorY: handle.startsWith('n') ? y + height : y,
  }));
}

function onPointerMove(event: PointerEvent) {
  if (!drag) return;
  const point = pointerPoint(event);
  if (drag.kind === 'draw') {
    const drawn = fromCorners(drag.startX, drag.startY, point.x, point.y);
    // A click without a drag keeps the current selection.
    if (drawn.width >= MIN_AREA_FRACTION / 2 || drawn.height >= MIN_AREA_FRACTION / 2)
      area.value = normalizeArea(drawn);
  } else if (drag.kind === 'move') {
    area.value = normalizeArea({ ...area.value, x: point.x - drag.offsetX, y: point.y - drag.offsetY });
  } else {
    area.value = normalizeArea(fromCorners(drag.anchorX, drag.anchorY, point.x, point.y));
  }
}

function onPointerUp() {
  drag = null;
}

// Arrow keys move the selection; with Shift they resize it.
function onSelectionKeydown(event: KeyboardEvent) {
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!delta) return;
  event.preventDefault();
  const [dx, dy] = delta.map((value) => value * KEY_STEP) as [number, number];
  area.value = normalizeArea(
    event.shiftKey
      ? { ...area.value, width: area.value.width + dx, height: area.value.height + dy }
      : { ...area.value, x: area.value.x + dx, y: area.value.y + dy },
  );
}

function answer(choice: ScreenArea | 'whole' | null) {
  areaRequest.value?.resolve(choice);
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && answer(null)"
    ><HarborDialogContent
      overlay-class="bg-harbor-ink/40 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-4xl rounded-[1.75rem] border-harbor-line bg-harbor-surface p-6 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.22)] sm:w-full"
      data-screen-area-picker
      ><DialogHeader>
        <DialogTitle>{{ t('meeting.screenShare.areaTitle') }}</DialogTitle>
        <DialogDescription class="text-harbor-muted">{{ t('meeting.screenShare.areaHint') }}</DialogDescription>
      </DialogHeader>
      <div
        ref="surface"
        class="relative mx-auto max-h-[60dvh] w-full touch-none select-none overflow-hidden rounded-2xl bg-harbor-ink"
        :style="{
          aspectRatio: `${videoSize.width} / ${videoSize.height}`,
          maxWidth: `calc(60dvh * ${videoSize.width / videoSize.height})`,
        }"
        @pointerdown="onSurfaceDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <video
          :ref="bindStream"
          autoplay
          muted
          playsinline
          class="pointer-events-none size-full object-fill"
          @loadedmetadata="onMetadata"
        />
        <!-- The shadow dims everything outside the selection. -->
        <div
          data-area-selection
          role="slider"
          tabindex="0"
          :aria-label="t('meeting.screenShare.areaSelection')"
          :aria-valuetext="pixelSize"
          class="absolute cursor-move rounded-md border-2 border-white shadow-[0_0_0_9999px_rgb(16_47_53/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          :style="{
            left: `${area.x * 100}%`,
            top: `${area.y * 100}%`,
            width: `${area.width * 100}%`,
            height: `${area.height * 100}%`,
          }"
          @pointerdown="onSelectionDown"
          @keydown="onSelectionKeydown"
        >
          <span
            class="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-harbor-ink/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm"
            >{{ pixelSize }}</span
          >
          <span
            v-for="handle in HANDLES"
            :key="handle"
            :data-area-handle="handle"
            class="absolute size-4 rounded-full border-2 border-harbor-accent bg-white shadow-harbor-soft"
            :class="{
              '-left-2 -top-2 cursor-nwse-resize': handle === 'nw',
              '-right-2 -top-2 cursor-nesw-resize': handle === 'ne',
              '-bottom-2 -left-2 cursor-nesw-resize': handle === 'sw',
              '-bottom-2 -right-2 cursor-nwse-resize': handle === 'se',
            }"
            @pointerdown="onHandleDown($event, handle)"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="pill" size="pill" data-share-whole-screen @click="answer('whole')"
          ><Monitor class="size-4" />{{ t('meeting.screenShare.shareWhole') }}</Button
        ><Button variant="accent" size="pill" data-share-area @click="answer({ ...area })"
          ><Crop class="size-4" />{{ t('meeting.screenShare.shareArea') }}</Button
        >
      </DialogFooter>
    </HarborDialogContent></Dialog
  >
</template>

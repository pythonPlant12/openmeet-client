<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { playHaptic } from '@/services/haptics';

import { waveformBars } from './voice-message';

// Bars of a voice message. Bars before `progress` use the played color; dragging seeks.
// With `levels`, the waveform draws as many thin bars as its width fits, so wide screens show more
// detail instead of thicker bars. With `bars`, it stretches exactly those bars across its width.
const props = withDefaults(
  defineProps<{
    bars?: number[];
    levels?: number[];
    /** Played part, from 0 to 1. */
    progress?: number;
    seekable?: boolean;
    playedClass: string;
    unplayedClass: string;
    label?: string;
    /** True only while the audio element is playing. */
    playing?: boolean;
  }>(),
  { bars: undefined, levels: undefined, progress: 0, seekable: false, label: 'Voice message position', playing: false },
);
const emit = defineEmits<{ (event: 'seek', fraction: number): void }>();

const track = ref<HTMLElement | null>(null);
let seekingPointer: number | null = null;

// Each fitted bar is 2px wide with a 2px gap.
const FITTED_BAR_PITCH = 4;
const FALLBACK_BAR_COUNT = 36;
const trackWidth = ref(0);
let resizeObserver: ResizeObserver | undefined;
const fitted = computed(() => !!props.levels);
const visibleBars = computed(() => {
  if (!props.levels) return props.bars ?? [];
  const count = trackWidth.value
    ? Math.max(1, Math.floor((trackWidth.value + 2) / FITTED_BAR_PITCH))
    : FALLBACK_BAR_COUNT;
  return waveformBars(props.levels, count);
});
const activeBarIndex = computed(() =>
  visibleBars.value.length
    ? Math.min(visibleBars.value.length - 1, Math.floor(props.progress * visibleBars.value.length))
    : -1,
);

watch(
  [track, fitted],
  ([element, isFitted]) => {
    resizeObserver?.disconnect();
    if (!element || !isFitted || !('ResizeObserver' in window)) return;
    resizeObserver ??= new ResizeObserver(([entry]) => {
      trackWidth.value = entry?.contentRect.width ?? 0;
    });
    resizeObserver.observe(element);
  },
  { flush: 'post' },
);

onBeforeUnmount(() => resizeObserver?.disconnect());

function fractionAt(clientX: number) {
  const rect = track.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

function onPointerDown(event: PointerEvent) {
  if (!props.seekable || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  seekingPointer = event.pointerId;
  track.value?.setPointerCapture?.(event.pointerId);
  playHaptic('selection');
  emit('seek', fractionAt(event.clientX));
}

function onPointerMove(event: PointerEvent) {
  if (seekingPointer !== event.pointerId) return;
  emit('seek', fractionAt(event.clientX));
}

function onPointerEnd(event: PointerEvent) {
  if (seekingPointer === event.pointerId) seekingPointer = null;
}

function onKeydown(event: KeyboardEvent) {
  if (!props.seekable) return;
  const step = event.key === 'ArrowRight' ? 0.05 : event.key === 'ArrowLeft' ? -0.05 : 0;
  if (!step) return;
  event.preventDefault();
  emit('seek', Math.min(1, Math.max(0, props.progress + step)));
}
</script>

<template>
  <div
    ref="track"
    data-voice-waveform
    class="relative flex h-7 min-w-0 flex-1 items-center gap-[2px]"
    :class="[seekable ? 'cursor-pointer touch-none' : undefined, { 'justify-between': fitted }]"
    :role="seekable ? 'slider' : 'img'"
    :tabindex="seekable ? 0 : undefined"
    :aria-label="label"
    :aria-valuemin="seekable ? 0 : undefined"
    :aria-valuemax="seekable ? 100 : undefined"
    :aria-valuenow="seekable ? Math.round(progress * 100) : undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @keydown="onKeydown"
  >
    <span
      v-for="(bar, index) in visibleBars"
      :key="index"
      class="rounded-full transition-[background-color,transform] duration-75"
      :class="[
        fitted ? 'w-[2px] shrink-0' : 'min-w-[2px] flex-1',
        (index + 0.5) / visibleBars.length <= progress ? playedClass : unplayedClass,
        { 'scale-y-110': playing && index === activeBarIndex },
      ]"
      :style="{ height: `${Math.round(bar * 100)}%` }"
    />
    <span
      v-if="playing"
      data-voice-playhead
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 rounded-full"
      :class="playedClass"
      :style="{ left: `${Math.min(100, Math.max(0, progress * 100))}%` }"
    />
  </div>
</template>

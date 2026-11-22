<script setup lang="ts">
import { useEventListener } from '@vueuse/core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// The microphone's input volume slider and its live input level, shared by the desktop menu and the phone panel.
const props = defineProps<{ volumePercent: number; levelPercent: number }>();
const emit = defineEmits<{ (event: 'change', percent: number): void }>();
const { t } = useI18n();

/** The level meter is a row of short bars; as many light up as the input is loud. */
const LEVEL_SEGMENTS = 24;
const litSegments = computed(() => Math.round((props.levelPercent / 100) * LEVEL_SEGMENTS));

/** Width of the slider's round thumb, in rem; matches `.call-volume-slider`. */
const THUMB_REM = 1.125;

// The volume shows as a percentage over the thumb while it is being set: while dragging with a mouse or a finger,
// and while the slider has keyboard focus. With a mouse it also shows while the pointer rests on the thumb.
const slider = ref<HTMLInputElement | null>(null);
const isThumbHovered = ref(false);
const isDragging = ref(false);
const hasKeyboardFocus = ref(false);
const showsValue = computed(() => isThumbHovered.value || isDragging.value || hasKeyboardFocus.value);

function thumbWidth() {
  return THUMB_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function onPointerMove(event: PointerEvent) {
  const input = slider.value;
  if (event.pointerType !== 'mouse' || !input) return;
  const rect = input.getBoundingClientRect();
  const thumb = thumbWidth();
  const center = rect.left + thumb / 2 + ((rect.width - thumb) * props.volumePercent) / 100;
  isThumbHovered.value = Math.abs(event.clientX - center) <= thumb / 2;
}

function onPointerDown() {
  isDragging.value = true;
}

// A drag can end anywhere on the page, not only over the slider.
useEventListener(window, 'pointerup', () => (isDragging.value = false));
useEventListener(window, 'pointercancel', () => (isDragging.value = false));

function onFocus(event: FocusEvent) {
  hasKeyboardFocus.value = (event.target as HTMLElement).matches(':focus-visible');
}

function onInput(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <!-- Arrow keys move the slider, not the menu's focus. -->
  <div class="space-y-4 px-2 pb-2 pt-1" @keydown.stop>
    <div class="space-y-2">
      <p class="text-sm font-semibold text-harbor-ink">{{ t('meeting.controls.inputVolume') }}</p>
      <div class="relative">
        <input
          ref="slider"
          type="range"
          min="0"
          max="100"
          step="1"
          :value="volumePercent"
          :aria-label="t('meeting.controls.inputVolume')"
          class="call-volume-slider"
          :style="{ '--fill': `${volumePercent}%` }"
          data-input-volume
          @input="onInput"
          @pointermove="onPointerMove"
          @pointerleave="isThumbHovered = false"
          @pointerdown="onPointerDown"
          @focus="onFocus"
          @blur="hasKeyboardFocus = false"
        />
        <span
          aria-hidden="true"
          class="call-volume-value"
          :style="{ '--value': volumePercent / 100 }"
          :data-shown="showsValue || undefined"
          data-input-volume-value
          >{{ volumePercent }}%</span
        >
      </div>
    </div>
    <div class="space-y-2">
      <p class="text-sm font-semibold text-harbor-ink">{{ t('meeting.controls.inputLevel') }}</p>
      <div
        role="meter"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="levelPercent"
        :aria-label="t('meeting.controls.inputLevel')"
        class="flex h-4 items-stretch justify-between gap-[3px]"
        data-input-level
      >
        <span
          v-for="segment in LEVEL_SEGMENTS"
          :key="segment"
          class="w-1 rounded-full transition-colors duration-75"
          :class="segment <= litSegments ? 'bg-harbor-accent' : 'bg-harbor-ink/15'"
          :data-lit="segment <= litSegments || undefined"
        />
      </div>
    </div>
  </div>
</template>

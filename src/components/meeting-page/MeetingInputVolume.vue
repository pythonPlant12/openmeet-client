<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// The microphone's input volume slider and its live input level, shared by the desktop menu and the phone panel.
const props = defineProps<{ volumePercent: number; levelPercent: number }>();
const emit = defineEmits<{ (event: 'change', percent: number): void }>();
const { t } = useI18n();

/** The level meter is a row of short bars; as many light up as the input is loud. */
const LEVEL_SEGMENTS = 24;
const litSegments = computed(() => Math.round((props.levelPercent / 100) * LEVEL_SEGMENTS));

function onInput(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <!-- Arrow keys move the slider, not the menu's focus. -->
  <div class="space-y-4 px-2 pb-2 pt-1" @keydown.stop>
    <div class="space-y-2">
      <p class="text-sm font-semibold text-harbor-ink">{{ t('meeting.controls.inputVolume') }}</p>
      <input
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
      />
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

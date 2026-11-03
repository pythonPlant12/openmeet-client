<script setup lang="ts">
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { VIDEO_QUALITY_OPTIONS } from '@/lib/video-quality';
import type { VideoQuality } from '@/services/video-quality';

// Quality choices shared by the camera and screen share menus.
defineProps<{
  /** Heading above the choices; submenus that already name them leave it out. */
  label?: string;
  quality: VideoQuality;
  disabled?: boolean;
  /** Height auto mode sends right now, shown beside Auto. */
  sentHeight?: number | null;
}>();
const emit = defineEmits<{ (event: 'select', quality: VideoQuality): void }>();

function select(value: unknown) {
  if (typeof value === 'string') emit('select', value as VideoQuality);
}
</script>

<template>
  <DropdownMenuLabel v-if="label" class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-harbor-subtle">
    {{ label }}
  </DropdownMenuLabel>
  <DropdownMenuRadioGroup :model-value="quality" @update:model-value="select">
    <DropdownMenuRadioItem
      v-for="option in VIDEO_QUALITY_OPTIONS"
      :key="option.value"
      :value="option.value"
      :disabled="disabled"
      class="cursor-pointer rounded-xl py-2 text-harbor-ink-soft"
      :data-quality-option="option.value"
    >
      <span class="min-w-0">
        <span class="block font-semibold text-harbor-ink"
          >{{ option.label
          }}<span
            v-if="option.value === 'auto' && quality === 'auto' && sentHeight"
            class="font-normal text-harbor-muted"
          >
            · now {{ sentHeight }}p</span
          ></span
        >
        <span class="block text-xs text-harbor-muted">{{ option.description }}</span>
      </span>
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>

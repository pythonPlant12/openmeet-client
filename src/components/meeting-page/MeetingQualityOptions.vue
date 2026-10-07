<script setup lang="ts">
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { VIDEO_QUALITY_OPTIONS } from '@/lib/video-quality';
import type { VideoQuality } from '@/services/video-quality';

// Quality choices shared by the camera and screen share menus.
defineProps<{
  label: string;
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
  <DropdownMenuLabel class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A9C9E]">
    {{ label }}
  </DropdownMenuLabel>
  <DropdownMenuRadioGroup :model-value="quality" @update:model-value="select">
    <DropdownMenuRadioItem
      v-for="option in VIDEO_QUALITY_OPTIONS"
      :key="option.value"
      :value="option.value"
      :disabled="disabled"
      class="cursor-pointer rounded-xl py-2 text-[#27595D]"
      :data-quality-option="option.value"
    >
      <span class="min-w-0">
        <span class="block font-semibold text-[#102F35]"
          >{{ option.label
          }}<span v-if="option.value === 'auto' && quality === 'auto' && sentHeight" class="font-normal text-[#61777B]">
            · now {{ sentHeight }}p</span
          ></span
        >
        <span class="block text-xs text-[#61777B]">{{ option.description }}</span>
      </span>
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>

<script setup lang="ts" generic="T extends string">
import { ChevronDown } from 'lucide-vue-next';
import { type Component, computed } from 'vue';

// A compact select for the meeting dialogs. Phones force form fields to 16px so iOS does not zoom on
// focus; the native select keeps that size but is invisible, and the smaller text shows through it.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  options: { value: T; label: string; icon?: Component }[];
  disabled?: boolean;
  /** Shown when there is nothing to choose. */
  placeholder?: string;
}>();
const model = defineModel<T>({ required: true });
const selected = computed(() => props.options.find((option) => option.value === model.value));
</script>

<template>
  <div
    class="relative flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-[#D8E7E3] bg-white pl-3 pr-8 text-xs text-[#102F35] focus-within:ring-2 focus-within:ring-[#0B7A75]/40 sm:text-sm"
    :class="{ 'opacity-50': disabled }"
    data-meeting-select
  >
    <component :is="selected.icon" v-if="selected?.icon" class="size-3.5 shrink-0 text-[#0B7A75]" aria-hidden="true" />
    <span class="truncate" aria-hidden="true">{{ selected?.label ?? placeholder }}</span>
    <ChevronDown class="pointer-events-none absolute right-2 size-4 text-[#4E6B70]" aria-hidden="true" />
    <select
      v-model="model"
      v-bind="$attrs"
      :disabled="disabled || !options.length"
      class="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
    >
      <option v-if="!options.length" value="">{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </div>
</template>

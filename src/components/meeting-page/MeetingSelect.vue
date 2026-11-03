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
    class="relative flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-harbor-line bg-harbor-surface pl-4 pr-9 text-xs text-harbor-ink focus-within:ring-2 focus-within:ring-harbor-subtle/40 sm:text-sm"
    :class="{ 'opacity-50': disabled }"
    data-meeting-select
  >
    <component
      :is="selected.icon"
      v-if="selected?.icon"
      class="size-3.5 shrink-0 text-harbor-icon"
      aria-hidden="true"
    />
    <span class="truncate" aria-hidden="true">{{ selected?.label ?? placeholder }}</span>
    <ChevronDown class="pointer-events-none absolute right-3 size-4 text-harbor-icon" aria-hidden="true" />
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

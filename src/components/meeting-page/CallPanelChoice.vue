<script setup lang="ts" generic="T extends string">
import { Check, ChevronDown } from 'lucide-vue-next';
import { computed, useId } from 'vue';

// One setting in the phone controls panel, such as a camera's source or quality: a row with the setting's name
// over its current value, which expands in place to the choices.
export interface CallPanelOption<V extends string> {
  value: V;
  label: string;
  description?: string;
}

const props = defineProps<{
  label: string;
  options: CallPanelOption<T>[];
  /** The chosen value. */
  value: T | null;
  /** Shown instead of the choices when there are none. */
  emptyText?: string;
  disabled?: boolean;
  /** Marks each choice for tests and automation, such as `data-device-option`. */
  optionAttribute?: string;
}>();
const emit = defineEmits<{ (event: 'select', value: T): void }>();

const listId = `call-panel-choice-${useId()}`;
// The row that holds several choices keeps one open at a time, so it may drive this one.
const isOpen = defineModel<boolean>('open', { default: false });
const current = computed(() => props.options.find((option) => option.value === props.value));
</script>

<template>
  <div data-panel-choice>
    <button
      type="button"
      class="call-choice"
      :aria-expanded="isOpen"
      :aria-controls="listId"
      data-panel-choice-trigger
      @click="isOpen = !isOpen"
    >
      <span class="min-w-0 flex-1 text-left">
        <span class="block">{{ label }}</span>
        <span class="block truncate text-xs font-normal text-harbor-muted" data-panel-choice-value>{{
          current?.label ?? (options.length ? '' : emptyText)
        }}</span>
      </span>
      <ChevronDown
        class="size-4 shrink-0 text-harbor-icon transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </button>
    <div v-if="isOpen" :id="listId" role="radiogroup" :aria-label="label" class="pb-1">
      <p v-if="!options.length && emptyText" class="px-3.5 py-2 text-sm text-harbor-muted">{{ emptyText }}</p>
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        class="call-choice pl-6"
        :aria-checked="option.value === value"
        :data-state="option.value === value ? 'checked' : 'unchecked'"
        :disabled="disabled"
        v-bind="optionAttribute ? { [optionAttribute]: option.value } : {}"
        @click="emit('select', option.value)"
      >
        <span class="min-w-0 flex-1 text-left">
          <span class="block truncate">{{ option.label }}</span>
          <span v-if="option.description" class="block text-xs font-normal text-harbor-muted">{{
            option.description
          }}</span>
        </span>
        <Check v-if="option.value === value" class="size-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

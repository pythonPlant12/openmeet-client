<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';
import { ref } from 'vue';

import { Input } from '@/components/ui/input';

defineProps<{ label: string; clearLabel: string; placeholder?: string }>();
const emit = defineEmits<{ (event: 'focus'): void; (event: 'blur'): void }>();
const query = defineModel<string>({ required: true });
const input = ref<{ focus: (options?: FocusOptions) => void } | null>(null);

function clear() {
  query.value = '';
  input.value?.focus();
}

defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options) });
</script>

<template>
  <!-- The white search field with a soft shadow under each pane header. -->
  <label class="relative block"
    ><span class="sr-only">{{ label }}</span
    ><Search
      class="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-harbor-muted" /><Input
      ref="input"
      v-model="query"
      type="search"
      :placeholder="placeholder ?? 'Search'"
      class="h-11 rounded-full border-0 bg-harbor-surface pl-11 pr-10 text-[0.9375rem] text-harbor-ink shadow-harbor-around placeholder:text-harbor-muted focus-visible:ring-0 focus-visible:ring-offset-0"
      @focus="emit('focus')"
      @blur="emit('blur')" /><button
      v-if="query"
      type="button"
      class="harbor-ghost-action absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-harbor-muted"
      :aria-label="clearLabel"
      @click="clear"
    >
      <X class="size-4" /></button
  ></label>
</template>

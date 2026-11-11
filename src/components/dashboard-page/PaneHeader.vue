<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';

const props = defineProps<{
  title: string;
  headingId?: string;
  /** Adds the search: a round button left of the title that expands into a field up to the trailing button. */
  searchLabel?: string;
  searchId?: string;
}>();
const emit = defineEmits<{ 'search-focus': []; 'search-blur': [] }>();
const query = defineModel<string>('query', { default: '' });

const input = ref<HTMLInputElement | null>(null);
const focused = ref(false);
// The field stays open while it is focused or holds a query, so results never lose their search.
const expanded = computed(() => focused.value || query.value !== '');

function handleFocus() {
  focused.value = true;
  emit('search-focus');
}

function handleBlur() {
  focused.value = false;
  emit('search-blur');
}

function clear() {
  query.value = '';
  input.value?.focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  query.value = '';
  input.value?.blur();
}

defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options) });
</script>

<template>
  <!-- The top of each sidebar pane: the search or a leading button, the centered title with its badge, the
       trailing button, and an optional row below. -->
  <div class="shrink-0 px-3 pb-2 pt-3 lg:px-4 lg:pt-4">
    <div class="relative flex h-11 items-center justify-between gap-2">
      <div v-if="props.searchLabel" class="relative z-[1] h-11 min-w-0 flex-1">
        <label
          data-pane-search
          :data-expanded="String(expanded)"
          class="absolute inset-y-0 left-0 flex cursor-text items-center overflow-hidden rounded-full bg-harbor-surface shadow-harbor-around transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          :class="expanded ? 'w-full' : 'w-11 cursor-pointer'"
        >
          <Search class="pointer-events-none absolute left-[0.8125rem] size-[1.125rem] text-harbor-ink-soft" />
          <input
            :id="searchId"
            ref="input"
            v-model="query"
            type="search"
            :aria-label="props.searchLabel"
            :placeholder="props.searchLabel"
            class="h-full w-full min-w-0 bg-transparent pl-11 pr-9 text-[0.9375rem] font-medium text-harbor-ink outline-none transition-opacity duration-200 placeholder:font-medium placeholder:text-harbor-muted [&::-webkit-search-cancel-button]:hidden"
            :class="expanded ? 'opacity-100' : 'opacity-0'"
            @focus="handleFocus"
            @blur="handleBlur"
            @keydown="handleKeydown"
          />
          <button
            v-if="query"
            type="button"
            class="harbor-ghost-action absolute right-2 inline-flex items-center justify-center rounded-full p-1.5 text-harbor-muted"
            aria-label="Clear search"
            @mousedown.prevent
            @click="clear"
          >
            <X class="size-4" />
          </button>
        </label>
      </div>
      <div v-else class="relative z-[1] flex"><slot name="leading" /></div>
      <h1
        :id="headingId"
        :data-hidden="String(!!props.searchLabel && expanded)"
        class="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-2 text-[1.0625rem] font-semibold text-harbor-ink transition-opacity duration-200"
        :class="{ 'opacity-0': props.searchLabel && expanded }"
      >
        <slot name="title"
          ><span>{{ title }}</span></slot
        ><slot name="badge" />
      </h1>
      <div class="relative z-[1] flex shrink-0"><slot name="trailing" /></div>
    </div>
    <div v-if="$slots.default" class="mt-3"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ count: number; singular: string; plural: string }>();
const text = computed(() => (props.count > 99 ? '99+' : String(props.count)));
</script>

<template>
  <span
    v-if="count > 0"
    data-section-badge
    class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0B7A75] px-1.5 text-[11px] font-semibold normal-case tracking-normal text-white"
    :aria-label="`${count} ${count === 1 ? singular : plural}`"
    >{{ text }}</span
  >
</template>

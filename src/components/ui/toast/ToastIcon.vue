<script setup lang="ts">
import { BellAnimated, CircleCheckAnimated, CircleXAnimated } from '@respeak/lucide-motion-vue';
import { useMediaQuery } from '@vueuse/core';
import { computed, onMounted, ref } from 'vue';

// A notification's icon: neutral like the rest of the toast, and it moves once as the toast comes in.
const props = defineProps<{ kind: 'success' | 'error' | 'info' }>();

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const icon = computed(() => {
  if (props.kind === 'success') return CircleCheckAnimated;
  if (props.kind === 'error') return CircleXAnimated;
  return BellAnimated;
});
// Starts after the first paint, so the icon plays from its resting pose while the toast slides in.
const playing = ref(false);
onMounted(() => {
  if (!prefersReducedMotion.value) requestAnimationFrame(() => (playing.value = true));
});
</script>

<template>
  <component
    :is="icon"
    :size="18"
    :stroke-width="2"
    :animate="playing"
    initial-on-animate-end
    data-toast-icon
    :data-kind="kind"
    aria-hidden="true"
  />
</template>

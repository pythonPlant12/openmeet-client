<script setup lang="ts">
import { motion } from 'motion-v';
import { computed, onMounted, onUnmounted, ref } from 'vue';

defineOptions({ inheritAttrs: false });

interface Props {
  text: string;
  as?: keyof HTMLElementTagNameMap;
  delay?: number;
  stagger?: number;
  threshold?: number;
}

const props = withDefaults(defineProps<Props>(), {
  as: 'p',
  delay: 0,
  stagger: 45,
  threshold: 0.2,
});

const rootRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const prefersReducedMotion = ref(false);
const usesAccessibleName = computed(() => /^h[1-6]$/.test(props.as));
const words = computed(() => {
  const values = props.text.trim().split(/\s+/);
  return values.map((word, index) => (index === values.length - 1 ? word : `${word} `));
});

let observer: IntersectionObserver | undefined;
let motionQuery: MediaQueryList | undefined;

function revealImmediatelyForReducedMotion() {
  prefersReducedMotion.value = motionQuery?.matches ?? false;
  if (!prefersReducedMotion.value) return;
  isVisible.value = true;
  observer?.disconnect();
}

onMounted(async () => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', revealImmediatelyForReducedMotion);
  prefersReducedMotion.value = motionQuery.matches;

  if (prefersReducedMotion.value || !('IntersectionObserver' in window)) {
    isVisible.value = true;
    return;
  }

  await document.fonts.ready;
  if (!rootRef.value) return;

  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      isVisible.value = true;
      observer?.disconnect();
    },
    { threshold: props.threshold },
  );
  observer.observe(rootRef.value);
});

onUnmounted(() => {
  observer?.disconnect();
  motionQuery?.removeEventListener('change', revealImmediatelyForReducedMotion);
});
</script>

<template>
  <component :is="as" ref="rootRef" v-bind="$attrs" :aria-label="usesAccessibleName ? text : undefined">
    <motion.span
      v-for="(word, index) in words"
      :key="`${word}-${index}`"
      :aria-hidden="usesAccessibleName ? 'true' : undefined"
      class="split-text-word"
      :class="{ 'split-text-word-visible': isVisible }"
      :initial="prefersReducedMotion ? false : { opacity: 0, y: 10 }"
      :animate="isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }"
      :transition="{
        type: 'spring',
        duration: 2,
        bounce: 0,
        delay: (delay + index * stagger) / 1000,
      }"
    >
      {{ word }}
    </motion.span>
  </component>
</template>

<style scoped>
.split-text-word {
  display: inline-block;
  white-space: pre;
  will-change: opacity, transform;
}

@media (prefers-reduced-motion: reduce) {
  .split-text-word {
    opacity: 1 !important;
    transform: none !important;
    will-change: auto;
  }
}
</style>

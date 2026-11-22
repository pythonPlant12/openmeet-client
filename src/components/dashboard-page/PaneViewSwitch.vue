<script setup lang="ts">
import { useMediaQuery, useTimeoutFn } from '@vueuse/core';
import { AnimatePresence, motion } from 'motion-v';
import { type Component, computed, ref, watch } from 'vue';

import { RoundButton } from '@/components/ui/round-button';

// The white round switch in a sidebar pane header, such as Chats and Contacts. `icon` is the animated icon of the
// view it leads to; when `viewKey` changes, the new icon slides in and plays its animation once.
const props = defineProps<{ viewKey: string; icon: Component; label: string }>();
const emit = defineEmits<{ click: [] }>();

// One icon animation runs for roughly this long.
const ICON_PLAY_DURATION = 900;

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const playing = ref(false);
const { start: stopPlayingLater } = useTimeoutFn(() => (playing.value = false), ICON_PLAY_DURATION, {
  immediate: false,
});

watch(
  () => props.viewKey,
  () => {
    if (prefersReducedMotion.value) return;
    playing.value = true;
    stopPlayingLater();
  },
);

const iconMotion = computed(() =>
  prefersReducedMotion.value
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.2 },
      },
);
</script>

<template>
  <RoundButton :aria-label="label" :title="label" @click="emit('click')">
    <AnimatePresence mode="popLayout" :initial="false">
      <motion.span :key="viewKey" v-bind="iconMotion" class="flex">
        <component :is="icon" :size="20" :stroke-width="1.9" :animate="playing" aria-hidden="true" />
      </motion.span>
    </AnimatePresence>
  </RoundButton>
</template>

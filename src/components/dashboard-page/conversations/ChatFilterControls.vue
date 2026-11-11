<script setup lang="ts">
import { useMediaQuery, useTimeoutFn } from '@vueuse/core';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref, watch } from 'vue';

import { RoundButton } from '@/components/ui/round-button';

import { CHAT_FILTER_VIEWS, type ChatFilter } from './chat-filter';

const props = defineProps<{ filter: ChatFilter }>();
const emit = defineEmits<{ switch: [next: ChatFilter] }>();

// One icon animation runs for roughly this long.
const ICON_PLAY_DURATION = 900;

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const view = computed(() => CHAT_FILTER_VIEWS[props.filter]);
// The new icon plays its animation once when the view changes.
const playing = ref(false);
const { start: stopPlayingLater } = useTimeoutFn(() => (playing.value = false), ICON_PLAY_DURATION, {
  immediate: false,
});

watch(
  () => props.filter,
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
  <!-- The white switch to the next view: Chats, then Group chats, then Friends chats. -->
  <RoundButton :aria-label="view.switchLabel" :title="view.switchLabel" @click="emit('switch', view.next)">
    <AnimatePresence mode="popLayout" :initial="false">
      <motion.span :key="filter" v-bind="iconMotion" class="flex">
        <component :is="view.switchIcon" :size="20" :stroke-width="1.9" :animate="playing" aria-hidden="true" />
      </motion.span>
    </AnimatePresence>
  </RoundButton>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { motion } from 'motion-v';
import type { HTMLAttributes } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    size: 'md',
  },
);

const { t } = useI18n();
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const rippleDelays = [0, 0.35, 0.7];
const sizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-12',
};
</script>

<template>
  <span
    role="status"
    :aria-label="t('common.loading')"
    :class="cn('relative inline-flex shrink-0 align-middle', sizeClasses[props.size], props.class)"
  >
    <span v-if="prefersReducedMotion" class="absolute inset-[18%] rounded-full border-2 border-current opacity-70" />
    <template v-else>
      <motion.span
        v-for="delay in rippleDelays"
        :key="delay"
        aria-hidden="true"
        class="absolute inset-0 block rounded-full border-2 border-current will-change-transform"
        :initial="{ scale: 0.2, opacity: 0 }"
        :animate="{ scale: [0.2, 1], opacity: [0, 0.7, 0] }"
        :transition="{ duration: 1.6, delay, repeat: Infinity, ease: 'easeOut' }"
      />
    </template>
  </span>
</template>

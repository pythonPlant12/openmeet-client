<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { type Component, computed, inject } from 'vue';

import { menuIconMotionKey } from './motion';

/**
 * A menu item icon that moves like the navbar's: it plays while the item is hovered and when it is pressed.
 * `animated` takes an icon from @respeak/lucide-motion-vue; icons the library lacks pass a static lucide icon
 * as `fallback`, which gets a short CSS bounce on the same triggers.
 */
defineProps<{ animated?: Component; fallback?: Component }>();

const supportsHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
// Screens with a calmer style, such as the call screen, turn the movement off for every menu below them.
const motionAllowed = inject(menuIconMotionKey, true);
const animates = computed(() => motionAllowed && !prefersReducedMotion.value);
</script>

<template>
  <component
    :is="animated"
    v-if="animated"
    :size="16"
    :stroke-width="2"
    :animate-on-hover="supportsHover && animates"
    :animate-on-tap="animates"
    trigger-target="closest:[role^='menuitem']"
    class="shrink-0"
    aria-hidden="true"
  />
  <component
    :is="fallback"
    v-else-if="fallback"
    :class="['size-4 shrink-0', { 'liquid-menu-static-icon': animates }]"
    aria-hidden="true"
  />
</template>

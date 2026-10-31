<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import type { Component } from 'vue';

/**
 * A menu item icon that moves like the navbar's: it plays while the item is hovered and when it is pressed.
 * `animated` takes an icon from @respeak/lucide-motion-vue; icons the library lacks pass a static lucide icon
 * as `fallback`, which gets a short CSS bounce on the same triggers.
 */
defineProps<{ animated?: Component; fallback?: Component }>();

const supportsHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
</script>

<template>
  <component
    :is="animated"
    v-if="animated"
    :size="16"
    :stroke-width="2"
    :animate-on-hover="supportsHover && !prefersReducedMotion"
    :animate-on-tap="!prefersReducedMotion"
    trigger-target="closest:[role^='menuitem']"
    class="shrink-0"
    aria-hidden="true"
  />
  <component :is="fallback" v-else-if="fallback" class="liquid-menu-static-icon size-4 shrink-0" aria-hidden="true" />
</template>

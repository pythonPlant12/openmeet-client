<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed } from 'vue';
import { Toaster as SonnerToaster } from 'vue-sonner';
import 'vue-sonner/style.css';

import ToastIcon from './ToastIcon.vue';

const isMobile = useMediaQuery('(max-width: 639px)');
const position = computed(() => (isMobile.value ? 'top-center' : 'top-right'));
</script>

<template>
  <SonnerToaster
    class="harbor-toaster marketing-font"
    theme="light"
    :position="position"
    :duration="6000"
    :visible-toasts="1"
    :gap="10"
    :offset="{ top: 84, right: 20, left: 20 }"
    :mobile-offset="{ top: 84, right: 12, left: 12 }"
    :swipe-directions="['left', 'right']"
    container-aria-label="OpenMeet notifications"
  >
    <template #success-icon><ToastIcon kind="success" /></template>
    <template #error-icon><ToastIcon kind="error" /></template>
    <template #warning-icon><ToastIcon kind="error" /></template>
    <template #info-icon><ToastIcon kind="info" /></template>
  </SonnerToaster>
</template>

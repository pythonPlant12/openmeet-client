<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { AnimatePresence, motion, useReducedMotion } from 'motion-v';
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui';

import { dismissToast, toastMessages } from './store';

const prefersReducedMotion = useReducedMotion();
</script>

<template>
  <ToastProvider swipe-direction="right">
    <AnimatePresence mode="sync">
      <motion.div
        v-for="message in toastMessages"
        :key="message.id"
        :layout="!prefersReducedMotion"
        :initial="prefersReducedMotion ? false : { opacity: 0, y: -16, scale: 0.98 }"
        :animate="prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }"
        :exit="prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="pointer-events-auto"
      >
        <ToastRoot
          :duration="message.duration ?? 8000"
          class="marketing-font grid w-full grid-cols-[1fr_auto] items-start gap-x-4 rounded-2xl border bg-white p-4 text-[#102F35] shadow-[0_18px_55px_rgba(16,47,53,0.16)]"
          :class="message.variant === 'destructive' ? 'border-[#F2C7BE]' : 'border-[#BBDDD6]'"
          @update:open="(open) => !open && dismissToast(message.id)"
        >
          <ToastTitle class="text-sm font-semibold">{{ message.title }}</ToastTitle>
          <ToastDescription v-if="message.description" class="mt-1 text-sm leading-5 text-[#61777B]">
            {{ message.description }}
          </ToastDescription>
          <ToastClose
            class="row-span-2 inline-flex size-8 items-center justify-center rounded-full text-[#61777B] transition-colors hover:bg-[#E6F4F1] hover:text-[#102F35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
            aria-label="Close notification"
          >
            <X class="size-4" />
          </ToastClose>
        </ToastRoot>
      </motion.div>
    </AnimatePresence>
    <ToastViewport
      class="fixed inset-x-3 top-[84px] z-[1100] flex max-h-[calc(100dvh-6rem)] flex-col gap-2 overflow-y-auto pb-3 sm:left-auto sm:right-5 sm:w-[min(26rem,calc(100vw-2.5rem))]"
    />
  </ToastProvider>
</template>

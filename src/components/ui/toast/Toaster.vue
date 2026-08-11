<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui';

import { dismissToast, toastMessages } from './store';
</script>

<template>
  <ToastProvider swipe-direction="right">
    <ToastRoot
      v-for="message in toastMessages"
      :key="message.id"
      :duration="message.duration ?? 5000"
      class="marketing-font grid w-full grid-cols-[1fr_auto] items-start gap-x-4 rounded-2xl border bg-white p-4 text-[#102F35] shadow-[0_18px_55px_rgba(16,47,53,0.16)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full data-[state=closed]:slide-out-to-right-full"
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
    <ToastViewport
      class="fixed right-0 top-[84px] z-[1100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[26rem]"
    />
  </ToastProvider>
</template>

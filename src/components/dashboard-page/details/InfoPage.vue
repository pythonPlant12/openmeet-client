<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

import { Dialog, DialogDescription, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';

defineProps<{
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
}>();
const emit = defineEmits<{ (event: 'update:open', value: boolean): void }>();
</script>

<template>
  <!-- A full screen page over the workspace, such as Profile info or Group info. It stays a dialog, so Escape and
       the back button close it, focus stays inside, and pages opened from it (a member's profile) stack on top. -->
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      hide-close
      overlay-class="!z-[1040] bg-transparent"
      class="harbor-info-page marketing-font !z-[1040] inset-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-white p-0 text-harbor-ink shadow-none sm:rounded-none"
      @open-auto-focus="$event.preventDefault()"
      @close-auto-focus="$event.preventDefault()"
    >
      <!-- The header floats over the page like the chat header, so the content fades and blurs under it. -->
      <header
        class="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pb-12 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-5"
      >
        <span class="harbor-chat-header-fade absolute inset-0 -z-10" aria-hidden="true" />
        <div class="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            data-info-page-back
            class="harbor-round-button pointer-events-auto size-10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle"
            aria-label="Go back"
            title="Back"
            @click="emit('update:open', false)"
          >
            <ArrowLeft class="size-5" /></button
          ><DialogTitle class="truncate text-base font-semibold text-harbor-ink">{{ title }}</DialogTitle>
        </div>
      </header>
      <DialogDescription class="sr-only">{{ description }}</DialogDescription>
      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-[calc(4.5rem+env(safe-area-inset-top))]"
        :aria-busy="busy"
      >
        <div class="mx-auto max-w-3xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
          <slot />
        </div>
      </div>
    </HarborDialogContent>
  </Dialog>
</template>

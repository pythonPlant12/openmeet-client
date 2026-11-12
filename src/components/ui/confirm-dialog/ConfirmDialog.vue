<script setup lang="ts">
import type { ConfirmDialogTone } from '.';
import { useMediaQuery } from '@vueuse/core';
import type { Component } from 'vue';
import { computed } from 'vue';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { i18n } from '@/i18n';
import { playHaptic } from '@/services/haptics';

/**
 * The one confirmation for the whole app: an icon, a short title, one line that states the consequence, the
 * action, and Cancel. Phones get a bottom action sheet with the action on top; wider screens a compact
 * centred dialog with the buttons side by side. Focus starts on Cancel, so a stray Enter never confirms.
 * The caller closes it once the confirmed action has finished; `busy` locks it meanwhile.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    actionLabel: string;
    icon?: Component;
    tone?: ConfirmDialogTone;
    busy?: boolean;
    busyLabel?: string;
    cancelLabel?: string;
  }>(),
  { tone: 'danger' },
);

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'confirm'): void;
  (event: 'cancel'): void;
}>();

// The app's phone breakpoint, the same one the toasts and navbar use.
const isPhone = useMediaQuery('(max-width: 639px)');
// A function ref, since a ref inside `v-for` would collect an array.
let cancelButton: HTMLElement | null = null;
function setCancelButton(button: unknown) {
  cancelButton = ((button as { $el?: HTMLElement } | null)?.$el ?? null) as HTMLElement | null;
}

const buttonOrder = computed(() => (isPhone.value ? (['action', 'cancel'] as const) : (['cancel', 'action'] as const)));
const root = computed(() => (isPhone.value ? Sheet : Dialog));
const content = computed(() => (isPhone.value ? SheetContent : HarborDialogContent));
const contentProps = computed(() =>
  isPhone.value
    ? {
        side: 'bottom' as const,
        'data-confirm-dialog-sheet': '',
        class:
          'marketing-font !z-[1060] rounded-t-[1.75rem] border-harbor-line bg-harbor-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-harbor-ink',
      }
    : {
        class:
          'marketing-font !z-[1060] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-0 rounded-[1.75rem] border-harbor-line bg-harbor-surface p-6 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full',
      },
);

function cancel() {
  if (props.busy) return;
  emit('cancel');
  emit('update:open', false);
}

function onOpenChange(open: boolean) {
  if (!open) cancel();
}

function confirm() {
  if (props.busy) return;
  if (props.tone === 'danger') playHaptic('warning');
  emit('confirm');
}

function focusCancel(event: Event) {
  event.preventDefault();
  cancelButton?.focus();
}
</script>

<template>
  <component :is="root" :open="open" @update:open="onOpenChange">
    <component
      :is="content"
      v-bind="contentProps"
      hide-close
      overlay-class="!z-[1060] bg-harbor-ink/30 backdrop-blur-md"
      @open-auto-focus="focusCancel"
    >
      <span
        v-if="icon"
        data-confirm-dialog-icon
        class="flex size-12 shrink-0 items-center justify-center rounded-full"
        :class="[
          tone === 'danger' ? 'bg-harbor-danger-soft text-harbor-danger' : 'bg-harbor-accent-soft text-harbor-accent',
          isPhone && 'mx-auto',
        ]"
      >
        <component :is="icon" class="size-6" />
      </span>
      <DialogTitle
        class="text-lg font-semibold leading-snug tracking-[-0.02em] text-harbor-ink"
        :class="icon && 'mt-4'"
      >
        {{ title }}
      </DialogTitle>
      <DialogDescription class="mt-2 text-sm leading-6 text-harbor-muted">{{ description }}</DialogDescription>
      <!-- The DOM follows the visual order, so Tab moves the way the buttons read: action first on phones. -->
      <div data-confirm-dialog-actions class="mt-6 flex gap-2" :class="isPhone ? 'flex-col' : 'flex-row justify-end'">
        <template v-for="button in buttonOrder" :key="button">
          <Button
            v-if="button === 'cancel'"
            :ref="setCancelButton"
            type="button"
            variant="pill"
            :class="isPhone ? 'w-full' : 'px-5'"
            :disabled="busy"
            @click="cancel"
          >
            {{ cancelLabel ?? i18n.global.t('common.cancel') }}
          </Button>
          <Button
            v-else
            type="button"
            :variant="tone"
            class="h-11"
            :class="isPhone ? 'w-full' : 'px-5'"
            :disabled="busy"
            @click="confirm"
          >
            <LoadingRipple v-if="busy" size="sm" />
            {{ busy && busyLabel ? busyLabel : actionLabel }}
          </Button>
        </template>
      </div>
    </component>
  </component>
</template>

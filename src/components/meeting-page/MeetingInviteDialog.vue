<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Dialog, DialogDescription, DialogHeader, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { MeetingRoomAccess } from '@/services/social-api';

import MeetingInviteContent from './MeetingInviteContent.vue';

// Invite people: a dimmed bottom sheet on a phone, which the handle makes taller, and a centred dialog on
// desktop. Both hold the same invite content.
defineProps<{
  roomId: string;
  access: MeetingRoomAccess | null;
  /** Phone call screens show the invite as a bottom sheet. */
  phone?: boolean;
  /** Guests get the share targets and the access line only. */
  guest?: boolean;
}>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ (event: 'access-updated', access: MeetingRoomAccess): void }>();
const { t } = useI18n();

/** A drag on the sheet's top further than this grows, shrinks, or dismisses the sheet. */
const HANDLE_DRAG_PX = 24;
/** A flick down this fast (px/ms) dismisses the sheet however short it was. */
const FLICK_VELOCITY = 0.5;
const isExpanded = ref(false);
// How far the sheet follows a finger dragging it down; it slides back, or away, on release.
const dragOffset = ref(0);
const isDragging = ref(false);
let drag: { startY: number; lastY: number; lastTime: number; velocity: number } | null = null;

function onDragStart(event: PointerEvent) {
  if (event.button !== 0) return;
  drag = { startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
}

function onDragMove(event: PointerEvent) {
  if (!drag) return;
  const elapsed = event.timeStamp - drag.lastTime;
  if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
  drag.lastY = event.clientY;
  drag.lastTime = event.timeStamp;
  const dy = event.clientY - drag.startY;
  if (Math.abs(dy) > 4) isDragging.value = true;
  dragOffset.value = Math.max(dy, 0);
}

function onDragEnd(event: PointerEvent) {
  stopDragListeners();
  if (!drag) return;
  const dy = event.clientY - drag.startY;
  const { velocity } = drag;
  drag = null;
  isDragging.value = false;
  if (dy < -HANDLE_DRAG_PX) {
    isExpanded.value = true;
    dragOffset.value = 0;
  } else if (dy > HANDLE_DRAG_PX || velocity > FLICK_VELOCITY) {
    if (isExpanded.value && velocity <= FLICK_VELOCITY) {
      isExpanded.value = false;
      dragOffset.value = 0;
    } else {
      // The closing slide starts from where the finger left the sheet.
      open.value = false;
    }
  } else {
    dragOffset.value = 0;
    const onHandle = event.target instanceof Element && !!event.target.closest('[data-invite-handle]');
    if (Math.abs(dy) <= 4 && onHandle) isExpanded.value = !isExpanded.value;
  }
}

function stopDragListeners() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
}

onBeforeUnmount(stopDragListeners);

/** Keyboard presses on the handle toggle the height; pointer taps already did in `onDragEnd`. */
function onHandleKey(event: MouseEvent) {
  if (event.detail === 0) isExpanded.value = !isExpanded.value;
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  isExpanded.value = false;
  dragOffset.value = 0;
});
</script>

<template>
  <Sheet v-if="phone" v-model:open="open">
    <SheetContent
      side="bottom"
      hide-close
      overlay-class="bg-harbor-ink/30 backdrop-blur-md sm:bg-harbor-ink/30"
      class="marketing-font flex flex-col gap-3 rounded-t-[1.75rem] border-0 bg-harbor-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-0 text-harbor-ink"
      :class="[
        isExpanded ? 'h-[92dvh]' : 'h-[62dvh]',
        isDragging
          ? '!transition-none'
          : 'transition-[height,transform] !duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
      ]"
      :style="dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined"
      :data-expanded="isExpanded"
      data-meeting-invite
    >
      <!-- The sheet's top drags: down to dismiss it or shrink it, up to make it taller; a tap toggles its height. -->
      <div class="shrink-0 touch-none select-none" data-invite-drag-area @pointerdown="onDragStart">
        <button
          type="button"
          class="flex h-6 w-full items-center justify-center"
          :aria-label="t(isExpanded ? 'meeting.invite.shrink' : 'meeting.invite.expand')"
          data-invite-handle
          @click="onHandleKey"
        >
          <span aria-hidden="true" class="h-1 w-9 rounded-full bg-harbor-line" />
        </button>
        <SheetTitle class="text-center text-white font-semibold">{{ t('meeting.invite.title') }}</SheetTitle>
      </div>
      <SheetDescription class="sr-only">{{ t('meeting.invite.description') }}</SheetDescription>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <MeetingInviteContent
          :room-id="roomId"
          :access="access"
          :active="open"
          :guest="guest"
          @access-updated="emit('access-updated', $event)"
        />
      </div>
    </SheetContent>
  </Sheet>

  <Dialog v-else v-model:open="open">
    <HarborDialogContent
      overlay-class="bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-lg grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto rounded-[1.75rem] border-harbor-line bg-harbor-surface p-6 text-harbor-ink shadow-harbor-float sm:w-full"
      data-meeting-invite
    >
      <DialogHeader>
        <DialogTitle class="text-center text-harbor-ink">{{ t('meeting.invite.title') }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('meeting.invite.description') }}</DialogDescription>
      </DialogHeader>
      <MeetingInviteContent
        :room-id="roomId"
        :access="access"
        :active="open"
        :guest="guest"
        @access-updated="emit('access-updated', $event)"
      />
    </HarborDialogContent>
  </Dialog>
</template>

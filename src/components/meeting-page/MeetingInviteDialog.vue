<script setup lang="ts">
import { ref, watch } from 'vue';
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

/** A drag on the handle further than this grows or shrinks the sheet. */
const HANDLE_DRAG_PX = 24;
const isExpanded = ref(false);
let handleStartY: number | null = null;

function onHandlePointerDown(event: PointerEvent) {
  handleStartY = event.clientY;
}

function onHandlePointerUp(event: PointerEvent) {
  if (handleStartY === null) return;
  const dy = event.clientY - handleStartY;
  handleStartY = null;
  if (dy < -HANDLE_DRAG_PX) isExpanded.value = true;
  else if (dy > HANDLE_DRAG_PX) {
    if (isExpanded.value) isExpanded.value = false;
    else open.value = false;
  } else isExpanded.value = !isExpanded.value;
}

watch(open, (isOpen) => {
  if (isOpen) isExpanded.value = false;
});
</script>

<template>
  <Sheet v-if="phone" v-model:open="open">
    <SheetContent
      side="bottom"
      hide-close
      overlay-class="bg-harbor-ink/30 backdrop-blur-md sm:bg-harbor-ink/30"
      class="marketing-font flex flex-col gap-3 rounded-t-[1.75rem] border-0 bg-harbor-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-0 text-harbor-ink transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      :class="isExpanded ? 'h-[92dvh]' : 'h-[62dvh]'"
      :data-expanded="isExpanded"
      data-meeting-invite
    >
      <button
        type="button"
        class="flex h-6 w-full shrink-0 touch-none items-center justify-center"
        :aria-label="t(isExpanded ? 'meeting.invite.shrink' : 'meeting.invite.expand')"
        data-invite-handle
        @pointerdown="onHandlePointerDown"
        @pointerup="onHandlePointerUp"
      >
        <span aria-hidden="true" class="h-1 w-9 rounded-full bg-harbor-line" />
      </button>
      <SheetTitle class="text-center text-white font-semibold">{{ t('meeting.invite.title') }}</SheetTitle>
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

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { BellRing, MessageCircleMore } from 'lucide-vue-next';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ChatThread from '@/components/dashboard-page/chat/ChatThread.vue';
import { RoundButton } from '@/components/ui/round-button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { swallowNextClick } from '@/lib/swallow-next-click';
import {
  type SystemNotificationPermission,
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
} from '@/services/notifications';
import type { ConversationMessage } from '@/services/social-api';
import type { ChatMessage } from '@/xstate/machines/webrtc/types';

interface Props {
  open: boolean;
  roomId: string;
  messages: ChatMessage[];
  localParticipantId: string | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'send', message: string, replyToId?: number): void;
  (e: 'react', messageId: number, emoji: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { locale, t } = useI18n();

const content = ref('');
const replyTo = ref<ConversationMessage | null>(null);
const thread = ref<InstanceType<typeof ChatThread> | null>(null);
const notificationPermission = ref<SystemNotificationPermission>(getSystemNotificationPermission());
const isDesktop = useMediaQuery('(min-width: 640px)');
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const sheetSide = computed<'bottom' | 'right'>(() => (isDesktop.value ? 'right' : 'bottom'));
// On phones the chat opens at half height, so the video stays visible above it, and expands to full height.
const isExpanded = ref(false);
const sheetSize = computed(() => (isDesktop.value ? 'side' : isExpanded.value ? 'full' : 'half'));
const sheetSizeClass = computed(
  () =>
    ({
      side: 'h-[75vh]',
      half: 'h-[50dvh]',
      full: 'h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)]',
    })[sheetSize.value],
);
/** A swipe on the handle this long expands (up) or shrinks (down) the sheet. */
const HANDLE_SWIPE_PX = 30;
let handleSwipeStartY: number | null = null;

function onHandlePointerDown(event: PointerEvent) {
  handleSwipeStartY = event.clientY;
}

function onHandlePointerUp(event: PointerEvent) {
  if (handleSwipeStartY === null) return;
  const lift = handleSwipeStartY - event.clientY;
  handleSwipeStartY = null;
  if (Math.abs(lift) < HANDLE_SWIPE_PX) return;
  // The swipe ends in a click on the handle, which would toggle the size straight back.
  swallowNextClick();
  if (lift > 0) isExpanded.value = true;
  else if (isExpanded.value) isExpanded.value = false;
  else emit('update:open', false);
}
// Messages already in the room when the chat opens appear at once; later ones animate in.
const animateAfterId = ref(0);

// Meeting chat lives in the room, so its messages are mapped onto the conversation message shape the
// shared thread renders. Reactions are listed by participant, which decides which ones are yours.
const threadMessages = computed<ConversationMessage[]>(() =>
  props.messages.map((message) => ({
    sequence: message.id,
    conversationId: props.roomId,
    senderId: message.participantId,
    senderName: message.participantName,
    content: message.message,
    createdAt: new Date(message.timestamp).toISOString(),
    replyTo: message.replyTo
      ? {
          sequence: message.replyTo.id,
          senderId: message.replyTo.participantId,
          senderName: message.replyTo.participantName,
          senderNickname: '',
          content: message.replyTo.message,
        }
      : null,
    reactions: (message.reactions ?? []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.participantIds.length,
      reactedByMe: !!props.localParticipantId && reaction.participantIds.includes(props.localParticipantId),
    })),
    attachments: [],
  })),
);

const latestId = () => props.messages[props.messages.length - 1]?.id ?? 0;
const isLocal = (message: ConversationMessage) => message.senderId === props.localParticipantId;
const shouldAnimate = (message: ConversationMessage) => message.sequence > animateAfterId.value;

const enableNotifications = async () => {
  notificationPermission.value = await requestSystemNotificationPermission();
};

const formatTime = (value: string): string =>
  new Date(value).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });

function handleSend() {
  const message = content.value.trim();
  if (!message) return;
  emit('send', message, replyTo.value?.sequence);
  content.value = '';
  replyTo.value = null;
}

function handleReact(message: ConversationMessage, emoji: string) {
  emit('react', message.sequence, emoji);
}

// A press outside the chat closes it. Focus moving away does not, and neither do presses on the chat
// button (it toggles the chat itself) or on menus, toasts, and dialogs that float above the meeting.
const KEEP_OPEN_TARGETS = '[data-chat-trigger], [role="menu"], [role="dialog"], [data-sonner-toaster]';
const handleInteractOutside = (event: Event) => {
  const original = (event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent;
  const target = original?.target instanceof Element ? original.target : null;
  if (original?.type === 'focusin' || target?.closest(KEEP_OPEN_TARGETS)) {
    event.preventDefault();
    return;
  }
  original?.preventDefault();
  event.preventDefault();
  emit('update:open', false);
};
const restoreChatTriggerFocus = (event: Event) => {
  event.preventDefault();
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-chat-trigger]')?.focus());
};

// New messages follow the reader to the bottom unless they scrolled up to read; your own messages
// always bring the view back down.
watch(
  () => props.messages.length,
  (length, previousLength) => {
    if (!props.open || length <= previousLength) return;
    const isOwn = props.messages[length - 1]?.participantId === props.localParticipantId;
    if (isOwn || thread.value?.isNearBottom()) thread.value?.scrollToBottom('smooth');
  },
);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      isExpanded.value = false;
      return;
    }
    animateAfterId.value = latestId();
    await nextTick();
    thread.value?.scrollToBottom('auto');
  },
  { immediate: true },
);
</script>

<template>
  <Sheet :open="open" :modal="false" @update:open="emit('update:open', $event)">
    <!-- data-dismiss-guard: a press outside the open chat only closes it (installOverlayClickGuard). -->
    <SheetContent
      data-dismiss-guard
      :side="sheetSide"
      :show-overlay="false"
      :data-chat-size="sheetSize"
      :class="sheetSizeClass"
      class="harbor-chat-panel marketing-font top-auto flex w-full flex-col transition-[height] duration-300 gap-0 overflow-hidden rounded-[1.5rem] border-0 bg-white p-0 text-harbor-ink shadow-harbor-float data-[state=closed]:fade-out-0 sm:bottom-20 sm:right-4 sm:mb-4 sm:max-w-md"
      @interact-outside="handleInteractOutside"
      @close-auto-focus="restoreChatTriggerFocus"
    >
      <button
        v-if="sheetSize !== 'side'"
        type="button"
        class="flex h-5 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-harbor-subtle"
        :aria-label="t(isExpanded ? 'meeting.chat.shrink' : 'meeting.chat.expand')"
        :aria-expanded="isExpanded"
        data-chat-expand
        @pointerdown="onHandlePointerDown"
        @pointerup="onHandlePointerUp"
        @click="isExpanded = !isExpanded"
      >
        <span aria-hidden="true" class="h-1 w-9 rounded-full bg-harbor-line" />
      </button>
      <SheetHeader class="min-h-16 flex-row items-center gap-3 space-y-0 border-b border-harbor-line py-3 pl-4 pr-14">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-harbor-avatar text-harbor-icon">
          <MessageCircleMore class="size-5" />
        </span>
        <div class="min-w-0 flex-1 text-left">
          <SheetTitle class="truncate text-base font-semibold text-harbor-ink">{{
            t('meeting.chat.title')
          }}</SheetTitle>
          <SheetDescription class="truncate text-xs text-harbor-muted">{{
            t('meeting.chat.subtitle')
          }}</SheetDescription>
        </div>
        <RoundButton
          v-if="notificationPermission === 'default'"
          size="sm"
          :aria-label="t('notifications.enableChat')"
          :title="t('notifications.enableChat')"
          @click="enableNotifications"
        >
          <BellRing />
        </RoundButton>
      </SheetHeader>

      <ChatThread
        ref="thread"
        v-model:content="content"
        v-model:reply-to="replyTo"
        :thread-key="roomId"
        :messages="threadMessages"
        show-sender
        :prefers-reduced-motion="prefersReducedMotion"
        :should-animate="shouldAnimate"
        :is-local="isLocal"
        :format-time="formatTime"
        :empty-text="t('meeting.chat.empty')"
        :footer-note="t('meeting.chat.footer')"
        :placeholder="t('meeting.chat.placeholder')"
        :send-label="t('meeting.chat.sendShort')"
        :attachments-enabled="false"
        :commands-enabled="false"
        @send="handleSend"
        @react="handleReact"
      />
    </SheetContent>
  </Sheet>
</template>

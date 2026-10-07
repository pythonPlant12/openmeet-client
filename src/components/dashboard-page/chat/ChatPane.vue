<script setup lang="ts">
import { ArrowLeft, MessageCircleMore, Phone, UsersRound, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref, watch } from 'vue';

import ChatThread from '@/components/dashboard-page/chat/ChatThread.vue';
import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import type { Conversation, ConversationMessage, Friend } from '@/services/social-api';

const props = defineProps<{
  conversation: Conversation | null;
  pendingFriend: Friend | null;
  selectedFriend: Friend | null;
  selectedTitle: string;
  selectedIsGroup: boolean;
  groupAvatarUrl?: string;
  friendAvatarUrls: Record<string, string>;
  isFriendAvatarLoading: (userId: string) => boolean;
  isGroupAvatarLoading: (groupId: string) => boolean;
  messages: ConversationMessage[];
  loading: boolean;
  loadingOlder: boolean;
  sending: boolean;
  callActive: boolean;
  notificationWarning: boolean;
  canRequestNotificationPermission: boolean;
  isDesktop: boolean;
  prefersReducedMotion: boolean;
  shouldAnimate: (message: ConversationMessage) => boolean;
  isLocal: (message: ConversationMessage) => boolean;
  formatTime: (value: string) => string;
  attachmentUrls?: Record<string, string>;
  isAttachmentLoading?: (path: string) => boolean;
  hasAttachmentError?: (path: string) => boolean;
  loadAttachment?: (path: string) => void;
}>();
const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'profile'): void;
  (event: 'group-info'): void;
  (event: 'call'): void;
  (event: 'scroll-top'): void;
  (event: 'send'): void;
  (event: 'request-notifications'): void;
  (event: 'dismiss-notifications'): void;
  (event: 'react', message: ConversationMessage, emoji: string): void;
}>();
const content = defineModel<string>('content', { required: true });
const replyTo = defineModel<ConversationMessage | null>('replyTo', { default: null });
const attachments = defineModel<File[]>('attachments', { default: () => [] });
const thread = ref<InstanceType<typeof ChatThread> | null>(null);
let edgeSwipeDistance = 0;
let edgeSwipe: { pointerId: number; startX: number; startY: number; axis: 'x' | 'y' | null } | null = null;
// Mobile back gesture: a right swipe anywhere in the chat goes back, except on messages that can be
// quoted, where the same swipe starts a reply. Fields stay excluded so text selection keeps working.
const BACK_SWIPE_EXCLUDED = '[data-repliable="true"], textarea, input, button, a, [data-reaction-picker]';
const EDGE_SWIPE_BACK_DISTANCE = 96;
const initial = computed(() => (props.prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.99 }));
const exit = computed(() => (props.prefersReducedMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }));
const directConversationLabel = computed(() =>
  props.selectedFriend?.nickname ? `@${props.selectedFriend.nickname}` : props.selectedTitle,
);
const groupConversationLabel = computed(() =>
  props.conversation?.groupCode ? `#${props.conversation.groupCode}` : props.selectedTitle,
);
function initials(name?: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

function onEdgePointerDown(event: PointerEvent) {
  if (props.isDesktop || event.pointerType === 'mouse') return;
  if ((event.target as Element | null)?.closest(BACK_SWIPE_EXCLUDED)) return;
  edgeSwipe = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, axis: null };
}

function onEdgePointerMove(event: PointerEvent) {
  if (!edgeSwipe || event.pointerId !== edgeSwipe.pointerId) return;
  const dx = event.clientX - edgeSwipe.startX;
  const dy = event.clientY - edgeSwipe.startY;
  if (!edgeSwipe.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    edgeSwipe.axis = dx > Math.abs(dy) ? 'x' : 'y';
  }
  if (edgeSwipe.axis !== 'x') return;
  event.stopPropagation();
  edgeSwipeDistance = Math.max(0, dx);
}

function onEdgePointerEnd(event: PointerEvent) {
  if (!edgeSwipe || event.pointerId !== edgeSwipe.pointerId) return;
  const shouldGoBack = edgeSwipe.axis === 'x' && edgeSwipeDistance >= EDGE_SWIPE_BACK_DISTANCE;
  edgeSwipe = null;
  edgeSwipeDistance = 0;
  // The pane stays still during the swipe, so going back plays exactly the back arrow's transition.
  if (shouldGoBack) emit('back');
}

// The dashboard can ask for the newest messages before a conversation's thread exists; the request
// waits for the thread to mount.
let pendingBottomScroll: ScrollBehavior | null = null;
function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  if (thread.value) thread.value.scrollToBottom(behavior);
  else pendingBottomScroll = behavior;
}
watch(thread, (mounted) => {
  if (!mounted || !pendingBottomScroll) return;
  mounted.scrollToBottom(pendingBottomScroll);
  pendingBottomScroll = null;
});

defineExpose({
  scrollToBottom,
  getScrollState: () => thread.value?.getScrollState() ?? null,
  isNearBottom: () => thread.value?.isNearBottom() ?? true,
  restoreScroll: (state: { height: number; top: number } | null) => thread.value?.restoreScroll(state),
  focusComposer: () => thread.value?.focusComposer(),
});
</script>
<template>
  <section
    data-chat-pane
    class="flex h-full min-h-0 min-w-0 flex-col bg-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    @pointerdown.capture="onEdgePointerDown"
    @pointermove.capture="onEdgePointerMove"
    @pointerup.capture="onEdgePointerEnd"
    @pointercancel.capture="onEdgePointerEnd"
    :class="
      conversation || pendingFriend
        ? 'relative translate-x-0 opacity-100'
        : 'pointer-events-none absolute inset-0 translate-x-3 opacity-0 lg:static lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto'
    "
    aria-labelledby="conversation-title"
  >
    <AnimatePresence mode="wait"
      ><motion.div
        v-if="conversation || pendingFriend"
        :key="conversation?.id ?? `pending-${pendingFriend?.id}`"
        :initial="initial"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="exit"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="flex h-full min-h-0 flex-col"
      >
        <header class="flex min-h-16 items-center gap-3 border-b border-[#E5EFEC] px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            class="harbor-ghost-action -ml-2 rounded-full text-[#27595D] lg:hidden"
            aria-label="Back to conversations"
            @click="emit('back')"
            ><ArrowLeft class="size-5" /></Button
          ><button
            v-if="selectedFriend && !pendingFriend"
            type="button"
            class="harbor-ghost-action -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left"
            @click="emit('profile')"
          >
            <span class="relative shrink-0"
              ><span
                class="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-[#0B7A75]"
                ><img
                  v-if="friendAvatarUrls[selectedFriend.id]"
                  :src="friendAvatarUrls[selectedFriend.id]"
                  alt=""
                  class="size-full object-cover"
                /><LoadingRipple
                  v-else-if="isFriendAvatarLoading(selectedFriend.id)"
                  class="size-4 text-[#0B7A75]"
                /><span v-else class="text-xs font-semibold">{{ initials(selectedFriend.name) }}</span></span
              ><PresenceDot
                surface="directMessages"
                :online="selectedFriend.isOnline"
                :status="selectedFriend.status"
                class="size-3 border-2 border-white" /></span
            ><span class="min-w-0"
              ><span id="conversation-title" class="block truncate font-semibold">{{ selectedTitle }}</span
              ><span class="block truncate text-xs text-[#61777B]">{{ directConversationLabel }}</span></span
            ></button
          ><button
            v-else-if="selectedIsGroup"
            type="button"
            class="harbor-ghost-action -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left"
            @click="emit('group-info')"
          >
            <span class="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#102F35] text-white"
              ><img v-if="groupAvatarUrl" :src="groupAvatarUrl" alt="" class="size-full object-cover" /><LoadingRipple
                v-else-if="conversation && isGroupAvatarLoading(conversation.id)"
                class="size-4 text-white" /><UsersRound v-else class="size-4" /></span
            ><span class="min-w-0"
              ><span id="conversation-title" class="block truncate font-semibold">{{ selectedTitle }}</span
              ><span class="block truncate text-xs text-[#61777B]">{{ groupConversationLabel }}</span></span
            >
          </button>
          <div v-else class="flex min-w-0 flex-1 items-center gap-3">
            <span class="flex size-9 items-center justify-center rounded-full bg-[#DDF1ED] text-[#0B7A75]"
              ><span class="text-xs font-semibold">{{ initials(selectedFriend?.name) }}</span></span
            >
            <div class="min-w-0">
              <h2 id="conversation-title" class="truncate font-semibold">{{ selectedTitle }}</h2>
              <p class="truncate text-xs text-[#61777B]">Direct-message request pending</p>
            </div>
          </div>
          <Button
            v-if="(selectedFriend && !pendingFriend) || selectedIsGroup"
            variant="ghost"
            size="icon"
            class="harbor-ghost-action rounded-full text-[#0B7A75]"
            :disabled="callActive"
            @click="emit('call')"
            ><Phone class="size-5"
          /></Button>
        </header>
        <ChatThread
          v-if="conversation"
          ref="thread"
          v-model:content="content"
          v-model:reply-to="replyTo"
          v-model:attachments="attachments"
          :thread-key="conversation.id"
          :messages="messages"
          :loading="loading"
          :loading-older="loadingOlder"
          :sending="sending"
          :show-sender="selectedIsGroup"
          :prefers-reduced-motion="prefersReducedMotion"
          :should-animate="shouldAnimate"
          :is-local="isLocal"
          :format-time="formatTime"
          :attachment-urls="attachmentUrls"
          :is-attachment-loading="isAttachmentLoading"
          :has-attachment-error="hasAttachmentError"
          :load-attachment="loadAttachment"
          footer-note="Messages stored by OpenMeet"
          @scroll-top="emit('scroll-top')"
          @send="emit('send')"
          @react="(message, emoji) => emit('react', message, emoji)"
        >
          <template #notice>
            <div
              v-if="notificationWarning"
              class="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#D8E7E3] bg-[#E6F4F1] px-3 py-2.5 text-sm text-[#102F35]"
            >
              <p>
                {{
                  canRequestNotificationPermission
                    ? 'Enable notifications for messages and calls.'
                    : 'Notifications are blocked. Enable them in your browser settings.'
                }}
              </p>
              <div class="flex shrink-0 items-center gap-1">
                <Button
                  v-if="canRequestNotificationPermission"
                  variant="ghost"
                  size="sm"
                  class="harbor-ghost-action h-8 rounded-lg px-2 font-bold text-[#0B7A75]"
                  @click="emit('request-notifications')"
                  >Enable</Button
                >
                <Button
                  variant="ghost"
                  size="icon"
                  class="harbor-ghost-action size-8 rounded-lg text-[#27595D]"
                  aria-label="Dismiss notification notice"
                  title="Dismiss"
                  @click="emit('dismiss-notifications')"
                  ><X class="size-4"
                /></Button>
              </div>
            </div>
          </template>
        </ChatThread>
        <div v-else class="flex flex-1 items-center justify-center px-6 py-10 text-center">
          <p class="max-w-sm rounded-xl bg-[#FFF8E8] px-4 py-3 text-sm text-[#80601D]">
            Waiting for {{ pendingFriend?.name }} to accept this direct-message request.
          </p>
        </div> </motion.div
      ><motion.div
        v-else-if="isDesktop"
        key="empty-conversation"
        :initial="initial"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="exit"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="flex h-full flex-1 items-center justify-center px-6 py-10 text-center"
        ><div class="max-w-sm">
          <span class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E6F4F1] text-[#0B7A75]"
            ><MessageCircleMore class="size-7"
          /></span>
          <h2 id="conversation-title" class="mt-5 text-xl font-semibold">Choose a conversation</h2>
          <p class="mt-2 text-sm leading-6 text-[#61777B]">
            Select a conversation or an accepted friend to manage its secure access.
          </p>
        </div></motion.div
      ></AnimatePresence
    >
  </section>
</template>

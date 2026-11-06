<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { ArrowLeft, CircleUserRound, Ellipsis, MessageCircleMore, Phone, UsersRound, Video, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref, watch } from 'vue';

import ChatThread from '@/components/dashboard-page/chat/ChatThread.vue';
import type { SenderAvatar } from '@/components/dashboard-page/chat/voice-message';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { userStatusOption } from '@/config/user-status.config';
import type { Conversation, ConversationMessage, Friend, GifSearchResult, GroupMember } from '@/services/social-api';

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
  unreadStartSequence?: number | null;
  groupMembers?: GroupMember[];
  groupMembersHasMore?: boolean;
  gifResults?: GifSearchResult[];
  gifSearchLoading?: boolean;
  gifSearchError?: string;
  gifPreviewUrls?: Record<string, string>;
  isGifPreviewLoading?: (id: string) => boolean;
  senderAvatar?: (message: ConversationMessage) => SenderAvatar;
}>();
const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'profile'): void;
  (event: 'group-info'): void;
  (event: 'call', options: { video: boolean }): void;
  (event: 'scroll-top'): void;
  (event: 'load-unread', sequence: number): void;
  (event: 'send'): void;
  (event: 'request-notifications'): void;
  (event: 'dismiss-notifications'): void;
  (event: 'react', message: ConversationMessage, emoji: string): void;
  (event: 'load-group-members'): void;
  (event: 'search-gifs', query: string): void;
  (event: 'load-gif-preview', gif: GifSearchResult): void;
  (event: 'select-gif', gif: GifSearchResult): void;
}>();
const content = defineModel<string>('content', { required: true });
const replyTo = defineModel<ConversationMessage | null>('replyTo', { default: null });
const attachments = defineModel<File[]>('attachments', { default: () => [] });
const thread = ref<InstanceType<typeof ChatThread> | null>(null);
const header = ref<HTMLElement | null>(null);
const { height: headerHeight } = useElementSize(header, undefined, { box: 'border-box' });
// The header's lower part is only its fade, so the first message starts inside it and slides under the blur.
const HEADER_FADE_OVERLAP = 28;
const messagesTop = computed(() =>
  headerHeight.value ? `${Math.max(0, headerHeight.value - HEADER_FADE_OVERLAP)}px` : undefined,
);
let edgeSwipeDistance = 0;
let edgeSwipe: { pointerId: number; startX: number; startY: number; axis: 'x' | 'y' | null } | null = null;
// Mobile back gesture: a right swipe anywhere in the chat goes back, except on messages that can be
// quoted, where the same swipe starts a reply. Fields stay excluded so text selection keeps working.
const BACK_SWIPE_EXCLUDED = '[data-repliable="true"], textarea, input, button, a, [data-reaction-picker]';
const EDGE_SWIPE_BACK_DISTANCE = 96;
const initial = computed(() => (props.prefersReducedMotion ? false : { opacity: 0, x: 16 }));
const exit = computed(() => (props.prefersReducedMotion ? undefined : { opacity: 0, x: -16 }));
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
  scrollToMessage: (sequence: number) => thread.value?.scrollToMessage(sequence) ?? false,
});
</script>
<template>
  <!-- On mobile the browser never takes horizontal pans here, so swipe-back works even where nothing scrolls. -->
  <section
    data-chat-pane
    class="flex h-full min-h-0 min-w-0 touch-pan-y flex-col bg-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:touch-auto"
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
        :animate="{ opacity: 1, x: 0 }"
        :exit="exit"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="relative flex h-full min-h-0 flex-col"
      >
        <!-- The header floats over the messages, which fade and blur as they scroll under it. -->
        <header ref="header" class="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pb-12 pt-3 sm:px-5">
          <span class="harbor-chat-header-fade absolute inset-0 -z-10" aria-hidden="true" />
          <div class="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              class="harbor-round-button pointer-events-auto size-10 shrink-0 lg:hidden"
              aria-label="Back to conversations"
              @click="emit('back')"
            >
              <ArrowLeft class="size-5" /></button
            ><button
              v-if="selectedFriend && !pendingFriend"
              type="button"
              class="pointer-events-auto flex min-w-0 cursor-pointer items-center gap-3 rounded-full py-1 pl-1 pr-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle"
              @click="emit('profile')"
            >
              <span class="relative shrink-0"
                ><span
                  class="flex size-10 items-center justify-center overflow-hidden rounded-full bg-harbor-avatar text-harbor-icon"
                  :class="[
                    'border-2',
                    userStatusOption(selectedFriend.isOnline ? selectedFriend.status : 'offline').borderClass,
                  ]"
                  ><img
                    v-if="friendAvatarUrls[selectedFriend.id]"
                    :src="friendAvatarUrls[selectedFriend.id]"
                    alt=""
                    class="size-full object-cover"
                  /><LoadingRipple v-else-if="isFriendAvatarLoading(selectedFriend.id)" class="size-4" /><span
                    v-else
                    class="text-xs font-semibold"
                    >{{ initials(selectedFriend.name) }}</span
                  ></span
                ><PresenceDot
                  surface="directMessages"
                  :online="selectedFriend.isOnline"
                  :status="selectedFriend.status"
                  class="size-3 border-2 border-white" /></span
              ><span class="min-w-0"
                ><span id="conversation-title" class="block truncate text-base font-semibold text-harbor-ink">{{
                  selectedTitle
                }}</span
                ><span class="sr-only">{{ directConversationLabel }}</span></span
              ></button
            ><button
              v-else-if="selectedIsGroup"
              type="button"
              class="pointer-events-auto flex min-w-0 cursor-pointer items-center gap-3 rounded-full py-1 pl-1 pr-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle"
              @click="emit('group-info')"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-harbor-avatar text-harbor-icon"
                ><img v-if="groupAvatarUrl" :src="groupAvatarUrl" alt="" class="size-full object-cover" /><LoadingRipple
                  v-else-if="conversation && isGroupAvatarLoading(conversation.id)"
                  class="size-4" /><UsersRound v-else class="size-5" /></span
              ><span class="min-w-0"
                ><span id="conversation-title" class="block truncate text-base font-semibold text-harbor-ink">{{
                  selectedTitle
                }}</span
                ><span class="sr-only">{{ groupConversationLabel }}</span></span
              >
            </button>
            <div v-else class="pointer-events-auto flex min-w-0 items-center gap-3">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full bg-harbor-avatar text-harbor-icon"
                ><span class="text-xs font-semibold">{{ initials(selectedFriend?.name) }}</span></span
              >
              <div class="min-w-0">
                <h2 id="conversation-title" class="truncate text-base font-semibold text-harbor-ink">
                  {{ selectedTitle }}
                </h2>
                <p class="truncate text-xs text-harbor-muted">Direct-message request pending</p>
              </div>
            </div>
            <div
              v-if="(selectedFriend && !pendingFriend) || selectedIsGroup"
              data-chat-actions
              class="harbor-round-group pointer-events-auto ml-auto shrink-0"
            >
              <button
                type="button"
                class="size-10"
                :aria-label="selectedIsGroup ? 'Start a group video call' : 'Start a video call'"
                :title="selectedIsGroup ? 'Start a group video call' : 'Start a video call'"
                :disabled="callActive"
                @click="emit('call', { video: true })"
              >
                <Video class="size-5" /></button
              ><button
                type="button"
                class="size-10"
                :aria-label="selectedIsGroup ? 'Start a group audio call' : 'Start an audio call'"
                :title="selectedIsGroup ? 'Start a group audio call' : 'Start an audio call'"
                :disabled="callActive"
                @click="emit('call', { video: false })"
              >
                <Phone class="size-[1.125rem]" />
              </button>
              <DropdownMenu :modal="false">
                <DropdownMenuTrigger as-child>
                  <button type="button" class="size-10" aria-label="More chat options" title="More options">
                    <Ellipsis class="size-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" :side-offset="8" class="min-w-52">
                  <DropdownMenuItem v-if="selectedIsGroup" @select="emit('group-info')">
                    <UsersRound />
                    Group info
                  </DropdownMenuItem>
                  <DropdownMenuItem v-else @select="emit('profile')">
                    <CircleUserRound />
                    See profile
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="callActive" @select="emit('call', { video: true })">
                    <Video />
                    Video call
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="callActive" @select="emit('call', { video: false })">
                    <Phone />
                    Audio call
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div
            v-if="notificationWarning"
            data-notification-notice
            class="pointer-events-auto mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white py-1.5 pl-4 pr-1.5 text-sm text-harbor-ink shadow-[0_1px_2px_rgba(17,27,33,0.06),0_4px_14px_rgba(17,27,33,0.07)]"
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
                class="harbor-ghost-action h-8 rounded-full px-3 font-semibold text-harbor-accent"
                @click="emit('request-notifications')"
                >Enable</Button
              >
              <Button
                variant="ghost"
                size="icon"
                class="harbor-ghost-action size-8 rounded-full text-harbor-icon"
                aria-label="Dismiss notification notice"
                title="Dismiss"
                @click="emit('dismiss-notifications')"
                ><X class="size-4"
              /></Button>
            </div>
          </div>
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
          :unread-start-sequence="unreadStartSequence"
          :group-members="selectedIsGroup ? groupMembers : []"
          :group-members-has-more="selectedIsGroup && groupMembersHasMore"
          :gif-results="gifResults"
          :gif-search-loading="gifSearchLoading"
          :gif-search-error="gifSearchError"
          :gif-preview-urls="gifPreviewUrls"
          :is-gif-preview-loading="isGifPreviewLoading"
          overlay-header
          :style="messagesTop ? { '--chat-messages-top': messagesTop } : undefined"
          :sender-avatar="senderAvatar"
          @scroll-top="emit('scroll-top')"
          @load-unread="(sequence) => emit('load-unread', sequence)"
          @send="emit('send')"
          @react="(message, emoji) => emit('react', message, emoji)"
          @load-group-members="emit('load-group-members')"
          @search-gifs="(query) => emit('search-gifs', query)"
          @load-gif-preview="(gif) => emit('load-gif-preview', gif)"
          @select-gif="(gif) => emit('select-gif', gif)"
        >
        </ChatThread>
        <div v-else class="harbor-chat-canvas flex flex-1 items-center justify-center px-6 py-10 text-center">
          <p class="max-w-sm rounded-xl bg-[#FFF8E8] px-4 py-3 text-sm text-[#80601D]">
            Waiting for {{ pendingFriend?.name }} to accept this direct-message request.
          </p>
        </div> </motion.div
      ><motion.div
        v-else-if="isDesktop"
        key="empty-conversation"
        :initial="initial"
        :animate="{ opacity: 1, x: 0, y: 0, scale: 1 }"
        :exit="exit"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="harbor-chat-canvas flex h-full flex-1 items-center justify-center px-6 py-10 text-center"
        ><div class="max-w-sm">
          <span
            class="mx-auto flex size-14 items-center justify-center rounded-full bg-white text-harbor-icon shadow-[0_1px_2px_rgba(17,27,33,0.06),0_4px_14px_rgba(17,27,33,0.08)]"
            ><MessageCircleMore class="size-7"
          /></span>
          <h2 id="conversation-title" class="mt-5 text-xl font-semibold">Choose a conversation</h2>
          <p class="mt-2 text-sm leading-6 text-harbor-muted">
            Select a conversation or an accepted friend to manage its secure access.
          </p>
        </div></motion.div
      ></AnimatePresence
    >
  </section>
</template>

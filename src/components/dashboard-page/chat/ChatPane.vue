<script setup lang="ts">
import { ArrowDown, ArrowLeft, MessageCircleMore, Phone, Reply, UsersRound, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import ChatMessage from '@/components/dashboard-page/chat/ChatMessage.vue';
import EmojiPickerButton from '@/components/dashboard-page/chat/EmojiPickerButton.vue';
import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { toast } from '@/components/ui/toast';
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
const reactionPickerSequence = ref<number | null>(null);
const highlightedSequence = ref<number | null>(null);
let edgeSwipeDistance = 0;
let highlightTimer: number | undefined;
let edgeSwipe: { pointerId: number; startX: number; startY: number; axis: 'x' | 'y' | null } | null = null;
// Mobile back gesture: a right swipe anywhere in the chat goes back, except on messages that can be
// quoted, where the same swipe starts a reply. Fields stay excluded so text selection keeps working.
const BACK_SWIPE_EXCLUDED = '[data-repliable="true"], textarea, input, button, [data-reaction-picker]';
// Consecutive messages from one sender within this window are grouped tightly.
const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;
const EDGE_SWIPE_BACK_DISTANCE = 96;
const pane = ref<HTMLElement | null>(null);
const composer = ref<HTMLTextAreaElement | null>(null);
let pendingBottomScroll: ScrollBehavior | null = null;
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
function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  pendingBottomScroll = props.prefersReducedMotion ? 'auto' : behavior;
  void nextTick(() => {
    requestAnimationFrame(applyPendingBottomScroll);
  });
}
function applyPendingBottomScroll() {
  if (!pane.value || !pendingBottomScroll) return;
  pane.value.scrollTo({ top: pane.value.scrollHeight, behavior: pendingBottomScroll });
  pendingBottomScroll = null;
}
function getScrollState() {
  return pane.value ? { height: pane.value.scrollHeight, top: pane.value.scrollTop } : null;
}
function restoreScroll(state: { height: number; top: number } | null) {
  if (pane.value && state) pane.value.scrollTop = state.top + pane.value.scrollHeight - state.height;
}
function focusComposer() {
  void nextTick(() => composer.value?.focus());
}
// More hidden newer messages than this shows the jump-to-latest button.
const JUMP_TO_LATEST_THRESHOLD = 10;
const NEAR_BOTTOM_DISTANCE = 80;
// The reply preview springs in over roughly this long before the quoted message is revealed.
const REPLY_PREVIEW_SETTLE_MS = 280;
const showJumpToLatest = ref(false);
let wasNearBottom = true;
let scrollFrame: number | undefined;
let revealTimer: number | undefined;
let paneResizeObserver: ResizeObserver | undefined;

function countMessagesBelowView() {
  const element = pane.value;
  if (!element) return 0;
  const viewBottom = element.getBoundingClientRect().bottom;
  const items = element.querySelectorAll<HTMLElement>('[data-message-sequence]');
  let hidden = 0;
  // Newest messages are last, so counting stops at the first one that is in view.
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]!.getBoundingClientRect().top < viewBottom) break;
    hidden += 1;
  }
  return hidden;
}

function updateScrollState() {
  scrollFrame = undefined;
  const element = pane.value;
  if (!element) return;
  wasNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_DISTANCE;
  showJumpToLatest.value = !wasNearBottom && countMessagesBelowView() > JUMP_TO_LATEST_THRESHOLD;
}

function onPaneScroll() {
  if (pane.value && pane.value.scrollTop < 80) emit('scroll-top');
  if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateScrollState);
}

function jumpToLatest() {
  showJumpToLatest.value = false;
  pane.value?.scrollTo({ top: pane.value.scrollHeight, behavior: props.prefersReducedMotion ? 'auto' : 'smooth' });
}

function revealQuotedMessage() {
  const sequence = replyTo.value?.sequence;
  if (sequence === undefined) return;
  pane.value
    ?.querySelector(`[data-message-sequence="${sequence}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: props.prefersReducedMotion ? 'auto' : 'smooth' });
}

// When the visible chat shrinks (reply preview, mobile keyboard), keep the reader's place: the quoted
// message while replying, otherwise the newest messages if the reader was already at the bottom.
function keepPlaceAfterResize() {
  if (replyTo.value) revealQuotedMessage();
  else if (wasNearBottom) scrollToBottom('auto');
}

watch(
  pane,
  (element, previous) => {
    if (previous) paneResizeObserver?.unobserve(previous);
    if (!element) return;
    if (pendingBottomScroll) requestAnimationFrame(applyPendingBottomScroll);
    if ('ResizeObserver' in window) {
      paneResizeObserver ??= new ResizeObserver(keepPlaceAfterResize);
      paneResizeObserver.observe(element);
    }
  },
  { flush: 'post' },
);

watch(
  () => props.messages.length,
  () => {
    if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateScrollState);
  },
  { flush: 'post' },
);
function flash(sequence: number) {
  highlightedSequence.value = null;
  window.clearTimeout(highlightTimer);
  // Re-adding the class on the next frame restarts the animation for repeated targets.
  requestAnimationFrame(() => {
    highlightedSequence.value = sequence;
    highlightTimer = window.setTimeout(() => (highlightedSequence.value = null), 900);
  });
}

function startReply(message: ConversationMessage) {
  // Only other people's messages can be quoted.
  if (props.isLocal(message)) return;
  replyTo.value = message;
  reactionPickerSequence.value = null;
  flash(message.sequence);
  focusComposer();
  window.clearTimeout(revealTimer);
  revealTimer = window.setTimeout(revealQuotedMessage, props.prefersReducedMotion ? 0 : REPLY_PREVIEW_SETTLE_MS);
}

// The picker stays open so several reactions can be toggled; a press outside it closes it.
function react(message: ConversationMessage, emoji: string) {
  emit('react', message, emoji);
}

async function copyMessage(message: ConversationMessage) {
  try {
    await navigator.clipboard.writeText(message.content);
    toast({ title: 'Message copied', variant: 'success' });
  } catch (error) {
    console.error('[ChatPane] Failed to copy message:', error);
    toast({ title: 'Could not copy the message.', variant: 'destructive' });
  }
}

function jumpToMessage(sequence: number) {
  const target = pane.value?.querySelector(`[data-message-sequence="${sequence}"]`);
  if (!target) {
    toast({ title: 'The quoted message is further back in the history.' });
    return;
  }
  target.scrollIntoView({ block: 'center', behavior: props.prefersReducedMotion ? 'auto' : 'smooth' });
  flash(sequence);
}

// One reaction picker at a time; a press anywhere outside it closes it.
function closeReactionPickerOnOutsidePress(event: PointerEvent) {
  if (!(event.target as Element | null)?.closest('[data-reaction-picker]')) reactionPickerSequence.value = null;
}

watch(reactionPickerSequence, (sequence) => {
  if (sequence === null) document.removeEventListener('pointerdown', closeReactionPickerOnOutsidePress, true);
  else document.addEventListener('pointerdown', closeReactionPickerOnOutsidePress, true);
});

watch(
  () => props.conversation?.id,
  () => {
    reactionPickerSequence.value = null;
    highlightedSequence.value = null;
  },
);

function onEdgePointerDown(event: PointerEvent) {
  if (props.isDesktop || event.pointerType === 'mouse') return;
  if ((event.target as Element | null)?.closest(BACK_SWIPE_EXCLUDED)) return;
  edgeSwipe = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, axis: null };
}

function isGroupedWithPrevious(index: number) {
  const message = props.messages[index];
  const previous = props.messages[index - 1];
  if (!message || !previous || previous.senderId !== message.senderId) return false;
  return Date.parse(message.createdAt) - Date.parse(previous.createdAt) < MESSAGE_GROUP_WINDOW_MS;
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

// Mobile keyboards often shrink only the visual viewport, which a resize observer cannot see.
window.visualViewport?.addEventListener('resize', keepPlaceAfterResize);

onBeforeUnmount(() => {
  window.clearTimeout(highlightTimer);
  window.clearTimeout(revealTimer);
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  paneResizeObserver?.disconnect();
  window.visualViewport?.removeEventListener('resize', keepPlaceAfterResize);
  document.removeEventListener('pointerdown', closeReactionPickerOnOutsidePress, true);
});

defineExpose({ scrollToBottom, getScrollState, restoreScroll, focusComposer });
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
        <div v-if="conversation" class="flex min-h-0 flex-1 flex-col">
          <div class="relative flex min-h-0 flex-1 flex-col">
            <div
              ref="pane"
              class="harbor-chat-canvas min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
              aria-label="Message history"
              @scroll.passive="onPaneScroll"
            >
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
              <div v-if="loadingOlder" class="flex justify-center pb-4">
                <LoadingRipple class="size-5 text-[#0B7A75]" />
              </div>
              <div v-if="loading && !messages.length" class="flex h-full items-center justify-center">
                <LoadingRipple class="size-7 text-[#0B7A75]" />
              </div>
              <p v-else-if="!messages.length" class="py-10 text-center text-sm text-[#61777B]">
                No messages yet. Start the conversation.
              </p>
              <ol v-else>
                <ChatMessage
                  v-for="(message, index) in messages"
                  :key="message.sequence"
                  :message="message"
                  :grouped="isGroupedWithPrevious(index)"
                  :first="index === 0"
                  :show-sender="selectedIsGroup"
                  :local="isLocal(message)"
                  :animate-in="shouldAnimate(message)"
                  :highlighted="highlightedSequence === message.sequence"
                  :reaction-picker-open="reactionPickerSequence === message.sequence"
                  :prefers-reduced-motion="prefersReducedMotion"
                  :format-time="formatTime"
                  @reply="startReply(message)"
                  @react="(emoji) => react(message, emoji)"
                  @open-reactions="reactionPickerSequence = message.sequence"
                  @copy="copyMessage(message)"
                  @jump-to="jumpToMessage"
                />
              </ol>
            </div>
            <AnimatePresence>
              <motion.button
                v-if="showJumpToLatest"
                type="button"
                data-jump-to-latest
                :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.6, y: 12 }"
                :animate="{ opacity: 1, scale: 1, y: 0 }"
                :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.6, y: 12 }"
                :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 30 }"
                class="absolute bottom-4 right-4 z-30 flex size-11 items-center justify-center rounded-full bg-white text-[#0B7A75] shadow-[0_6px_20px_rgba(16,47,53,0.18),0_1px_3px_rgba(16,47,53,0.1)] [@media(hover:hover)]:hover:bg-[#E6F4F1] [@media(hover:hover)]:hover:text-[#102F35]"
                aria-label="Scroll to the latest message"
                title="Scroll to the latest message"
                @click="jumpToLatest"
              >
                <ArrowDown class="size-5" />
              </motion.button>
            </AnimatePresence>
          </div>
          <div class="border-t border-[#E5EFEC] bg-white px-4 py-3 sm:px-6">
            <p class="mb-2 text-xs text-[#61777B]">Messages stored by OpenMeet</p>
            <AnimatePresence>
              <motion.div
                v-if="replyTo"
                data-reply-preview
                :initial="prefersReducedMotion ? false : { opacity: 0, y: 10, height: 0 }"
                :animate="{ opacity: 1, y: 0, height: 'auto' }"
                :exit="prefersReducedMotion ? undefined : { opacity: 0, y: 10, height: 0 }"
                :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }"
                class="overflow-hidden"
              >
                <div class="mb-2 flex items-center gap-2.5 rounded-2xl bg-[#F3F5F4] px-3 py-2">
                  <span
                    class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#0B7A75] shadow-[0_1px_2px_rgba(16,47,53,0.08)]"
                    ><Reply class="size-3.5"
                  /></span>
                  <div class="min-w-0 flex-1 text-xs">
                    <p class="font-semibold text-[#102F35]">
                      Replying to {{ isLocal(replyTo) ? 'yourself' : replyTo.senderName }}
                    </p>
                    <p class="truncate text-[#4E6B70]">{{ replyTo.content }}</p>
                  </div>
                  <button
                    type="button"
                    class="harbor-ghost-action shrink-0 rounded-full p-1 text-[#27595D]"
                    aria-label="Cancel reply"
                    @click="replyTo = null"
                  >
                    <X class="size-4" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
            <form class="flex items-end gap-2" @submit.prevent="emit('send')">
              <textarea
                ref="composer"
                v-model="content"
                rows="1"
                maxlength="2000"
                placeholder="Write a message"
                aria-label="Message"
                class="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-transparent bg-[#F3F5F4] px-3 py-2.5 text-sm text-[#102F35] placeholder:text-[#8A9C9E] focus-visible:border-[#D8E7E3] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-0"
                @keydown.enter.exact.prevent="emit('send')"
                @keydown.esc="replyTo = null"
              />
              <EmojiPickerButton
                v-model="content"
                :composer="composer"
                :prefers-reduced-motion="prefersReducedMotion"
              />
              <Button
                type="submit"
                class="harbor-primary-action h-11 rounded-xl bg-[#0B7A75] px-4 text-white"
                :disabled="!content.trim() || loading || sending"
                >{{ sending ? 'Sending...' : 'Send' }}</Button
              >
            </form>
          </div>
        </div>
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

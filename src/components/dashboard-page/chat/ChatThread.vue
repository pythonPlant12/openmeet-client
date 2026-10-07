<script setup lang="ts">
import { ArrowDown, Reply, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import ChatMessage from '@/components/dashboard-page/chat/ChatMessage.vue';
import EmojiPickerButton from '@/components/dashboard-page/chat/EmojiPickerButton.vue';
import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import type { ConversationMessage } from '@/services/social-api';

// The message list and composer shared by conversations and the meeting chat.
const props = withDefaults(
  defineProps<{
    /** Changing it (another conversation or room) closes pickers and highlights. */
    threadKey: string | null;
    messages: ConversationMessage[];
    loading?: boolean;
    loadingOlder?: boolean;
    sending?: boolean;
    showSender: boolean;
    prefersReducedMotion: boolean;
    shouldAnimate: (message: ConversationMessage) => boolean;
    isLocal: (message: ConversationMessage) => boolean;
    formatTime: (value: string) => string;
    emptyText?: string;
    footerNote?: string;
    placeholder?: string;
    sendLabel?: string;
  }>(),
  {
    loading: false,
    loadingOlder: false,
    sending: false,
    emptyText: 'No messages yet. Start the conversation.',
    footerNote: undefined,
    placeholder: 'Write a message',
    sendLabel: 'Send',
  },
);
const emit = defineEmits<{
  (event: 'scroll-top'): void;
  (event: 'send'): void;
  (event: 'react', message: ConversationMessage, emoji: string): void;
}>();
const content = defineModel<string>('content', { required: true });
const replyTo = defineModel<ConversationMessage | null>('replyTo', { default: null });
const reactionPickerSequence = ref<number | null>(null);
const highlightedSequence = ref<number | null>(null);
let highlightTimer: number | undefined;
// Consecutive messages from one sender within this window are grouped tightly.
const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;
const pane = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const composer = ref<HTMLTextAreaElement | null>(null);
let pendingBottomScroll: ScrollBehavior | null = null;

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

function isNearBottom() {
  return wasNearBottom;
}

function onPaneScroll() {
  if (pane.value && pane.value.scrollTop < 80) emit('scroll-top');
  if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateScrollState);
}

// The button stays during the smooth scroll and leaves through the scroll handler once near the bottom.
function jumpToLatest() {
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

// Messages grow after they render when link and meeting cards load their details. Without this the
// newest messages slide out of view right after a chat opens. New messages scroll on their own.
let listResizeObserver: ResizeObserver | undefined;
let observedMessageCount = 0;
function keepBottomAfterListResize() {
  const count = props.messages.length;
  if (count !== observedMessageCount) {
    observedMessageCount = count;
    return;
  }
  if (wasNearBottom && !replyTo.value) scrollToBottom('auto');
}

watch(
  list,
  (element, previous) => {
    if (previous) listResizeObserver?.unobserve(previous);
    if (!element || !('ResizeObserver' in window)) return;
    listResizeObserver ??= new ResizeObserver(keepBottomAfterListResize);
    listResizeObserver.observe(element);
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

function react(message: ConversationMessage, emoji: string) {
  reactionPickerSequence.value = null;
  emit('react', message, emoji);
}

async function copyMessage(message: ConversationMessage) {
  try {
    await navigator.clipboard.writeText(message.content);
    toast({ title: 'Message copied', variant: 'success' });
  } catch (error) {
    console.error('[ChatThread] Failed to copy message:', error);
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
  () => props.threadKey,
  () => {
    reactionPickerSequence.value = null;
    highlightedSequence.value = null;
  },
);

function isGroupedWithPrevious(index: number) {
  const message = props.messages[index];
  const previous = props.messages[index - 1];
  if (!message || !previous || previous.senderId !== message.senderId) return false;
  return Date.parse(message.createdAt) - Date.parse(previous.createdAt) < MESSAGE_GROUP_WINDOW_MS;
}

// Mobile keyboards often shrink only the visual viewport, which a resize observer cannot see.
window.visualViewport?.addEventListener('resize', keepPlaceAfterResize);

onBeforeUnmount(() => {
  window.clearTimeout(highlightTimer);
  window.clearTimeout(revealTimer);
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  paneResizeObserver?.disconnect();
  listResizeObserver?.disconnect();
  window.visualViewport?.removeEventListener('resize', keepPlaceAfterResize);
  document.removeEventListener('pointerdown', closeReactionPickerOnOutsidePress, true);
});

defineExpose({ scrollToBottom, getScrollState, isNearBottom, restoreScroll, focusComposer });
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="pane"
        class="harbor-chat-canvas min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        aria-label="Message history"
        @scroll.passive="onPaneScroll"
      >
        <slot name="notice" />
        <div v-if="loadingOlder" class="flex justify-center pb-4">
          <LoadingRipple class="size-5 text-[#0B7A75]" />
        </div>
        <div v-if="loading && !messages.length" class="flex h-full items-center justify-center">
          <LoadingRipple class="size-7 text-[#0B7A75]" />
        </div>
        <p v-else-if="!messages.length" class="py-10 text-center text-sm text-[#61777B]">
          {{ emptyText }}
        </p>
        <ol v-else ref="list">
          <ChatMessage
            v-for="(message, index) in messages"
            :key="message.sequence"
            :message="message"
            :grouped="isGroupedWithPrevious(index)"
            :first="index === 0"
            :show-sender="showSender"
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
      <p v-if="footerNote" class="mb-2 text-xs text-[#61777B]">{{ footerNote }}</p>
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
          :placeholder="placeholder"
          aria-label="Message"
          class="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-transparent bg-[#F3F5F4] px-3 py-2.5 text-sm text-[#102F35] placeholder:text-[#8A9C9E] focus-visible:border-[#D8E7E3] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-0"
          @keydown.enter.exact.prevent="emit('send')"
          @keydown.esc="replyTo = null"
        />
        <EmojiPickerButton v-model="content" :composer="composer" :prefers-reduced-motion="prefersReducedMotion" />
        <Button
          type="submit"
          class="harbor-primary-action h-11 rounded-xl bg-[#0B7A75] px-4 text-white"
          :disabled="!content.trim() || loading || sending"
          >{{ sending ? 'Sending...' : sendLabel }}</Button
        >
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, ArrowUp, FileText, Image, Paperclip, Reply, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import ChatMessage from '@/components/dashboard-page/chat/ChatMessage.vue';
import EmojiPickerButton from '@/components/dashboard-page/chat/EmojiPickerButton.vue';
import FilePreview from '@/components/dashboard-page/chat/FilePreview.vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import type { ConversationMessage, ConversationMessageAttachment } from '@/services/social-api';

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
    attachmentUrls?: Record<string, string>;
    isAttachmentLoading?: (path: string) => boolean;
    hasAttachmentError?: (path: string) => boolean;
    loadAttachment?: (path: string) => void;
    unreadStartSequence?: number | null;
    attachmentsEnabled?: boolean;
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
    attachmentUrls: () => ({}),
    isAttachmentLoading: () => false,
    hasAttachmentError: () => false,
    loadAttachment: () => undefined,
    unreadStartSequence: null,
    attachmentsEnabled: true,
  },
);
const emit = defineEmits<{
  (event: 'scroll-top'): void;
  (event: 'load-unread', sequence: number): void;
  (event: 'send'): void;
  (event: 'react', message: ConversationMessage, emoji: string): void;
}>();
const content = defineModel<string>('content', { required: true });
const replyTo = defineModel<ConversationMessage | null>('replyTo', { default: null });
const attachments = defineModel<File[]>('attachments', { default: () => [] });
const reactionPickerSequence = ref<number | null>(null);
const highlightedSequence = ref<number | null>(null);
const previewAttachments = ref<ConversationMessageAttachment[]>([]);
const previewIndex = ref(0);
let highlightTimer: number | undefined;
// Consecutive messages from one sender within this window are grouped tightly.
const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;
const pane = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const composer = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const mediaInput = ref<HTMLInputElement | null>(null);
const previewUrls = new Map<File, string>();
let pendingBottomScroll: ScrollBehavior | null = null;

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;

function chooseAttachments(kind: 'file' | 'media') {
  if (props.sending) return;
  (kind === 'file' ? fileInput.value : mediaInput.value)?.click();
}

function addAttachments(event: Event) {
  if (props.sending) return;
  const input = event.target as HTMLInputElement;
  const selected = [...(input.files ?? [])];
  input.value = '';
  let totalSize = attachments.value.reduce((sum, attachment) => sum + attachment.size, 0);
  let rejectedForSize = false;
  let rejectedForTotal = false;
  const allowed = selected.filter((file) => {
    if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
      rejectedForSize = true;
      return false;
    }
    if (totalSize + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
      rejectedForTotal = true;
      return false;
    }
    totalSize += file.size;
    return true;
  });
  if (rejectedForSize) {
    toast({ title: 'Each attachment must be between 1 byte and 25 MB.', variant: 'destructive' });
  }
  if (rejectedForTotal)
    toast({ title: 'Attachments in one message must total 25 MB or less.', variant: 'destructive' });
  const available = MAX_ATTACHMENTS - attachments.value.length;
  if (allowed.length > available) {
    toast({ title: `You can send up to ${MAX_ATTACHMENTS} attachments at once.`, variant: 'destructive' });
  }
  if (available > 0) attachments.value = [...attachments.value, ...allowed.slice(0, available)];
}

function removeAttachment(file: File) {
  if (props.sending) return;
  attachments.value = attachments.value.filter((attachment) => attachment !== file);
  const previewUrl = previewUrls.get(file);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrls.delete(file);
}

function previewUrl(file: File) {
  let url = previewUrls.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    previewUrls.set(file, url);
  }
  return url;
}

function isVisualAttachment(file: File) {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

function isVideoAttachment(file: File) {
  return file.type.startsWith('video/');
}

function formatFileSize(byteSize: number) {
  if (byteSize < 1024 * 1024) return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(byteSize >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
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
const showJumpToLatest = ref(false);
const showJumpToUnread = ref(false);
let wasNearBottom = true;
let scrollFrame: number | undefined;
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
  showJumpToUnread.value = wasNearBottom && props.unreadStartSequence !== null;
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

function scrollToMessage(sequence: number) {
  const target = pane.value?.querySelector(`[data-message-sequence="${sequence}"]`);
  if (!target) return false;
  target.scrollIntoView({ block: 'center', behavior: props.prefersReducedMotion ? 'auto' : 'smooth' });
  return true;
}

function jumpToUnread() {
  const sequence = props.unreadStartSequence;
  if (sequence === null) return;
  if (!scrollToMessage(sequence)) emit('load-unread', sequence);
}

// Keep a reader who was at the bottom pinned there when the composer or mobile keyboard changes
// the pane height. Readers browsing older messages retain their exact position.
function keepBottomAfterPaneResize() {
  if (wasNearBottom) scrollToBottom('auto');
}

watch(
  pane,
  (element, previous) => {
    if (previous) paneResizeObserver?.unobserve(previous);
    if (!element || !('ResizeObserver' in window)) return;
    paneResizeObserver ??= new ResizeObserver(keepBottomAfterPaneResize);
    paneResizeObserver.observe(element);
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
  if (wasNearBottom) scrollToBottom('auto');
}

watch(
  list,
  (element, previous) => {
    if (previous) listResizeObserver?.unobserve(previous);
    if (!element || !('ResizeObserver' in window)) return;
    observedMessageCount = props.messages.length;
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
  focusComposer();
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
  if (!scrollToMessage(sequence)) {
    toast({ title: 'The quoted message is further back in the history.' });
    return;
  }
  flash(sequence);
}

function openPreview(nextAttachments: ConversationMessageAttachment[], index: number) {
  previewAttachments.value = nextAttachments;
  previewIndex.value = index;
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

watch(
  () => props.unreadStartSequence,
  () => updateScrollState(),
);

watch(attachments, (nextAttachments) => {
  for (const [file, url] of previewUrls) {
    if (!nextAttachments.includes(file)) {
      URL.revokeObjectURL(url);
      previewUrls.delete(file);
    }
  }
});

window.visualViewport?.addEventListener('resize', keepBottomAfterPaneResize);

function isGroupedWithPrevious(index: number) {
  const message = props.messages[index];
  const previous = props.messages[index - 1];
  if (!message || !previous || previous.senderId !== message.senderId) return false;
  return Date.parse(message.createdAt) - Date.parse(previous.createdAt) < MESSAGE_GROUP_WINDOW_MS;
}

onBeforeUnmount(() => {
  window.clearTimeout(highlightTimer);
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  paneResizeObserver?.disconnect();
  listResizeObserver?.disconnect();
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  window.visualViewport?.removeEventListener('resize', keepBottomAfterPaneResize);
  document.removeEventListener('pointerdown', closeReactionPickerOnOutsidePress, true);
});

defineExpose({ scrollToBottom, getScrollState, isNearBottom, restoreScroll, focusComposer, scrollToMessage });
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
          <template v-for="(message, index) in messages" :key="message.sequence">
            <li
              v-if="message.sequence === unreadStartSequence"
              data-unread-divider
              class="my-5 flex items-center gap-3 text-xs font-semibold text-[#4E6B70]"
            >
              <span class="h-px flex-1 bg-[#D8E7E3]" /><span>Unread messages</span
              ><span class="h-px flex-1 bg-[#D8E7E3]" />
            </li>
            <ChatMessage
              :message="message"
              :grouped="isGroupedWithPrevious(index)"
              :first="index === 0"
              :show-sender="showSender"
              :local="isLocal(message)"
              :animate-in="shouldAnimate(message)"
              :highlighted="highlightedSequence === message.sequence"
              :reply-selected="replyTo?.sequence === message.sequence"
              :reaction-picker-open="reactionPickerSequence === message.sequence"
              :prefers-reduced-motion="prefersReducedMotion"
              :format-time="formatTime"
              :attachment-urls="attachmentUrls"
              :is-attachment-loading="isAttachmentLoading"
              :has-attachment-error="hasAttachmentError"
              :load-attachment="loadAttachment"
              @reply="startReply(message)"
              @react="(emoji) => react(message, emoji)"
              @open-reactions="reactionPickerSequence = message.sequence"
              @copy="copyMessage(message)"
              @jump-to="jumpToMessage"
              @preview="openPreview"
            />
          </template>
        </ol>
      </div>
      <AnimatePresence>
        <motion.button
          v-if="showJumpToUnread || showJumpToLatest"
          type="button"
          data-jump-to-latest
          :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.6, y: 12 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.6, y: 12 }"
          :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 30 }"
          class="absolute bottom-4 right-4 z-30 flex size-11 items-center justify-center rounded-full bg-white text-[#0B7A75] shadow-[0_6px_20px_rgba(16,47,53,0.18),0_1px_3px_rgba(16,47,53,0.1)] [@media(hover:hover)]:hover:bg-[#E6F4F1] [@media(hover:hover)]:hover:text-[#102F35]"
          :aria-label="showJumpToUnread ? 'Go to unread messages' : 'Scroll to the latest message'"
          :title="showJumpToUnread ? 'Go to unread messages' : 'Scroll to the latest message'"
          @click="showJumpToUnread ? jumpToUnread() : jumpToLatest()"
        >
          <ArrowUp v-if="showJumpToUnread" class="size-5" /><ArrowDown v-else class="size-5" />
        </motion.button>
      </AnimatePresence>
    </div>
    <FilePreview
      v-if="previewAttachments.length"
      :attachments="previewAttachments"
      v-model:active-index="previewIndex"
      :attachment-urls="attachmentUrls"
      @close="previewAttachments = []"
    />
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
          class="cursor-pointer overflow-hidden"
          role="button"
          tabindex="0"
          @click="jumpToMessage(replyTo.sequence)"
          @keydown.enter.prevent="jumpToMessage(replyTo.sequence)"
          @keydown.space.prevent="jumpToMessage(replyTo.sequence)"
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
              @click.stop="replyTo = null"
            >
              <X class="size-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence v-if="attachmentsEnabled">
        <motion.div
          v-if="attachments.length"
          :initial="prefersReducedMotion ? false : { opacity: 0, y: 8, height: 0 }"
          :animate="{ opacity: 1, y: 0, height: 'auto' }"
          :exit="prefersReducedMotion ? undefined : { opacity: 0, y: 8, height: 0 }"
          :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }"
          class="overflow-hidden"
        >
          <div class="mb-2 flex gap-2 overflow-x-auto rounded-2xl bg-[#EDF8F5] p-2">
            <article
              v-for="attachment in attachments"
              :key="`${attachment.name}-${attachment.lastModified}-${attachment.size}`"
              class="relative flex w-32 shrink-0 flex-col overflow-hidden rounded-xl border border-[#D8E7E3] bg-white text-[#102F35]"
            >
              <img
                v-if="attachment.type.startsWith('image/')"
                :src="previewUrl(attachment)"
                :alt="attachment.name"
                class="aspect-[4/3] w-full object-cover"
              />
              <video
                v-else-if="isVideoAttachment(attachment)"
                :src="previewUrl(attachment)"
                muted
                playsinline
                preload="metadata"
                class="aspect-[4/3] w-full bg-[#102F35] object-cover"
              />
              <div v-else class="flex aspect-[4/3] items-center justify-center bg-[#F3F5F4] text-[#0B7A75]">
                <FileText class="size-7" />
              </div>
              <div class="min-w-0 px-2 py-1.5">
                <p class="truncate text-xs font-semibold">{{ attachment.name }}</p>
                <p class="text-[0.6875rem] text-[#61777B]">{{ formatFileSize(attachment.size) }}</p>
              </div>
              <button
                type="button"
                class="harbor-ghost-action absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-[#102F35]/75 text-white [@media(hover:hover)]:hover:bg-[#102F35]"
                :aria-label="`Remove ${attachment.name}`"
                :disabled="sending"
                @click="removeAttachment(attachment)"
              >
                <X class="size-3.5" />
              </button>
              <span v-if="isVisualAttachment(attachment)" class="sr-only">Media attachment</span>
            </article>
          </div>
        </motion.div>
      </AnimatePresence>
      <form class="flex items-end gap-2" @submit.prevent="emit('send')">
        <input ref="fileInput" type="file" multiple class="sr-only" @change="addAttachments" />
        <input
          ref="mediaInput"
          type="file"
          accept="image/*,video/*"
          multiple
          class="sr-only"
          @change="addAttachments"
        />
        <DropdownMenu v-if="attachmentsEnabled">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="harbor-ghost-action flex size-11 shrink-0 items-center justify-center rounded-xl text-[#0B7A75]"
              aria-label="Add an attachment"
              title="Add an attachment"
              :disabled="sending"
            >
              <Paperclip class="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            class="harbor-action-menu min-w-44 rounded-2xl border-[#D8E7E3] bg-white p-1.5 text-[#102F35]"
          >
            <DropdownMenuItem
              class="harbor-context-menu-item min-h-10 cursor-pointer rounded-xl px-3 py-2 font-semibold"
              :disabled="sending"
              @select="chooseAttachments('file')"
            >
              <FileText class="size-4" />Attach file
            </DropdownMenuItem>
            <DropdownMenuItem
              class="harbor-context-menu-item min-h-10 cursor-pointer rounded-xl px-3 py-2 font-semibold"
              :disabled="sending"
              @select="chooseAttachments('media')"
            >
              <Image class="size-4" />Send media
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <textarea
          ref="composer"
          v-model="content"
          rows="1"
          maxlength="2000"
          :placeholder="placeholder"
          :disabled="sending"
          aria-label="Message"
          class="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-transparent bg-[#F3F5F4] px-3 py-2.5 text-sm text-[#102F35] placeholder:text-[#8A9C9E] focus-visible:border-[#D8E7E3] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-0"
          @keydown.enter.exact.prevent="emit('send')"
          @keydown.esc="replyTo = null"
        />
        <EmojiPickerButton
          v-model="content"
          :composer="composer"
          :prefers-reduced-motion="prefersReducedMotion"
          :disabled="sending"
        />
        <Button
          type="submit"
          class="harbor-primary-action h-11 rounded-xl bg-[#0B7A75] px-4 text-white"
          :disabled="(!content.trim() && (!attachmentsEnabled || !attachments.length)) || loading || sending"
          >{{ sending ? 'Sending...' : sendLabel }}</Button
        >
      </form>
    </div>
  </div>
</template>

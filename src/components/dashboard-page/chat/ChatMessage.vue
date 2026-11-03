<script setup lang="ts">
import { Copy, CornerUpLeft, Download, FileText, Reply, SmilePlus } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref } from 'vue';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import type { ConversationMessage, ConversationMessageAttachment } from '@/services/social-api';

import MessageContent from './MessageContent.vue';
import VoiceMessagePlayer from './VoiceMessagePlayer.vue';
import { replyAttachmentLabel } from './chat-composer';
import { QUICK_REACTIONS } from './reactions';
import { type SenderAvatar, isAudioAttachment } from './voice-message';

const props = defineProps<{
  message: ConversationMessage;
  local: boolean;
  /** Follows a message from the same sender, so the name and spacing are tightened. */
  grouped: boolean;
  /** Group chats name the sender of incoming messages. */
  showSender: boolean;
  /** The first visible message opens its reaction picker below, so the list edge cannot clip it. */
  first?: boolean;
  animateIn: boolean;
  highlighted: boolean;
  reactionPickerOpen: boolean;
  replySelected: boolean;
  prefersReducedMotion: boolean;
  formatTime: (value: string) => string;
  attachmentUrls: Record<string, string>;
  isAttachmentLoading: (path: string) => boolean;
  hasAttachmentError: (path: string) => boolean;
  loadAttachment: (path: string) => void;
  /** The sender's picture, shown beside voice messages. */
  senderAvatar?: SenderAvatar;
}>();
const emit = defineEmits<{
  (event: 'reply'): void;
  (event: 'react', emoji: string): void;
  (event: 'open-reactions'): void;
  (event: 'copy'): void;
  (event: 'jump-to', sequence: number): void;
  (event: 'preview', attachments: ConversationMessageAttachment[], index: number): void;
}>();

// Swipes only need a short pull on a message; nothing rests open.
const SWIPE_DISTANCE = 56;
// A message never travels farther than this either way, however far the finger goes.
const MAX_SWIPE_DISTANCE = 84;

const reactions = computed(() => props.message.reactions ?? []);
const myReactions = computed(
  () => new Set(reactions.value.filter((reaction) => reaction.reactedByMe).map((reaction) => reaction.emoji)),
);
// Only other people's messages can be quoted.
const canReply = computed(() => !props.local);
const isMenuOpen = ref(false);
// A message lifts only for an open menu, reaction picker, or selected reply.
const isLifted = computed(() => props.replySelected || props.reactionPickerOpen || isMenuOpen.value);
const attachments = computed(() => props.message.attachments ?? []);
const visibleAttachments = computed(() => attachments.value.slice(0, 4));
// A lone voice message shows its time beside the duration instead of on its own row.
const voiceOnly = computed(
  () =>
    !props.message.content && attachments.value.length === 1 && isAudioAttachment(attachments.value[0]!.contentType),
);
const hiddenAttachmentCount = computed(() => Math.max(attachments.value.length - visibleAttachments.value.length, 0));
const quotedAttachmentLabel = computed(() =>
  props.message.replyTo ? replyAttachmentLabel(props.message.replyTo) : '',
);
const initial = computed(() =>
  props.animateIn && !props.prefersReducedMotion
    ? props.local
      ? { opacity: 0, x: 14, y: 18, scale: 0.86 }
      : { opacity: 0, x: -10, y: 14, scale: 0.92 }
    : false,
);

function isImage(contentType: string) {
  return contentType.startsWith('image/');
}

function isVideo(contentType: string) {
  return contentType.startsWith('video/');
}

function isPdf(contentType: string) {
  return contentType === 'application/pdf';
}

function fileExtension(fileName: string) {
  const extension = fileName.split('.').pop();
  return extension && extension !== fileName ? extension.toUpperCase() : 'FILE';
}

function formatFileSize(byteSize: number) {
  if (byteSize < 1024 * 1024) return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(byteSize >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
</script>

<template>
  <motion.li
    :data-message-sequence="message.sequence"
    :initial="initial"
    :animate="{ opacity: 1, x: 0, y: 0, scale: 1 }"
    :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: 'easeOut' }"
    class="relative flex flex-col"
    :class="[local ? 'items-end' : 'items-start', 'mt-2.5 first:mt-0', { 'z-10': isLifted || highlighted }]"
  >
    <SwipeableRow
      :id="`message-${message.sequence}`"
      class="-mx-2 w-[calc(100%+1rem)] px-2"
      clip-horizontally
      :leading-width="canReply ? SWIPE_DISTANCE : 0"
      :trailing-width="SWIPE_DISTANCE"
      :full-swipe-distance="SWIPE_DISTANCE"
      :max-distance="MAX_SWIPE_DISTANCE"
      :full-swipe-leading="canReply"
      full-swipe-trailing
      momentary
      @full-swipe-leading="emit('reply')"
      @full-swipe-trailing="emit('open-reactions')"
    >
      <template v-if="canReply" #leading="{ armed }">
        <span class="flex flex-1 items-center justify-start pl-2" aria-hidden="true">
          <span
            class="flex size-8 items-center justify-center rounded-full transition-[transform,background-color,color] duration-150"
            :class="armed ? 'scale-110 bg-harbor-icon text-white' : 'bg-white text-harbor-icon shadow-sm'"
            ><Reply class="size-4"
          /></span>
        </span>
      </template>
      <template #trailing="{ armed }">
        <span class="flex flex-1 items-center justify-end pr-2" aria-hidden="true">
          <span
            class="flex size-8 items-center justify-center rounded-full transition-[transform,background-color,color] duration-150"
            :class="armed ? 'scale-110 bg-harbor-icon text-white' : 'bg-white text-harbor-icon shadow-sm'"
            ><SmilePlus class="size-4"
          /></span>
        </span>
      </template>
      <ContextMenu :press-open-delay="450" @update:open="isMenuOpen = $event">
        <ContextMenuTrigger as-child>
          <div class="flex w-full" :class="local ? 'justify-end' : 'justify-start'">
            <motion.article
              data-message-bubble
              :data-repliable="canReply"
              :animate="isLifted ? { scale: 1.02, y: -2 } : { scale: 1, y: 0 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }"
              class="max-w-[82%] rounded-[1.15rem] px-3 pb-1.5 pt-2 text-[0.9375rem] transition-shadow duration-200 sm:max-w-[68%] [@media(pointer:coarse)]:select-none"
              :class="[
                local ? 'bg-harbor-accent-soft text-harbor-ink' : 'bg-white text-harbor-ink',
                !grouped && (local ? 'rounded-br-md' : 'rounded-bl-md'),
                isLifted ? 'harbor-message-lifted' : 'harbor-message-resting',
                { 'harbor-message-flash': highlighted && !replySelected },
              ]"
            >
              <p v-if="showSender && !local && !grouped" class="mb-0.5 text-xs font-semibold text-harbor-accent">
                {{ message.senderName }}
                <span v-if="message.senderNickname" class="font-medium text-harbor-subtle"
                  >@{{ message.senderNickname }}</span
                >
              </p>
              <button
                v-if="message.replyTo"
                type="button"
                data-message-quote
                class="mb-1.5 mt-0.5 block w-full rounded-xl bg-harbor-ink/[0.05] px-2.5 py-2 text-left text-xs text-harbor-ink-soft transition-colors [@media(hover:hover)]:hover:bg-harbor-ink/[0.08]"
                :aria-label="`Show the message from ${message.replyTo.senderName}`"
                @click="emit('jump-to', message.replyTo.sequence)"
              >
                <span class="mb-0.5 flex items-center gap-1 font-semibold text-harbor-ink"
                  ><CornerUpLeft class="size-3 shrink-0" />{{ message.replyTo.senderName }}</span
                >
                <span class="line-clamp-2 block leading-snug">
                  <template v-if="quotedAttachmentLabel">
                    <strong v-if="message.replyTo.content" class="block font-semibold">{{
                      quotedAttachmentLabel
                    }}</strong>
                    <span v-else>{{ quotedAttachmentLabel }}</span>
                    <span v-if="message.replyTo.content" class="block">{{ message.replyTo.content }}</span>
                  </template>
                  <template v-else>{{ message.replyTo.content }}</template>
                </span>
              </button>
              <div
                v-if="attachments.length"
                class="grid gap-1.5"
                :class="[visibleAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2', { 'mb-1.5': !voiceOnly }]"
              >
                <template v-for="(attachment, index) in visibleAttachments" :key="attachment.id">
                  <VoiceMessagePlayer
                    v-if="isAudioAttachment(attachment.contentType)"
                    :class="{ 'col-span-2': visibleAttachments.length > 1 }"
                    :attachment="attachment"
                    :url="attachmentUrls[attachment.url]"
                    :loading="isAttachmentLoading(attachment.url)"
                    :error="hasAttachmentError(attachment.url)"
                    :sent-at="voiceOnly ? message.createdAt : undefined"
                    :avatar="visibleAttachments.length === 1 ? senderAvatar : undefined"
                    :format-time="formatTime"
                    @load="loadAttachment(attachment.url)"
                  />
                  <button
                    v-else-if="isImage(attachment.contentType) && attachmentUrls[attachment.url]"
                    type="button"
                    class="relative block overflow-hidden rounded-xl bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    @click="emit('preview', attachments, index)"
                  >
                    <img
                      :src="attachmentUrls[attachment.url]"
                      :alt="attachment.fileName"
                      class="max-h-72 w-full object-cover"
                    /><span
                      v-if="index === 3 && hiddenAttachmentCount"
                      class="absolute inset-0 flex items-center justify-center bg-harbor-ink/45 text-xl font-bold text-white backdrop-blur-sm"
                      >+{{ hiddenAttachmentCount }}</span
                    >
                  </button>
                  <video
                    v-else-if="isVideo(attachment.contentType) && attachmentUrls[attachment.url]"
                    :src="attachmentUrls[attachment.url]"
                    controls
                    playsinline
                    preload="metadata"
                    class="max-h-72 w-full rounded-xl bg-harbor-ink"
                  />
                  <button
                    v-else-if="isPdf(attachment.contentType) && attachmentUrls[attachment.url]"
                    type="button"
                    class="flex min-h-20 items-center gap-2 rounded-xl bg-harbor-ink/[0.05] px-2.5 py-2 text-left text-harbor-ink transition-colors [@media(hover:hover)]:hover:bg-harbor-ink/[0.08]"
                    @click="emit('preview', attachments, index)"
                  >
                    <FileText class="size-5 shrink-0" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-xs font-semibold">{{ attachment.fileName }}</span>
                      <span class="block text-[0.6875rem] opacity-75">{{ formatFileSize(attachment.byteSize) }}</span>
                    </span>
                    <Download class="size-4 shrink-0" />
                  </button>
                  <a
                    v-else-if="attachmentUrls[attachment.url]"
                    :href="attachmentUrls[attachment.url]"
                    :download="attachment.fileName"
                    class="flex min-h-20 items-center gap-2 rounded-xl bg-harbor-ink/[0.05] px-2.5 py-2 text-left text-harbor-ink transition-colors [@media(hover:hover)]:hover:bg-harbor-ink/[0.08]"
                  >
                    <FileText class="size-5 shrink-0" />
                    <span class="min-w-0 flex-1"
                      ><span class="block truncate text-xs font-semibold">{{ attachment.fileName }}</span
                      ><span class="block text-[0.6875rem] opacity-75"
                        >{{ fileExtension(attachment.fileName) }} · {{ formatFileSize(attachment.byteSize) }}</span
                      ></span
                    >
                    <Download class="size-4 shrink-0" />
                  </a>
                  <button
                    v-else
                    type="button"
                    class="flex min-h-20 items-center gap-2 rounded-xl bg-harbor-ink/[0.05] px-2.5 py-2 text-left text-harbor-ink"
                    :aria-label="`Load ${attachment.fileName}`"
                    @click="loadAttachment(attachment.url)"
                  >
                    <LoadingRipple
                      v-if="isPdf(attachment.contentType) && isAttachmentLoading(attachment.url)"
                      class="size-5"
                    />
                    <FileText v-else class="size-5 shrink-0" />
                    <span class="min-w-0 flex-1"
                      ><span class="block truncate text-xs font-semibold">{{ attachment.fileName }}</span
                      ><span class="block text-[0.6875rem] opacity-75"
                        >{{ fileExtension(attachment.fileName) }} · {{ formatFileSize(attachment.byteSize) }}</span
                      ></span
                    >
                  </button>
                </template>
                <button
                  v-if="hiddenAttachmentCount && !isImage(visibleAttachments[3]?.contentType ?? '')"
                  type="button"
                  class="flex min-h-20 items-center justify-center rounded-xl bg-harbor-ink/10 px-2 text-sm font-semibold text-harbor-ink"
                  @click="emit('preview', attachments, 4)"
                >
                  +{{ hiddenAttachmentCount }} more files
                </button>
              </div>
              <MessageContent v-if="message.content" :content="message.content" />
              <time
                v-if="!voiceOnly"
                :datetime="message.createdAt"
                class="mt-0.5 block text-right text-[0.6875rem] tabular-nums text-harbor-muted"
                >{{ formatTime(message.createdAt) }}</time
              >
            </motion.article>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent data-message-menu class="min-w-56">
          <div class="flex items-center justify-between gap-1 px-1 pb-1" role="group" aria-label="React">
            <ContextMenuItem v-for="emoji in QUICK_REACTIONS" :key="emoji" as-child @select="emit('react', emoji)">
              <button
                type="button"
                class="flex size-9 cursor-pointer items-center justify-center rounded-full text-lg transition-transform focus:bg-harbor-hover [@media(hover:hover)]:hover:scale-110 [@media(hover:hover)]:hover:bg-harbor-hover"
                :aria-label="`React with ${emoji}`"
              >
                {{ emoji }}
              </button>
            </ContextMenuItem>
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem v-if="canReply" @select="emit('reply')"><Reply />Reply</ContextMenuItem>
          <ContextMenuItem @select="emit('copy')"><Copy />Copy</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SwipeableRow>
    <!-- The picker floats over the list so opening it never shifts the messages around it. -->
    <AnimatePresence>
      <motion.div
        v-if="reactionPickerOpen"
        data-reaction-picker
        :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.8, y: first ? -8 : 8 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.85, y: first ? -6 : 6 }"
        :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 32 }"
        class="absolute z-20 flex items-center gap-0.5 rounded-full border border-harbor-line bg-white p-1 shadow-[0_12px_30px_rgba(17,27,33,0.16)]"
        :class="[
          first ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
          local ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
        ]"
        role="group"
        :aria-label="`React to ${local ? 'your' : `${message.senderName}'s`} message`"
      >
        <motion.button
          v-for="(emoji, index) in QUICK_REACTIONS"
          :key="emoji"
          type="button"
          :initial="prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.6 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :transition="
            prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 600, damping: 26, delay: index * 0.025 }
          "
          class="flex size-9 items-center justify-center rounded-full text-lg transition-colors active:scale-90 [@media(hover:hover)]:hover:scale-110"
          :class="myReactions.has(emoji) ? 'bg-harbor-line' : '[@media(hover:hover)]:hover:bg-harbor-hover'"
          :aria-label="myReactions.has(emoji) ? `Remove ${emoji} reaction` : `React with ${emoji}`"
          :aria-pressed="myReactions.has(emoji)"
          @click="emit('react', emoji)"
        >
          {{ emoji }}
        </motion.button>
      </motion.div>
    </AnimatePresence>
    <!-- Reactions tuck under the bubble's edge; the row grows and shrinks so later messages slide, not jump. -->
    <AnimatePresence>
      <motion.div
        v-if="reactions.length"
        data-reaction-row
        :initial="prefersReducedMotion ? false : { height: 0, marginTop: 0, marginBottom: 0, opacity: 0 }"
        :animate="{ height: 'auto', marginTop: -10, marginBottom: -4, opacity: 1 }"
        :exit="prefersReducedMotion ? undefined : { height: 0, marginTop: 0, marginBottom: 0, opacity: 0 }"
        :transition="
          prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }
        "
        class="relative z-10 max-w-[82%] overflow-hidden sm:max-w-[68%]"
      >
        <div class="flex flex-wrap gap-1 px-2 pb-1 pt-1" :class="local ? 'justify-end' : 'justify-start'">
          <!-- popLayout lifts a leaving chip out of the flow at once, so the remaining chips glide over. -->
          <AnimatePresence mode="popLayout">
            <motion.button
              v-for="reaction in reactions"
              :key="reaction.emoji"
              type="button"
              data-reaction-chip
              layout
              :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.5 }"
              :animate="{ opacity: 1, scale: 1 }"
              :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.5 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 28 }"
              class="inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums shadow-[0_1px_3px_rgba(16,47,53,0.12)] ring-2 ring-white"
              :class="
                reaction.reactedByMe ? 'bg-harbor-accent-soft text-harbor-ink' : 'bg-harbor-hover text-harbor-icon'
              "
              :aria-pressed="reaction.reactedByMe"
              :aria-label="`${reaction.emoji} ${reaction.count}${reaction.reactedByMe ? ', including you' : ''}`"
              @click="emit('react', reaction.emoji)"
            >
              <span class="text-[0.8125rem] leading-none">{{ reaction.emoji }}</span>
              <span v-if="reaction.count > 1">{{ reaction.count }}</span>
            </motion.button>
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.li>
</template>

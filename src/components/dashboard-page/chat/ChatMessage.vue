<script setup lang="ts">
import { Copy, Reply, SmilePlus } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed } from 'vue';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import type { ConversationMessage } from '@/services/social-api';

import { QUICK_REACTIONS } from './reactions';

const props = defineProps<{
  message: ConversationMessage;
  local: boolean;
  /** Follows a message from the same sender, so the name and spacing are tightened. */
  grouped: boolean;
  /** Group chats name the sender of incoming messages. */
  showSender: boolean;
  animateIn: boolean;
  highlighted: boolean;
  reactionPickerOpen: boolean;
  prefersReducedMotion: boolean;
  formatTime: (value: string) => string;
}>();
const emit = defineEmits<{
  (event: 'reply'): void;
  (event: 'react', emoji: string): void;
  (event: 'open-reactions'): void;
  (event: 'copy'): void;
  (event: 'jump-to', sequence: number): void;
}>();

// Swipes only need a short pull on a message; nothing rests open.
const SWIPE_DISTANCE = 56;

const reactions = computed(() => props.message.reactions ?? []);
// Only other people's messages can be quoted.
const canReply = computed(() => !props.local);
const initial = computed(() =>
  props.animateIn && !props.prefersReducedMotion
    ? props.local
      ? { opacity: 0, x: 14, y: 18, scale: 0.86 }
      : { opacity: 0, x: -10, y: 14, scale: 0.92 }
    : false,
);
</script>

<template>
  <motion.li
    :data-message-sequence="message.sequence"
    :initial="initial"
    :animate="{ opacity: 1, x: 0, y: 0, scale: 1 }"
    :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: 'easeOut' }"
    class="flex flex-col"
    :class="[local ? 'items-end' : 'items-start', grouped ? 'mt-0.5' : 'mt-3 first:mt-0']"
  >
    <SwipeableRow
      :id="`message-${message.sequence}`"
      class="w-full"
      :leading-width="canReply ? SWIPE_DISTANCE : 0"
      :trailing-width="SWIPE_DISTANCE"
      :full-swipe-distance="SWIPE_DISTANCE"
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
            :class="armed ? 'scale-110 bg-[#0B7A75] text-white' : 'bg-[#E6F4F1] text-[#0B7A75]'"
            ><Reply class="size-4"
          /></span>
        </span>
      </template>
      <template #trailing="{ armed }">
        <span class="flex flex-1 items-center justify-end pr-2" aria-hidden="true">
          <span
            class="flex size-8 items-center justify-center rounded-full transition-[transform,background-color,color] duration-150"
            :class="armed ? 'scale-110 bg-[#0B7A75] text-white' : 'bg-[#E6F4F1] text-[#0B7A75]'"
            ><SmilePlus class="size-4"
          /></span>
        </span>
      </template>
      <ContextMenu :press-open-delay="450">
        <ContextMenuTrigger as-child>
          <div class="flex w-full" :class="local ? 'justify-end' : 'justify-start'">
            <motion.article
              data-message-bubble
              :data-repliable="canReply"
              :animate="reactionPickerOpen ? { scale: 1.02, y: -2 } : { scale: 1, y: 0 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }"
              class="max-w-[82%] rounded-[1.15rem] px-3 pb-1.5 pt-2 text-[0.9375rem] sm:max-w-[68%] [@media(pointer:coarse)]:select-none"
              :class="[
                local ? 'bg-[#0B7A75] text-white' : 'border border-[#E4ECE9] bg-white text-[#102F35]',
                !grouped && (local ? 'rounded-br-md' : 'rounded-bl-md'),
                reactionPickerOpen
                  ? 'shadow-[0_14px_34px_rgba(16,47,53,0.18)]'
                  : 'shadow-[0_1px_2px_rgba(16,47,53,0.06)]',
                { 'harbor-message-flash': highlighted },
              ]"
            >
              <p v-if="showSender && !local && !grouped" class="mb-0.5 text-xs font-semibold text-[#0B7A75]">
                {{ message.senderName }}
                <span v-if="message.senderNickname" class="font-medium text-[#8A9C9E]"
                  >@{{ message.senderNickname }}</span
                >
              </p>
              <button
                v-if="message.replyTo"
                type="button"
                data-message-quote
                class="mb-1.5 mt-0.5 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left text-xs transition-colors"
                :class="
                  local
                    ? 'border-white/70 bg-white/15 text-white/85 [@media(hover:hover)]:hover:bg-white/20'
                    : 'border-[#0B7A75] bg-[#F3F5F4] text-[#5F7375] [@media(hover:hover)]:hover:bg-[#ECF0EF]'
                "
                :aria-label="`Show the message from ${message.replyTo.senderName}`"
                @click="emit('jump-to', message.replyTo.sequence)"
              >
                <span class="block font-semibold" :class="local ? 'text-white' : 'text-[#0B7A75]'">{{
                  message.replyTo.senderName
                }}</span>
                <span class="line-clamp-2 block">{{ message.replyTo.content }}</span>
              </button>
              <p class="whitespace-pre-wrap break-words leading-snug">{{ message.content }}</p>
              <time
                :datetime="message.createdAt"
                class="mt-0.5 block text-right text-[0.6875rem] tabular-nums"
                :class="local ? 'text-white/70' : 'text-[#8A9C9E]'"
                >{{ formatTime(message.createdAt) }}</time
              >
            </motion.article>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          data-message-menu
          class="harbor-action-menu min-w-56 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35]"
        >
          <div class="flex items-center justify-between gap-1 px-1 pb-1" role="group" aria-label="React">
            <ContextMenuItem v-for="emoji in QUICK_REACTIONS" :key="emoji" as-child @select="emit('react', emoji)">
              <button
                type="button"
                class="flex size-9 cursor-pointer items-center justify-center rounded-full text-lg transition-transform focus:bg-[#E6F4F1] [@media(hover:hover)]:hover:scale-110 [@media(hover:hover)]:hover:bg-[#E6F4F1]"
                :aria-label="`React with ${emoji}`"
              >
                {{ emoji }}
              </button>
            </ContextMenuItem>
          </div>
          <ContextMenuSeparator class="mx-1 my-1 bg-[#E5EFEC]" />
          <ContextMenuItem
            v-if="canReply"
            class="harbor-context-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
            @select="emit('reply')"
            ><Reply class="size-4" />Reply</ContextMenuItem
          >
          <ContextMenuItem
            class="harbor-context-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
            @select="emit('copy')"
            ><Copy class="size-4" />Copy</ContextMenuItem
          >
        </ContextMenuContent>
      </ContextMenu>
    </SwipeableRow>
    <AnimatePresence>
      <motion.div
        v-if="reactionPickerOpen"
        data-reaction-picker
        :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.85, y: -6 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9, y: -4 }"
        :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 30 }"
        class="mt-1.5 flex items-center gap-0.5 rounded-full border border-[#D8E7E3] bg-white p-1 shadow-[0_12px_30px_rgba(16,47,53,0.16)]"
        role="group"
        :aria-label="`React to ${local ? 'your' : `${message.senderName}'s`} message`"
      >
        <button
          v-for="emoji in QUICK_REACTIONS"
          :key="emoji"
          type="button"
          class="flex size-9 items-center justify-center rounded-full text-lg transition-transform active:scale-90 [@media(hover:hover)]:hover:scale-110 [@media(hover:hover)]:hover:bg-[#E6F4F1]"
          :aria-label="`React with ${emoji}`"
          @click="emit('react', emoji)"
        >
          {{ emoji }}
        </button>
      </motion.div>
    </AnimatePresence>
    <div v-if="reactions.length" class="mt-1 flex flex-wrap gap-1" :class="local ? 'justify-end' : 'justify-start'">
      <AnimatePresence>
        <motion.button
          v-for="reaction in reactions"
          :key="reaction.emoji"
          type="button"
          data-reaction-chip
          :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.6 }"
          :animate="{ opacity: 1, scale: 1 }"
          :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.6 }"
          :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 28 }"
          class="inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold"
          :class="
            reaction.reactedByMe
              ? 'border-[#9BCFC7] bg-[#E6F4F1] text-[#102F35]'
              : 'border-transparent bg-[#EEF2F1] text-[#4E6B70]'
          "
          :aria-pressed="reaction.reactedByMe"
          :aria-label="`${reaction.emoji} ${reaction.count}${reaction.reactedByMe ? ', including you' : ''}`"
          @click="emit('react', reaction.emoji)"
        >
          <span class="text-sm">{{ reaction.emoji }}</span
          >{{ reaction.count }}
        </motion.button>
      </AnimatePresence>
    </div>
  </motion.li>
</template>

<script setup lang="ts">
import { Copy, CornerUpLeft, Reply, SmilePlus } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref } from 'vue';

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
  /** The first visible message opens its reaction picker below, so the list edge cannot clip it. */
  first?: boolean;
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
const isMenuOpen = ref(false);
// A message is lifted while it is the target of a reaction picker or its own menu.
const isLifted = computed(() => props.reactionPickerOpen || isMenuOpen.value);
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
    class="relative flex flex-col"
    :class="[local ? 'items-end' : 'items-start', grouped ? 'mt-0.5' : 'mt-3 first:mt-0', { 'mb-2': reactions.length }]"
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
                local ? 'bg-[#0B7A75] text-white' : 'bg-white text-[#102F35]',
                !grouped && (local ? 'rounded-br-md' : 'rounded-bl-md'),
                isLifted ? 'harbor-message-lifted' : 'harbor-message-resting',
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
                class="mb-1.5 mt-0.5 block w-full rounded-xl px-2.5 py-2 text-left text-xs transition-colors"
                :class="
                  local
                    ? 'bg-white/[0.14] text-white/80 [@media(hover:hover)]:hover:bg-white/20'
                    : 'bg-[#F1F4F3] text-[#61777B] [@media(hover:hover)]:hover:bg-[#EAEFED]'
                "
                :aria-label="`Show the message from ${message.replyTo.senderName}`"
                @click="emit('jump-to', message.replyTo.sequence)"
              >
                <span
                  class="mb-0.5 flex items-center gap-1 font-semibold"
                  :class="local ? 'text-white' : 'text-[#27595D]'"
                  ><CornerUpLeft class="size-3 shrink-0" />{{ message.replyTo.senderName }}</span
                >
                <span class="line-clamp-2 block leading-snug">{{ message.replyTo.content }}</span>
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
    <!-- The picker floats over the list so opening it never shifts the messages around it. -->
    <AnimatePresence>
      <motion.div
        v-if="reactionPickerOpen"
        data-reaction-picker
        :initial="prefersReducedMotion ? false : { opacity: 0, scale: 0.8, y: first ? -8 : 8 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="prefersReducedMotion ? undefined : { opacity: 0, scale: 0.85, y: first ? -6 : 6 }"
        :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 32 }"
        class="absolute z-20 flex items-center gap-0.5 rounded-full border border-[#E4ECE9] bg-white p-1 shadow-[0_12px_30px_rgba(16,47,53,0.18)]"
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
          class="flex size-9 items-center justify-center rounded-full text-lg active:scale-90 [@media(hover:hover)]:hover:scale-110 [@media(hover:hover)]:hover:bg-[#E6F4F1]"
          :aria-label="`React with ${emoji}`"
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
        :initial="prefersReducedMotion ? false : { height: 0, opacity: 0 }"
        :animate="{ height: 'auto', opacity: 1 }"
        :exit="prefersReducedMotion ? undefined : { height: 0, opacity: 0 }"
        :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }"
        class="relative z-10 -mt-1.5 flex max-w-[82%] flex-wrap gap-1 px-2 sm:max-w-[68%]"
        :class="local ? 'justify-end' : 'justify-start'"
      >
        <AnimatePresence>
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
            :class="reaction.reactedByMe ? 'bg-[#E6F4F1] text-[#102F35]' : 'bg-[#F1F4F3] text-[#4E6B70]'"
            :aria-pressed="reaction.reactedByMe"
            :aria-label="`${reaction.emoji} ${reaction.count}${reaction.reactedByMe ? ', including you' : ''}`"
            @click="emit('react', reaction.emoji)"
          >
            <span class="text-[0.8125rem] leading-none">{{ reaction.emoji }}</span>
            <span v-if="reaction.count > 1">{{ reaction.count }}</span>
          </motion.button>
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  </motion.li>
</template>

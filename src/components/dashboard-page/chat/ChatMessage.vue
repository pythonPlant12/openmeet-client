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
    :class="local ? 'items-end' : 'items-start'"
  >
    <SwipeableRow
      :id="`message-${message.sequence}`"
      class="w-full"
      :leading-width="SWIPE_DISTANCE"
      :trailing-width="SWIPE_DISTANCE"
      :full-swipe-distance="SWIPE_DISTANCE"
      full-swipe-leading
      full-swipe-trailing
      momentary
      @full-swipe-leading="emit('reply')"
      @full-swipe-trailing="emit('open-reactions')"
    >
      <template #leading="{ armed }">
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
              :animate="reactionPickerOpen ? { scale: 1.02, y: -2 } : { scale: 1, y: 0 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }"
              class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[70%] [@media(pointer:coarse)]:select-none"
              :class="[
                local
                  ? 'rounded-br-md bg-[#0B7A75] text-white'
                  : 'rounded-bl-md border border-[#D8E7E3] bg-[#F6FAF7] text-[#102F35]',
                reactionPickerOpen ? 'shadow-[0_14px_34px_rgba(16,47,53,0.18)]' : 'shadow-sm',
                { 'harbor-message-flash': highlighted },
              ]"
            >
              <button
                v-if="message.replyTo"
                type="button"
                data-message-quote
                class="mb-2 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left text-xs"
                :class="
                  local ? 'border-white/70 bg-white/15 text-white/90' : 'border-[#0B7A75] bg-[#E6F4F1] text-[#27595D]'
                "
                :aria-label="`Show the message from ${message.replyTo.senderName}`"
                @click="emit('jump-to', message.replyTo.sequence)"
              >
                <span class="block font-semibold">{{ message.replyTo.senderName }}</span>
                <span class="line-clamp-2 block">{{ message.replyTo.content }}</span>
              </button>
              <div class="mb-1 flex items-center gap-2 text-xs" :class="local ? 'text-white/80' : 'text-[#61777B]'">
                <span class="font-semibold">{{ local ? 'You' : message.senderName }}</span>
                <span v-if="!local && message.senderNickname">@{{ message.senderNickname }}</span>
                <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
              </div>
              <p class="whitespace-pre-wrap break-words leading-5">{{ message.content }}</p>
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
              ? 'border-[#0B7A75] bg-[#E6F4F1] text-[#102F35]'
              : 'border-[#D8E7E3] bg-white text-[#27595D]'
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
